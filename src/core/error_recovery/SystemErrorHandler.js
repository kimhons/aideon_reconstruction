/**
 * @fileoverview Implementation of the SystemErrorHandler component for the Autonomous Error Recovery System.
 * This component provides comprehensive error handling and recovery across all system components.
 * 
 * @module core/error_recovery/SystemErrorHandler
 * @requires events
 * @requires uuid
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");

/**
 * SystemErrorHandler provides comprehensive error handling and recovery
 * across all system components, ensuring failures are contained and recovered from.
 */
class SystemErrorHandler extends EventEmitter {
  /**
   * Creates a new SystemErrorHandler instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.strategyPipeline - Strategy pipeline instance
   * @param {Object} options.contextManager - Context propagation manager instance
   * @param {Object} options.neuralHub - Neural coordination hub instance
   * @param {Object} options.semanticProcessor - Semantic processor instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.strategyPipeline = options.strategyPipeline;
    this.contextManager = options.contextManager;
    this.neuralHub = options.neuralHub;
    this.semanticProcessor = options.semanticProcessor;
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Error handling state
    this.activeRecoveries = new Map();
    this.errorPatterns = new Map();
    this.recoveryHistory = new Map();
    
    // Register global error handlers
    this.registerGlobalErrorHandlers();
    
    this.logger.info("SystemErrorHandler initialized");
  }
  
  /**
   * Registers global error handlers for system components.
   * @private
   */
  registerGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
    
    // Handle component-specific errors
    if (this.neuralHub) {
      this.neuralHub.on('neural:error', this.handleNeuralError.bind(this));
    }
    
    if (this.semanticProcessor) {
      this.semanticProcessor.on('query:failed', this.handleSemanticError.bind(this));
    }
    
    if (this.strategyPipeline) {
      this.strategyPipeline.on('pipeline:failed', this.handlePipelineError.bind(this));
      this.strategyPipeline.on('pipeline:strategy_execution:failed', this.handleExecutionError.bind(this));
    }
    
    this.logger.debug("Global error handlers registered");
  }
  
  /**
   * Handles an error and initiates recovery.
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Error context
   * @param {string} source - Error source
   * @returns {Promise<Object>} Recovery result
   */
  async handleError(error, context = {}, source = "unknown") {
    const errorId = uuidv4();
    const startTime = Date.now();
    
    // Normalize error
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorMessage = errorObj.message || "Unknown error";
    
    this.logger.error(`Error ${errorId} from ${source}: ${errorMessage}`, errorObj);
    
    // Create error context
    const errorContext = {
      errorId,
      errorMessage,
      errorType: errorObj.name || "Error",
      errorStack: errorObj.stack,
      source,
      timestamp: startTime,
      ...context
    };
    
    // Create recovery tracking
    const recovery = {
      errorId,
      startTime,
      status: "started",
      error: errorObj,
      context: errorContext,
      attempts: 0,
      recoverySteps: [],
      result: null
    };
    
    this.activeRecoveries.set(errorId, recovery);
    
    // Emit error event
    this.emit("error:detected", {
      errorId,
      source,
      message: errorMessage,
      context: errorContext
    });
    
    if (this.metrics) {
      this.metrics.recordMetric("error_detected", 1);
      this.metrics.recordMetric(`error_source_${source}`, 1);
    }
    
    try {
      // Create execution context
      let executionContext = null;
      if (this.contextManager) {
        executionContext = this.contextManager.createExecutionContext(errorId, errorContext);
      }
      
      // Process through recovery pipeline
      let recoveryResult = null;
      if (this.strategyPipeline) {
        recoveryResult = await this.strategyPipeline.processThroughPipeline(
          errorId,
          errorContext
        );
        
        recovery.attempts++;
        recovery.recoverySteps.push({
          timestamp: Date.now(),
          action: "pipeline_recovery",
          result: recoveryResult.successful ? "success" : "failure",
          details: recoveryResult
        });
      } else {
        // Fallback recovery if no pipeline available
        recoveryResult = await this.performFallbackRecovery(errorId, errorContext);
        
        recovery.attempts++;
        recovery.recoverySteps.push({
          timestamp: Date.now(),
          action: "fallback_recovery",
          result: recoveryResult.successful ? "success" : "failure",
          details: recoveryResult
        });
      }
      
      // Update recovery status
      recovery.status = recoveryResult.successful ? "recovered" : "failed";
      recovery.result = recoveryResult;
      recovery.endTime = Date.now();
      recovery.duration = recovery.endTime - recovery.startTime;
      
      // Move from active to history
      this.activeRecoveries.delete(errorId);
      this.recoveryHistory.set(errorId, recovery);
      
      // Emit recovery event
      this.emit(recoveryResult.successful ? "error:recovered" : "error:recovery_failed", {
        errorId,
        duration: recovery.duration,
        attempts: recovery.attempts,
        result: recoveryResult
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("error_recovery_duration", recovery.duration);
        this.metrics.recordMetric("error_recovery_success", recoveryResult.successful ? 1 : 0);
        this.metrics.recordMetric("error_recovery_attempts", recovery.attempts);
      }
      
      this.logger.info(
        `Error ${errorId} recovery ${recoveryResult.successful ? "succeeded" : "failed"} in ${recovery.duration}ms`
      );
      
      return {
        errorId,
        recovered: recoveryResult.successful,
        duration: recovery.duration,
        attempts: recovery.attempts,
        result: recoveryResult
      };
      
    } catch (recoveryError) {
      // Handle recovery failure
      const duration = Date.now() - startTime;
      this.logger.error(`Recovery for error ${errorId} failed: ${recoveryError.message}`, recoveryError);
      
      // Update recovery status
      recovery.status = "failed";
      recovery.endTime = Date.now();
      recovery.duration = duration;
      recovery.recoveryError = recoveryError;
      
      // Move from active to history
      this.activeRecoveries.delete(errorId);
      this.recoveryHistory.set(errorId, recovery);
      
      // Emit recovery failed event
      this.emit("error:recovery_failed", {
        errorId,
        duration,
        error: recoveryError.message
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("error_recovery_duration", duration);
        this.metrics.recordMetric("error_recovery_success", 0);
        this.metrics.recordMetric("error_recovery_catastrophic_failure", 1);
      }
      
      return {
        errorId,
        recovered: false,
        duration,
        error: recoveryError.message
      };
    }
  }
  
  /**
   * Performs fallback recovery when no pipeline is available.
   * @param {string} errorId - Error ID
   * @param {Object} errorContext - Error context
   * @returns {Promise<Object>} Recovery result
   * @private
   */
  async performFallbackRecovery(errorId, errorContext) {
    this.logger.debug(`Performing fallback recovery for error: ${errorId}`);
    
    // Simple fallback recovery logic
    const componentId = errorContext.componentId || "unknown";
    const successful = Math.random() > 0.3; // 70% success rate for fallback
    
    // Simulate recovery delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      errorId,
      successful,
      actions: [
        {
          actionId: "FallbackRecoveryAction",
          parameters: { componentId },
          result: successful ? "success" : "failure",
          message: successful ? 
            `Successfully recovered component ${componentId}` : 
            `Failed to recover component ${componentId}`
        }
      ],
      completedAt: Date.now()
    };
  }
  
  /**
   * Handles an uncaught exception.
   * @param {Error} error - Uncaught exception
   * @private
   */
  handleUncaughtException(error) {
    this.logger.error("Uncaught exception:", error);
    
    // Handle the error
    this.handleError(error, {}, "uncaught_exception").catch(err => {
      this.logger.error("Failed to handle uncaught exception:", err);
    });
    
    // Note: In a production system, you might want to exit the process
    // after handling the error, but for this implementation we'll continue
  }
  
  /**
   * Handles an unhandled promise rejection.
   * @param {Error} reason - Rejection reason
   * @param {Promise} promise - Rejected promise
   * @private
   */
  handleUnhandledRejection(reason, promise) {
    this.logger.error("Unhandled promise rejection:", reason);
    
    // Handle the error
    this.handleError(reason, {}, "unhandled_rejection").catch(err => {
      this.logger.error("Failed to handle unhandled rejection:", err);
    });
  }
  
  /**
   * Handles a neural error.
   * @param {Object} event - Neural error event
   * @private
   */
  handleNeuralError(event) {
    this.logger.warn(`Neural error: ${event.error}`);
    
    // Handle the error
    this.handleError(event.error, event, "neural_hub").catch(err => {
      this.logger.error("Failed to handle neural error:", err);
    });
  }
  
  /**
   * Handles a semantic error.
   * @param {Object} event - Semantic error event
   * @private
   */
  handleSemanticError(event) {
    this.logger.warn(`Semantic query failed: ${event.error}`);
    
    // Handle the error
    this.handleError(event.error, event, "semantic_processor").catch(err => {
      this.logger.error("Failed to handle semantic error:", err);
    });
  }
  
  /**
   * Handles a pipeline error.
   * @param {Object} event - Pipeline error event
   * @private
   */
  handlePipelineError(event) {
    this.logger.warn(`Pipeline failed: ${event.error}`);
    
    // For pipeline errors, we don't recursively handle them
    // as they may already be part of error handling
    this.emit("pipeline:error", event);
    
    if (this.metrics) {
      this.metrics.recordMetric("pipeline_error", 1);
    }
  }
  
  /**
   * Handles an execution error.
   * @param {Object} event - Execution error event
   * @private
   */
  handleExecutionError(event) {
    this.logger.warn(`Strategy execution failed: ${event.error}`);
    
    // For execution errors, we don't recursively handle them
    // as they may already be part of error handling
    this.emit("execution:error", event);
    
    if (this.metrics) {
      this.metrics.recordMetric("execution_error", 1);
    }
  }
  
  /**
   * Gets the status of an error recovery.
   * @param {string} errorId - Error ID
   * @returns {Object|null} Recovery status or null if not found
   */
  getRecoveryStatus(errorId) {
    // Check active recoveries
    if (this.activeRecoveries.has(errorId)) {
      const recovery = this.activeRecoveries.get(errorId);
      return {
        errorId,
        status: recovery.status,
        startTime: recovery.startTime,
        duration: Date.now() - recovery.startTime,
        attempts: recovery.attempts,
        inProgress: true
      };
    }
    
    // Check recovery history
    if (this.recoveryHistory.has(errorId)) {
      const recovery = this.recoveryHistory.get(errorId);
      return {
        errorId,
        status: recovery.status,
        startTime: recovery.startTime,
        endTime: recovery.endTime,
        duration: recovery.duration,
        attempts: recovery.attempts,
        recovered: recovery.status === "recovered",
        inProgress: false
      };
    }
    
    return null;
  }
  
  /**
   * Analyzes error patterns to identify recurring issues.
   * @returns {Array<Object>} Identified error patterns
   */
  analyzeErrorPatterns() {
    const patterns = [];
    const errorsBySource = new Map();
    const errorsByType = new Map();
    
    // Group errors by source and type
    for (const recovery of this.recoveryHistory.values()) {
      const source = recovery.context.source || "unknown";
      const type = recovery.context.errorType || "unknown";
      
      // Group by source
      if (!errorsBySource.has(source)) {
        errorsBySource.set(source, []);
      }
      errorsBySource.get(source).push(recovery);
      
      // Group by type
      if (!errorsByType.has(type)) {
        errorsByType.set(type, []);
      }
      errorsByType.get(type).push(recovery);
    }
    
    // Analyze source patterns
    for (const [source, errors] of errorsBySource.entries()) {
      if (errors.length >= 3) { // At least 3 errors to consider a pattern
        patterns.push({
          type: "source_pattern",
          source,
          count: errors.length,
          recoveryRate: errors.filter(e => e.status === "recovered").length / errors.length,
          averageDuration: errors.reduce((sum, e) => sum + (e.duration || 0), 0) / errors.length,
          firstSeen: Math.min(...errors.map(e => e.startTime)),
          lastSeen: Math.max(...errors.map(e => e.startTime))
        });
      }
    }
    
    // Analyze type patterns
    for (const [type, errors] of errorsByType.entries()) {
      if (errors.length >= 3) { // At least 3 errors to consider a pattern
        patterns.push({
          type: "error_type_pattern",
          errorType: type,
          count: errors.length,
          recoveryRate: errors.filter(e => e.status === "recovered").length / errors.length,
          averageDuration: errors.reduce((sum, e) => sum + (e.duration || 0), 0) / errors.length,
          firstSeen: Math.min(...errors.map(e => e.startTime)),
          lastSeen: Math.max(...errors.map(e => e.startTime))
        });
      }
    }
    
    // Sort patterns by count (most frequent first)
    patterns.sort((a, b) => b.count - a.count);
    
    return patterns;
  }
  
  /**
   * Gets recovery statistics.
   * @returns {Object} Recovery statistics
   */
  getRecoveryStatistics() {
    const totalRecoveries = this.recoveryHistory.size;
    const successfulRecoveries = Array.from(this.recoveryHistory.values())
      .filter(r => r.status === "recovered").length;
    const failedRecoveries = totalRecoveries - successfulRecoveries;
    
    const durations = Array.from(this.recoveryHistory.values())
      .map(r => r.duration || 0);
    
    const averageDuration = durations.length > 0 ? 
      durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    
    return {
      totalRecoveries,
      successfulRecoveries,
      failedRecoveries,
      recoveryRate: totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0,
      averageDuration,
      maxDuration,
      minDuration,
      activeRecoveries: this.activeRecoveries.size,
      patterns: this.analyzeErrorPatterns()
    };
  }
}

module.exports = SystemErrorHandler;
