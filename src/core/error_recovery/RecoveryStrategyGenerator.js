/**
 * RecoveryStrategyGenerator.js
 * 
 * Generates recovery strategies based on causal analysis results.
 * This module is responsible for creating, ranking, and adapting recovery strategies.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} RecoveryStrategy
 * @property {string} id - Unique identifier for the strategy
 * @property {string} name - Human-readable name
 * @property {string} description - Description of what the strategy does
 * @property {Array<Object>} actions - List of recovery actions to execute
 * @property {Object} metadata - Additional metadata about the strategy
 */

/**
 * @typedef {Object} RankedRecoveryStrategy
 * @property {string} id - Unique identifier for the strategy
 * @property {string} name - Human-readable name
 * @property {string} description - Description of what the strategy does
 * @property {Array<Object>} actions - List of recovery actions to execute
 * @property {Object} metadata - Additional metadata about the strategy
 * @property {Object} ranking - Ranking information
 * @property {number} ranking.rank - Rank position (1-based)
 * @property {number} ranking.score - Ranking score (0-1)
 * @property {Object} explanation - Human-readable explanation of the strategy
 */

/**
 * @typedef {Object} StrategyTemplate
 * @property {string} id - Unique identifier for the template
 * @property {string} name - Human-readable name
 * @property {string} description - Description of what strategies from this template do
 * @property {number} confidence - Confidence level (0-1)
 * @property {Object} template - Template definition
 * @property {Function} [createStrategy] - Optional function to create a strategy from this template
 */

/**
 * @typedef {Object} SystemState
 * @property {Object} resources - Available system resources
 * @property {Array<Object>} components - System component states
 */

/**
 * Generates recovery strategies based on causal analysis results.
 */
class RecoveryStrategyGenerator {
  /**
   * Creates a new RecoveryStrategyGenerator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.container - Dependency container
   * @param {Object} options.eventEmitter - Event emitter instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.container = options.container;
    this.eventEmitter = options.eventEmitter;
    this.logger = options.logger || console;
    this.config = options.config || {};
    
    // Default configuration
    this.config.maxStrategies = this.config.maxStrategies || 5;
    this.config.useFallbackStrategy = this.config.useFallbackStrategy !== false;
    this.config.useCache = this.config.useCache !== false;
    this.config.priorityTags = this.config.priorityTags || ["critical", "recommended"];
    
    // Default ranking weights
    this.config.rankingWeights = this.config.rankingWeights || {
      successProbability: 0.4,
      resourceRequirements: 0.2,
      potentialSideEffects: 0.1,
      estimatedExecutionTime: 0.1,
      historicalPerformance: 0.2
    };
    
    // Strategy cache
    this.strategyCache = new Map();
    
    // Dependencies (to be resolved during initialization)
    this.templateRegistry = null;
    this.actionRegistry = null;
    this.historicalData = null;
    this.metrics = null;
    
    this.logger.info('RecoveryStrategyGenerator created');
  }
  
  /**
   * Initializes the RecoveryStrategyGenerator by resolving dependencies
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Resolve dependencies from container
      this.templateRegistry = await this.container.resolve('strategyTemplateRegistry');
      this.actionRegistry = await this.container.resolve('recoveryActionRegistry');
      this.historicalData = await this.container.resolve('historicalDataManager');
      
      // Optional metrics collector
      try {
        this.metrics = await this.container.resolve('metricsCollector');
      } catch (error) {
        this.logger.warn(`Metrics collector not available: ${error.message}`);
      }
      
      this.logger.info('RecoveryStrategyGenerator initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize RecoveryStrategyGenerator: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Emits an event through the event emitter
   * 
   * @private
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   */
  _emitEvent(eventName, data) {
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      this.eventEmitter.emit(eventName, data);
    }
  }
  
  /**
   * Caches strategies for an analysis result
   * 
   * @private
   * @param {Object} analysisResult - Analysis result
   * @param {Array<RecoveryStrategy>} strategies - Strategies to cache
   */
  _cacheStrategies(analysisResult, strategies) {
    if (!analysisResult || !analysisResult.analysisId) {
      return;
    }
    
    this.strategyCache.set(analysisResult.analysisId, {
      strategies,
      timestamp: Date.now()
    });
    
    this._emitEvent("strategy:cache:store", {
      analysisId: analysisResult.analysisId,
      count: strategies.length
    });
  }
  
  /**
   * Gets cached strategies for an analysis result
   * 
   * @private
   * @param {Object} analysisResult - Analysis result
   * @returns {Array<RecoveryStrategy>|null} Cached strategies or null if not found
   */
  _getCachedStrategies(analysisResult) {
    if (!analysisResult || !analysisResult.analysisId) {
      return null;
    }
    
    const cached = this.strategyCache.get(analysisResult.analysisId);
    if (!cached) {
      return null;
    }
    
    // Check if cache is still valid (5 minutes TTL)
    const now = Date.now();
    if (now - cached.timestamp > 5 * 60 * 1000) {
      this.strategyCache.delete(analysisResult.analysisId);
      return null;
    }
    
    this._emitEvent("strategy:cache:hit", {
      analysisId: analysisResult.analysisId,
      count: cached.strategies.length
    });
    
    return cached.strategies;
  }
  
  /**
   * Composes a strategy from a template
   * 
   * @private
   * @param {string} templateId - Template ID
   * @param {StrategyTemplate} template - Strategy template
   * @param {Object} analysisResult - Analysis result
   * @param {Object} options - Generation options
   * @returns {Promise<RecoveryStrategy|null>} Composed strategy or null if composition fails
   */
  async _composeStrategy(templateId, template, analysisResult, options = {}) {
    try {
      // If template has a custom createStrategy function, use it
      if (template.createStrategy && typeof template.createStrategy === 'function') {
        const strategy = await template.createStrategy(analysisResult, options);
        if (strategy) {
          return {
            ...strategy,
            id: strategy.id || `strategy-${uuidv4()}`,
            metadata: {
              ...strategy.metadata,
              templateId,
              generatedAt: Date.now()
            }
          };
        }
      }
      
      // Otherwise, use standard composition logic
      const strategyId = `strategy-${uuidv4()}`;
      const rootCause = analysisResult.rootCauses && analysisResult.rootCauses.length > 0 
        ? analysisResult.rootCauses[0] 
        : { type: 'unknown', description: 'Unknown root cause' };
      
      // Generate actions based on recovery hints or root cause
      const actions = [];
      
      // Add actions from recovery hints if available
      if (analysisResult.recoveryHints && Array.isArray(analysisResult.recoveryHints)) {
        for (const hint of analysisResult.recoveryHints) {
          try {
            const action = await this.actionRegistry.getAction(hint);
            if (action) {
              actions.push({
                id: hint,
                type: action.type || 'unknown',
                target: analysisResult.componentId || 'system',
                parameters: {}
              });
            }
          } catch (error) {
            this.logger.warn(`Failed to get action for hint ${hint}: ${error.message}`);
          }
        }
      }
      
      // If no actions from hints, try to generate based on root cause
      if (actions.length === 0 && rootCause) {
        const actionType = this._mapRootCauseToActionType(rootCause.type);
        if (actionType) {
          actions.push({
            id: `${actionType}_action`,
            type: actionType,
            target: analysisResult.componentId || 'system',
            parameters: {}
          });
        }
      }
      
      // Create strategy metadata
      const metadata = {
        templateId,
        generatedAt: Date.now(),
        confidence: template.confidence || analysisResult.confidence || 0.5,
        tags: template.tags || []
      };
      
      // Add appropriate tags based on template and analysis
      if (template.tags && Array.isArray(template.tags)) {
        metadata.tags = [...metadata.tags, ...template.tags];
      }
      
      if (rootCause && rootCause.type) {
        metadata.tags.push(`rootcause:${rootCause.type}`);
      }
      
      if (analysisResult.errorType) {
        metadata.tags.push(`errortype:${analysisResult.errorType}`);
      }
      
      if (analysisResult.componentId) {
        metadata.tags.push(`component:${analysisResult.componentId}`);
      }
      
      // Create the strategy
      return {
        id: strategyId,
        name: template.name || `Recovery Strategy for ${rootCause.type}`,
        description: template.description || `Attempts to recover from ${rootCause.description || rootCause.type}`,
        actions,
        metadata
      };
    } catch (error) {
      this.logger.error(`Failed to compose strategy from template ${templateId}: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Maps root cause type to action type
   * 
   * @private
   * @param {string} rootCauseType - Root cause type
   * @returns {string|null} Action type or null if no mapping exists
   */
  _mapRootCauseToActionType(rootCauseType) {
    const mappings = {
      'network_error': 'restart_connection',
      'timeout': 'retry',
      'resource_exhaustion': 'free_resources',
      'configuration_error': 'reconfigure',
      'permission_denied': 'elevate_permissions',
      'data_corruption': 'restore_backup',
      'version_mismatch': 'update_component',
      'dependency_failure': 'restart_dependency'
    };
    
    return mappings[rootCauseType] || 'restart';
  }
  
  /**
   * Fetches or composes a strategy
   * 
   * @private
   * @param {string} strategyId - Strategy ID
   * @param {Object} analysisResult - Analysis result
   * @returns {Promise<RecoveryStrategy|null>} Strategy or null if not found
   */
  async _fetchOrComposeStrategy(strategyId, analysisResult) {
    try {
      // Try to fetch from template registry first
      const template = await this.templateRegistry.getTemplate(strategyId);
      if (template) {
        return this._composeStrategy(strategyId, template, analysisResult);
      }
      
      // If not found in registry, try to create a basic strategy
      return {
        id: strategyId,
        name: `Recovery Strategy ${strategyId}`,
        description: 'Automatically generated recovery strategy',
        actions: [],
        metadata: {
          generatedAt: Date.now(),
          isHistorical: true
        }
      };
    } catch (error) {
      this.logger.error(`Failed to fetch or compose strategy ${strategyId}: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Creates a fallback strategy when no valid strategies are found
   * 
   * @private
   * @param {Object} analysisResult - Analysis result
   * @returns {RecoveryStrategy} Fallback strategy
   */
  _createFallbackStrategy(analysisResult) {
    const strategyId = `fallback-${uuidv4()}`;
    const componentId = analysisResult.componentId || 'unknown_component';
    
    // Determine appropriate fallback action based on component type
    let fallbackAction = {
      id: 'restart_component',
      type: 'restart',
      target: componentId,
      parameters: {}
    };
    
    // Add more specialized fallback actions if we have more information
    if (analysisResult.errorType === 'connection_failure') {
      fallbackAction = {
        id: 'reconnect',
        type: 'reconnect',
        target: componentId,
        parameters: {
          maxRetries: 3,
          retryInterval: 1000
        }
      };
    } else if (analysisResult.errorType === 'resource_exhaustion') {
      fallbackAction = {
        id: 'free_resources',
        type: 'free_resources',
        target: componentId,
        parameters: {
          resourceTypes: ['memory', 'connections', 'handles']
        }
      };
    }
    
    return {
      id: strategyId,
      name: 'Fallback Recovery Strategy',
      description: `Generic fallback strategy for ${componentId}`,
      actions: [fallbackAction],
      metadata: {
        generatedAt: Date.now(),
        isFallback: true,
        confidence: 0.5,
        tags: ['fallback', `component:${componentId}`]
      }
    };
  }
  
  /**
   * Generates recovery strategies based on causal analysis results.
   * @param {string} errorId - ID of the error
   * @param {CausalAnalysisResult} analysisResult - Result of causal analysis
   * @param {Object} [options] - Generation options
   * @param {number} [options.maxStrategies] - Maximum number of strategies to generate
   * @param {boolean} [options.useFallbackStrategy] - Whether to use fallback strategy if no valid strategies are found
   * @param {boolean} [options.useCache] - Whether to use cached strategies
   * @param {Array<string>} [options.priorityTags] - Tags to prioritize in strategy selection
   * @returns {Promise<Object>} Generated strategies
   */
  async generateStrategies(errorId, analysisResult, options = {}) {
    const startTime = Date.now();
    const generationId = uuidv4();
    
    // Merge options with defaults
    const maxStrategies = options.maxStrategies || this.config.maxStrategies;
    const useFallbackStrategy = options.useFallbackStrategy !== undefined ? options.useFallbackStrategy : this.config.useFallbackStrategy;
    const useCache = options.useCache !== undefined ? options.useCache : this.config.useCache;
    const priorityTags = options.priorityTags || this.config.priorityTags;
    
    // Ensure dependencies are initialized
    if (!this.templateRegistry || !this.actionRegistry) {
      await this.initialize();
    }
    
    // Ensure analysisResult is valid to prevent errors
    if (!analysisResult || typeof analysisResult !== "object") {
      analysisResult = { analysisId: `generated-${uuidv4()}`, rootCauses: [], confidence: 0, recoveryHints: [] };
      this.logger.warn(`Invalid or missing analysis result for error ${errorId}, using generated placeholder`);
    }
    
    try {
      this.logger.debug(`Starting strategy generation: ${generationId}`);
      this._emitEvent("strategy:generation:started", { generationId, errorId, analysisResult });
      
      // Check cache first if enabled
      if (useCache) {
        const cachedStrategies = this._getCachedStrategies(analysisResult);
        if (cachedStrategies && cachedStrategies.length > 0) {
          this.logger.debug(`Using ${cachedStrategies.length} cached strategies for error ${errorId}`);
          return { strategies: cachedStrategies };
        }
      }
      
      // Get applicable templates from registry
      const templates = await this.templateRegistry.getApplicableTemplates(analysisResult);
      
      // Generate strategies from templates
      const generatedStrategies = [];
      
      // Add strategies from templates
      if (templates && Array.isArray(templates)) {
        await Promise.all(templates.map(async (template) => {
          try {
            if (!template || !template.id) {
              return;
            }
            
            const strategy = await this._composeStrategy(template.id, template, analysisResult, options);
            if (strategy) {
              generatedStrategies.push(strategy);
            }
          } catch (error) {
            this.logger.warn(`Failed to generate strategy from template ${template.id}: ${error.message}`);
            return null; // Skip this template
          }
        }));
      }
      
      // Add strategies from historical recommendations if available
      if (this.historicalData) {
        const recommendations = await this.historicalData.getRecommendations(analysisResult);
        if (recommendations && Array.isArray(recommendations)) {
          await Promise.all(recommendations.map(async (recommendation) => {
            try {
              if (!recommendation || !recommendation.strategyId) {
                return;
              }
              
              const strategy = await this._fetchOrComposeStrategy(recommendation.strategyId, analysisResult);
              if (strategy) {
                generatedStrategies.push(strategy);
              }
            } catch (error) {
              this.logger.warn(`Failed to generate strategy from recommendation ${recommendation.strategyId}: ${error.message}`);
              return null; // Skip this recommendation
            }
          }));
        }
      }
      
      // Translate any strategies that need translation
      if (generatedStrategies.length > 0) {
        await Promise.all(generatedStrategies.map(async (strategy) => {
          try {
            // Translate action IDs to actual actions if needed
            if (strategy.actions) {
              for (let i = 0; i < strategy.actions.length; i++) {
                const action = strategy.actions[i];
                if (typeof action === 'string') {
                  const actionDef = await this.actionRegistry.getAction(action);
                  if (actionDef) {
                    strategy.actions[i] = {
                      actionId: action,
                      parameters: {}
                    };
                  }
                }
              }
            }
            
            return strategy;
          } catch (error) {
            this.logger.warn(`Failed to translate strategy ${strategy.id || 'unknown'}: ${error.message}`);
            return strategy; // Return original strategy if translation fails
          }
        }));
      }

      // Prioritize strategies based on tags
      generatedStrategies.sort((a, b) => {
        const aPriority = priorityTags.some(tag => a.metadata?.tags?.includes(tag));
        const bPriority = priorityTags.some(tag => b.metadata?.tags?.includes(tag));
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return 0; // Keep original order otherwise for now (ranking happens later)
      });

      // Limit the number of strategies
      let finalStrategies = generatedStrategies.slice(0, maxStrategies);
      
      // Ensure we have at least one valid strategy with actions, or use fallback
      if (useFallbackStrategy && (finalStrategies.length === 0 || !finalStrategies.some(s => s.actions && s.actions.length > 0))) {
        this.logger.warn(`No valid strategies with actions generated for error ${errorId}, creating fallback strategy`);
        const fallbackStrategy = this._createFallbackStrategy(analysisResult);
        
        // Ensure fallback strategy has proper metadata and tags
        if (!fallbackStrategy.metadata) {
          fallbackStrategy.metadata = {};
        }
        if (!fallbackStrategy.metadata.tags) {
          fallbackStrategy.metadata.tags = [];
        }
        if (!fallbackStrategy.metadata.tags.includes('fallback')) {
          fallbackStrategy.metadata.tags.push('fallback');
        }
        
        finalStrategies = [fallbackStrategy, ...finalStrategies].slice(0, maxStrategies); // Add fallback and re-slice
      }

      // Cache the generated strategies
      if (useCache) {
        this._cacheStrategies(analysisResult, finalStrategies);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Completed strategy generation in ${duration}ms: ${generationId}`);
      this._emitEvent("strategy:generation:completed", { 
        generationId, 
        strategies: finalStrategies, 
        duration 
      });

      if (this.metrics && typeof this.metrics.recordMetric === 'function') {
        this.metrics.recordMetric("strategy_generation_duration", duration);
        this.metrics.recordMetric("strategies_generated_count", finalStrategies.length);
      }

      return { strategies: finalStrategies };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error during strategy generation: ${error.message}`, error);
      this._emitEvent("strategy:generation:failed", { generationId, error, duration });
      
      // Return empty strategies array instead of throwing error to ensure consistent return type
      return { strategies: [] };
    }
  }

  /**
   * Ranks generated strategies by estimated success probability and other factors.
   * @param {Array<RecoveryStrategy>} strategies - Strategies to rank
   * @param {CausalAnalysisResult} analysisResult - Result of causal analysis
   * @param {SystemState} systemState - Current system state
   * @returns {Promise<Array<RankedRecoveryStrategy>>} Ranked strategies
   */
  async rankStrategies(strategies, analysisResult, systemState) {
    const startTime = Date.now();
    const rankingId = uuidv4();

    // Ensure dependencies are initialized
    if (!this.historicalData) {
      await this.initialize();
    }

    // Ensure analysisResult is valid to prevent errors
    if (!analysisResult || typeof analysisResult !== "object") {
      analysisResult = { analysisId: `generated-${uuidv4()}`, rootCauses: [], confidence: 0, recoveryHints: [] };
      this.logger.warn(`Invalid or missing analysis result for ranking, using generated placeholder`);
    }
    
    // Ensure systemState is valid
    if (!systemState || typeof systemState !== "object") {
        systemState = { resources: {}, components: [] }; // Provide a default empty state
        this.logger.warn(`Invalid or missing system state for ranking, using default empty state.`);
    }

    try {
      this.logger.debug(`Starting strategy ranking: ${rankingId}`);
      this._emitEvent("strategy:ranking:started", { rankingId, strategies });

      // Check if strategies array is empty or undefined
      if (!strategies || !Array.isArray(strategies) || strategies.length === 0) {
        this.logger.warn(`No strategies provided for ranking, creating a default strategy`);
        // Create a default strategy to ensure we always return at least one ranked strategy
        const defaultStrategy = this._createFallbackStrategy(analysisResult);
        strategies = [defaultStrategy];
      }

      const rankedStrategyPromises = strategies.map(async (strategy) => {
        try {
          const successProbability = await this._estimateSuccessProbability(strategy, analysisResult);
          const resourceRequirements = await this._estimateResourceRequirements(strategy, systemState);
          const potentialSideEffects = await this._estimatePotentialSideEffects(strategy, systemState);
          const estimatedExecutionTime = await this._estimateExecutionTime(strategy, systemState);
          const historicalPerformance = await this.historicalData.getStrategyPerformance(strategy.id || 'unknown');

          // Calculate ranking score using configured weights
          const weights = this.config.rankingWeights;
          let score = (successProbability * weights.successProbability);
          score -= ((resourceRequirements.normalized || 0) * weights.resourceRequirements);
          score -= ((potentialSideEffects.length * 0.1) * weights.potentialSideEffects); // Normalize side effects impact
          score -= ((estimatedExecutionTime / 60000) * weights.estimatedExecutionTime); // Normalize time impact
          if (historicalPerformance && historicalPerformance.successRate) {
            score += ((historicalPerformance.successRate - 0.5) * weights.historicalPerformance); // Adjust based on historical success
          }

          const rankingFactors = [
            { factor: "successProbability", weight: weights.successProbability, score: successProbability },
            { factor: "resourceRequirements", weight: weights.resourceRequirements, score: resourceRequirements.normalized || 0 },
            { factor: "potentialSideEffects", weight: weights.potentialSideEffects, score: potentialSideEffects.length },
            { factor: "estimatedExecutionTime", weight: weights.estimatedExecutionTime, score: estimatedExecutionTime },
            { factor: "historicalPerformance", weight: weights.historicalPerformance, score: historicalPerformance?.successRate || 0.5 }
          ];

          const explanation = this._generateExplanation(strategy, analysisResult);

          return {
            ...strategy,
            ranking: {
              rank: 0, // Will be assigned after sorting
              score: Math.max(0, Math.min(1, score)), // Clamp score between 0 and 1
              successProbability,
              resourceRequirements,
              estimatedExecutionTime,
              potentialSideEffects,
              historicalPerformance,
              rankingFactors
            },
            explanation
          };
        } catch (rankError) {
          this.logger.warn(`Failed to rank strategy ${strategy.id || 'unknown'}: ${rankError.message}`);
          // Instead of returning null, return a basic ranking to ensure we always have results
          return {
            ...strategy,
            ranking: {
              rank: 0,
              score: 0.1, // Low but non-zero score
              successProbability: 0.1,
              resourceRequirements: { normalized: 0.5 },
              estimatedExecutionTime: 30000, // 30 seconds
              potentialSideEffects: [],
              historicalPerformance: { successRate: 0.5 },
              rankingFactors: []
            },
            explanation: { summary: "Basic fallback ranking due to ranking error" }
          };
        }
      });

      let rankedStrategies = await Promise.all(rankedStrategyPromises);

      // Sort strategies by score (higher is better)
      rankedStrategies.sort((a, b) => b.ranking.score - a.ranking.score);

      // Assign rank numbers
      rankedStrategies = rankedStrategies.map((strategy, index) => ({
        ...strategy,
        ranking: {
          ...strategy.ranking,
          rank: index + 1
        }
      }));

      const duration = Date.now() - startTime;
      this.logger.debug(`Completed strategy ranking in ${duration}ms: ${rankingId}`);
      this._emitEvent("strategy:ranking:completed", { rankingId, rankedStrategies, duration });

      if (this.metrics && typeof this.metrics.recordMetric === 'function') {
        this.metrics.recordMetric("strategy_ranking_duration", duration);
      }

      return rankedStrategies;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error during strategy ranking: ${error.message}`, error);
      this._emitEvent("strategy:ranking:failed", { rankingId, error, duration });
      
      // Create a fallback strategy with ranking to ensure we always return at least one ranked strategy
      const fallbackStrategy = this._createFallbackStrategy(analysisResult);
      const rankedFallbackStrategy = {
        ...fallbackStrategy,
        ranking: {
          rank: 1,
          score: 0.5,
          successProbability: 0.5,
          resourceRequirements: { normalized: 0.5 },
          estimatedExecutionTime: 30000, // 30 seconds
          potentialSideEffects: [],
          historicalPerformance: { successRate: 0.5 },
          rankingFactors: []
        },
        explanation: { summary: "Fallback strategy due to ranking error" }
      };
      
      return [rankedFallbackStrategy];
    }
  }

  /**
   * Estimates the success probability of a strategy
   * 
   * @private
   * @param {RecoveryStrategy} strategy - Strategy to estimate
   * @param {Object} analysisResult - Analysis result
   * @returns {Promise<number>} Estimated success probability (0-1)
   */
  async _estimateSuccessProbability(strategy, analysisResult) {
    try {
      // Base probability from strategy metadata
      let probability = strategy.metadata?.confidence || 0.5;
      
      // Adjust based on historical performance if available
      if (this.historicalData) {
        const performance = await this.historicalData.getStrategyPerformance(strategy.id);
        if (performance && typeof performance.successRate === 'number') {
          // Blend historical performance with base probability
          probability = (probability * 0.3) + (performance.successRate * 0.7);
        }
      }
      
      // Adjust based on analysis result confidence
      if (analysisResult && typeof analysisResult.confidence === 'number') {
        probability *= analysisResult.confidence;
      }
      
      // Adjust based on action count (strategies with more actions are generally more complex and less likely to succeed)
      if (strategy.actions && Array.isArray(strategy.actions)) {
        const actionCount = strategy.actions.length;
        if (actionCount > 3) {
          probability *= (1 - ((actionCount - 3) * 0.05)); // Reduce probability by 5% for each action beyond 3
        }
      }
      
      // Ensure probability is between 0 and 1
      return Math.max(0, Math.min(1, probability));
    } catch (error) {
      this.logger.warn(`Error estimating success probability: ${error.message}`);
      return 0.5; // Default to 50% if estimation fails
    }
  }
  
  /**
   * Estimates the resource requirements of a strategy
   * 
   * @private
   * @param {RecoveryStrategy} strategy - Strategy to estimate
   * @param {SystemState} systemState - Current system state
   * @returns {Promise<Object>} Estimated resource requirements
   */
  async _estimateResourceRequirements(strategy, systemState) {
    try {
      const requirements = {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
        normalized: 0
      };
      
      // Calculate requirements based on actions
      if (strategy.actions && Array.isArray(strategy.actions)) {
        for (const action of strategy.actions) {
          try {
            const actionDef = await this.actionRegistry.getAction(action.id || action.actionId);
            if (actionDef && actionDef.resourceHints) {
              requirements.cpu += actionDef.resourceHints.cpu || 0;
              requirements.memory += actionDef.resourceHints.memory || 0;
              requirements.disk += actionDef.resourceHints.disk || 0;
              requirements.network += actionDef.resourceHints.network || 0;
            }
          } catch (error) {
            this.logger.warn(`Failed to get resource hints for action ${action.id || action.actionId}: ${error.message}`);
          }
        }
      }
      
      // Calculate normalized requirements (0-1) based on available resources
      if (systemState && systemState.resources) {
        const availableCpu = systemState.resources.cpu?.available || 100;
        const availableMemory = systemState.resources.memory?.available || 1024;
        const availableDisk = systemState.resources.disk?.available || 10240;
        const availableNetwork = systemState.resources.network?.available || 100;
        
        const cpuNormalized = Math.min(1, requirements.cpu / availableCpu);
        const memoryNormalized = Math.min(1, requirements.memory / availableMemory);
        const diskNormalized = Math.min(1, requirements.disk / availableDisk);
        const networkNormalized = Math.min(1, requirements.network / availableNetwork);
        
        requirements.normalized = (cpuNormalized + memoryNormalized + diskNormalized + networkNormalized) / 4;
      } else {
        // Default normalization if system state is not available
        requirements.normalized = Math.min(1, (requirements.cpu / 100 + requirements.memory / 1024 + requirements.disk / 10240 + requirements.network / 100) / 4);
      }
      
      return requirements;
    } catch (error) {
      this.logger.warn(`Error estimating resource requirements: ${error.message}`);
      return { cpu: 10, memory: 100, disk: 10, network: 10, normalized: 0.5 }; // Default if estimation fails
    }
  }
  
  /**
   * Estimates the potential side effects of a strategy
   * 
   * @private
   * @param {RecoveryStrategy} strategy - Strategy to estimate
   * @param {SystemState} systemState - Current system state
   * @returns {Promise<Array<Object>>} Potential side effects
   */
  async _estimatePotentialSideEffects(strategy, systemState) {
    try {
      const sideEffects = [];
      
      // Check for side effects based on actions
      if (strategy.actions && Array.isArray(strategy.actions)) {
        for (const action of strategy.actions) {
          try {
            const actionDef = await this.actionRegistry.getAction(action.id || action.actionId);
            if (actionDef && actionDef.sideEffects && Array.isArray(actionDef.sideEffects)) {
              for (const effect of actionDef.sideEffects) {
                // Check if the side effect is relevant to the current system state
                if (this._isSideEffectRelevant(effect, systemState)) {
                  sideEffects.push({
                    ...effect,
                    actionId: action.id || action.actionId
                  });
                }
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to get side effects for action ${action.id || action.actionId}: ${error.message}`);
          }
        }
      }
      
      return sideEffects;
    } catch (error) {
      this.logger.warn(`Error estimating potential side effects: ${error.message}`);
      return []; // Default to no side effects if estimation fails
    }
  }
  
  /**
   * Checks if a side effect is relevant to the current system state
   * 
   * @private
   * @param {Object} sideEffect - Side effect to check
   * @param {SystemState} systemState - Current system state
   * @returns {boolean} Whether the side effect is relevant
   */
  _isSideEffectRelevant(sideEffect, systemState) {
    // If no system state is available, assume all side effects are relevant
    if (!systemState || typeof systemState !== "object") {
      return true;
    }
    
    // Check if the affected component is in the system state
    if (sideEffect.affectedComponent && systemState.components) {
      const component = systemState.components.find(c => c.id === sideEffect.affectedComponent);
      if (!component) {
        return false; // Component not in system state, side effect not relevant
      }
    }
    
    // Check if the affected resource is in the system state
    if (sideEffect.affectedResource && systemState.resources) {
      const resource = systemState.resources[sideEffect.affectedResource];
      if (!resource) {
        return false; // Resource not in system state, side effect not relevant
      }
    }
    
    return true; // Side effect is relevant
  }
  
  /**
   * Estimates the execution time of a strategy
   * 
   * @private
   * @param {RecoveryStrategy} strategy - Strategy to estimate
   * @param {SystemState} systemState - Current system state
   * @returns {Promise<number>} Estimated execution time in milliseconds
   */
  async _estimateExecutionTime(strategy, systemState) {
    try {
      let totalTime = 0;
      
      // Calculate execution time based on actions
      if (strategy.actions && Array.isArray(strategy.actions)) {
        for (const action of strategy.actions) {
          try {
            const actionDef = await this.actionRegistry.getAction(action.id || action.actionId);
            if (actionDef && actionDef.executionTimeHint) {
              totalTime += actionDef.executionTimeHint;
            } else {
              totalTime += 5000; // Default to 5 seconds if no hint is available
            }
          } catch (error) {
            this.logger.warn(`Failed to get execution time hint for action ${action.id || action.actionId}: ${error.message}`);
            totalTime += 5000; // Default to 5 seconds if action definition is not available
          }
        }
      }
      
      // Adjust based on system state (e.g., slower execution on resource-constrained systems)
      if (systemState && systemState.resources) {
        const cpuLoad = 1 - (systemState.resources.cpu?.available || 50) / 100;
        const memoryLoad = 1 - (systemState.resources.memory?.available || 512) / 1024;
        
        // Increase execution time based on resource load
        const loadFactor = 1 + ((cpuLoad + memoryLoad) / 2);
        totalTime *= loadFactor;
      }
      
      return Math.max(1000, totalTime); // Ensure at least 1 second execution time
    } catch (error) {
      this.logger.warn(`Error estimating execution time: ${error.message}`);
      return 30000; // Default to 30 seconds if estimation fails
    }
  }
  
  /**
   * Generates a human-readable explanation of a strategy
   * 
   * @private
   * @param {RecoveryStrategy} strategy - Strategy to explain
   * @param {Object} analysisResult - Analysis result
   * @returns {Object} Explanation object
   */
  _generateExplanation(strategy, analysisResult) {
    try {
      const rootCause = analysisResult.rootCauses && analysisResult.rootCauses.length > 0 
        ? analysisResult.rootCauses[0] 
        : { type: 'unknown', description: 'Unknown root cause' };
      
      const actionDescriptions = [];
      if (strategy.actions && Array.isArray(strategy.actions)) {
        for (const action of strategy.actions) {
          const actionType = action.type || 'unknown';
          const target = action.target || 'system';
          
          let description = `${this._humanizeActionType(actionType)} ${target}`;
          
          if (action.parameters && Object.keys(action.parameters).length > 0) {
            const paramDescriptions = [];
            for (const [key, value] of Object.entries(action.parameters)) {
              paramDescriptions.push(`${this._humanizeParameterName(key)}: ${this._formatParameterValue(value)}`);
            }
            
            if (paramDescriptions.length > 0) {
              description += ` with ${paramDescriptions.join(', ')}`;
            }
          }
          
          actionDescriptions.push(description);
        }
      }
      
      const summary = `This strategy attempts to recover from ${rootCause.description || rootCause.type} by ${actionDescriptions.join(' and then ')}.`;
      
      const confidence = strategy.metadata?.confidence || 0.5;
      let confidenceDescription = 'moderate';
      if (confidence >= 0.8) {
        confidenceDescription = 'high';
      } else if (confidence >= 0.6) {
        confidenceDescription = 'good';
      } else if (confidence <= 0.3) {
        confidenceDescription = 'low';
      }
      
      const confidenceStatement = `Based on historical data and analysis, this strategy has a ${confidenceDescription} chance of success.`;
      
      return {
        summary,
        confidence: confidenceStatement,
        actions: actionDescriptions,
        rootCause: rootCause.description || rootCause.type
      };
    } catch (error) {
      this.logger.warn(`Error generating explanation: ${error.message}`);
      return { summary: "Recovery strategy for the detected issue" }; // Default if explanation generation fails
    }
  }
  
  /**
   * Humanizes an action type for explanation
   * 
   * @private
   * @param {string} actionType - Action type
   * @returns {string} Humanized action type
   */
  _humanizeActionType(actionType) {
    const mappings = {
      'restart': 'restart',
      'restart_connection': 'reconnect',
      'retry': 'retry',
      'free_resources': 'free resources in',
      'reconfigure': 'reconfigure',
      'elevate_permissions': 'elevate permissions for',
      'restore_backup': 'restore backup of',
      'update_component': 'update',
      'restart_dependency': 'restart dependency of'
    };
    
    return mappings[actionType] || actionType;
  }
  
  /**
   * Humanizes a parameter name for explanation
   * 
   * @private
   * @param {string} paramName - Parameter name
   * @returns {string} Humanized parameter name
   */
  _humanizeParameterName(paramName) {
    // Convert camelCase to space-separated words
    return paramName.replace(/([A-Z])/g, ' $1').toLowerCase();
  }
  
  /**
   * Formats a parameter value for explanation
   * 
   * @private
   * @param {*} value - Parameter value
   * @returns {string} Formatted parameter value
   */
  _formatParameterValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  }

  /**
   * Adapts a strategy based on system state and constraints.
   * @param {RecoveryStrategy} strategy - Strategy to adapt
   * @param {SystemState} systemState - Current system state
   * @param {Object} [constraints] - Adaptation constraints
   * @returns {Promise<RecoveryStrategy>} Adapted strategy
   */
  async adaptStrategy(strategy, systemState, constraints = {}) {
    const startTime = Date.now();
    const adaptationId = uuidv4();

    // Ensure strategy is valid
    if (!strategy || typeof strategy !== "object") {
      this.logger.warn(`Invalid strategy provided for adaptation, returning null`);
      return null;
    }

    // Ensure strategy has an ID
    if (!strategy.id) {
      strategy.id = `strategy-${uuidv4()}`;
    }

    // Ensure systemState is valid
    if (!systemState || typeof systemState !== "object") {
      systemState = { resources: {}, components: [] }; // Provide a default empty state
      this.logger.warn(`Invalid or missing system state for adaptation, using default empty state.`);
    }

    try {
      this.logger.debug(`Starting strategy adaptation: ${adaptationId}`);
      this._emitEvent("strategy:adaptation:started", { adaptationId, strategy, systemState, constraints });

      // Create a deep copy of the strategy to avoid modifying the original
      const adaptedStrategy = JSON.parse(JSON.stringify(strategy));

      // Adapt actions based on system state and constraints
      if (adaptedStrategy.actions && Array.isArray(adaptedStrategy.actions)) {
        for (let i = 0; i < adaptedStrategy.actions.length; i++) {
          const action = adaptedStrategy.actions[i];
          
          // Skip if action is null or undefined
          if (!action) continue;
          
          // Get action definition from registry
          const actionDef = await this.actionRegistry.getAction(action.actionId);
          if (!actionDef) {
            this.logger.warn(`Action definition not found for ${action.actionId}, skipping adaptation`);
            continue;
          }

          // Adapt action parameters based on system state
          if (action.parameters && actionDef.resourceHints) {
            // Check if system has enough resources
            const requiredCpu = actionDef.resourceHints.cpu || 0;
            const requiredMemory = actionDef.resourceHints.memory || 0;
            const availableCpu = systemState.resources?.cpu?.available || 0;
            const availableMemory = systemState.resources?.memory?.available || 0;

            if (requiredCpu > availableCpu || requiredMemory > availableMemory) {
              // Adapt action to use less resources
              if (action.parameters.depth && requiredCpu > availableCpu) {
                if (action.parameters.depth === "deep") {
                  action.parameters.depth = "medium";
                } else if (action.parameters.depth === "medium") {
                  action.parameters.depth = "shallow";
                }
              }

              // Add note about adaptation
              if (!adaptedStrategy.metadata) {
                adaptedStrategy.metadata = {};
              }
              if (!adaptedStrategy.metadata.adaptations) {
                adaptedStrategy.metadata.adaptations = [];
              }
              adaptedStrategy.metadata.adaptations.push({
                actionId: action.actionId,
                reason: "resource_constraint",
                original: JSON.parse(JSON.stringify(strategy.actions[i])),
                adapted: JSON.parse(JSON.stringify(action))
              });
            }
          }

          // Apply constraints to action parameters
          if (constraints.maxRetries && action.parameters && action.parameters.maxRetries) {
            const originalMaxRetries = action.parameters.maxRetries;
            action.parameters.maxRetries = Math.min(action.parameters.maxRetries, constraints.maxRetries);
            
            // Add note about adaptation if changed
            if (action.parameters.maxRetries !== originalMaxRetries) {
              if (!adaptedStrategy.metadata) {
                adaptedStrategy.metadata = {};
              }
              if (!adaptedStrategy.metadata.adaptations) {
                adaptedStrategy.metadata.adaptations = [];
              }
              adaptedStrategy.metadata.adaptations.push({
                actionId: action.actionId,
                reason: "constraint_maxRetries",
                original: { maxRetries: originalMaxRetries },
                adapted: { maxRetries: action.parameters.maxRetries }
              });
            }
          }

          // Apply timeout constraints
          if (constraints.maxTimeout && action.parameters && action.parameters.timeout) {
            const originalTimeout = action.parameters.timeout;
            action.parameters.timeout = Math.min(action.parameters.timeout, constraints.maxTimeout);
            
            // Add note about adaptation if changed
            if (action.parameters.timeout !== originalTimeout) {
              if (!adaptedStrategy.metadata) {
                adaptedStrategy.metadata = {};
              }
              if (!adaptedStrategy.metadata.adaptations) {
                adaptedStrategy.metadata.adaptations = [];
              }
              adaptedStrategy.metadata.adaptations.push({
                actionId: action.actionId,
                reason: "constraint_maxTimeout",
                original: { timeout: originalTimeout },
                adapted: { timeout: action.parameters.timeout }
              });
            }
          }
        }
      }

      // Update metadata
      if (!adaptedStrategy.metadata) {
        adaptedStrategy.metadata = {};
      }
      adaptedStrategy.metadata.adaptedAt = Date.now();
      adaptedStrategy.metadata.originalStrategyId = strategy.id;

      const duration = Date.now() - startTime;
      this.logger.debug(`Completed strategy adaptation in ${duration}ms: ${adaptationId}`);
      this._emitEvent("strategy:adaptation:completed", { adaptationId, strategy: adaptedStrategy, duration });

      if (this.metrics && typeof this.metrics.recordMetric === 'function') {
        this.metrics.recordMetric("strategy_adaptation_duration", duration);
      }

      return adaptedStrategy;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error during strategy adaptation: ${error.message}`, error);
      this._emitEvent("strategy:adaptation:failed", { adaptationId, error, duration });
      
      // Return original strategy instead of throwing error
      return strategy;
    }
  }
}

module.exports = RecoveryStrategyGenerator;
