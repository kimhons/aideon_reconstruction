/**
 * AutonomousRecoveryOrchestrator.js
 * 
 * Orchestrates the autonomous error recovery process by coordinating all components
 * of the Error Recovery System. This is the main entry point for the Error Recovery System.
 * 
 * @module src/core/error_recovery/AutonomousRecoveryOrchestrator
 */

'use strict';

const EventBus = require('./foundation/EventBus');
const DependencyContainer = require('./foundation/DependencyContainer');
const RecoveryLearningSystem = require('./RecoveryLearningSystem');
const RecoveryStrategyGenerator = require('./RecoveryStrategyGenerator');
const ResolutionExecutor = require('./ResolutionExecutor');
const CausalAnalyzer = require('./CausalAnalyzer');
const ContextManager = require('./foundation/ContextManager');

/**
 * Class responsible for orchestrating the autonomous error recovery process
 */
class AutonomousRecoveryOrchestrator {
  /**
   * Creates a new AutonomousRecoveryOrchestrator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication (optional, will create if not provided)
   * @param {Object} options.dependencyContainer - Dependency container (optional, will create if not provided)
   * @param {Object} options.config - Configuration settings
   * @param {boolean} options.skipSelfRegistration - Skip self-registration in dependency container (for testing)
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.dependencyContainer = options.dependencyContainer || new DependencyContainer({ eventBus: this.eventBus });
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.autoRecoveryEnabled = this.config.autoRecoveryEnabled !== false;
    this.maxRecoveryAttempts = this.config.maxRecoveryAttempts || 3;
    this.recoveryTimeout = this.config.recoveryTimeout || 30000; // 30 seconds
    
    this.activeRecoveries = new Map();
    this.recoveryHistory = [];
    this.isInitialized = false;
    
    // Register this component with the dependency container
    // Skip self-registration if requested (for testing scenarios)
    if (!options.skipSelfRegistration) {
      // Use registerInstance instead of register for self-registration
      if (this.dependencyContainer.registerInstance) {
        this.dependencyContainer.registerInstance('recoveryOrchestrator', this);
      } else {
        // Fallback to register with a factory function if registerInstance is not available
        this.dependencyContainer.register('recoveryOrchestrator', () => this);
      }
    }
  }
  
  /**
   * Initialize the recovery orchestrator and its components
   * 
   * @returns {Promise<boolean>} Initialization result
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      // Register core components with the dependency container
      await this._registerComponents();
      
      // Initialize components
      await this._initializeComponents();
      
      // Set up event listeners
      this._setupEventListeners();
      
      this.isInitialized = true;
      
      // Emit initialization event
      this.eventBus.emit('recovery:orchestrator:initialized', {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize recovery orchestrator:', error);
      
      // Emit error event
      this.eventBus.emit('recovery:orchestrator:error', {
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      return false;
    }
  }
  
  /**
   * Handle an error and attempt recovery
   * 
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   */
  async recoverFromError(error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return {
        success: false,
        reason: 'recovery_disabled',
        error
      };
    }
    
    try {
      // Generate recovery ID
      const recoveryId = `recovery_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Create recovery record
      const recovery = {
        id: recoveryId,
        error,
        context,
        startTime: Date.now(),
        endTime: null,
        duration: null,
        status: 'analyzing',
        attempts: 0,
        strategies: [],
        selectedStrategy: null,
        result: null
      };
      
      // Store recovery
      this.activeRecoveries.set(recoveryId, recovery);
      
      // Emit recovery started event
      this.eventBus.emit('recovery:started', {
        recoveryId,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        context,
        timestamp: recovery.startTime
      });
      
      // Get context manager
      const contextManager = this.dependencyContainer.resolve('contextManager');
      
      // Enhance context with system state
      const enhancedContext = await contextManager.enhanceContext({
        ...context,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        recoveryId
      });
      
      // Analyze error
      recovery.status = 'analyzing';
      const causalAnalyzer = this.dependencyContainer.resolve('causalAnalyzer');
      const analysisResult = await causalAnalyzer.analyzeError(error, enhancedContext);
      
      if (!analysisResult.success) {
        return this._completeRecovery(recoveryId, {
          success: false,
          reason: 'analysis_failed',
          error: analysisResult.error
        });
      }
      
      // Generate recovery strategies
      recovery.status = 'generating_strategies';
      const strategyGenerator = this.dependencyContainer.resolve('strategyGenerator');
      const generationResult = await strategyGenerator.generateStrategies(analysisResult.rootCauses, enhancedContext);
      
      if (!generationResult.success || !generationResult.strategies || generationResult.strategies.length === 0) {
        return this._completeRecovery(recoveryId, {
          success: false,
          reason: 'no_strategies_available',
          error: generationResult.error || new Error('No recovery strategies available')
        });
      }
      
      // Store strategies
      recovery.strategies = generationResult.strategies;
      
      // Select best strategy
      recovery.selectedStrategy = generationResult.strategies[0]; // Best strategy is first
      
      // Check if auto-recovery is enabled
      if (!this.autoRecoveryEnabled) {
        return this._completeRecovery(recoveryId, {
          success: false,
          reason: 'auto_recovery_disabled',
          availableStrategies: recovery.strategies.map(s => ({
            id: s.id,
            type: s.type,
            confidence: s.confidence,
            description: s.description
          }))
        });
      }
      
      // Execute recovery strategy
      return await this._executeRecoveryStrategy(recoveryId);
    } catch (recoveryError) {
      console.error('Error during recovery process:', recoveryError);
      
      // Emit error event
      this.eventBus.emit('recovery:orchestrator:error', {
        error: recoveryError.message,
        stack: recoveryError.stack,
        originalError: error.message,
        timestamp: Date.now()
      });
      
      return {
        success: false,
        reason: 'recovery_process_error',
        error: recoveryError
      };
    }
  }
  
  /**
   * Execute a specific recovery strategy
   * 
   * @param {string} recoveryId - Recovery ID
   * @param {Object} strategyOverride - Optional strategy override
   * @returns {Promise<Object>} Execution result
   */
  async executeStrategy(recoveryId, strategyOverride = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.activeRecoveries.has(recoveryId)) {
      return {
        success: false,
        reason: 'recovery_not_found',
        recoveryId
      };
    }
    
    const recovery = this.activeRecoveries.get(recoveryId);
    
    // Override selected strategy if provided
    if (strategyOverride) {
      recovery.selectedStrategy = strategyOverride;
    }
    
    return await this._executeRecoveryStrategy(recoveryId);
  }
  
  /**
   * Get recovery status
   * 
   * @param {string} recoveryId - Recovery ID
   * @returns {Object} Recovery status
   */
  getRecoveryStatus(recoveryId) {
    if (this.activeRecoveries.has(recoveryId)) {
      const recovery = this.activeRecoveries.get(recoveryId);
      
      return {
        id: recovery.id,
        status: recovery.status,
        startTime: recovery.startTime,
        attempts: recovery.attempts,
        strategies: recovery.strategies.length,
        selectedStrategy: recovery.selectedStrategy ? {
          id: recovery.selectedStrategy.id,
          type: recovery.selectedStrategy.type,
          confidence: recovery.selectedStrategy.confidence
        } : null
      };
    } else {
      // Check recovery history
      const historyEntry = this.recoveryHistory.find(r => r.id === recoveryId);
      
      if (historyEntry) {
        return {
          id: historyEntry.id,
          status: historyEntry.status,
          startTime: historyEntry.startTime,
          endTime: historyEntry.endTime,
          duration: historyEntry.duration,
          attempts: historyEntry.attempts,
          success: historyEntry.result ? historyEntry.result.success : false,
          reason: historyEntry.result ? historyEntry.result.reason : null
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get recovery history
   * 
   * @param {Object} options - Filter options
   * @returns {Array} Recovery history
   */
  getRecoveryHistory(options = {}) {
    const { 
      limit = 100, 
      status, 
      success, 
      startTime, 
      endTime 
    } = options;
    
    // Apply filters
    let filteredHistory = [...this.recoveryHistory];
    
    if (status) {
      filteredHistory = filteredHistory.filter(r => r.status === status);
    }
    
    if (success !== undefined) {
      filteredHistory = filteredHistory.filter(r => 
        r.result && r.result.success === success
      );
    }
    
    if (startTime) {
      filteredHistory = filteredHistory.filter(r => r.startTime >= startTime);
    }
    
    if (endTime) {
      filteredHistory = filteredHistory.filter(r => r.endTime <= endTime);
    }
    
    // Sort by timestamp (newest first) and limit
    return filteredHistory
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        status: r.status,
        startTime: r.startTime,
        endTime: r.endTime,
        duration: r.duration,
        attempts: r.attempts,
        success: r.result ? r.result.success : false,
        reason: r.result ? r.result.reason : null,
        error: r.error ? {
          message: r.error.message,
          name: r.error.name
        } : null,
        selectedStrategy: r.selectedStrategy ? {
          id: r.selectedStrategy.id,
          type: r.selectedStrategy.type,
          confidence: r.selectedStrategy.confidence
        } : null
      }));
  }
  
  /**
   * Register components with the dependency container
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _registerComponents() {
    // Create components if not provided
    if (!this.dependencyContainer.has('contextManager')) {
      const contextManager = new ContextManager({
        eventBus: this.eventBus,
        config: this.config.contextManager
      });
      this.dependencyContainer.registerInstance('contextManager', contextManager);
    }
    
    if (!this.dependencyContainer.has('causalAnalyzer')) {
      const causalAnalyzer = new CausalAnalyzer({
        eventBus: this.eventBus,
        dependencyContainer: this.dependencyContainer,
        config: this.config.causalAnalyzer
      });
      this.dependencyContainer.registerInstance('causalAnalyzer', causalAnalyzer);
    }
    
    if (!this.dependencyContainer.has('strategyGenerator')) {
      const strategyGenerator = new RecoveryStrategyGenerator({
        eventBus: this.eventBus,
        dependencyContainer: this.dependencyContainer,
        config: this.config.strategyGenerator
      });
      this.dependencyContainer.registerInstance('strategyGenerator', strategyGenerator);
    }
    
    if (!this.dependencyContainer.has('resolutionExecutor')) {
      const resolutionExecutor = new ResolutionExecutor({
        eventBus: this.eventBus,
        dependencyContainer: this.dependencyContainer,
        config: this.config.resolutionExecutor
      });
      this.dependencyContainer.registerInstance('resolutionExecutor', resolutionExecutor);
    }
    
    if (!this.dependencyContainer.has('learningSystem')) {
      const learningSystem = new RecoveryLearningSystem({
        eventBus: this.eventBus,
        dependencyContainer: this.dependencyContainer,
        config: this.config.learningSystem
      });
      this.dependencyContainer.registerInstance('learningSystem', learningSystem);
    }
  }
  
  /**
   * Initialize components
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _initializeComponents() {
    // Initialize context manager
    const contextManager = this.dependencyContainer.resolve('contextManager');
    if (typeof contextManager.initialize === 'function') {
      await contextManager.initialize();
    }
    
    // Initialize causal analyzer
    const causalAnalyzer = this.dependencyContainer.resolve('causalAnalyzer');
    if (typeof causalAnalyzer.initialize === 'function') {
      await causalAnalyzer.initialize();
    }
    
    // Initialize strategy generator
    const strategyGenerator = this.dependencyContainer.resolve('strategyGenerator');
    if (typeof strategyGenerator.initialize === 'function') {
      await strategyGenerator.initialize();
    }
    
    // Initialize resolution executor
    const resolutionExecutor = this.dependencyContainer.resolve('resolutionExecutor');
    if (typeof resolutionExecutor.initialize === 'function') {
      await resolutionExecutor.initialize();
    }
    
    // Initialize learning system
    const learningSystem = this.dependencyContainer.resolve('learningSystem');
    if (typeof learningSystem.initialize === 'function') {
      await learningSystem.initialize();
    }
  }
  
  /**
   * Set up event listeners
   * 
   * @private
   */
  _setupEventListeners() {
    // Listen for recovery events
    this.eventBus.on('recovery:strategy:executed', this._handleStrategyExecuted.bind(this));
    this.eventBus.on('recovery:strategy:failed', this._handleStrategyFailed.bind(this));
    
    // Listen for learning events
    this.eventBus.on('learning:completed', this._handleLearningCompleted.bind(this));
  }
  
  /**
   * Execute recovery strategy
   * 
   * @param {string} recoveryId - Recovery ID
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeRecoveryStrategy(recoveryId) {
    if (!this.activeRecoveries.has(recoveryId)) {
      return {
        success: false,
        reason: 'recovery_not_found',
        recoveryId
      };
    }
    
    const recovery = this.activeRecoveries.get(recoveryId);
    
    // Check if we've exceeded max attempts
    if (recovery.attempts >= this.maxRecoveryAttempts) {
      return this._completeRecovery(recoveryId, {
        success: false,
        reason: 'max_attempts_exceeded',
        attempts: recovery.attempts
      });
    }
    
    // Increment attempt counter
    recovery.attempts++;
    
    // Update status
    recovery.status = 'executing_strategy';
    
    // Get resolution executor
    const resolutionExecutor = this.dependencyContainer.resolve('resolutionExecutor');
    
    // Execute strategy
    const executionResult = await resolutionExecutor.executeStrategy(
      recovery.selectedStrategy,
      {
        recoveryId,
        error: recovery.error,
        context: recovery.context,
        attempt: recovery.attempts
      }
    );
    
    // Check result
    if (executionResult.success) {
      // Strategy executed successfully
      return this._completeRecovery(recoveryId, {
        success: true,
        strategy: recovery.selectedStrategy,
        executionResult
      });
    } else if (recovery.attempts < this.maxRecoveryAttempts && recovery.strategies.length > recovery.attempts) {
      // Try next strategy
      recovery.selectedStrategy = recovery.strategies[recovery.attempts];
      
      // Emit strategy failed event
      this.eventBus.emit('recovery:strategy:failed', {
        recoveryId,
        strategy: recovery.strategies[recovery.attempts - 1],
        error: executionResult.error,
        nextStrategy: recovery.selectedStrategy,
        timestamp: Date.now()
      });
      
      // Execute next strategy
      return await this._executeRecoveryStrategy(recoveryId);
    } else {
      // All strategies failed or max attempts reached
      return this._completeRecovery(recoveryId, {
        success: false,
        reason: 'all_strategies_failed',
        attempts: recovery.attempts,
        lastError: executionResult.error
      });
    }
  }
  
  /**
   * Complete recovery process
   * 
   * @param {string} recoveryId - Recovery ID
   * @param {Object} result - Recovery result
   * @returns {Object} Recovery result
   * @private
   */
  _completeRecovery(recoveryId, result) {
    if (!this.activeRecoveries.has(recoveryId)) {
      return {
        success: false,
        reason: 'recovery_not_found',
        recoveryId
      };
    }
    
    const recovery = this.activeRecoveries.get(recoveryId);
    
    // Update recovery record
    recovery.endTime = Date.now();
    recovery.duration = recovery.endTime - recovery.startTime;
    recovery.status = result.success ? 'completed' : 'failed';
    recovery.result = result;
    
    // Move to history
    this.recoveryHistory.push({ ...recovery });
    this.activeRecoveries.delete(recoveryId);
    
    // Emit recovery completed event
    this.eventBus.emit('recovery:completed', {
      recoveryId,
      success: result.success,
      reason: result.reason,
      duration: recovery.duration,
      attempts: recovery.attempts,
      timestamp: recovery.endTime
    });
    
    // Record learning
    this._recordLearning(recovery);
    
    return result;
  }
  
  /**
   * Record learning from recovery
   * 
   * @param {Object} recovery - Recovery record
   * @private
   */
  async _recordLearning(recovery) {
    try {
      const learningSystem = this.dependencyContainer.resolve('learningSystem');
      
      if (recovery.result.success) {
        // Record successful strategy
        await learningSystem.recordSuccess(
          recovery.selectedStrategy,
          {
            executionTimeMs: recovery.duration,
            attempts: recovery.attempts,
            context: recovery.context,
            result: recovery.result.executionResult
          }
        );
      } else {
        // Record failed strategies
        for (let i = 0; i < recovery.attempts; i++) {
          const strategy = recovery.strategies[i];
          
          await learningSystem.recordFailure(
            strategy,
            {
              error: i === recovery.attempts - 1 ? recovery.result.lastError : null,
              executionTimeMs: recovery.duration / recovery.attempts, // Approximate
              context: recovery.context
            }
          );
        }
      }
    } catch (error) {
      console.error('Failed to record learning:', error);
      
      // Emit error event
      this.eventBus.emit('recovery:learning:error', {
        error: error.message,
        stack: error.stack,
        recoveryId: recovery.id,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle strategy executed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleStrategyExecuted(data) {
    // Implementation details
  }
  
  /**
   * Handle strategy failed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleStrategyFailed(data) {
    // Implementation details
  }
  
  /**
   * Handle learning completed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleLearningCompleted(data) {
    // Implementation details
  }
}

module.exports = AutonomousRecoveryOrchestrator;
