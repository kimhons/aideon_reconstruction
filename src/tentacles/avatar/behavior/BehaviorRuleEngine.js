/**
 * @fileoverview BehaviorRuleEngine evaluates and applies behavior rules based on interaction context,
 * providing a rule-based system for determining appropriate avatar behaviors.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Engine for evaluating and applying behavior rules
 */
class BehaviorRuleEngine {
  /**
   * Creates a new BehaviorRuleEngine instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('BehaviorRuleEngine');
    this.events = new EventEmitter();
    
    // Initialize rule collections
    this.rules = new Map();
    this.ruleCategories = new Map();
    this.priorityLevels = {
      CRITICAL: 100,
      HIGH: 75,
      MEDIUM: 50,
      LOW: 25,
      BACKGROUND: 10
    };
    
    // Initialize configuration
    this.config = {
      maxActiveRules: 10,
      minRuleConfidence: 0.6,
      enableConflictResolution: true,
      enableRuleChaining: true,
      offlineRuleEvaluation: true
    };
    
    this.isInitialized = false;
    
    this.logger.info('BehaviorRuleEngine created');
  }
  
  /**
   * Initializes the rule engine
   * 
   * @param {Object} [options] - Initialization options
   * @param {Array<Object>} [options.initialRules] - Initial rules to register
   * @param {Object} [options.configuration] - Engine configuration
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'rule_engine_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('BehaviorRuleEngine already initialized');
        return;
      }
      
      this.logger.info('Initializing BehaviorRuleEngine');
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Register initial rules if provided
      if (options.initialRules && Array.isArray(options.initialRules)) {
        for (const rule of options.initialRules) {
          await this._registerRuleInternal(rule);
        }
      }
      
      this.isInitialized = true;
      this.events.emit('initialized');
      this.logger.info('BehaviorRuleEngine initialized');
    } catch (error) {
      this.logger.error('Error initializing BehaviorRuleEngine', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Evaluates rules based on interaction data and context
   * 
   * @param {Object} interactionData - Interaction data
   * @param {Object} socialContext - Social context information
   * @param {Object} [options] - Evaluation options
   * @returns {Promise<Array<Object>>} Applicable rules with activation details
   */
  async evaluateRules(interactionData, socialContext, options = {}) {
    const lockKey = `evaluate_rules_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorRuleEngine not initialized');
      }
      
      this.logger.debug('Evaluating behavior rules', { 
        interactionTypes: Object.keys(interactionData),
        ruleCount: this.rules.size
      });
      
      // Step 1: Evaluate all rules and calculate confidence scores
      const evaluationResults = [];
      
      for (const [ruleId, rule] of this.rules.entries()) {
        // Skip disabled rules
        if (rule.disabled) {
          continue;
        }
        
        // Skip rules that don't apply to the current context
        if (!this._checkRuleContextApplicability(rule, socialContext)) {
          continue;
        }
        
        // Evaluate rule conditions
        const evaluationResult = await this._evaluateRuleConditions(
          rule,
          interactionData,
          socialContext
        );
        
        if (evaluationResult.confidence >= this.config.minRuleConfidence) {
          evaluationResults.push({
            rule,
            confidence: evaluationResult.confidence,
            priority: rule.priority || this.priorityLevels.MEDIUM,
            contextMatch: evaluationResult.contextMatch,
            conditionResults: evaluationResult.conditionResults
          });
        }
      }
      
      // Step 2: Sort by priority and confidence
      evaluationResults.sort((a, b) => {
        // First by priority (higher first)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by confidence (higher first)
        return b.confidence - a.confidence;
      });
      
      // Step 3: Resolve conflicts if enabled
      let applicableRules = evaluationResults;
      if (this.config.enableConflictResolution) {
        applicableRules = this._resolveRuleConflicts(applicableRules);
      }
      
      // Step 4: Limit to max active rules
      applicableRules = applicableRules.slice(0, this.config.maxActiveRules);
      
      // Step 5: Format the final result
      const result = applicableRules.map(item => ({
        id: item.rule.id,
        name: item.rule.name,
        category: item.rule.category,
        priority: item.priority,
        confidence: item.confidence,
        actions: item.rule.actions,
        metadata: {
          contextMatch: item.contextMatch,
          conditionResults: item.conditionResults
        }
      }));
      
      this.logger.debug('Rule evaluation complete', { 
        applicableRuleCount: result.length 
      });
      
      // Emit event for subscribers
      this.events.emit('rules_evaluated', result);
      
      return result;
    } catch (error) {
      this.logger.error('Error evaluating behavior rules', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Registers a new behavior rule
   * 
   * @param {Object} rule - Rule definition
   * @param {string} rule.id - Unique rule identifier
   * @param {string} rule.name - Human-readable rule name
   * @param {string} rule.category - Rule category
   * @param {number} [rule.priority] - Rule priority (higher values = higher priority)
   * @param {Array<Object>} rule.conditions - Rule conditions
   * @param {Array<Object>} rule.actions - Rule actions
   * @param {Object} [rule.metadata] - Additional rule metadata
   * @returns {Promise<Object>} Registered rule
   */
  async registerRule(rule) {
    const lockKey = `register_rule_${rule.id}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorRuleEngine not initialized');
      }
      
      this.logger.debug('Registering behavior rule', { ruleId: rule.id });
      
      // Validate rule structure
      this._validateRule(rule);
      
      // Register the rule
      const registeredRule = await this._registerRuleInternal(rule);
      
      // Emit event for subscribers
      this.events.emit('rule_registered', registeredRule);
      
      return registeredRule;
    } catch (error) {
      this.logger.error('Error registering behavior rule', { error, ruleId: rule.id });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates an existing behavior rule
   * 
   * @param {string} ruleId - Rule identifier
   * @param {Object} updates - Rule updates
   * @returns {Promise<Object>} Updated rule
   */
  async updateRule(ruleId, updates) {
    const lockKey = `update_rule_${ruleId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorRuleEngine not initialized');
      }
      
      this.logger.debug('Updating behavior rule', { ruleId });
      
      // Check if rule exists
      if (!this.rules.has(ruleId)) {
        throw new Error(`Rule with ID ${ruleId} not found`);
      }
      
      // Get existing rule
      const existingRule = this.rules.get(ruleId);
      
      // Create updated rule
      const updatedRule = {
        ...existingRule,
        ...updates,
        id: ruleId, // Ensure ID doesn't change
        lastUpdated: Date.now()
      };
      
      // Validate updated rule
      this._validateRule(updatedRule);
      
      // Update category mapping if category changed
      if (updates.category && updates.category !== existingRule.category) {
        // Remove from old category
        const oldCategoryRules = this.ruleCategories.get(existingRule.category) || [];
        this.ruleCategories.set(
          existingRule.category,
          oldCategoryRules.filter(id => id !== ruleId)
        );
        
        // Add to new category
        const newCategoryRules = this.ruleCategories.get(updates.category) || [];
        newCategoryRules.push(ruleId);
        this.ruleCategories.set(updates.category, newCategoryRules);
      }
      
      // Update rule in storage
      this.rules.set(ruleId, updatedRule);
      
      // Emit event for subscribers
      this.events.emit('rule_updated', updatedRule);
      
      return updatedRule;
    } catch (error) {
      this.logger.error('Error updating behavior rule', { error, ruleId });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Deletes a behavior rule
   * 
   * @param {string} ruleId - Rule identifier
   * @returns {Promise<boolean>} Whether the rule was deleted
   */
  async deleteRule(ruleId) {
    const lockKey = `delete_rule_${ruleId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorRuleEngine not initialized');
      }
      
      this.logger.debug('Deleting behavior rule', { ruleId });
      
      // Check if rule exists
      if (!this.rules.has(ruleId)) {
        return false;
      }
      
      // Get rule for category removal
      const rule = this.rules.get(ruleId);
      
      // Remove from category mapping
      if (rule.category) {
        const categoryRules = this.ruleCategories.get(rule.category) || [];
        this.ruleCategories.set(
          rule.category,
          categoryRules.filter(id => id !== ruleId)
        );
      }
      
      // Delete rule
      this.rules.delete(ruleId);
      
      // Emit event for subscribers
      this.events.emit('rule_deleted', { id: ruleId });
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting behavior rule', { error, ruleId });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets a specific rule by ID
   * 
   * @param {string} ruleId - Rule identifier
   * @returns {Object|null} Rule or null if not found
   */
  getRule(ruleId) {
    if (!this.isInitialized) {
      throw new Error('BehaviorRuleEngine not initialized');
    }
    
    return this.rules.get(ruleId) || null;
  }
  
  /**
   * Gets all rules, optionally filtered by category
   * 
   * @param {Object} [options] - Retrieval options
   * @param {string} [options.category] - Filter by category
   * @returns {Array<Object>} Rules
   */
  getRules(options = {}) {
    if (!this.isInitialized) {
      throw new Error('BehaviorRuleEngine not initialized');
    }
    
    let ruleIds = [];
    
    // Filter by category if specified
    if (options.category) {
      ruleIds = this.ruleCategories.get(options.category) || [];
    } else {
      ruleIds = Array.from(this.rules.keys());
    }
    
    // Convert to array of rule objects
    return ruleIds
      .map(id => this.rules.get(id))
      .filter(rule => rule !== undefined);
  }
  
  /**
   * Updates engine configuration
   * 
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(configUpdates) {
    const lockKey = 'update_rule_engine_config';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorRuleEngine not initialized');
      }
      
      this.logger.debug('Updating rule engine configuration', { 
        updateKeys: Object.keys(configUpdates) 
      });
      
      // Update configuration
      this.config = {
        ...this.config,
        ...configUpdates
      };
      
      // Emit event for subscribers
      this.events.emit('config_updated', this.config);
      
      return { ...this.config };
    } catch (error) {
      this.logger.error('Error updating rule engine configuration', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets current engine configuration
   * 
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Registers an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  
  /**
   * Shuts down the rule engine
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = 'rule_engine_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('BehaviorRuleEngine not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down BehaviorRuleEngine');
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('BehaviorRuleEngine shut down');
    } catch (error) {
      this.logger.error('Error shutting down BehaviorRuleEngine', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Validates a rule definition
   * 
   * @private
   * @param {Object} rule - Rule to validate
   * @throws {Error} If validation fails
   */
  _validateRule(rule) {
    // Check required fields
    if (!rule.id) {
      throw new Error('Rule must have an ID');
    }
    if (!rule.name) {
      throw new Error('Rule must have a name');
    }
    if (!rule.category) {
      throw new Error('Rule must have a category');
    }
    if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      throw new Error('Rule must have at least one condition');
    }
    if (!rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }
    
    // Validate conditions
    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      if (!condition.type) {
        throw new Error(`Condition ${i} must have a type`);
      }
      if (condition.type === 'comparison' && (!condition.field || !condition.operator)) {
        throw new Error(`Comparison condition ${i} must have field and operator`);
      }
      if (condition.type === 'function' && !condition.function) {
        throw new Error(`Function condition ${i} must have a function name`);
      }
    }
    
    // Validate actions
    for (let i = 0; i < rule.actions.length; i++) {
      const action = rule.actions[i];
      if (!action.type) {
        throw new Error(`Action ${i} must have a type`);
      }
    }
  }
  
  /**
   * Registers a rule internally
   * 
   * @private
   * @param {Object} rule - Rule to register
   * @returns {Promise<Object>} Registered rule
   */
  async _registerRuleInternal(rule) {
    // Add timestamps and ensure priority
    const registeredRule = {
      ...rule,
      priority: rule.priority || this.priorityLevels.MEDIUM,
      created: Date.now(),
      lastUpdated: Date.now()
    };
    
    // Store rule
    this.rules.set(rule.id, registeredRule);
    
    // Add to category mapping
    if (!this.ruleCategories.has(rule.category)) {
      this.ruleCategories.set(rule.category, []);
    }
    const categoryRules = this.ruleCategories.get(rule.category);
    if (!categoryRules.includes(rule.id)) {
      categoryRules.push(rule.id);
    }
    
    return registeredRule;
  }
  
  /**
   * Checks if a rule is applicable to the current social context
   * 
   * @private
   * @param {Object} rule - Rule to check
   * @param {Object} socialContext - Social context information
   * @returns {boolean} Whether the rule is applicable
   */
  _checkRuleContextApplicability(rule, socialContext) {
    // If rule has no context constraints, it's always applicable
    if (!rule.contextConstraints) {
      return true;
    }
    
    const constraints = rule.contextConstraints;
    
    // Check formality level
    if (constraints.formality !== undefined && 
        socialContext.formality !== undefined) {
      if (constraints.formality === 'formal' && socialContext.formality < 0.7) {
        return false;
      }
      if (constraints.formality === 'informal' && socialContext.formality > 0.3) {
        return false;
      }
    }
    
    // Check relationship type
    if (constraints.relationshipType && 
        socialContext.relationshipType &&
        constraints.relationshipType !== socialContext.relationshipType) {
      return false;
    }
    
    // Check social setting
    if (constraints.socialSetting && 
        socialContext.setting &&
        constraints.socialSetting !== socialContext.setting) {
      return false;
    }
    
    // Check cultural context
    if (constraints.culturalContext && 
        socialContext.culturalContext) {
      // If rule specifies cultures and none match the current context
      if (Array.isArray(constraints.culturalContext) && 
          !constraints.culturalContext.includes(socialContext.culturalContext)) {
        return false;
      }
      // If rule specifies a single culture that doesn't match
      if (typeof constraints.culturalContext === 'string' && 
          constraints.culturalContext !== socialContext.culturalContext) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evaluates rule conditions against interaction data and context
   * 
   * @private
   * @param {Object} rule - Rule to evaluate
   * @param {Object} interactionData - Interaction data
   * @param {Object} socialContext - Social context information
   * @returns {Promise<Object>} Evaluation result with confidence score
   */
  async _evaluateRuleConditions(rule, interactionData, socialContext) {
    const conditionResults = [];
    let totalWeight = 0;
    let weightedSum = 0;
    let contextMatchScore = 0;
    
    // Evaluate each condition
    for (const condition of rule.conditions) {
      const weight = condition.weight || 1;
      totalWeight += weight;
      
      let result = false;
      let confidence = 0;
      
      try {
        switch (condition.type) {
          case 'comparison':
            ({ result, confidence } = this._evaluateComparisonCondition(
              condition, interactionData, socialContext
            ));
            break;
            
          case 'function':
            ({ result, confidence } = await this._evaluateFunctionCondition(
              condition, interactionData, socialContext
            ));
            break;
            
          case 'presence':
            ({ result, confidence } = this._evaluatePresenceCondition(
              condition, interactionData
            ));
            break;
            
          case 'pattern':
            ({ result, confidence } = this._evaluatePatternCondition(
              condition, interactionData
            ));
            break;
            
          default:
            this.logger.warn(`Unknown condition type: ${condition.type}`);
            result = false;
            confidence = 0;
        }
      } catch (error) {
        this.logger.error('Error evaluating condition', { 
          error, 
          ruleId: rule.id,
          conditionType: condition.type 
        });
        result = false;
        confidence = 0;
      }
      
      // Store result
      conditionResults.push({
        type: condition.type,
        result,
        confidence,
        weight
      });
      
      // Add to weighted sum
      weightedSum += confidence * weight;
    }
    
    // Calculate overall confidence
    const overallConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Calculate context match score (how well the rule matches the social context)
    if (rule.contextConstraints && socialContext) {
      contextMatchScore = this._calculateContextMatchScore(rule.contextConstraints, socialContext);
    } else {
      contextMatchScore = 0.5; // Neutral score if no constraints or context
    }
    
    return {
      confidence: overallConfidence,
      contextMatch: contextMatchScore,
      conditionResults
    };
  }
  
  /**
   * Evaluates a comparison condition
   * 
   * @private
   * @param {Object} condition - Condition to evaluate
   * @param {Object} interactionData - Interaction data
   * @param {Object} socialContext - Social context information
   * @returns {Object} Evaluation result with confidence score
   */
  _evaluateComparisonCondition(condition, interactionData, socialContext) {
    const { field, operator, value, source = 'interaction' } = condition;
    
    // Determine source data
    let sourceData;
    switch (source) {
      case 'interaction':
        sourceData = interactionData;
        break;
      case 'social':
        sourceData = socialContext;
        break;
      default:
        sourceData = interactionData;
    }
    
    // Get field value using dot notation
    const fieldValue = this._getNestedProperty(sourceData, field);
    
    // If field doesn't exist, condition fails
    if (fieldValue === undefined) {
      return { result: false, confidence: 0 };
    }
    
    let result = false;
    let confidence = 0;
    
    // Evaluate based on operator
    switch (operator) {
      case 'equals':
        result = fieldValue === value;
        confidence = result ? 1 : 0;
        break;
        
      case 'notEquals':
        result = fieldValue !== value;
        confidence = result ? 1 : 0;
        break;
        
      case 'contains':
        if (typeof fieldValue === 'string') {
          result = fieldValue.includes(value);
          confidence = result ? 1 : 0;
        } else if (Array.isArray(fieldValue)) {
          result = fieldValue.includes(value);
          confidence = result ? 1 : 0;
        } else {
          result = false;
          confidence = 0;
        }
        break;
        
      case 'greaterThan':
        result = fieldValue > value;
        confidence = result ? 1 : 0;
        break;
        
      case 'lessThan':
        result = fieldValue < value;
        confidence = result ? 1 : 0;
        break;
        
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          result = fieldValue >= value[0] && fieldValue <= value[1];
          confidence = result ? 1 : 0;
        } else {
          result = false;
          confidence = 0;
        }
        break;
        
      case 'fuzzyMatch':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          const similarity = this._calculateStringSimilarity(fieldValue, value);
          result = similarity > 0.7;
          confidence = similarity;
        } else {
          result = false;
          confidence = 0;
        }
        break;
        
      default:
        result = false;
        confidence = 0;
    }
    
    return { result, confidence };
  }
  
  /**
   * Evaluates a function condition
   * 
   * @private
   * @param {Object} condition - Condition to evaluate
   * @param {Object} interactionData - Interaction data
   * @param {Object} socialContext - Social context information
   * @returns {Promise<Object>} Evaluation result with confidence score
   */
  async _evaluateFunctionCondition(condition, interactionData, socialContext) {
    const { function: funcName, params = {} } = condition;
    
    // Define condition functions
    const conditionFunctions = {
      // Check if text contains emotional content
      hasEmotionalContent: (text, threshold = 0.5) => {
        if (!text) return { result: false, confidence: 0 };
        
        // Simple keyword-based emotion detection
        const emotionalKeywords = [
          'happy', 'sad', 'angry', 'excited', 'worried', 'afraid',
          'love', 'hate', 'anxious', 'calm', 'stressed', 'relaxed',
          'frustrated', 'pleased', 'disappointed', 'proud'
        ];
        
        const words = text.toLowerCase().split(/\W+/);
        const emotionalWords = words.filter(word => 
          emotionalKeywords.includes(word)
        );
        
        const emotionDensity = emotionalWords.length / words.length;
        const result = emotionDensity >= threshold;
        const confidence = Math.min(1, emotionDensity * 2); // Scale up for better confidence
        
        return { result, confidence };
      },
      
      // Check if interaction is a question
      isQuestion: (text) => {
        if (!text) return { result: false, confidence: 0 };
        
        // Check for question marks
        const hasQuestionMark = text.includes('?');
        
        // Check for question words
        const questionWords = ['who', 'what', 'where', 'when', 'why', 'how', 'can', 'could', 'would', 'will', 'should'];
        const startsWithQuestionWord = questionWords.some(word => 
          text.toLowerCase().startsWith(word + ' ')
        );
        
        // Check for inverted word order (e.g., "Are you", "Is it", "Can I")
        const invertedWordOrder = /^(are|is|was|were|do|does|did|have|has|had|can|could|would|will|should|might|may)\s+\w+/i.test(text);
        
        if (hasQuestionMark) {
          return { result: true, confidence: 0.9 };
        } else if (startsWithQuestionWord && invertedWordOrder) {
          return { result: true, confidence: 0.8 };
        } else if (startsWithQuestionWord || invertedWordOrder) {
          return { result: true, confidence: 0.7 };
        } else {
          return { result: false, confidence: 0.1 };
        }
      },
      
      // Check if interaction is a greeting
      isGreeting: (text) => {
        if (!text) return { result: false, confidence: 0 };
        
        const greetings = [
          'hello', 'hi', 'hey', 'good morning', 'good afternoon', 
          'good evening', 'greetings', 'howdy', 'what\'s up', 
          'how are you', 'nice to meet you', 'welcome'
        ];
        
        const lowerText = text.toLowerCase();
        
        // Check for exact matches at the beginning
        for (const greeting of greetings) {
          if (lowerText.startsWith(greeting)) {
            return { result: true, confidence: 0.9 };
          }
        }
        
        // Check for partial matches
        for (const greeting of greetings) {
          if (lowerText.includes(greeting)) {
            return { result: true, confidence: 0.7 };
          }
        }
        
        return { result: false, confidence: 0.1 };
      },
      
      // Check if interaction is formal
      isFormalLanguage: (text) => {
        if (!text) return { result: false, confidence: 0 };
        
        const formalIndicators = [
          'would you', 'could you', 'may i', 'please', 'thank you',
          'sincerely', 'regards', 'respectfully', 'sir', 'madam',
          'mr.', 'ms.', 'mrs.', 'dr.', 'professor', 'esteemed'
        ];
        
        const informalIndicators = [
          'hey', 'yeah', 'cool', 'awesome', 'gonna', 'wanna',
          'gotta', 'dunno', 'y\'all', 'u', 'r', 'ur', 'lol', 'omg'
        ];
        
        const lowerText = text.toLowerCase();
        
        let formalScore = 0;
        let informalScore = 0;
        
        // Check formal indicators
        for (const indicator of formalIndicators) {
          if (lowerText.includes(indicator)) {
            formalScore += 1;
          }
        }
        
        // Check informal indicators
        for (const indicator of informalIndicators) {
          if (lowerText.includes(indicator)) {
            informalScore += 1;
          }
        }
        
        // Check for contractions (informal)
        const contractions = lowerText.match(/\w+'(s|t|re|ve|ll|d)/g) || [];
        informalScore += contractions.length * 0.5;
        
        // Calculate formality score (0 to 1)
        const totalIndicators = formalScore + informalScore;
        let formalityScore = 0.5; // Default neutral
        
        if (totalIndicators > 0) {
          formalityScore = formalScore / totalIndicators;
        }
        
        const result = formalityScore >= 0.6;
        return { result, confidence: formalityScore };
      },
      
      // Check if social context is professional
      isProfessionalContext: (context) => {
        if (!context) return { result: false, confidence: 0.5 };
        
        const professionalSettings = ['work', 'business', 'meeting', 'conference', 'interview'];
        const professionalRelationships = ['colleague', 'client', 'manager', 'employee', 'business'];
        
        let professionalScore = 0.5; // Start neutral
        
        // Check setting
        if (context.setting) {
          if (professionalSettings.includes(context.setting)) {
            professionalScore += 0.3;
          } else if (context.setting === 'casual' || context.setting === 'social') {
            professionalScore -= 0.3;
          }
        }
        
        // Check relationship type
        if (context.relationshipType) {
          if (professionalRelationships.includes(context.relationshipType)) {
            professionalScore += 0.3;
          } else if (['friend', 'family', 'personal'].includes(context.relationshipType)) {
            professionalScore -= 0.3;
          }
        }
        
        // Check formality level
        if (context.formality !== undefined) {
          professionalScore += (context.formality - 0.5) * 0.4;
        }
        
        // Clamp to 0-1 range
        professionalScore = Math.max(0, Math.min(1, professionalScore));
        
        const result = professionalScore >= 0.6;
        return { result, confidence: professionalScore };
      }
    };
    
    // Check if function exists
    if (!conditionFunctions[funcName]) {
      this.logger.warn(`Unknown condition function: ${funcName}`);
      return { result: false, confidence: 0 };
    }
    
    // Extract parameters from interaction data or social context
    const resolvedParams = {};
    for (const [paramName, paramPath] of Object.entries(params)) {
      if (typeof paramPath === 'string' && paramPath.startsWith('$')) {
        // Parameter references a path in interaction data or social context
        const path = paramPath.substring(1); // Remove $ prefix
        const source = path.startsWith('social.') ? socialContext : interactionData;
        const sourcePath = path.startsWith('social.') ? path.substring(7) : path;
        
        resolvedParams[paramName] = this._getNestedProperty(source, sourcePath);
      } else {
        // Parameter is a literal value
        resolvedParams[paramName] = paramPath;
      }
    }
    
    // Execute function with resolved parameters
    try {
      return await conditionFunctions[funcName](...Object.values(resolvedParams));
    } catch (error) {
      this.logger.error(`Error executing condition function ${funcName}`, { error });
      return { result: false, confidence: 0 };
    }
  }
  
  /**
   * Evaluates a presence condition
   * 
   * @private
   * @param {Object} condition - Condition to evaluate
   * @param {Object} interactionData - Interaction data
   * @returns {Object} Evaluation result with confidence score
   */
  _evaluatePresenceCondition(condition, interactionData) {
    const { field, exists = true } = condition;
    
    // Get field value using dot notation
    const fieldValue = this._getNestedProperty(interactionData, field);
    
    // Check if field exists and is not null/undefined
    const fieldExists = fieldValue !== undefined && fieldValue !== null;
    
    // Result depends on whether we're checking for existence or absence
    const result = exists ? fieldExists : !fieldExists;
    
    return { result, confidence: result ? 1 : 0 };
  }
  
  /**
   * Evaluates a pattern condition
   * 
   * @private
   * @param {Object} condition - Condition to evaluate
   * @param {Object} interactionData - Interaction data
   * @returns {Object} Evaluation result with confidence score
   */
  _evaluatePatternCondition(condition, interactionData) {
    const { field, pattern, flags = '' } = condition;
    
    // Get field value using dot notation
    const fieldValue = this._getNestedProperty(interactionData, field);
    
    // If field doesn't exist or isn't a string, condition fails
    if (fieldValue === undefined || typeof fieldValue !== 'string') {
      return { result: false, confidence: 0 };
    }
    
    try {
      // Create RegExp object
      const regex = new RegExp(pattern, flags);
      
      // Test the pattern
      const result = regex.test(fieldValue);
      
      return { result, confidence: result ? 1 : 0 };
    } catch (error) {
      this.logger.error('Invalid regular expression in pattern condition', { 
        error, pattern, flags 
      });
      return { result: false, confidence: 0 };
    }
  }
  
  /**
   * Resolves conflicts between rules
   * 
   * @private
   * @param {Array<Object>} evaluationResults - Rule evaluation results
   * @returns {Array<Object>} Conflict-free rule set
   */
  _resolveRuleConflicts(evaluationResults) {
    if (evaluationResults.length <= 1) {
      return evaluationResults;
    }
    
    const resolvedResults = [...evaluationResults];
    const conflictGroups = new Map();
    
    // Group potentially conflicting rules by category
    for (let i = 0; i < resolvedResults.length; i++) {
      const result = resolvedResults[i];
      const category = result.rule.category;
      
      if (!conflictGroups.has(category)) {
        conflictGroups.set(category, []);
      }
      
      conflictGroups.get(category).push(i);
    }
    
    // Check for explicit conflicts
    for (let i = 0; i < resolvedResults.length; i++) {
      const result = resolvedResults[i];
      
      // Skip already removed rules
      if (!result) continue;
      
      // Check if rule has conflict definitions
      if (result.rule.conflicts && Array.isArray(result.rule.conflicts)) {
        for (const conflictId of result.rule.conflicts) {
          // Find conflicting rule in results
          const conflictIndex = resolvedResults.findIndex(
            r => r && r.rule.id === conflictId
          );
          
          if (conflictIndex !== -1) {
            // Keep the higher priority/confidence rule
            if (result.priority > resolvedResults[conflictIndex].priority ||
                (result.priority === resolvedResults[conflictIndex].priority &&
                 result.confidence > resolvedResults[conflictIndex].confidence)) {
              // Remove conflicting rule
              resolvedResults[conflictIndex] = null;
            } else {
              // Remove current rule
              resolvedResults[i] = null;
              break;
            }
          }
        }
      }
    }
    
    // For each category that might have internal conflicts
    for (const [category, indices] of conflictGroups.entries()) {
      if (indices.length <= 1) continue;
      
      // Get category conflict resolution strategy
      const strategy = this._getCategoryConflictStrategy(category);
      
      if (strategy === 'highest_only') {
        // Keep only the highest priority/confidence rule in the category
        let highestIndex = indices[0];
        let highestResult = resolvedResults[highestIndex];
        
        for (let i = 1; i < indices.length; i++) {
          const index = indices[i];
          const result = resolvedResults[index];
          
          // Skip already removed rules
          if (!result) continue;
          
          if (!highestResult ||
              result.priority > highestResult.priority ||
              (result.priority === highestResult.priority &&
               result.confidence > highestResult.confidence)) {
            // Mark previous highest for removal
            if (highestResult) {
              resolvedResults[highestIndex] = null;
            }
            
            // Update highest
            highestIndex = index;
            highestResult = result;
          } else {
            // Mark current for removal
            resolvedResults[index] = null;
          }
        }
      }
      // Other strategies could be implemented here
    }
    
    // Filter out removed rules
    return resolvedResults.filter(result => result !== null);
  }
  
  /**
   * Gets conflict resolution strategy for a category
   * 
   * @private
   * @param {string} category - Rule category
   * @returns {string} Conflict resolution strategy
   */
  _getCategoryConflictStrategy(category) {
    // Categories that should only have one active rule at a time
    const exclusiveCategories = [
      'conversation_style',
      'greeting_style',
      'farewell_style',
      'formality_level'
    ];
    
    if (exclusiveCategories.includes(category)) {
      return 'highest_only';
    }
    
    // Default strategy allows multiple rules
    return 'allow_multiple';
  }
  
  /**
   * Calculates how well a rule matches the social context
   * 
   * @private
   * @param {Object} constraints - Rule context constraints
   * @param {Object} socialContext - Social context information
   * @returns {number} Context match score (0-1)
   */
  _calculateContextMatchScore(constraints, socialContext) {
    let matchPoints = 0;
    let totalPoints = 0;
    
    // Check formality level
    if (constraints.formality !== undefined && 
        socialContext.formality !== undefined) {
      totalPoints++;
      
      if (constraints.formality === 'formal' && socialContext.formality >= 0.7) {
        matchPoints++;
      } else if (constraints.formality === 'informal' && socialContext.formality <= 0.3) {
        matchPoints++;
      } else if (constraints.formality === 'neutral' && 
                socialContext.formality > 0.3 && 
                socialContext.formality < 0.7) {
        matchPoints++;
      }
    }
    
    // Check relationship type
    if (constraints.relationshipType && 
        socialContext.relationshipType) {
      totalPoints++;
      
      if (constraints.relationshipType === socialContext.relationshipType) {
        matchPoints++;
      }
    }
    
    // Check social setting
    if (constraints.socialSetting && 
        socialContext.setting) {
      totalPoints++;
      
      if (constraints.socialSetting === socialContext.setting) {
        matchPoints++;
      }
    }
    
    // Check cultural context
    if (constraints.culturalContext && 
        socialContext.culturalContext) {
      totalPoints++;
      
      if (Array.isArray(constraints.culturalContext)) {
        if (constraints.culturalContext.includes(socialContext.culturalContext)) {
          matchPoints++;
        }
      } else if (constraints.culturalContext === socialContext.culturalContext) {
        matchPoints++;
      }
    }
    
    // Calculate score
    return totalPoints > 0 ? matchPoints / totalPoints : 0.5;
  }
  
  /**
   * Gets a nested property from an object using dot notation
   * 
   * @private
   * @param {Object} obj - Object to get property from
   * @param {string} path - Property path (dot notation)
   * @returns {*} Property value or undefined if not found
   */
  _getNestedProperty(obj, path) {
    if (!obj || !path) {
      return undefined;
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Calculates similarity between two strings
   * 
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  _calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) {
      return 0;
    }
    
    // Convert to lowercase for case-insensitive comparison
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Calculate Levenshtein distance
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Deletion
          matrix[i][j - 1] + 1,      // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }
    
    // Calculate similarity score
    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }
}

module.exports = { BehaviorRuleEngine };
