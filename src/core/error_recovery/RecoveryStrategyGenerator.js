/**
 * RecoveryStrategyGenerator.js
 * 
 * Enhanced RecoveryStrategyGenerator with full Aideon integration.
 * Implements the "Intelligent Recovery Tentacle" pattern for autonomous error recovery.
 * 
 * This component is responsible for generating contextually appropriate recovery strategies
 * based on sophisticated error analysis, integrating with Aideon's SCALM, HTN Planner,
 * Knowledge Framework, and ML Layer to provide adaptive recovery capabilities.
 * 
 * @module core/error_recovery/RecoveryStrategyGenerator
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const TentacleContextAnalyzer = require('./strategy/TentacleContextAnalyzer');
const StrategyMLPredictor = require('./strategy/StrategyMLPredictor');
const StrategySecurityValidator = require('./strategy/StrategySecurityValidator');
const DistributedRecoveryAnalyzer = require('./strategy/DistributedRecoveryAnalyzer');
const EnhancedStrategyFactory = require('./strategy/EnhancedStrategyFactory');
const StrategyGenerationMetrics = require('./metrics/StrategyGenerationMetrics');
const AdaptivePerformanceOptimizer = require('./performance/AdaptivePerformanceOptimizer');
const StrategySecurityFramework = require('./security/StrategySecurityFramework');

/**
 * Enhanced RecoveryStrategyGenerator with full Aideon integration.
 * Implements the "Intelligent Recovery Tentacle" pattern.
 */
class RecoveryStrategyGenerator {
  /**
   * Creates a new RecoveryStrategyGenerator with enhanced capabilities.
   * @param {Object} dependencies - Enhanced dependency injection
   * @param {EventBus} dependencies.eventBus - Formalized IPC/Message Bus
   * @param {RecoveryLearningSystem} dependencies.learningSystem - Legacy learning system
   * @param {ScalmFramework} dependencies.scalmFramework - SCALM integration
   * @param {KnowledgeFramework} dependencies.knowledgeFramework - Knowledge base access
   * @param {HtnPlanner} dependencies.htnPlanner - HTN Planner integration
   * @param {SecurityMonitor} dependencies.securityMonitor - Security framework
   * @param {MlLayer} dependencies.mlLayer - ML capabilities
   * @param {DistributedProcessingManager} dependencies.distributedManager - Distributed processing
   * @param {Object} config - Enhanced configuration options
   */
  constructor(dependencies, config = {}) {
    if (!dependencies || !dependencies.eventBus) {
      throw new Error('EventBus is required for RecoveryStrategyGenerator');
    }

    // Core dependencies
    this.eventBus = dependencies.eventBus;
    this.learningSystem = dependencies.learningSystem;
    this.scalmFramework = dependencies.scalmFramework;
    this.knowledgeFramework = dependencies.knowledgeFramework;
    this.htnPlanner = dependencies.htnPlanner;
    this.securityMonitor = dependencies.securityMonitor;
    this.mlLayer = dependencies.mlLayer;
    this.distributedManager = dependencies.distributedManager;
    
    // Enhanced components
    this.strategyFactory = new EnhancedStrategyFactory(dependencies);
    this.contextAnalyzer = new TentacleContextAnalyzer(dependencies);
    this.mlPredictor = new StrategyMLPredictor(dependencies.mlLayer);
    this.securityValidator = new StrategySecurityValidator(dependencies.securityMonitor);
    this.distributedAnalyzer = new DistributedRecoveryAnalyzer(dependencies.distributedManager);
    this.metrics = new StrategyGenerationMetrics();
    this.performanceOptimizer = new AdaptivePerformanceOptimizer(this.metrics, config.performance);
    this.securityFramework = new StrategySecurityFramework(
      dependencies.securityMonitor, 
      dependencies.authManager
    );
    
    // Configuration
    this.config = this._mergeConfig(this._getDefaultConfig(), config);
    
    // State
    this.isInitialized = false;
    this.strategyCache = new Map();
    this.activeGenerations = new Map();
    
    // Initialize
    this._initialize();
  }

  /**
   * Initializes the RecoveryStrategyGenerator.
   * @private
   */
  async _initialize() {
    try {
      await this._registerEventHandlers();
      await this._initializeComponents();
      
      this.isInitialized = true;
      
      this.eventBus.emit('component:initialized', {
        component: 'RecoveryStrategyGenerator',
        timestamp: Date.now()
      });
    } catch (error) {
      this.eventBus.emit('component:initialization:failed', {
        component: 'RecoveryStrategyGenerator',
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Failed to initialize RecoveryStrategyGenerator: ${error.message}`);
    }
  }

  /**
   * Registers event handlers for the RecoveryStrategyGenerator.
   * @private
   */
  async _registerEventHandlers() {
    // Core error recovery events
    this.eventBus.on('error:analysis:completed', this._handleErrorAnalysisCompleted.bind(this));
    this.eventBus.on('strategy:execution:completed', this._handleStrategyExecutionCompleted.bind(this));
    this.eventBus.on('strategy:execution:failed', this._handleStrategyExecutionFailed.bind(this));

    // Framework integration events
    this.eventBus.on('scalm:adaptation:triggered', this._handleScalmAdaptation.bind(this));
    this.eventBus.on('htn:plan:failed', this._handleHtnPlanFailed.bind(this));
    this.eventBus.on('knowledge:updated', this._handleKnowledgeUpdated.bind(this));
    this.eventBus.on('ml:model:updated', this._handleMlModelUpdated.bind(this));

    // System state events
    this.eventBus.on('system:tentacle:state:changed', this._handleTentacleStateChanged.bind(this));
    this.eventBus.on('security:permissions:changed', this._handlePermissionsChanged.bind(this));
    this.eventBus.on('distributed:topology:changed', this._handleTopologyChanged.bind(this));

    // User interaction events
    this.eventBus.on('user:approval:granted', this._handleUserApprovalGranted.bind(this));
    this.eventBus.on('user:approval:denied', this._handleUserApprovalDenied.bind(this));
    this.eventBus.on('user:preference:updated', this._handleUserPreferenceUpdated.bind(this));
  }

  /**
   * Initializes the components of the RecoveryStrategyGenerator.
   * @private
   */
  async _initializeComponents() {
    await Promise.all([
      this.strategyFactory.initialize(),
      this.contextAnalyzer.initialize(),
      this.mlPredictor.initialize(),
      this.securityValidator.initialize(),
      this.distributedAnalyzer.initialize(),
      this.metrics.initialize(),
      this.performanceOptimizer.initialize(),
      this.securityFramework.initialize()
    ]);
  }

  /**
   * Gets the default configuration for the RecoveryStrategyGenerator.
   * @private
   * @returns {Object} The default configuration.
   */
  _getDefaultConfig() {
    return {
      // Core configuration
      maxStrategies: 5,
      generationTimeoutMs: 2000,
      enabledStrategyTypes: ['all'],
      
      // ML configuration
      mlEnhancement: {
        enabled: true,
        predictionModels: ['success_prediction', 'ranking_model'],
        confidenceThreshold: 0.7,
        learningRate: 0.01
      },
      
      // Security configuration
      security: {
        maxRiskLevel: 'medium',
        requireUserApproval: ['high_risk', 'system_modification'],
        auditLevel: 'comprehensive'
      },
      
      // Distributed configuration
      distributed: {
        enabled: true,
        maxDevices: 3,
        coordinationTimeout: 5000,
        failoverStrategy: 'automatic'
      },
      
      // Tentacle configuration
      tentacles: {
        coordinationMode: 'adaptive',
        resourceSharing: true,
        isolationLevel: 'process'
      },
      
      // Performance configuration
      performance: {
        cacheSize: 100,
        parallelEvaluation: true,
        adaptiveOptimization: true
      }
    };
  }

  /**
   * Merges the default configuration with the provided configuration.
   * @private
   * @param {Object} defaultConfig - The default configuration.
   * @param {Object} userConfig - The user-provided configuration.
   * @returns {Object} The merged configuration.
   */
  _mergeConfig(defaultConfig, userConfig) {
    const mergedConfig = { ...defaultConfig };
    
    // Recursively merge nested objects
    for (const [key, value] of Object.entries(userConfig)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && 
          mergedConfig[key] && typeof mergedConfig[key] === 'object') {
        mergedConfig[key] = this._mergeConfig(mergedConfig[key], value);
      } else {
        mergedConfig[key] = value;
      }
    }
    
    return mergedConfig;
  }

  /**
   * Enhanced strategy generation with ML integration and tentacle awareness.
   * @param {Object} errorAnalysis - Enhanced error analysis from CausalAnalyzer
   * @param {Object} systemContext - Current system context including tentacle states
   * @returns {Promise<Array<Object>>} ML-ranked recovery strategies
   */
  async generateStrategies(errorAnalysis, systemContext) {
    if (!this.isInitialized) {
      throw new Error('RecoveryStrategyGenerator is not initialized');
    }

    if (!errorAnalysis || !errorAnalysis.id) {
      throw new Error('Valid error analysis is required for strategy generation');
    }

    const generationId = uuidv4();
    const startTime = Date.now();
    
    try {
      // Track active generation
      this.activeGenerations.set(generationId, {
        errorId: errorAnalysis.id,
        startTime,
        status: 'in_progress'
      });

      // Emit start event
      this.eventBus.emit('strategy:generation:started', {
        generationId,
        errorId: errorAnalysis.id,
        tentacles: errorAnalysis.affectedTentacles || [],
        timestamp: startTime
      });

      // Check cache first if enabled
      if (this.config.performance.cacheEnabled) {
        const cachedStrategies = this._checkStrategyCache(errorAnalysis);
        if (cachedStrategies) {
          this.metrics.recordMetric('cacheHitRate', 1);
          return this._finalizeStrategies(cachedStrategies, generationId, errorAnalysis, startTime);
        }
        this.metrics.recordMetric('cacheHitRate', 0);
      }

      // Set up generation timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Strategy generation timed out after ${this.config.generationTimeoutMs}ms`));
        }, this.config.generationTimeoutMs);
      });

      // Perform strategy generation with timeout
      const generationPromise = this._performStrategyGeneration(errorAnalysis, systemContext);
      const strategies = await Promise.race([generationPromise, timeoutPromise]);
      
      return this._finalizeStrategies(strategies, generationId, errorAnalysis, startTime);
    } catch (error) {
      // Handle generation failure
      this._handleGenerationFailure(generationId, errorAnalysis, error, startTime);
      
      // Return fallback strategies
      return this._generateFallbackStrategies(errorAnalysis);
    }
  }

  /**
   * Performs the actual strategy generation process.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @param {Object} systemContext - The system context.
   * @returns {Promise<Array<Object>>} The generated strategies.
   */
  async _performStrategyGeneration(errorAnalysis, systemContext) {
    // Enhanced context analysis with tentacle awareness
    const enhancedContext = await this.contextAnalyzer.analyzeContext(
      errorAnalysis, 
      systemContext || {}
    );

    // ML-enhanced strategy generation
    const baseStrategies = await this._generateBaseStrategies(errorAnalysis, enhancedContext);
    const mlEnhancedStrategies = this.config.mlEnhancement.enabled ? 
      await this.mlPredictor.enhanceStrategies(baseStrategies) : 
      baseStrategies;
    
    // Distributed environment considerations
    const distributedStrategies = this.config.distributed.enabled ? 
      await this.distributedAnalyzer.analyzeDistributedOptions(
        mlEnhancedStrategies, 
        enhancedContext
      ) : 
      mlEnhancedStrategies;

    // Security validation with permissions framework
    const validatedStrategies = await this.securityValidator.validateStrategies(
      distributedStrategies,
      errorAnalysis.securityContext || {}
    );

    // Final ranking with ML predictions
    const rankedStrategies = await this._rankStrategiesWithML(
      validatedStrategies, 
      enhancedContext
    );

    // Limit number of strategies
    return rankedStrategies.slice(0, this.config.maxStrategies);
  }

  /**
   * Generates base strategies for the given error analysis.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @param {Object} enhancedContext - The enhanced context.
   * @returns {Promise<Array<Object>>} The base strategies.
   */
  async _generateBaseStrategies(errorAnalysis, enhancedContext) {
    const strategies = [];
    
    // Generate strategies based on error type
    const errorType = errorAnalysis.type || 'unknown';
    const errorComponent = errorAnalysis.component || 'unknown';
    const errorSeverity = errorAnalysis.severity || 'medium';
    
    // Get historical strategies from learning system
    const historicalStrategies = await this._getHistoricalStrategies(
      errorType, 
      errorComponent, 
      errorSeverity
    );
    
    // Add historical strategies if available
    if (historicalStrategies && historicalStrategies.length > 0) {
      strategies.push(...historicalStrategies);
    }
    
    // Generate new strategies based on error type
    const newStrategies = await this.strategyFactory.createStrategiesForError(
      errorAnalysis, 
      enhancedContext
    );
    
    // Add new strategies
    strategies.push(...newStrategies);
    
    // Ensure each strategy has a unique ID
    return strategies.map(strategy => ({
      ...strategy,
      id: strategy.id || uuidv4(),
      generatedAt: Date.now()
    }));
  }

  /**
   * Gets historical strategies from the learning system.
   * @private
   * @param {string} errorType - The error type.
   * @param {string} errorComponent - The error component.
   * @param {string} errorSeverity - The error severity.
   * @returns {Promise<Array<Object>>} The historical strategies.
   */
  async _getHistoricalStrategies(errorType, errorComponent, errorSeverity) {
    try {
      // Try to get strategies from learning system
      if (this.learningSystem) {
        return await this.learningSystem.getStrategiesForError(
          errorType, 
          errorComponent, 
          errorSeverity
        );
      }
      
      // Try to get strategies from knowledge framework
      if (this.knowledgeFramework) {
        return await this.knowledgeFramework.queryStrategies({
          errorType,
          errorComponent,
          errorSeverity,
          limit: 10,
          minSuccessRate: 0.5
        });
      }
      
      return [];
    } catch (error) {
      this.eventBus.emit('strategy:historical:retrieval:failed', {
        errorType,
        errorComponent,
        error: error.message,
        timestamp: Date.now()
      });
      
      return [];
    }
  }

  /**
   * ML-enhanced strategy ranking using specialized models.
   * @private
   * @param {Array<Object>} strategies - The strategies to rank.
   * @param {Object} context - The context.
   * @returns {Promise<Array<Object>>} The ranked strategies.
   */
  async _rankStrategiesWithML(strategies, context) {
    if (!strategies || strategies.length === 0) {
      return [];
    }
    
    try {
      // Use ML for ranking if available
      if (this.mlLayer && this.config.mlEnhancement.enabled) {
        const mlRankings = await this.mlLayer.rankStrategies({
          strategies,
          context,
          historicalData: await this._getHistoricalOutcomes(),
          userPreferences: context.userPreferences || {}
        });

        return strategies
          .map((strategy, index) => ({
            ...strategy,
            mlRanking: mlRankings[index],
            finalScore: this._calculateFinalScore(strategy, mlRankings[index], context)
          }))
          .sort((a, b) => b.finalScore - a.finalScore);
      }
      
      // Fallback to basic ranking
      return this._basicRankStrategies(strategies, context);
    } catch (error) {
      this.eventBus.emit('strategy:ranking:failed', {
        error: error.message,
        fallbackUsed: true,
        timestamp: Date.now()
      });
      
      // Fallback to basic ranking
      return this._basicRankStrategies(strategies, context);
    }
  }

  /**
   * Basic strategy ranking without ML.
   * @private
   * @param {Array<Object>} strategies - The strategies to rank.
   * @param {Object} context - The context.
   * @returns {Array<Object>} The ranked strategies.
   */
  _basicRankStrategies(strategies, context) {
    return strategies
      .map(strategy => ({
        ...strategy,
        finalScore: this._calculateBasicScore(strategy, context)
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculates the final score for a strategy using ML ranking.
   * @private
   * @param {Object} strategy - The strategy.
   * @param {Object} mlRanking - The ML ranking.
   * @param {Object} context - The context.
   * @returns {number} The final score.
   */
  _calculateFinalScore(strategy, mlRanking, context) {
    // Combine multiple factors with weights
    const weights = {
      successProbability: 0.4,
      historicalSuccess: 0.2,
      resourceImpact: 0.1,
      executionTime: 0.1,
      userPreference: 0.2
    };
    
    // Calculate weighted score
    let score = 0;
    
    // ML prediction score
    score += (mlRanking.successProbability || 0.5) * weights.successProbability;
    
    // Historical success rate
    const historicalRate = strategy.learningMetadata?.historicalSuccessRate || 0.5;
    score += historicalRate * weights.historicalSuccess;
    
    // Resource impact (lower is better)
    const resourceImpact = this._normalizeResourceImpact(
      strategy.predictions?.resourceImpact || { cpu: 'medium', memory: 'medium', network: 'medium' }
    );
    score += (1 - resourceImpact) * weights.resourceImpact;
    
    // Execution time (lower is better)
    const execTime = strategy.predictions?.estimatedExecutionTime || 1000;
    const normalizedExecTime = Math.min(1, Math.max(0, 1 - (execTime / 5000)));
    score += normalizedExecTime * weights.executionTime;
    
    // User preference
    const userPref = this._calculateUserPreferenceScore(strategy, context.userPreferences || {});
    score += userPref * weights.userPreference;
    
    return score;
  }

  /**
   * Calculates a basic score for a strategy without ML.
   * @private
   * @param {Object} strategy - The strategy.
   * @param {Object} context - The context.
   * @returns {number} The basic score.
   */
  _calculateBasicScore(strategy, context) {
    // Simple scoring based on available data
    let score = 0.5; // Default middle score
    
    // Historical success rate if available
    if (strategy.learningMetadata?.historicalSuccessRate) {
      score = strategy.learningMetadata.historicalSuccessRate;
    }
    
    // Adjust for strategy type preference
    const strategyTypePreference = {
      retry: 0.7,
      fallback: 0.8,
      circuitBreaking: 0.6,
      resourceAllocation: 0.7,
      stateCorrection: 0.8,
      configurationAdjustment: 0.7,
      componentRestart: 0.5,
      dependencySubstitution: 0.6,
      composite: 0.7
    };
    
    const typeScore = strategyTypePreference[strategy.type] || 0.5;
    
    // Combine scores
    return (score * 0.7) + (typeScore * 0.3);
  }

  /**
   * Normalizes resource impact to a value between 0 and 1.
   * @private
   * @param {Object} resourceImpact - The resource impact.
   * @returns {number} The normalized resource impact.
   */
  _normalizeResourceImpact(resourceImpact) {
    const impactValues = {
      minimal: 0.1,
      low: 0.3,
      medium: 0.5,
      high: 0.8,
      critical: 1.0
    };
    
    const cpuImpact = impactValues[resourceImpact.cpu] || 0.5;
    const memoryImpact = impactValues[resourceImpact.memory] || 0.5;
    const networkImpact = impactValues[resourceImpact.network] || 0.5;
    
    // Weight CPU and memory higher than network
    return (cpuImpact * 0.4) + (memoryImpact * 0.4) + (networkImpact * 0.2);
  }

  /**
   * Calculates a user preference score for a strategy.
   * @private
   * @param {Object} strategy - The strategy.
   * @param {Object} userPreferences - The user preferences.
   * @returns {number} The user preference score.
   */
  _calculateUserPreferenceScore(strategy, userPreferences) {
    // Default preference score
    let score = 0.5;
    
    // Strategy type preference
    if (userPreferences.preferredStrategyTypes) {
      if (userPreferences.preferredStrategyTypes.includes(strategy.type)) {
        score += 0.3;
      } else if (userPreferences.preferredStrategyTypes.includes('all')) {
        score += 0.1;
      }
    }
    
    // User interaction preference
    if (userPreferences.interactionPreference === 'minimal' && 
        !strategy.securityContext?.userApprovalRequired) {
      score += 0.2;
    } else if (userPreferences.interactionPreference === 'guided' && 
               strategy.securityContext?.userApprovalRequired) {
      score += 0.2;
    }
    
    // Resource usage preference
    if (userPreferences.resourcePreference === 'efficient' && 
        this._normalizeResourceImpact(strategy.predictions?.resourceImpact || {}) < 0.4) {
      score += 0.2;
    }
    
    // Cap at 1.0
    return Math.min(1.0, score);
  }

  /**
   * Gets historical strategy outcomes.
   * @private
   * @returns {Promise<Array<Object>>} The historical outcomes.
   */
  async _getHistoricalOutcomes() {
    try {
      if (this.knowledgeFramework) {
        return await this.knowledgeFramework.getHistoricalOutcomes({
          limit: 100,
          sortBy: 'timestamp',
          order: 'desc'
        });
      }
      
      if (this.learningSystem) {
        return await this.learningSystem.getHistoricalOutcomes();
      }
      
      return [];
    } catch (error) {
      this.eventBus.emit('strategy:historical:outcomes:failed', {
        error: error.message,
        timestamp: Date.now()
      });
      
      return [];
    }
  }

  /**
   * Finalizes strategies and handles completion.
   * @private
   * @param {Array<Object>} strategies - The strategies.
   * @param {string} generationId - The generation ID.
   * @param {Object} errorAnalysis - The error analysis.
   * @param {number} startTime - The start time.
   * @returns {Array<Object>} The finalized strategies.
   */
  _finalizeStrategies(strategies, generationId, errorAnalysis, startTime) {
    // Update active generation
    this.activeGenerations.set(generationId, {
      errorId: errorAnalysis.id,
      startTime,
      endTime: Date.now(),
      status: 'completed',
      strategiesCount: strategies.length
    });
    
    // Update cache if enabled
    if (this.config.performance.cacheEnabled && strategies.length > 0) {
      this._updateStrategyCache(errorAnalysis, strategies);
    }
    
    // Record metrics
    this.metrics.recordMetric('generationLatency', Date.now() - startTime);
    this.metrics.recordMetric('strategyCount', strategies.length);
    
    // Emit completion event
    this.eventBus.emit('strategy:generation:completed', {
      generationId,
      errorId: errorAnalysis.id,
      strategiesGenerated: strategies.length,
      topStrategy: strategies[0]?.id,
      generationTimeMs: Date.now() - startTime,
      timestamp: Date.now()
    });
    
    return strategies;
  }

  /**
   * Handles strategy generation failure.
   * @private
   * @param {string} generationId - The generation ID.
   * @param {Object} errorAnalysis - The error analysis.
   * @param {Error} error - The error.
   * @param {number} startTime - The start time.
   */
  _handleGenerationFailure(generationId, errorAnalysis, error, startTime) {
    // Update active generation
    this.activeGenerations.set(generationId, {
      errorId: errorAnalysis.id,
      startTime,
      endTime: Date.now(),
      status: 'failed',
      error: error.message
    });
    
    // Record metrics
    this.metrics.recordMetric('generationFailures', 1);
    this.metrics.recordMetric('generationLatency', Date.now() - startTime);
    
    // Emit failure event
    this.eventBus.emit('strategy:generation:failed', {
      generationId,
      errorId: errorAnalysis.id,
      error: error.message,
      fallbackUsed: true,
      timestamp: Date.now()
    });
  }

  /**
   * Generates fallback strategies for when normal generation fails.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @returns {Array<Object>} The fallback strategies.
   */
  async _generateFallbackStrategies(errorAnalysis) {
    try {
      // Create basic retry strategy
      const retryStrategy = {
        id: uuidv4(),
        type: 'retry',
        name: 'Basic Retry Strategy',
        description: 'Simple retry with exponential backoff',
        targetError: {
          type: errorAnalysis.type || 'unknown',
          component: errorAnalysis.component || 'unknown',
          severity: errorAnalysis.severity || 'medium'
        },
        actions: [
          {
            type: 'retry',
            target: errorAnalysis.component || 'unknown',
            parameters: {
              maxRetries: 3,
              backoffFactor: 2,
              initialDelayMs: 1000
            }
          }
        ],
        expectedOutcome: {
          successCriteria: 'operation completes without error',
          timeoutMs: 10000
        },
        metadata: {
          createdAt: Date.now(),
          createdBy: 'RecoveryStrategyGenerator',
          isFallback: true
        }
      };
      
      // Create basic component restart strategy
      const restartStrategy = {
        id: uuidv4(),
        type: 'componentRestart',
        name: 'Component Restart Strategy',
        description: 'Restart the affected component',
        targetError: {
          type: errorAnalysis.type || 'unknown',
          component: errorAnalysis.component || 'unknown',
          severity: errorAnalysis.severity || 'medium'
        },
        actions: [
          {
            type: 'restart',
            target: errorAnalysis.component || 'unknown',
            parameters: {
              gracefulShutdown: true,
              timeoutMs: 5000
            }
          }
        ],
        expectedOutcome: {
          successCriteria: 'component restarts successfully',
          timeoutMs: 10000
        },
        metadata: {
          createdAt: Date.now(),
          createdBy: 'RecoveryStrategyGenerator',
          isFallback: true
        }
      };
      
      return [retryStrategy, restartStrategy];
    } catch (error) {
      // Last resort fallback
      return [{
        id: uuidv4(),
        type: 'manual',
        name: 'Manual Intervention Required',
        description: 'Automatic strategy generation failed, manual intervention is required',
        targetError: {
          type: errorAnalysis.type || 'unknown',
          component: errorAnalysis.component || 'unknown',
          severity: errorAnalysis.severity || 'medium'
        },
        actions: [
          {
            type: 'notify',
            target: 'user',
            parameters: {
              message: `Error recovery failed for ${errorAnalysis.component || 'unknown'}: ${errorAnalysis.message || 'Unknown error'}`,
              level: 'error'
            }
          }
        ],
        metadata: {
          createdAt: Date.now(),
          createdBy: 'RecoveryStrategyGenerator',
          isFallback: true,
          isLastResort: true
        }
      }];
    }
  }

  /**
   * Checks the strategy cache for matching strategies.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @returns {Array<Object>|null} The cached strategies or null if not found.
   */
  _checkStrategyCache(errorAnalysis) {
    const cacheKey = this._generateCacheKey(errorAnalysis);
    const cachedEntry = this.strategyCache.get(cacheKey);
    
    if (!cachedEntry) {
      return null;
    }
    
    // Check if cache entry is still valid
    const now = Date.now();
    if (now - cachedEntry.timestamp > this.config.performance.cacheTtlMs) {
      this.strategyCache.delete(cacheKey);
      return null;
    }
    
    return cachedEntry.strategies;
  }

  /**
   * Updates the strategy cache with new strategies.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @param {Array<Object>} strategies - The strategies.
   */
  _updateStrategyCache(errorAnalysis, strategies) {
    const cacheKey = this._generateCacheKey(errorAnalysis);
    
    this.strategyCache.set(cacheKey, {
      timestamp: Date.now(),
      strategies: strategies
    });
    
    // Prune cache if it exceeds the size limit
    if (this.strategyCache.size > this.config.performance.cacheSize) {
      // Remove oldest entries
      const entries = [...this.strategyCache.entries()];
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const entriesToRemove = entries.slice(0, entries.length - this.config.performance.cacheSize);
      for (const [key] of entriesToRemove) {
        this.strategyCache.delete(key);
      }
    }
  }

  /**
   * Generates a cache key for the error analysis.
   * @private
   * @param {Object} errorAnalysis - The error analysis.
   * @returns {string} The cache key.
   */
  _generateCacheKey(errorAnalysis) {
    const keyParts = [
      errorAnalysis.type || 'unknown',
      errorAnalysis.component || 'unknown',
      errorAnalysis.severity || 'medium',
      errorAnalysis.errorCode || 'unknown'
    ];
    
    return keyParts.join(':');
  }

  /**
   * Handles execution feedback with SCALM integration.
   * @param {Object} strategy - The executed strategy.
   * @param {Object} result - The execution result.
   * @param {Object} context - The execution context.
   * @returns {Promise<void>} A promise that resolves when the feedback is processed.
   */
  async handleExecutionFeedback(strategy, result, context) {
    if (!strategy || !result) {
      throw new Error('Strategy and result are required for execution feedback');
    }
    
    try {
      // Update knowledge framework
      if (this.knowledgeFramework) {
        await this.knowledgeFramework.recordStrategyOutcome({
          strategyId: strategy.id,
          result,
          context,
          timestamp: Date.now()
        });
      }

      // Update learning system
      if (this.learningSystem) {
        if (result.success) {
          await this.learningSystem.recordSuccess(strategy, result);
        } else {
          await this.learningSystem.recordFailure(strategy, result);
        }
      }

      // Trigger SCALM learning
      if (this.scalmFramework) {
        await this.scalmFramework.processExecutionOutcome({
          strategy,
          result,
          context,
          learningSignal: this._generateLearningSignal(result)
        });
      }

      // Update ML models if significant outcome
      if (this.mlLayer && this._isSignificantOutcome(result)) {
        await this.mlLayer.updateStrategyPredictionModels({
          strategy,
          actualOutcome: result,
          context
        });
      }

      // Record metrics
      this.metrics.recordMetric(
        result.success ? 'strategySuccessRate' : 'strategyFailureRate', 
        1
      );
      
      if (result.executionTimeMs) {
        this.metrics.recordMetric('strategyExecutionTime', result.executionTimeMs);
      }

      // Emit feedback processed event
      this.eventBus.emit('strategy:feedback:processed', {
        strategyId: strategy.id,
        success: result.success,
        learningUpdate: true,
        timestamp: Date.now()
      });
      
      // Invalidate cache for this error type if needed
      if (this.config.performance.cacheEnabled && strategy.targetError) {
        const cacheKey = this._generateCacheKey(strategy.targetError);
        this.strategyCache.delete(cacheKey);
      }
      
      // Optimize performance based on metrics
      if (this.config.performance.adaptiveOptimization) {
        await this.performanceOptimizer.optimizeBasedOnMetrics();
      }
    } catch (error) {
      this.eventBus.emit('strategy:feedback:failed', {
        strategyId: strategy.id,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Failed to process execution feedback: ${error.message}`);
    }
  }

  /**
   * Generates a learning signal from the execution result.
   * @private
   * @param {Object} result - The execution result.
   * @returns {Object} The learning signal.
   */
  _generateLearningSignal(result) {
    return {
      success: result.success,
      confidence: result.success ? 1.0 : 0.0,
      metrics: result.metrics || {},
      timestamp: Date.now()
    };
  }

  /**
   * Determines if an outcome is significant enough to update ML models.
   * @private
   * @param {Object} result - The execution result.
   * @returns {boolean} Whether the outcome is significant.
   */
  _isSignificantOutcome(result) {
    // Consider outcomes significant if they have detailed metrics
    // or if they represent extreme success/failure
    return (
      (result.metrics && Object.keys(result.metrics).length > 0) ||
      (result.success && result.executionTimeMs && result.executionTimeMs < 500) ||
      (!result.success && result.error && result.error.severity === 'critical')
    );
  }

  /**
   * Event handler for error analysis completed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleErrorAnalysisCompleted(data) {
    try {
      if (!data || !data.analysis) {
        return;
      }
      
      // Auto-generate strategies if configured
      if (this.config.autoGenerateStrategies) {
        const systemContext = await this._getCurrentSystemContext();
        await this.generateStrategies(data.analysis, systemContext);
      }
    } catch (error) {
      this.eventBus.emit('strategy:auto:generation:failed', {
        errorId: data.analysis?.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Event handler for strategy execution completed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleStrategyExecutionCompleted(data) {
    try {
      if (!data || !data.strategy || !data.result) {
        return;
      }
      
      const context = await this._getCurrentSystemContext();
      await this.handleExecutionFeedback(data.strategy, data.result, context);
    } catch (error) {
      this.eventBus.emit('strategy:feedback:failed', {
        strategyId: data.strategy?.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Event handler for strategy execution failed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleStrategyExecutionFailed(data) {
    try {
      if (!data || !data.strategy || !data.error) {
        return;
      }
      
      const context = await this._getCurrentSystemContext();
      await this.handleExecutionFeedback(
        data.strategy, 
        { 
          success: false, 
          error: data.error,
          executionTimeMs: data.executionTimeMs
        }, 
        context
      );
    } catch (error) {
      this.eventBus.emit('strategy:feedback:failed', {
        strategyId: data.strategy?.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Event handler for SCALM adaptation triggered.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleScalmAdaptation(data) {
    // Handle SCALM adaptation events
    // This could involve updating strategy generation parameters
    // based on system-wide learning
  }

  /**
   * Event handler for HTN plan failed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleHtnPlanFailed(data) {
    // Handle HTN plan failure events
    // This could involve generating recovery strategies
    // specifically for planning failures
  }

  /**
   * Event handler for knowledge updated.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleKnowledgeUpdated(data) {
    // Handle knowledge update events
    // This could involve invalidating caches or
    // updating strategy generation parameters
    if (data && data.domain === 'recovery_strategies') {
      // Clear relevant cache entries
      if (this.config.performance.cacheEnabled) {
        this._pruneStrategyCache();
      }
    }
  }

  /**
   * Event handler for ML model updated.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleMlModelUpdated(data) {
    // Handle ML model update events
    // This could involve updating the ML predictor
    // or invalidating caches
    if (data && data.modelType === 'strategy_prediction') {
      await this.mlPredictor.updateModel(data.modelId);
    }
  }

  /**
   * Event handler for tentacle state changed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleTentacleStateChanged(data) {
    // Handle tentacle state change events
    // This could involve updating context for strategy generation
  }

  /**
   * Event handler for permissions changed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handlePermissionsChanged(data) {
    // Handle permissions change events
    // This could involve updating security validation parameters
  }

  /**
   * Event handler for topology changed.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleTopologyChanged(data) {
    // Handle topology change events
    // This could involve updating distributed recovery options
  }

  /**
   * Event handler for user approval granted.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleUserApprovalGranted(data) {
    // Handle user approval granted events
    // This could involve proceeding with strategy execution
  }

  /**
   * Event handler for user approval denied.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleUserApprovalDenied(data) {
    // Handle user approval denied events
    // This could involve generating alternative strategies
  }

  /**
   * Event handler for user preference updated.
   * @private
   * @param {Object} data - The event data.
   */
  async _handleUserPreferenceUpdated(data) {
    // Handle user preference update events
    // This could involve updating strategy ranking parameters
  }

  /**
   * Gets the current system context.
   * @private
   * @returns {Promise<Object>} The current system context.
   */
  async _getCurrentSystemContext() {
    try {
      // Try to get context from various sources
      const context = {};
      
      // Get tentacle states if available
      if (this.contextAnalyzer) {
        context.tentacleStates = await this.contextAnalyzer.getCurrentTentacleStates();
      }
      
      // Get user preferences if available
      if (this.knowledgeFramework) {
        context.userPreferences = await this.knowledgeFramework.getUserPreferences();
      }
      
      // Get system resources if available
      if (this.distributedManager) {
        context.availableResources = await this.distributedManager.getAvailableResources();
      }
      
      return context;
    } catch (error) {
      this.eventBus.emit('context:retrieval:failed', {
        error: error.message,
        timestamp: Date.now()
      });
      
      return {};
    }
  }

  /**
   * Prunes the strategy cache based on age and relevance.
   * @private
   */
  _pruneStrategyCache() {
    if (!this.strategyCache || this.strategyCache.size === 0) {
      return;
    }
    
    const now = Date.now();
    const ttl = this.config.performance.cacheTtlMs || 300000; // 5 minutes default
    
    // Remove expired entries
    for (const [key, entry] of this.strategyCache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.strategyCache.delete(key);
      }
    }
  }

  /**
   * Shuts down the RecoveryStrategyGenerator.
   * @returns {Promise<void>} A promise that resolves when shutdown is complete.
   */
  async shutdown() {
    try {
      // Clean up resources
      this.strategyCache.clear();
      this.activeGenerations.clear();
      
      // Shut down components
      await Promise.all([
        this.strategyFactory.shutdown(),
        this.contextAnalyzer.shutdown(),
        this.mlPredictor.shutdown(),
        this.securityValidator.shutdown(),
        this.distributedAnalyzer.shutdown(),
        this.metrics.shutdown(),
        this.performanceOptimizer.shutdown(),
        this.securityFramework.shutdown()
      ]);
      
      // Remove event listeners
      this.eventBus.removeAllListeners();
      
      this.isInitialized = false;
      
      this.eventBus.emit('component:shutdown', {
        component: 'RecoveryStrategyGenerator',
        timestamp: Date.now()
      });
    } catch (error) {
      this.eventBus.emit('component:shutdown:failed', {
        component: 'RecoveryStrategyGenerator',
        error: error.message,
        timestamp: Date.now()
      });
      
      throw new Error(`Failed to shut down RecoveryStrategyGenerator: ${error.message}`);
    }
  }
}

module.exports = RecoveryStrategyGenerator;
