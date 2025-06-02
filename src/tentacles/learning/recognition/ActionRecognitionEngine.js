/**
 * @fileoverview ActionRecognitionEngine for the Learning from Demonstration system.
 * Analyzes captured actions to identify patterns, sequences, and meaningful operations.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require('../common/events/EventBus');
const Logger = require('../common/utils/Logger');
const Configuration = require('../common/utils/Configuration');
const { LearningError, ValidationError, OperationError } = require('../common/utils/ErrorHandler');
const Action = require('../common/models/Action');
const Intent = require('../common/models/Intent');
const { v4: uuidv4 } = require('uuid');

/**
 * Analyzes captured actions to identify patterns, sequences, and meaningful operations.
 */
class ActionRecognitionEngine {
  /**
   * Creates a new ActionRecognitionEngine instance.
   * @param {Object} options - Engine options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger('ActionRecognitionEngine');
    this.config = options.config || new Configuration(ActionRecognitionEngine.defaultConfig());
    
    this.recognizers = new Map();
    this.patterns = new Map();
    this.recognitionCache = new Map();
    
    this._setupEventListeners();
    this.logger.info('ActionRecognitionEngine initialized');
  }

  /**
   * Default configuration for the ActionRecognitionEngine.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      recognition: {
        patternThreshold: 0.7, // Minimum confidence for pattern recognition
        sequenceMaxGap: 2000, // Maximum milliseconds between actions in a sequence
        minSequenceLength: 2, // Minimum actions in a sequence
        maxSequenceLength: 100, // Maximum actions in a sequence
        contextWindow: 5, // Number of surrounding actions to consider for context
        enableLearning: true, // Whether to learn new patterns over time
        enableAdaptation: true, // Whether to adapt to user behavior
        confidenceDecayRate: 0.01, // Rate at which confidence decays for unused patterns
        noiseFilteringLevel: 'medium', // 'none', 'low', 'medium', 'high'
        recognizers: {
          basic: {
            enabled: true,
            weight: 1.0
          },
          semantic: {
            enabled: true,
            weight: 1.5
          },
          temporal: {
            enabled: true,
            weight: 1.2
          },
          spatial: {
            enabled: true,
            weight: 1.0
          },
          contextual: {
            enabled: true,
            weight: 1.3
          }
        }
      }
    };
  }

  /**
   * Registers a pattern recognizer.
   * @param {string} recognizerId - Unique identifier for the recognizer
   * @param {Object} recognizer - Pattern recognizer instance
   * @returns {ActionRecognitionEngine} This instance for chaining
   */
  registerRecognizer(recognizerId, recognizer) {
    if (!recognizerId || typeof recognizerId !== 'string') {
      throw new ValidationError('Recognizer ID is required and must be a string');
    }
    
    if (!recognizer || typeof recognizer !== 'object') {
      throw new ValidationError('Recognizer must be an object');
    }
    
    if (typeof recognizer.recognize !== 'function') {
      throw new ValidationError('Recognizer must implement recognize method');
    }
    
    this.recognizers.set(recognizerId, recognizer);
    this.logger.info(`Registered pattern recognizer: ${recognizerId}`);
    
    return this;
  }

  /**
   * Unregisters a pattern recognizer.
   * @param {string} recognizerId - Unique identifier for the recognizer
   * @returns {boolean} True if recognizer was unregistered, false if not found
   */
  unregisterRecognizer(recognizerId) {
    const result = this.recognizers.delete(recognizerId);
    
    if (result) {
      this.logger.info(`Unregistered pattern recognizer: ${recognizerId}`);
    }
    
    return result;
  }

  /**
   * Registers a known pattern.
   * @param {string} patternId - Unique identifier for the pattern
   * @param {Object} pattern - Pattern definition
   * @returns {ActionRecognitionEngine} This instance for chaining
   */
  registerPattern(patternId, pattern) {
    if (!patternId || typeof patternId !== 'string') {
      throw new ValidationError('Pattern ID is required and must be a string');
    }
    
    if (!pattern || typeof pattern !== 'object') {
      throw new ValidationError('Pattern must be an object');
    }
    
    if (!pattern.name || typeof pattern.name !== 'string') {
      throw new ValidationError('Pattern name is required and must be a string');
    }
    
    if (!pattern.type || typeof pattern.type !== 'string') {
      throw new ValidationError('Pattern type is required and must be a string');
    }
    
    if (!pattern.signature || !Array.isArray(pattern.signature)) {
      throw new ValidationError('Pattern signature is required and must be an array');
    }
    
    this.patterns.set(patternId, {
      ...pattern,
      confidence: pattern.confidence || 1.0,
      usageCount: pattern.usageCount || 0,
      lastUsed: pattern.lastUsed || new Date()
    });
    
    this.logger.info(`Registered pattern: ${patternId} (${pattern.name})`);
    
    return this;
  }

  /**
   * Unregisters a known pattern.
   * @param {string} patternId - Unique identifier for the pattern
   * @returns {boolean} True if pattern was unregistered, false if not found
   */
  unregisterPattern(patternId) {
    const result = this.patterns.delete(patternId);
    
    if (result) {
      this.logger.info(`Unregistered pattern: ${patternId}`);
    }
    
    return result;
  }

  /**
   * Analyzes a demonstration to recognize patterns and infer intent.
   * @param {Object} demonstration - Demonstration to analyze
   * @param {Object} [options={}] - Analysis options
   * @param {boolean} [options.inferIntent=true] - Whether to infer intent
   * @param {boolean} [options.learnPatterns=true] - Whether to learn new patterns
   * @param {boolean} [options.useCache=true] - Whether to use recognition cache
   * @returns {Promise<Object>} Promise resolving to analysis results
   */
  async analyzeActions(demonstration, options = {}) {
    if (!demonstration || !demonstration.id || !Array.isArray(demonstration.actions)) {
      throw new ValidationError('Invalid demonstration object');
    }
    
    const demonstrationId = demonstration.id;
    const actions = demonstration.actions;
    
    if (actions.length === 0) {
      return {
        demonstrationId,
        patterns: [],
        sequences: [],
        intent: null
      };
    }
    
    const inferIntent = options.inferIntent !== false;
    const learnPatterns = options.learnPatterns !== false && this.config.get('recognition.enableLearning');
    const useCache = options.useCache !== false;
    
    // Check cache first if enabled
    if (useCache && this.recognitionCache.has(demonstrationId)) {
      const cachedResult = this.recognitionCache.get(demonstrationId);
      this.logger.debug(`Using cached analysis for demonstration: ${demonstrationId}`);
      return cachedResult;
    }
    
    this.logger.info(`Analyzing demonstration: ${demonstrationId} (${actions.length} actions)`);
    
    try {
      // Prepare actions for analysis
      const preparedActions = this._prepareActionsForAnalysis(actions);
      
      // Recognize patterns using all registered recognizers
      const patternResults = await this._recognizePatterns(preparedActions);
      
      // Identify sequences of actions
      const sequences = this._identifySequences(preparedActions, patternResults);
      
      // Infer intent if requested
      let intent = null;
      if (inferIntent && sequences.length > 0) {
        intent = await this._inferIntent(sequences, demonstration);
      }
      
      // Learn new patterns if enabled
      if (learnPatterns && sequences.length > 0) {
        await this._learnNewPatterns(sequences, demonstration);
      }
      
      // Prepare result
      const result = {
        demonstrationId,
        patterns: patternResults,
        sequences,
        intent
      };
      
      // Cache result
      this.recognitionCache.set(demonstrationId, result);
      
      this.logger.info(`Analysis complete for demonstration: ${demonstrationId}`, {
        patternCount: patternResults.length,
        sequenceCount: sequences.length,
        hasIntent: !!intent
      });
      
      this.eventBus.emit('recognition:complete', {
        demonstrationId,
        patternCount: patternResults.length,
        sequenceCount: sequences.length,
        hasIntent: !!intent
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze demonstration: ${demonstrationId}`, error);
      this.eventBus.emit('recognition:error', { demonstrationId, error });
      throw error;
    }
  }

  /**
   * Gets all registered patterns.
   * @returns {Array<Object>} Array of patterns
   */
  getAllPatterns() {
    return Array.from(this.patterns.values());
  }

  /**
   * Gets a pattern by ID.
   * @param {string} patternId - Pattern ID
   * @returns {Object|null} Pattern or null if not found
   */
  getPattern(patternId) {
    return this.patterns.get(patternId) || null;
  }

  /**
   * Clears the recognition cache.
   * @param {string} [demonstrationId] - Optional demonstration ID to clear specific cache
   * @returns {ActionRecognitionEngine} This instance for chaining
   */
  clearCache(demonstrationId) {
    if (demonstrationId) {
      this.recognitionCache.delete(demonstrationId);
      this.logger.debug(`Cleared cache for demonstration: ${demonstrationId}`);
    } else {
      this.recognitionCache.clear();
      this.logger.debug('Cleared entire recognition cache');
    }
    
    return this;
  }

  /**
   * Prepares actions for analysis by filtering noise and normalizing data.
   * @param {Array<Object>} actions - Actions to prepare
   * @returns {Array<Object>} Prepared actions
   * @private
   */
  _prepareActionsForAnalysis(actions) {
    // Sort actions by timestamp
    const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp);
    
    // Filter noise based on configuration
    const noiseLevel = this.config.get('recognition.noiseFilteringLevel', 'medium');
    let filteredActions = sortedActions;
    
    if (noiseLevel !== 'none') {
      filteredActions = this._filterNoise(sortedActions, noiseLevel);
    }
    
    // Normalize action data for consistent analysis
    return filteredActions.map(action => this._normalizeAction(action));
  }

  /**
   * Filters noise from actions based on the specified level.
   * @param {Array<Object>} actions - Actions to filter
   * @param {string} level - Noise filtering level ('low', 'medium', 'high')
   * @returns {Array<Object>} Filtered actions
   * @private
   */
  _filterNoise(actions, level) {
    if (actions.length <= 1) {
      return actions;
    }
    
    let result = [...actions];
    
    // Apply different filtering strategies based on level
    switch (level) {
      case 'low':
        // Basic filtering: Remove duplicate consecutive mouse moves
        result = this._filterConsecutiveDuplicates(result);
        break;
        
      case 'medium':
        // Medium filtering: Remove duplicates and reduce mouse move density
        result = this._filterConsecutiveDuplicates(result);
        result = this._reduceMouseMoveDensity(result);
        break;
        
      case 'high':
        // High filtering: Aggressive noise reduction
        result = this._filterConsecutiveDuplicates(result);
        result = this._reduceMouseMoveDensity(result, 20); // Higher threshold
        result = this._filterLowConfidenceActions(result, 0.5); // Remove low confidence
        break;
    }
    
    this.logger.debug(`Noise filtering (${level}) reduced actions from ${actions.length} to ${result.length}`);
    
    return result;
  }

  /**
   * Filters consecutive duplicate actions.
   * @param {Array<Object>} actions - Actions to filter
   * @returns {Array<Object>} Filtered actions
   * @private
   */
  _filterConsecutiveDuplicates(actions) {
    if (actions.length <= 1) {
      return actions;
    }
    
    const result = [actions[0]];
    
    for (let i = 1; i < actions.length; i++) {
      const current = actions[i];
      const previous = actions[i - 1];
      
      // Skip duplicate mouse moves
      if (current.type === Action.TYPES.MOUSE_MOVE && previous.type === Action.TYPES.MOUSE_MOVE) {
        const currentX = current.data.x;
        const currentY = current.data.y;
        const previousX = previous.data.x;
        const previousY = previous.data.y;
        
        // Skip if position is very close to previous
        if (Math.abs(currentX - previousX) < 5 && Math.abs(currentY - previousY) < 5) {
          continue;
        }
      }
      
      result.push(current);
    }
    
    return result;
  }

  /**
   * Reduces the density of mouse move actions.
   * @param {Array<Object>} actions - Actions to filter
   * @param {number} [threshold=10] - Minimum pixel distance between moves
   * @returns {Array<Object>} Filtered actions
   * @private
   */
  _reduceMouseMoveDensity(actions, threshold = 10) {
    if (actions.length <= 1) {
      return actions;
    }
    
    const result = [];
    let lastMouseMove = null;
    
    for (const action of actions) {
      // Keep non-mouse-move actions
      if (action.type !== Action.TYPES.MOUSE_MOVE) {
        result.push(action);
        continue;
      }
      
      // For mouse moves, check distance from last recorded mouse move
      if (!lastMouseMove) {
        result.push(action);
        lastMouseMove = action;
        continue;
      }
      
      const distance = Math.sqrt(
        Math.pow(action.data.x - lastMouseMove.data.x, 2) +
        Math.pow(action.data.y - lastMouseMove.data.y, 2)
      );
      
      if (distance >= threshold) {
        result.push(action);
        lastMouseMove = action;
      }
    }
    
    return result;
  }

  /**
   * Filters actions with confidence below the specified threshold.
   * @param {Array<Object>} actions - Actions to filter
   * @param {number} threshold - Minimum confidence threshold
   * @returns {Array<Object>} Filtered actions
   * @private
   */
  _filterLowConfidenceActions(actions, threshold) {
    return actions.filter(action => action.confidence >= threshold);
  }

  /**
   * Normalizes an action for consistent analysis.
   * @param {Object} action - Action to normalize
   * @returns {Object} Normalized action
   * @private
   */
  _normalizeAction(action) {
    // Create a copy to avoid modifying the original
    const normalized = { ...action };
    
    // Ensure data is an object
    normalized.data = normalized.data || {};
    
    // Normalize specific action types
    switch (normalized.type) {
      case Action.TYPES.MOUSE_MOVE:
        // Round coordinates to integers
        if (normalized.data.x !== undefined) {
          normalized.data.x = Math.round(normalized.data.x);
        }
        if (normalized.data.y !== undefined) {
          normalized.data.y = Math.round(normalized.data.y);
        }
        break;
        
      case Action.TYPES.KEY_PRESS:
        // Normalize key names to lowercase
        if (normalized.data.key) {
          normalized.data.key = normalized.data.key.toLowerCase();
        }
        break;
        
      case Action.TYPES.TEXT_INPUT:
        // Ensure text is a string
        if (normalized.data.text) {
          normalized.data.text = String(normalized.data.text);
        }
        break;
    }
    
    return normalized;
  }

  /**
   * Recognizes patterns in the prepared actions using all registered recognizers.
   * @param {Array<Object>} actions - Prepared actions
   * @returns {Promise<Array<Object>>} Promise resolving to recognized patterns
   * @private
   */
  async _recognizePatterns(actions) {
    if (actions.length === 0) {
      return [];
    }
    
    const patternResults = [];
    const patternThreshold = this.config.get('recognition.patternThreshold');
    
    // Get enabled recognizers and their weights
    const enabledRecognizers = [];
    for (const [recognizerId, recognizer] of this.recognizers) {
      const recognizerConfig = this.config.scope(`recognition.recognizers.${recognizerId}`);
      
      if (recognizerConfig.get('enabled', true)) {
        enabledRecognizers.push({
          id: recognizerId,
          recognizer,
          weight: recognizerConfig.get('weight', 1.0)
        });
      }
    }
    
    if (enabledRecognizers.length === 0) {
      this.logger.warn('No enabled recognizers found');
      return [];
    }
    
    // Run each recognizer
    const recognizerResults = await Promise.all(
      enabledRecognizers.map(async ({ id, recognizer, weight }) => {
        try {
          const results = await recognizer.recognize(actions);
          
          // Apply weight to confidence scores
          return results.map(result => ({
            ...result,
            recognizerId: id,
            confidence: result.confidence * weight
          }));
        } catch (error) {
          this.logger.error(`Error in recognizer ${id}`, error);
          return [];
        }
      })
    );
    
    // Flatten and filter results
    const allResults = recognizerResults.flat();
    
    // Group by pattern ID and combine confidences
    const patternMap = new Map();
    
    for (const result of allResults) {
      const patternId = result.patternId;
      
      if (!patternMap.has(patternId)) {
        patternMap.set(patternId, {
          patternId,
          confidence: result.confidence,
          occurrences: [result]
        });
      } else {
        const existing = patternMap.get(patternId);
        existing.confidence = Math.max(existing.confidence, result.confidence);
        existing.occurrences.push(result);
      }
    }
    
    // Convert to array and filter by threshold
    for (const [patternId, result] of patternMap) {
      if (result.confidence >= patternThreshold) {
        // Get pattern details
        const pattern = this.patterns.get(patternId);
        
        if (pattern) {
          // Update pattern usage statistics
          pattern.usageCount++;
          pattern.lastUsed = new Date();
          
          patternResults.push({
            ...result,
            name: pattern.name,
            type: pattern.type,
            description: pattern.description
          });
        } else {
          // Pattern not registered but recognized
          patternResults.push(result);
        }
      }
    }
    
    return patternResults;
  }

  /**
   * Identifies sequences of actions based on patterns and temporal proximity.
   * @param {Array<Object>} actions - Prepared actions
   * @param {Array<Object>} patterns - Recognized patterns
   * @returns {Array<Object>} Identified sequences
   * @private
   */
  _identifySequences(actions, patterns) {
    if (actions.length === 0) {
      return [];
    }
    
    const sequences = [];
    const maxGap = this.config.get('recognition.sequenceMaxGap');
    const minLength = this.config.get('recognition.minSequenceLength');
    const maxLength = this.config.get('recognition.maxSequenceLength');
    
    // Start with pattern-based sequences
    for (const pattern of patterns) {
      for (const occurrence of pattern.occurrences) {
        if (occurrence.actionIndices && occurrence.actionIndices.length >= minLength) {
          // Get actions in this pattern occurrence
          const sequenceActions = occurrence.actionIndices
            .map(index => actions[index])
            .filter(Boolean);
          
          if (sequenceActions.length >= minLength) {
            sequences.push({
              id: uuidv4(),
              type: 'pattern',
              patternId: pattern.patternId,
              patternName: pattern.name,
              confidence: occurrence.confidence,
              actions: sequenceActions,
              startTime: sequenceActions[0].timestamp,
              endTime: sequenceActions[sequenceActions.length - 1].timestamp
            });
          }
        }
      }
    }
    
    // Identify temporal sequences (actions close in time)
    let currentSequence = [];
    let lastTimestamp = null;
    
    for (const action of actions) {
      if (lastTimestamp === null || action.timestamp - lastTimestamp <= maxGap) {
        currentSequence.push(action);
      } else {
        // Gap too large, end current sequence if long enough
        if (currentSequence.length >= minLength) {
          sequences.push({
            id: uuidv4(),
            type: 'temporal',
            confidence: 0.7, // Default confidence for temporal sequences
            actions: currentSequence,
            startTime: currentSequence[0].timestamp,
            endTime: currentSequence[currentSequence.length - 1].timestamp
          });
        }
        
        // Start new sequence
        currentSequence = [action];
      }
      
      lastTimestamp = action.timestamp;
    }
    
    // Add final sequence if long enough
    if (currentSequence.length >= minLength) {
      sequences.push({
        id: uuidv4(),
        type: 'temporal',
        confidence: 0.7, // Default confidence for temporal sequences
        actions: currentSequence,
        startTime: currentSequence[0].timestamp,
        endTime: currentSequence[currentSequence.length - 1].timestamp
      });
    }
    
    // Limit sequence length
    for (const sequence of sequences) {
      if (sequence.actions.length > maxLength) {
        sequence.actions = sequence.actions.slice(0, maxLength);
        sequence.endTime = sequence.actions[sequence.actions.length - 1].timestamp;
      }
    }
    
    return sequences;
  }

  /**
   * Infers intent from identified sequences and demonstration context.
   * @param {Array<Object>} sequences - Identified sequences
   * @param {Object} demonstration - Original demonstration
   * @returns {Promise<Intent|null>} Promise resolving to inferred intent or null
   * @private
   */
  async _inferIntent(sequences, demonstration) {
    if (sequences.length === 0) {
      return null;
    }
    
    // Find the sequence with highest confidence
    let bestSequence = sequences[0];
    for (const sequence of sequences) {
      if (sequence.confidence > bestSequence.confidence) {
        bestSequence = sequence;
      }
    }
    
    // Extract action IDs from the best sequence
    const actionIds = bestSequence.actions.map(action => action.id);
    
    // Determine intent type based on sequence
    let intentType = Intent.TYPES.CUSTOM;
    let intentName = 'Custom Action';
    let intentDescription = '';
    let intentConfidence = bestSequence.confidence;
    
    // Try to determine intent type from pattern
    if (bestSequence.type === 'pattern' && bestSequence.patternId) {
      const pattern = this.patterns.get(bestSequence.patternId);
      
      if (pattern) {
        intentType = pattern.intentType || intentType;
        intentName = pattern.intentName || bestSequence.patternName || intentName;
        intentDescription = pattern.intentDescription || intentDescription;
      }
    } else {
      // Analyze sequence to determine intent type
      intentType = this._determineIntentType(bestSequence.actions);
      intentName = this._generateIntentName(intentType, bestSequence.actions);
      intentDescription = this._generateIntentDescription(intentType, bestSequence.actions);
    }
    
    // Create intent object
    const intent = new Intent({
      id: uuidv4(),
      type: intentType,
      name: intentName,
      description: intentDescription,
      confidence: intentConfidence,
      parameters: this._extractIntentParameters(bestSequence.actions, intentType),
      relatedActionIds: actionIds
    });
    
    // Update context with demonstration metadata
    if (demonstration.metadata) {
      intent.updateContext({
        demonstrationId: demonstration.id,
        demonstrationName: demonstration.name,
        demonstrationMetadata: demonstration.metadata
      });
    }
    
    this.logger.info(`Inferred intent: ${intent.name} (${intent.type}) with confidence ${intent.confidence}`);
    
    return intent;
  }

  /**
   * Determines the intent type from a sequence of actions.
   * @param {Array<Object>} actions - Sequence actions
   * @returns {string} Intent type
   * @private
   */
  _determineIntentType(actions) {
    // Count action types
    const typeCounts = {};
    for (const action of actions) {
      typeCounts[action.type] = (typeCounts[action.type] || 0) + 1;
    }
    
    // Check for UI interactions
    const uiInteractions = actions.filter(a => a.type === Action.TYPES.UI_INTERACTION);
    if (uiInteractions.length > 0) {
      // Check for form filling
      const textInputs = actions.filter(a => 
        a.type === Action.TYPES.TEXT_INPUT || 
        (a.type === Action.TYPES.UI_INTERACTION && a.data.action === 'input')
      );
      
      if (textInputs.length > 0) {
        return Intent.TYPES.DATA_ENTRY;
      }
      
      // Check for navigation
      const navigationActions = uiInteractions.filter(a => 
        a.data.action === 'click' && 
        (a.data.elementType === 'a' || a.data.elementType === 'button')
      );
      
      if (navigationActions.length > 0) {
        return Intent.TYPES.NAVIGATION;
      }
      
      // Check for selection
      const selectionActions = uiInteractions.filter(a => 
        a.data.action === 'select' || 
        a.data.elementType === 'checkbox' || 
        a.data.elementType === 'radio'
      );
      
      if (selectionActions.length > 0) {
        return Intent.TYPES.SELECTION;
      }
    }
    
    // Check for file operations
    const fileOperations = actions.filter(a => 
      a.type === Action.TYPES.SYSTEM_EVENT && 
      a.data.category === 'file'
    );
    
    if (fileOperations.length > 0) {
      return Intent.TYPES.FILE_OPERATION;
    }
    
    // Check for search
    const searchActions = actions.filter(a => 
      (a.type === Action.TYPES.TEXT_INPUT && a.data.text.length > 0) ||
      (a.type === Action.TYPES.UI_INTERACTION && a.data.elementType === 'search')
    );
    
    if (searchActions.length > 0) {
      return Intent.TYPES.SEARCH;
    }
    
    // Default to custom
    return Intent.TYPES.CUSTOM;
  }

  /**
   * Generates an intent name based on type and actions.
   * @param {string} intentType - Intent type
   * @param {Array<Object>} actions - Sequence actions
   * @returns {string} Generated intent name
   * @private
   */
  _generateIntentName(intentType, actions) {
    switch (intentType) {
      case Intent.TYPES.NAVIGATION:
        return 'Navigate to Page';
        
      case Intent.TYPES.DATA_ENTRY:
        return 'Enter Form Data';
        
      case Intent.TYPES.DATA_RETRIEVAL:
        return 'Retrieve Information';
        
      case Intent.TYPES.FILE_OPERATION:
        return 'Perform File Operation';
        
      case Intent.TYPES.SEARCH:
        return 'Search for Content';
        
      case Intent.TYPES.SELECTION:
        return 'Select Items';
        
      default:
        return 'Perform Action Sequence';
    }
  }

  /**
   * Generates an intent description based on type and actions.
   * @param {string} intentType - Intent type
   * @param {Array<Object>} actions - Sequence actions
   * @returns {string} Generated intent description
   * @private
   */
  _generateIntentDescription(intentType, actions) {
    const actionCount = actions.length;
    
    switch (intentType) {
      case Intent.TYPES.NAVIGATION:
        return `Navigate through the interface using ${actionCount} actions`;
        
      case Intent.TYPES.DATA_ENTRY:
        return `Enter data into a form using ${actionCount} actions`;
        
      case Intent.TYPES.DATA_RETRIEVAL:
        return `Retrieve information from the system using ${actionCount} actions`;
        
      case Intent.TYPES.FILE_OPERATION:
        return `Perform operations on files using ${actionCount} actions`;
        
      case Intent.TYPES.SEARCH:
        return `Search for specific content using ${actionCount} actions`;
        
      case Intent.TYPES.SELECTION:
        return `Select specific items using ${actionCount} actions`;
        
      default:
        return `Perform a sequence of ${actionCount} actions`;
    }
  }

  /**
   * Extracts parameters from actions based on intent type.
   * @param {Array<Object>} actions - Sequence actions
   * @param {string} intentType - Intent type
   * @returns {Object} Extracted parameters
   * @private
   */
  _extractIntentParameters(actions, intentType) {
    const parameters = {};
    
    switch (intentType) {
      case Intent.TYPES.NAVIGATION:
        // Extract target URL or page
        const navigationActions = actions.filter(a => 
          a.type === Action.TYPES.UI_INTERACTION && 
          a.data.elementType === 'a'
        );
        
        if (navigationActions.length > 0) {
          const lastNav = navigationActions[navigationActions.length - 1];
          if (lastNav.data.elementProperties && lastNav.data.elementProperties.href) {
            parameters.targetUrl = lastNav.data.elementProperties.href;
          }
        }
        break;
        
      case Intent.TYPES.DATA_ENTRY:
        // Extract form fields and values
        const formFields = {};
        const textInputs = actions.filter(a => a.type === Action.TYPES.TEXT_INPUT);
        
        for (const input of textInputs) {
          if (input.data.target && input.data.target.id) {
            formFields[input.data.target.id] = input.data.text;
          }
        }
        
        if (Object.keys(formFields).length > 0) {
          parameters.formFields = formFields;
        }
        break;
        
      case Intent.TYPES.SEARCH:
        // Extract search query
        const searchInputs = actions.filter(a => a.type === Action.TYPES.TEXT_INPUT);
        
        if (searchInputs.length > 0) {
          const lastSearch = searchInputs[searchInputs.length - 1];
          parameters.searchQuery = lastSearch.data.text;
        }
        break;
    }
    
    return parameters;
  }

  /**
   * Learns new patterns from identified sequences.
   * @param {Array<Object>} sequences - Identified sequences
   * @param {Object} demonstration - Original demonstration
   * @returns {Promise<void>} Promise resolving when learning is complete
   * @private
   */
  async _learnNewPatterns(sequences, demonstration) {
    if (!this.config.get('recognition.enableLearning') || sequences.length === 0) {
      return;
    }
    
    // Find sequences that don't match existing patterns
    const newSequences = sequences.filter(sequence => 
      sequence.type === 'temporal' || !this.patterns.has(sequence.patternId)
    );
    
    if (newSequences.length === 0) {
      return;
    }
    
    this.logger.debug(`Learning from ${newSequences.length} new sequences`);
    
    // Process each new sequence
    for (const sequence of newSequences) {
      // Only learn from sequences with sufficient confidence
      if (sequence.confidence < this.config.get('recognition.patternThreshold')) {
        continue;
      }
      
      // Generate a signature for the sequence
      const signature = this._generatePatternSignature(sequence.actions);
      
      // Check if similar pattern already exists
      let isNew = true;
      for (const [patternId, pattern] of this.patterns) {
        if (this._compareSignatures(signature, pattern.signature) > 0.8) {
          isNew = false;
          break;
        }
      }
      
      if (isNew) {
        // Create a new pattern
        const patternId = uuidv4();
        const intentType = this._determineIntentType(sequence.actions);
        const patternName = this._generatePatternName(sequence.actions, intentType);
        
        this.registerPattern(patternId, {
          name: patternName,
          type: 'learned',
          signature,
          intentType,
          intentName: this._generateIntentName(intentType, sequence.actions),
          intentDescription: this._generateIntentDescription(intentType, sequence.actions),
          confidence: sequence.confidence * 0.9, // Slightly lower confidence for learned patterns
          source: {
            demonstrationId: demonstration.id,
            timestamp: new Date()
          }
        });
        
        this.logger.info(`Learned new pattern: ${patternName} (${patternId})`);
        this.eventBus.emit('pattern:learned', { patternId, patternName });
      }
    }
  }

  /**
   * Generates a pattern signature from a sequence of actions.
   * @param {Array<Object>} actions - Sequence actions
   * @returns {Array} Pattern signature
   * @private
   */
  _generatePatternSignature(actions) {
    return actions.map(action => {
      // Create a simplified representation for signature
      const base = {
        type: action.type
      };
      
      // Add type-specific signature elements
      switch (action.type) {
        case Action.TYPES.MOUSE_CLICK:
          return {
            ...base,
            button: action.data.button,
            doubleClick: action.data.doubleClick
          };
          
        case Action.TYPES.KEY_PRESS:
          return {
            ...base,
            key: action.data.key,
            modifiers: {
              ctrl: action.data.ctrl,
              alt: action.data.alt,
              shift: action.data.shift,
              meta: action.data.meta
            }
          };
          
        case Action.TYPES.UI_INTERACTION:
          return {
            ...base,
            elementType: action.data.elementType,
            action: action.data.action
          };
          
        default:
          return base;
      }
    });
  }

  /**
   * Compares two pattern signatures for similarity.
   * @param {Array} signature1 - First signature
   * @param {Array} signature2 - Second signature
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _compareSignatures(signature1, signature2) {
    // Simple length comparison first
    if (Math.abs(signature1.length - signature2.length) > 2) {
      return 0;
    }
    
    // Compare each element
    const minLength = Math.min(signature1.length, signature2.length);
    let matchCount = 0;
    
    for (let i = 0; i < minLength; i++) {
      const elem1 = signature1[i];
      const elem2 = signature2[i];
      
      // Compare basic type
      if (elem1.type === elem2.type) {
        matchCount += 0.5;
        
        // Compare type-specific details
        switch (elem1.type) {
          case Action.TYPES.MOUSE_CLICK:
            if (elem1.button === elem2.button) {
              matchCount += 0.25;
            }
            if (elem1.doubleClick === elem2.doubleClick) {
              matchCount += 0.25;
            }
            break;
            
          case Action.TYPES.KEY_PRESS:
            if (elem1.key === elem2.key) {
              matchCount += 0.5;
            }
            break;
            
          case Action.TYPES.UI_INTERACTION:
            if (elem1.elementType === elem2.elementType) {
              matchCount += 0.25;
            }
            if (elem1.action === elem2.action) {
              matchCount += 0.25;
            }
            break;
        }
      }
    }
    
    // Calculate similarity score
    return matchCount / minLength;
  }

  /**
   * Generates a pattern name from actions and intent type.
   * @param {Array<Object>} actions - Sequence actions
   * @param {string} intentType - Intent type
   * @returns {string} Generated pattern name
   * @private
   */
  _generatePatternName(actions, intentType) {
    const prefix = this._getPatternNamePrefix(intentType);
    const suffix = this._getPatternNameSuffix(actions);
    
    return `${prefix} ${suffix}`;
  }

  /**
   * Gets a pattern name prefix based on intent type.
   * @param {string} intentType - Intent type
   * @returns {string} Pattern name prefix
   * @private
   */
  _getPatternNamePrefix(intentType) {
    switch (intentType) {
      case Intent.TYPES.NAVIGATION:
        return 'Navigation';
        
      case Intent.TYPES.DATA_ENTRY:
        return 'Form Filling';
        
      case Intent.TYPES.DATA_RETRIEVAL:
        return 'Data Retrieval';
        
      case Intent.TYPES.FILE_OPERATION:
        return 'File Operation';
        
      case Intent.TYPES.SEARCH:
        return 'Search';
        
      case Intent.TYPES.SELECTION:
        return 'Selection';
        
      default:
        return 'Action Sequence';
    }
  }

  /**
   * Gets a pattern name suffix based on actions.
   * @param {Array<Object>} actions - Sequence actions
   * @returns {string} Pattern name suffix
   * @private
   */
  _getPatternNameSuffix(actions) {
    // Look for distinctive actions
    const uiInteractions = actions.filter(a => a.type === Action.TYPES.UI_INTERACTION);
    
    if (uiInteractions.length > 0) {
      // Try to find a form or element name
      for (const action of uiInteractions) {
        if (action.data.elementProperties) {
          if (action.data.elementProperties.name) {
            return `for ${action.data.elementProperties.name}`;
          }
          if (action.data.elementProperties.id) {
            return `for ${action.data.elementProperties.id}`;
          }
        }
      }
    }
    
    // Default to action count
    return `(${actions.length} actions)`;
  }

  /**
   * Sets up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Listen for demonstration capture events
    this.eventBus.on('capture:stopped', async ({ demonstrationId, demonstration }) => {
      if (demonstration && this.config.get('recognition.enableLearning')) {
        try {
          this.logger.debug(`Auto-analyzing demonstration: ${demonstrationId}`);
          await this.analyzeActions(demonstration);
        } catch (error) {
          this.logger.error(`Failed to auto-analyze demonstration: ${demonstrationId}`, error);
        }
      }
    });
  }
}

module.exports = ActionRecognitionEngine;
