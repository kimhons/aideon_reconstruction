/**
 * @fileoverview Implementation of the AutonomousRecoveryOrchestrator component.
 * This component orchestrates the complete error recovery flow, coordinating
 * between analysis, strategy generation, validation, and execution components.
 * 
 * @module core/error_recovery/integration/AutonomousRecoveryOrchestrator
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * CircuitBreaker protects the system from cascading failures by preventing
 * repeated recovery attempts for the same error within a short time period.
 */
class CircuitBreaker {
  /**
   * Creates a new CircuitBreaker instance.
   * @param {Object} options - Configuration options
   * @param {number} [options.maxAttempts=3] - Maximum number of attempts within the time window
   * @param {number} [options.timeWindowMs=60000] - Time window in milliseconds
   * @param {number} [options.resetTimeMs=300000] - Time before resetting the circuit after tripping
   */
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.timeWindowMs = options.timeWindowMs || 60000; // 1 minute
    this.resetTimeMs = options.resetTimeMs || 300000; // 5 minutes
    
    this.errorAttempts = new Map(); // Map of error signatures to attempt records
    this.trippedCircuits = new Map(); // Map of error signatures to trip timestamps
  }
  
  /**
   * Checks if recovery should be allowed for an error.
   * @param {string} errorSignature - Unique signature of the error
   * @returns {boolean} Whether recovery is allowed
   */
  allowRecovery(errorSignature) {
    // Check if circuit is tripped
    if (this.trippedCircuits.has(errorSignature)) {
      const tripTime = this.trippedCircuits.get(errorSignature);
      if (Date.now() - tripTime < this.resetTimeMs) {
        return false; // Circuit is still tripped
      } else {
        // Reset circuit
        this.trippedCircuits.delete(errorSignature);
        this.errorAttempts.delete(errorSignature);
      }
    }
    
    // Check attempt count
    if (!this.errorAttempts.has(errorSignature)) {
      this.errorAttempts.set(errorSignature, {
        count: 0,
        attempts: []
      });
    }
    
    const record = this.errorAttempts.get(errorSignature);
    
    // Clean up old attempts
    const now = Date.now();
    record.attempts = record.attempts.filter(time => now - time < this.timeWindowMs);
    record.count = record.attempts.length;
    
    // Check if max attempts reached
    if (record.count >= this.maxAttempts) {
      // Trip circuit
      this.trippedCircuits.set(errorSignature, now);
      return false;
    }
    
    // Allow recovery and record attempt
    record.attempts.push(now);
    record.count++;
    
    return true;
  }
}

/**
 * AutonomousRecoveryOrchestrator coordinates the complete error recovery flow.
 */
class AutonomousRecoveryOrchestrator {
  /**
   * Creates a new AutonomousRecoveryOrchestrator instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.container - Dependency container
   * @param {Object} options.eventEmitter - Event emitter instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.container = options.container;
    this.externalEventEmitter = options.eventEmitter; // Optional external event emitter
    this.logger = options.logger || console;
    this.config = options.config || {
      maxRecoveryAttempts: 3,
      recoveryTimeoutMs: 60000, // 1 minute
      circuitBreaker: {
        maxAttempts: 3,
        timeWindowMs: 60000, // 1 minute
        resetTimeMs: 300000 // 5 minutes
      }
    };
    
    // Dependencies resolved lazily
    this.causalAnalyzer = null;
    this.strategyGenerator = null;
    this.validationRunner = null;
    this.resolutionExecutor = null;
    this.learningSystem = null;
    this.contextManager = null;
    
    // Fix: Initialize metricsCollector with a no-op implementation immediately
    // This ensures it's always available even before initialize() is called
    this.metricsCollector = {
      recordMetric: (name, value) => {
        console.log(`[DEBUG] MetricsCollector.recordMetric called with: ${name}, ${value}`);
      },
      incrementCounter: (name, value = 1) => {
        console.log(`[DEBUG] MetricsCollector.incrementCounter called with: ${name}, ${value}`);
      },
      setGauge: (name, value) => {
        console.log(`[DEBUG] MetricsCollector.setGauge called with: ${name}, ${value}`);
      },
      recordSuccess: (name, success) => {
        console.log(`[DEBUG] MetricsCollector.recordSuccess called with: ${name}, ${success}`);
      },
      recordTiming: (name, duration) => {
        console.log(`[DEBUG] MetricsCollector.recordTiming called with: ${name}, ${duration}`);
      }
    };
    
    // Circuit breaker for preventing cascading failures
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    
    // Active recovery flows
    this.activeFlows = new Map();
    
    this.logger.info("AutonomousRecoveryOrchestrator initialized");
  }
  
  /**
   * Initializes the component by resolving dependencies.
   * Should be called after the container is fully configured.
   */
  async initialize() {
    try {
      console.log("[DEBUG] AutonomousRecoveryOrchestrator.initialize() called");
      
      console.log("[DEBUG] Resolving causalAnalyzer dependency");
      this.causalAnalyzer = await this.container.resolve("causalAnalyzer");
      console.log("[DEBUG] causalAnalyzer resolved:", this.causalAnalyzer ? "success" : "failed");
      
      console.log("[DEBUG] Resolving recoveryStrategyGenerator dependency");
      this.strategyGenerator = await this.container.resolve("recoveryStrategyGenerator");
      console.log("[DEBUG] strategyGenerator resolved:", this.strategyGenerator ? "success" : "failed");
      
      console.log("[DEBUG] Resolving integrationValidationRunner dependency");
      this.validationRunner = await this.container.resolve("integrationValidationRunner");
      console.log("[DEBUG] validationRunner resolved:", this.validationRunner ? "success" : "failed");
      console.log("[DEBUG] validationRunner type:", typeof this.validationRunner);
      console.log("[DEBUG] validationRunner methods:", Object.keys(this.validationRunner));
      
      console.log("[DEBUG] Resolving resolutionExecutor dependency");
      this.resolutionExecutor = await this.container.resolve("resolutionExecutor");
      console.log("[DEBUG] resolutionExecutor resolved:", this.resolutionExecutor ? "success" : "failed");
      console.log("[DEBUG] resolutionExecutor type:", typeof this.resolutionExecutor);
      console.log("[DEBUG] resolutionExecutor methods:", Object.keys(this.resolutionExecutor));
      
      console.log("[DEBUG] Resolving recoveryLearningSystem dependency");
      this.learningSystem = await this.container.resolve("recoveryLearningSystem");
      console.log("[DEBUG] learningSystem resolved:", this.learningSystem ? "success" : "failed");
      
      console.log("[DEBUG] Resolving contextManager dependency");
      this.contextManager = await this.container.resolve("contextManager");
      console.log("[DEBUG] contextManager resolved:", this.contextManager ? "success" : "failed");
      
      // Fix: Resolve metricsCollector with a try-catch and keep the existing no-op if resolution fails
      try {
        console.log("[DEBUG] Resolving metricsCollector dependency");
        const resolvedMetricsCollector = await this.container.resolve("metricsCollector");
        console.log("[DEBUG] metricsCollector resolved:", resolvedMetricsCollector ? "success" : "failed");
        
        // Fix: Verify that the resolved metricsCollector has all required methods
        // If any are missing, add them from our no-op implementation
        const requiredMethods = [
          'recordMetric', 'incrementCounter', 'setGauge', 
          'recordSuccess', 'recordTiming'
        ];
        
        let isValid = true;
        for (const method of requiredMethods) {
          if (typeof resolvedMetricsCollector[method] !== 'function') {
            isValid = false;
            this.logger.warn(`MetricsCollector missing required method: ${method}, using fallback implementation`);
            console.log(`[DEBUG] MetricsCollector missing required method: ${method}`);
            break;
          }
        }
        
        if (isValid) {
          console.log("[DEBUG] Using resolved metricsCollector");
          this.metricsCollector = resolvedMetricsCollector;
        } else {
          // Keep using the no-op implementation initialized in constructor
          console.log("[DEBUG] Using fallback no-op MetricsCollector implementation");
          this.logger.warn(`Using fallback no-op MetricsCollector implementation`);
        }
      } catch (error) {
        console.log(`[DEBUG] MetricsCollector resolution failed: ${error.message}`);
        this.logger.warn(`MetricsCollector not available, using no-op implementation: ${error.message}`);
        // Keep using the no-op implementation initialized in constructor
      }
      
      this.logger.info("AutonomousRecoveryOrchestrator dependencies resolved");
      console.log("[DEBUG] AutonomousRecoveryOrchestrator dependencies resolved successfully");
    } catch (error) {
      console.log(`[DEBUG] Failed to initialize dependencies: ${error.message}`);
      this.logger.error(`Failed to initialize AutonomousRecoveryOrchestrator dependencies: ${error.message}`, error);
      throw error; // Re-throw to prevent operation with missing critical dependencies
    }
  }
  
  /**
   * Emits an event through the event emitter.
   * @private
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   */
  _emitEvent(eventName, data) {
    console.log(`[DEBUG] Emitting event: ${eventName}`);
    if (this.externalEventEmitter && typeof this.externalEventEmitter.emit === 'function') {
      this.externalEventEmitter.emit(eventName, data);
    }
  }
  
  /**
   * Handles an error by orchestrating the recovery process.
   * @param {Error|string} error - Error object or error message
   * @param {Object} [context] - Error context
   * @returns {Promise<Object>} Recovery result
   */
  async handleError(error, context = {}) {
    console.log("[DEBUG] AutonomousRecoveryOrchestrator.handleError() called");
    console.log("[DEBUG] Error:", error);
    console.log("[DEBUG] Context:", JSON.stringify(context));
    
    const startTime = Date.now();
    const errorId = context.errorId || `error-${uuidv4()}`;
    const flowId = `flow-${uuidv4()}`;
    
    console.log(`[DEBUG] Generated errorId: ${errorId}, flowId: ${flowId}`);
    
    // Ensure error is an Error object
    if (typeof error === 'string') {
      console.log(`[DEBUG] Converting string error to Error object: ${error}`);
      error = new Error(error);
    }
    
    // Create error signature for circuit breaker
    const errorSignature = this._createErrorSignature(error, context);
    console.log(`[DEBUG] Error signature: ${errorSignature}`);
    
    // Check circuit breaker
    if (!this.circuitBreaker.allowRecovery(errorSignature)) {
      console.log(`[DEBUG] Circuit breaker prevented recovery for error: ${errorSignature}`);
      this.logger.warn(`Circuit breaker prevented recovery for error: ${errorSignature}`);
      
      // Record metrics - safely access metricsCollector
      if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
        this.metricsCollector.incrementCounter("recovery_attempts_prevented");
      }
      
      return {
        success: false,
        flowId,
        errorId,
        reason: "circuit_breaker",
        message: "Recovery prevented by circuit breaker due to repeated failures"
      };
    }
    
    try {
      // Initialize dependencies if not already done
      if (!this.causalAnalyzer) {
        console.log("[DEBUG] Dependencies not initialized, calling initialize()");
        await this.initialize();
      }
      
      // Record flow start
      this.activeFlows.set(flowId, {
        errorId,
        startTime,
        status: "analyzing",
        error: error.message,
        context
      });
      
      this._emitEvent("recovery:flow:started", { flowId, errorId, error, context });
      
      // Record metrics - safely access metricsCollector
      if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
        this.metricsCollector.incrementCounter("recovery_flows_started");
      }
      
      // Step 1: Causal Analysis
      console.log(`[DEBUG] Starting causal analysis for error: ${errorId}`);
      this.logger.info(`Starting causal analysis for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "analyzing"
      });
      
      const analysisResult = await this.causalAnalyzer.analyzeError(errorId, error, context);
      console.log(`[DEBUG] Analysis result:`, JSON.stringify(analysisResult));
      
      // Record metrics - safely access metricsCollector
      if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
        this.metricsCollector.recordMetric("causal_analysis_confidence", analysisResult.confidence || 0);
      }
      
      // Step 2: Strategy Generation
      console.log(`[DEBUG] Generating recovery strategies for error: ${errorId}`);
      this.logger.info(`Generating recovery strategies for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "generating_strategies"
      });
      
      const { strategies } = await this.strategyGenerator.generateStrategies(errorId, analysisResult);
      console.log(`[DEBUG] Generated ${strategies ? strategies.length : 0} strategies`);
      
      if (!strategies || strategies.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`[DEBUG] No recovery strategies generated for error: ${errorId}`);
        this.logger.warn(`No recovery strategies generated for error: ${errorId}`);
        
        this.activeFlows.set(flowId, {
          ...this.activeFlows.get(flowId),
          status: "failed",
          endTime: Date.now(),
          reason: "no_strategies"
        });
        
        // Record metrics - safely access metricsCollector
        if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
          this.metricsCollector.recordMetric("recovery_flow_duration", duration);
        }
        if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
          this.metricsCollector.incrementCounter("recovery_flows_failed");
        }
        
        this._emitEvent("recovery:flow:failed", { 
          flowId, 
          errorId, 
          reason: "no_strategies", 
          duration 
        });
        
        return {
          success: false,
          flowId,
          errorId,
          reason: "no_strategies",
          message: "No recovery strategies could be generated"
        };
      }
      
      // Step 3: Strategy Ranking
      console.log(`[DEBUG] Ranking recovery strategies for error: ${errorId}`);
      this.logger.info(`Ranking recovery strategies for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "ranking_strategies"
      });
      
      // Get system state from context manager
      const systemState = await this.contextManager.getSystemState();
      console.log(`[DEBUG] System state:`, JSON.stringify(systemState));
      
      const rankedStrategies = await this.strategyGenerator.rankStrategies(strategies, analysisResult, systemState);
      console.log(`[DEBUG] Ranked ${rankedStrategies ? rankedStrategies.length : 0} strategies`);
      
      if (!rankedStrategies || rankedStrategies.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`[DEBUG] No ranked strategies available for error: ${errorId}`);
        this.logger.warn(`No ranked strategies available for error: ${errorId}`);
        
        this.activeFlows.set(flowId, {
          ...this.activeFlows.get(flowId),
          status: "failed",
          endTime: Date.now(),
          reason: "no_ranked_strategies"
        });
        
        // Record metrics - safely access metricsCollector
        if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
          this.metricsCollector.recordMetric("recovery_flow_duration", duration);
        }
        if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
          this.metricsCollector.incrementCounter("recovery_flows_failed");
        }
        
        this._emitEvent("recovery:flow:failed", { 
          flowId, 
          errorId, 
          reason: "no_ranked_strategies", 
          duration 
        });
        
        return {
          success: false,
          flowId,
          errorId,
          reason: "no_ranked_strategies",
          message: "No ranked recovery strategies available"
        };
      }
      
      // Select best strategy
      const selectedStrategy = rankedStrategies[0];
      console.log(`[DEBUG] Selected best strategy: ${selectedStrategy.id}`);
      
      // Step 4: Strategy Adaptation
      console.log(`[DEBUG] Adapting selected strategy for error: ${errorId}`);
      this.logger.info(`Adapting selected strategy for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "adapting_strategy"
      });
      
      const adaptedStrategy = await this.strategyGenerator.adaptStrategy(selectedStrategy, systemState);
      console.log(`[DEBUG] Adapted strategy:`, JSON.stringify(adaptedStrategy));
      
      // Step 5: Strategy Validation
      console.log(`[DEBUG] Validating adapted strategy for error: ${errorId}`);
      this.logger.info(`Validating adapted strategy for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "validating_strategy"
      });
      
      console.log(`[DEBUG] Validation runner:`, this.validationRunner);
      console.log(`[DEBUG] Calling validateStrategy on validation runner`);
      const validationResult = await this.validationRunner.validateStrategy(adaptedStrategy, analysisResult, systemState);
      console.log(`[DEBUG] Validation result:`, JSON.stringify(validationResult));
      
      if (!validationResult.isValid) {
        const duration = Date.now() - startTime;
        console.log(`[DEBUG] Strategy validation failed: ${validationResult.reason}`);
        this.logger.warn(`Strategy validation failed for error: ${errorId}: ${validationResult.reason}`);
        
        this.activeFlows.set(flowId, {
          ...this.activeFlows.get(flowId),
          status: "failed",
          endTime: Date.now(),
          reason: "validation_failed"
        });
        
        // Record metrics - safely access metricsCollector
        if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
          this.metricsCollector.recordMetric("recovery_flow_duration", duration);
        }
        if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
          this.metricsCollector.incrementCounter("recovery_flows_failed");
          this.metricsCollector.incrementCounter("strategy_validation_failed");
        }
        
        this._emitEvent("recovery:flow:failed", { 
          flowId, 
          errorId, 
          reason: "validation_failed", 
          validationResult,
          duration 
        });
        
        return {
          success: false,
          flowId,
          errorId,
          reason: "validation_failed",
          message: `Strategy validation failed: ${validationResult.reason}`,
          validationResult
        };
      }
      
      // Step 6: Strategy Execution
      console.log(`[DEBUG] Executing recovery strategy for error: ${errorId}`);
      this.logger.info(`Executing recovery strategy for error: ${errorId}`);
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "executing_strategy"
      });
      
      console.log(`[DEBUG] Resolution executor:`, this.resolutionExecutor);
      console.log(`[DEBUG] Calling executeStrategy on resolution executor`);
      const executionResult = await this.resolutionExecutor.executeStrategy(adaptedStrategy, analysisResult);
      console.log(`[DEBUG] Execution result:`, JSON.stringify(executionResult));
      
      const duration = Date.now() - startTime;
      
      if (!executionResult.successful) {
        console.log(`[DEBUG] Strategy execution failed`);
        this.logger.warn(`Strategy execution failed for error: ${errorId}`);
        
        this.activeFlows.set(flowId, {
          ...this.activeFlows.get(flowId),
          status: "failed",
          endTime: Date.now(),
          reason: "execution_failed"
        });
        
        // Record metrics - safely access metricsCollector
        if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
          this.metricsCollector.recordMetric("recovery_flow_duration", duration);
        }
        if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
          this.metricsCollector.incrementCounter("recovery_flows_failed");
          this.metricsCollector.incrementCounter("strategy_execution_failed");
        }
        
        this._emitEvent("recovery:flow:failed", { 
          flowId, 
          errorId, 
          reason: "execution_failed", 
          executionResult,
          duration 
        });
        
        return {
          success: false,
          flowId,
          errorId,
          reason: "execution_failed",
          message: "Strategy execution failed",
          executionResult
        };
      }
      
      // Step 7: Learning from execution
      console.log(`[DEBUG] Recording learning data for error: ${errorId}`);
      this.logger.info(`Recording learning data for error: ${errorId}`);
      
      console.log(`[DEBUG] Learning system:`, this.learningSystem);
      console.log(`[DEBUG] Calling recordRecoveryOutcome on learning system`);
      await this.learningSystem.recordRecoveryOutcome({
        errorId,
        analysisResult,
        strategy: adaptedStrategy,
        executionResult,
        successful: true,
        duration
      });
      
      // Update flow status
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "completed",
        endTime: Date.now()
      });
      
      // Record metrics - safely access metricsCollector
      if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
        this.metricsCollector.recordMetric("recovery_flow_duration", duration);
      }
      if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
        this.metricsCollector.incrementCounter("recovery_flows_completed");
      }
      if (this.metricsCollector && typeof this.metricsCollector.recordSuccess === 'function') {
        this.metricsCollector.recordSuccess("recovery_flow", true);
      }
      
      this._emitEvent("recovery:flow:completed", { 
        flowId, 
        errorId, 
        executionResult,
        duration 
      });
      
      console.log(`[DEBUG] Recovery flow completed successfully, returning success: true`);
      const successResult = {
        success: true,
        flowId,
        errorId,
        duration,
        strategy: adaptedStrategy,
        executionResult
      };
      console.log(`[DEBUG] Success result:`, JSON.stringify(successResult));
      
      return successResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[DEBUG] Error during recovery flow: ${error.message}`, error);
      this.logger.error(`Error during recovery flow: ${error.message}`, error);
      
      this.activeFlows.set(flowId, {
        ...this.activeFlows.get(flowId),
        status: "error",
        endTime: Date.now(),
        error: error.message
      });
      
      // Record metrics - safely access metricsCollector
      if (this.metricsCollector && typeof this.metricsCollector.recordMetric === 'function') {
        this.metricsCollector.recordMetric("recovery_flow_duration", duration);
      }
      if (this.metricsCollector && typeof this.metricsCollector.incrementCounter === 'function') {
        this.metricsCollector.incrementCounter("recovery_flows_errored");
      }
      
      this._emitEvent("recovery:flow:error", { flowId, errorId, error, duration });
      
      return {
        success: false,
        flowId,
        errorId,
        reason: "error",
        message: `Recovery flow failed with error: ${error.message}`
      };
    }
  }
  
  /**
   * Creates a unique signature for an error to use with the circuit breaker.
   * @private
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {string} Error signature
   */
  _createErrorSignature(error, context) {
    // Use error name, message, and component ID if available
    const name = error.name || 'Error';
    const message = error.message || '';
    const componentId = context.componentId || '';
    
    // Create a simplified signature that groups similar errors
    return `${name}:${componentId}:${message.substring(0, 50)}`;
  }
  
  /**
   * Gets the status of a recovery flow.
   * @param {string} flowId - ID of the recovery flow
   * @returns {Object|null} Flow status or null if not found
   */
  getFlowStatus(flowId) {
    return this.activeFlows.get(flowId) || null;
  }
  
  /**
   * Gets all active recovery flows.
   * @returns {Array<Object>} List of active flows
   */
  getAllFlows() {
    return Array.from(this.activeFlows.values());
  }
}

module.exports = { AutonomousRecoveryOrchestrator, CircuitBreaker };
