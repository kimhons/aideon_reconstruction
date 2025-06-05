/**
 * @fileoverview Implementation of the ContextPropagationManager component for the Autonomous Error Recovery System.
 * This component ensures consistent execution context propagation across all system components.
 * 
 * @module core/error_recovery/ContextPropagationManager
 * @requires events
 * @requires uuid
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");

/**
 * ContextPropagationManager ensures consistent execution context propagation
 * across all system components, preventing context loss at integration boundaries.
 */
class ContextPropagationManager extends EventEmitter {
  /**
   * Creates a new ContextPropagationManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Context registries
    this.executionContexts = new Map();
    this.strategyContexts = new Map();
    this.analysisContexts = new Map();
    this.learningContexts = new Map();
    
    // Context expiration (30 minutes by default)
    this.contextExpirationMs = options.contextExpirationMs || 1800000;
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanupExpiredContexts(), 300000); // 5 minutes
    
    this.logger.info("ContextPropagationManager initialized");
  }
  
  /**
   * Creates and registers a new execution context.
   * @param {string} errorId - Error ID
   * @param {Object} initialContext - Initial context data
   * @returns {Object} Created execution context
   */
  createExecutionContext(errorId, initialContext = {}) {
    const contextId = uuidv4();
    
    const executionContext = {
      contextId,
      errorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        ...initialContext,
        errorId,
        contextId
      },
      history: [
        {
          timestamp: Date.now(),
          operation: "context_created",
          source: "ContextPropagationManager"
        }
      ]
    };
    
    this.executionContexts.set(contextId, executionContext);
    
    this.logger.debug(`Created execution context: ${contextId} for error: ${errorId}`);
    this.emit("context:created", { contextId, errorId });
    
    if (this.metrics) {
      this.metrics.recordMetric("execution_context_created", 1);
    }
    
    return executionContext;
  }
  
  /**
   * Gets an execution context by ID.
   * @param {string} contextId - Context ID
   * @returns {Object|null} Execution context or null if not found
   */
  getExecutionContext(contextId) {
    if (!this.executionContexts.has(contextId)) {
      this.logger.warn(`Execution context not found: ${contextId}`);
      return null;
    }
    
    const context = this.executionContexts.get(contextId);
    
    // Update access timestamp
    context.updatedAt = Date.now();
    context.history.push({
      timestamp: Date.now(),
      operation: "context_accessed",
      source: "ContextPropagationManager"
    });
    
    return context;
  }
  
  /**
   * Updates an execution context with new data.
   * @param {string} contextId - Context ID
   * @param {Object} updateData - Data to update
   * @param {string} source - Source of the update
   * @returns {boolean} Whether the update was successful
   */
  updateExecutionContext(contextId, updateData, source = "unknown") {
    if (!this.executionContexts.has(contextId)) {
      this.logger.warn(`Cannot update non-existent execution context: ${contextId}`);
      return false;
    }
    
    const context = this.executionContexts.get(contextId);
    
    // Update context data
    context.data = {
      ...context.data,
      ...updateData
    };
    
    // Update timestamps and history
    context.updatedAt = Date.now();
    context.history.push({
      timestamp: Date.now(),
      operation: "context_updated",
      source,
      updateKeys: Object.keys(updateData)
    });
    
    this.logger.debug(`Updated execution context: ${contextId} from source: ${source}`);
    this.emit("context:updated", { contextId, source, updateKeys: Object.keys(updateData) });
    
    if (this.metrics) {
      this.metrics.recordMetric("execution_context_updated", 1);
    }
    
    return true;
  }
  
  /**
   * Links a strategy context to an execution context.
   * @param {string} strategyId - Strategy ID
   * @param {string} contextId - Execution context ID
   * @returns {boolean} Whether the link was successful
   */
  linkStrategyToContext(strategyId, contextId) {
    if (!this.executionContexts.has(contextId)) {
      this.logger.warn(`Cannot link strategy to non-existent context: ${contextId}`);
      return false;
    }
    
    this.strategyContexts.set(strategyId, {
      contextId,
      linkedAt: Date.now()
    });
    
    const context = this.executionContexts.get(contextId);
    context.history.push({
      timestamp: Date.now(),
      operation: "strategy_linked",
      source: "ContextPropagationManager",
      strategyId
    });
    
    this.logger.debug(`Linked strategy ${strategyId} to context: ${contextId}`);
    this.emit("context:strategy_linked", { contextId, strategyId });
    
    return true;
  }
  
  /**
   * Gets the execution context for a strategy.
   * @param {string} strategyId - Strategy ID
   * @returns {Object|null} Execution context or null if not found
   */
  getContextForStrategy(strategyId) {
    if (!this.strategyContexts.has(strategyId)) {
      this.logger.warn(`No context linked to strategy: ${strategyId}`);
      return null;
    }
    
    const { contextId } = this.strategyContexts.get(strategyId);
    return this.getExecutionContext(contextId);
  }
  
  /**
   * Links an analysis context to an execution context.
   * @param {string} analysisId - Analysis ID
   * @param {string} contextId - Execution context ID
   * @returns {boolean} Whether the link was successful
   */
  linkAnalysisToContext(analysisId, contextId) {
    if (!this.executionContexts.has(contextId)) {
      this.logger.warn(`Cannot link analysis to non-existent context: ${contextId}`);
      return false;
    }
    
    this.analysisContexts.set(analysisId, {
      contextId,
      linkedAt: Date.now()
    });
    
    const context = this.executionContexts.get(contextId);
    context.history.push({
      timestamp: Date.now(),
      operation: "analysis_linked",
      source: "ContextPropagationManager",
      analysisId
    });
    
    this.logger.debug(`Linked analysis ${analysisId} to context: ${contextId}`);
    this.emit("context:analysis_linked", { contextId, analysisId });
    
    return true;
  }
  
  /**
   * Gets the execution context for an analysis.
   * @param {string} analysisId - Analysis ID
   * @returns {Object|null} Execution context or null if not found
   */
  getContextForAnalysis(analysisId) {
    if (!this.analysisContexts.has(analysisId)) {
      this.logger.warn(`No context linked to analysis: ${analysisId}`);
      return null;
    }
    
    const { contextId } = this.analysisContexts.get(analysisId);
    return this.getExecutionContext(contextId);
  }
  
  /**
   * Links a learning context to an execution context.
   * @param {string} learningId - Learning ID
   * @param {string} contextId - Execution context ID
   * @returns {boolean} Whether the link was successful
   */
  linkLearningToContext(learningId, contextId) {
    if (!this.executionContexts.has(contextId)) {
      this.logger.warn(`Cannot link learning to non-existent context: ${contextId}`);
      return false;
    }
    
    this.learningContexts.set(learningId, {
      contextId,
      linkedAt: Date.now()
    });
    
    const context = this.executionContexts.get(contextId);
    context.history.push({
      timestamp: Date.now(),
      operation: "learning_linked",
      source: "ContextPropagationManager",
      learningId
    });
    
    this.logger.debug(`Linked learning ${learningId} to context: ${contextId}`);
    this.emit("context:learning_linked", { contextId, learningId });
    
    return true;
  }
  
  /**
   * Gets the execution context for a learning operation.
   * @param {string} learningId - Learning ID
   * @returns {Object|null} Execution context or null if not found
   */
  getContextForLearning(learningId) {
    if (!this.learningContexts.has(learningId)) {
      this.logger.warn(`No context linked to learning: ${learningId}`);
      return null;
    }
    
    const { contextId } = this.learningContexts.get(learningId);
    return this.getExecutionContext(contextId);
  }
  
  /**
   * Creates an execution object with context.
   * @param {string} strategyId - Strategy ID
   * @param {Object} executionData - Execution data
   * @returns {Object} Execution object with context
   */
  createExecutionObject(strategyId, executionData = {}) {
    const executionId = executionData.executionId || uuidv4();
    
    // Try to get context for strategy
    let contextData = {};
    const strategyContext = this.getContextForStrategy(strategyId);
    
    if (strategyContext) {
      contextData = strategyContext.data;
      
      // Update context with execution ID
      this.updateExecutionContext(
        strategyContext.contextId,
        { executionId },
        "ExecutionObjectCreation"
      );
    }
    
    // Create execution object with context
    const executionObject = {
      executionId,
      strategyId,
      context: contextData,
      startedAt: Date.now(),
      ...executionData
    };
    
    this.logger.debug(`Created execution object: ${executionId} for strategy: ${strategyId}`);
    this.emit("execution:created", { executionId, strategyId });
    
    if (this.metrics) {
      this.metrics.recordMetric("execution_object_created", 1);
    }
    
    return executionObject;
  }
  
  /**
   * Completes an execution object with results.
   * @param {string} executionId - Execution ID
   * @param {Object} results - Execution results
   * @returns {Object} Completed execution object
   */
  completeExecutionObject(executionId, results = {}) {
    // Find context by execution ID
    let contextId = null;
    let context = null;
    
    for (const [cid, ctx] of this.executionContexts.entries()) {
      if (ctx.data.executionId === executionId) {
        contextId = cid;
        context = ctx;
        break;
      }
    }
    
    // Create completed execution object
    const completedExecution = {
      executionId,
      completedAt: Date.now(),
      duration: context ? Date.now() - context.data.executionStartTime : 0,
      context: context ? context.data : {},
      ...results
    };
    
    // Update context if found
    if (contextId) {
      this.updateExecutionContext(
        contextId,
        { 
          executionCompleted: true,
          executionResults: results,
          executionCompletedAt: Date.now()
        },
        "ExecutionObjectCompletion"
      );
    }
    
    this.logger.debug(`Completed execution object: ${executionId}`);
    this.emit("execution:completed", { executionId, results });
    
    if (this.metrics) {
      this.metrics.recordMetric("execution_object_completed", 1);
    }
    
    return completedExecution;
  }
  
  /**
   * Cleans up expired contexts.
   * @private
   */
  cleanupExpiredContexts() {
    const now = Date.now();
    let expiredCount = 0;
    
    // Clean up execution contexts
    for (const [contextId, context] of this.executionContexts.entries()) {
      if (now - context.updatedAt > this.contextExpirationMs) {
        this.executionContexts.delete(contextId);
        expiredCount++;
      }
    }
    
    // Clean up strategy contexts
    for (const [strategyId, link] of this.strategyContexts.entries()) {
      if (now - link.linkedAt > this.contextExpirationMs) {
        this.strategyContexts.delete(strategyId);
      }
    }
    
    // Clean up analysis contexts
    for (const [analysisId, link] of this.analysisContexts.entries()) {
      if (now - link.linkedAt > this.contextExpirationMs) {
        this.analysisContexts.delete(analysisId);
      }
    }
    
    // Clean up learning contexts
    for (const [learningId, link] of this.learningContexts.entries()) {
      if (now - link.linkedAt > this.contextExpirationMs) {
        this.learningContexts.delete(learningId);
      }
    }
    
    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired contexts`);
      
      if (this.metrics) {
        this.metrics.recordMetric("expired_contexts_cleaned", expiredCount);
      }
    }
  }
  
  /**
   * Stops the context propagation manager and cleans up resources.
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.logger.info("ContextPropagationManager stopped");
  }
}

module.exports = ContextPropagationManager;
