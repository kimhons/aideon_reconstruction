/**
 * @fileoverview Implementation of the StrategyPipelineBridge component for the Autonomous Error Recovery System.
 * This component serves as an integration bridge between the new StrategyPipeline architecture
 * and the existing RecoveryStrategyGenerator and ResolutionExecutor components.
 * 
 * @module core/error_recovery/bridges/StrategyPipelineBridge
 * @requires events
 * @requires uuid
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");

/**
 * StrategyPipelineBridge connects the new StrategyPipeline architecture with
 * existing RecoveryStrategyGenerator and ResolutionExecutor components,
 * enabling a phased migration while maintaining backward compatibility.
 */
class StrategyPipelineBridge extends EventEmitter {
  /**
   * Creates a new StrategyPipelineBridge instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.strategyPipeline - New StrategyPipeline instance
   * @param {Object} options.contextManager - ContextPropagationManager instance
   * @param {Object} options.strategyGenerator - Existing RecoveryStrategyGenerator instance
   * @param {Object} options.resolutionExecutor - Existing ResolutionExecutor instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.strategyPipeline = options.strategyPipeline;
    this.contextManager = options.contextManager;
    this.strategyGenerator = options.strategyGenerator;
    this.resolutionExecutor = options.resolutionExecutor;
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Bridge state tracking
    this.bridgedOperations = new Map();
    this.legacyToNewMappings = new Map();
    this.newToLegacyMappings = new Map();
    
    // Register event listeners for bidirectional communication
    this.registerEventListeners();
    
    this.logger.info("StrategyPipelineBridge initialized");
  }
  
  /**
   * Registers event listeners for bidirectional communication.
   * @private
   */
  registerEventListeners() {
    // Listen to legacy component events
    if (this.strategyGenerator) {
      this.strategyGenerator.on("strategy:generation:started", this.handleLegacyGenerationStarted.bind(this));
      this.strategyGenerator.on("strategy:generation:completed", this.handleLegacyGenerationCompleted.bind(this));
      this.strategyGenerator.on("strategy:generation:failed", this.handleLegacyGenerationFailed.bind(this));
    }
    
    if (this.resolutionExecutor) {
      this.resolutionExecutor.on("resolution:started", this.handleLegacyResolutionStarted.bind(this));
      this.resolutionExecutor.on("resolution:completed", this.handleLegacyResolutionCompleted.bind(this));
      this.resolutionExecutor.on("resolution:failed", this.handleLegacyResolutionFailed.bind(this));
    }
    
    // Listen to new architecture events
    if (this.strategyPipeline) {
      this.strategyPipeline.on("pipeline:started", this.handleNewPipelineStarted.bind(this));
      this.strategyPipeline.on("pipeline:completed", this.handleNewPipelineCompleted.bind(this));
      this.strategyPipeline.on("pipeline:failed", this.handleNewPipelineFailed.bind(this));
      this.strategyPipeline.on("pipeline:strategy_generation:completed", this.handleNewStrategyGenerationCompleted.bind(this));
      this.strategyPipeline.on("pipeline:strategy_execution:completed", this.handleNewStrategyExecutionCompleted.bind(this));
    }
    
    this.logger.debug("Event listeners registered for bidirectional communication");
  }
  
  /**
   * Processes an error through the new StrategyPipeline while maintaining
   * compatibility with legacy components.
   * @param {string} errorId - Error ID
   * @param {Object} errorContext - Error context
   * @param {Object} [options] - Processing options
   * @param {boolean} [options.useLegacyFallback=true] - Whether to use legacy components as fallback
   * @returns {Promise<Object>} Processing result
   */
  async processError(errorId, errorContext, options = {}) {
    const bridgeId = uuidv4();
    const startTime = Date.now();
    const { useLegacyFallback = true } = options;
    
    this.logger.debug(`Processing error ${errorId} through bridge ${bridgeId}`);
    
    // Track bridged operation
    this.bridgedOperations.set(bridgeId, {
      errorId,
      startTime,
      status: "started",
      usedPipeline: false,
      usedLegacy: false,
      result: null
    });
    
    try {
      // Try processing through new pipeline first
      if (this.strategyPipeline) {
        this.logger.debug(`Using new StrategyPipeline for error ${errorId}`);
        
        const pipelineResult = await this.strategyPipeline.processThroughPipeline(
          errorId,
          errorContext
        );
        
        // Update bridge operation
        const operation = this.bridgedOperations.get(bridgeId);
        operation.usedPipeline = true;
        operation.status = "completed";
        operation.result = pipelineResult;
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
        
        this.logger.debug(`Successfully processed error ${errorId} through new pipeline in ${operation.duration}ms`);
        
        if (this.metrics) {
          this.metrics.recordMetric("bridge_used_pipeline", 1);
          this.metrics.recordMetric("bridge_duration", operation.duration);
        }
        
        return {
          bridgeId,
          errorId,
          usedPipeline: true,
          usedLegacy: false,
          successful: pipelineResult.successful,
          result: pipelineResult,
          duration: operation.duration
        };
      }
      
      // Fall back to legacy components if pipeline not available or failed
      if (useLegacyFallback && this.strategyGenerator && this.resolutionExecutor) {
        this.logger.debug(`Using legacy components for error ${errorId}`);
        
        const legacyResult = await this.processErrorWithLegacyComponents(
          errorId,
          errorContext
        );
        
        // Update bridge operation
        const operation = this.bridgedOperations.get(bridgeId);
        operation.usedLegacy = true;
        operation.status = "completed";
        operation.result = legacyResult;
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
        
        this.logger.debug(`Successfully processed error ${errorId} through legacy components in ${operation.duration}ms`);
        
        if (this.metrics) {
          this.metrics.recordMetric("bridge_used_legacy", 1);
          this.metrics.recordMetric("bridge_duration", operation.duration);
        }
        
        return {
          bridgeId,
          errorId,
          usedPipeline: false,
          usedLegacy: true,
          successful: legacyResult.successful,
          result: legacyResult,
          duration: operation.duration
        };
      }
      
      // No processing options available
      throw new Error("No processing options available: neither pipeline nor legacy components are accessible");
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error processing through bridge: ${error.message}`, error);
      
      // Update bridge operation
      const operation = this.bridgedOperations.get(bridgeId);
      if (operation) {
        operation.status = "failed";
        operation.error = error;
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
      }
      
      if (this.metrics) {
        this.metrics.recordMetric("bridge_error", 1);
        this.metrics.recordMetric("bridge_duration", duration);
      }
      
      return {
        bridgeId,
        errorId,
        usedPipeline: false,
        usedLegacy: false,
        successful: false,
        error: error.message,
        duration
      };
    }
  }
  
  /**
   * Processes an error with legacy components.
   * @param {string} errorId - Error ID
   * @param {Object} errorContext - Error context
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async processErrorWithLegacyComponents(errorId, errorContext) {
    // Create analysis result (normally would come from CausalAnalyzer)
    const analysisResult = {
      analysisId: `legacy-analysis-${uuidv4()}`,
      errorId,
      errorType: errorContext.errorType || "Unknown",
      componentId: errorContext.componentId || "Unknown",
      severity: errorContext.severity || "medium",
      rootCauses: [
        {
          cause: errorContext.errorMessage || "Unknown error",
          confidence: 0.8,
          evidence: ["Error message analysis"]
        }
      ],
      timestamp: Date.now()
    };
    
    // Generate strategies
    const generationResult = await this.strategyGenerator.generateStrategies(
      errorId,
      analysisResult
    );
    
    if (!generationResult.strategies || generationResult.strategies.length === 0) {
      throw new Error("No strategies generated by legacy component");
    }
    
    // Select best strategy (first one for simplicity)
    const selectedStrategy = generationResult.strategies[0];
    
    // Execute strategy
    const executionResult = await this.resolutionExecutor.executeStrategy(
      selectedStrategy,
      { ...errorContext, analysisResult }
    );
    
    return {
      errorId,
      successful: executionResult.successful,
      strategy: selectedStrategy,
      execution: executionResult,
      timestamp: Date.now()
    };
  }
  
  /**
   * Translates a legacy strategy to the new format.
   * @param {Object} legacyStrategy - Legacy strategy object
   * @returns {Object} New format strategy
   * @private
   */
  translateLegacyToNewStrategy(legacyStrategy) {
    // Create a new format strategy based on legacy strategy
    const newStrategy = {
      ...legacyStrategy,
      metadata: {
        ...(legacyStrategy.metadata || {}),
        originalFormat: "legacy",
        translatedAt: Date.now()
      }
    };
    
    // Store mapping for future reference
    this.legacyToNewMappings.set(legacyStrategy.id, newStrategy.id);
    this.newToLegacyMappings.set(newStrategy.id, legacyStrategy.id);
    
    return newStrategy;
  }
  
  /**
   * Translates a new strategy to the legacy format.
   * @param {Object} newStrategy - New format strategy
   * @returns {Object} Legacy format strategy
   * @private
   */
  translateNewToLegacyStrategy(newStrategy) {
    // Create a legacy format strategy based on new strategy
    const legacyStrategy = {
      ...newStrategy,
      metadata: {
        ...(newStrategy.metadata || {}),
        originalFormat: "new",
        translatedAt: Date.now()
      }
    };
    
    // Store mapping for future reference
    this.newToLegacyMappings.set(newStrategy.id, legacyStrategy.id);
    this.legacyToNewMappings.set(legacyStrategy.id, newStrategy.id);
    
    return legacyStrategy;
  }
  
  /**
   * Handles legacy strategy generation started event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyGenerationStarted(event) {
    this.logger.debug(`Legacy strategy generation started: ${event.generationId}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline && this.contextManager) {
      // Create context for the generation
      const contextId = this.contextManager.createExecutionContext(
        event.errorId,
        { legacyGenerationId: event.generationId }
      ).contextId;
      
      this.logger.debug(`Created context ${contextId} for legacy generation ${event.generationId}`);
    }
  }
  
  /**
   * Handles legacy strategy generation completed event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyGenerationCompleted(event) {
    this.logger.debug(`Legacy strategy generation completed: ${event.generationId}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline) {
      this.strategyPipeline.emit("pipeline:strategy_generation:completed", {
        pipelineId: `legacy-${event.generationId}`,
        strategies: event.strategies.map(s => this.translateLegacyToNewStrategy(s))
      });
    }
  }
  
  /**
   * Handles legacy strategy generation failed event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyGenerationFailed(event) {
    this.logger.debug(`Legacy strategy generation failed: ${event.generationId}, Error: ${event.error}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline) {
      this.strategyPipeline.emit("pipeline:strategy_generation:failed", {
        pipelineId: `legacy-${event.generationId}`,
        error: event.error
      });
    }
  }
  
  /**
   * Handles legacy resolution started event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyResolutionStarted(event) {
    this.logger.debug(`Legacy resolution started: ${event.executionId}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline) {
      this.strategyPipeline.emit("pipeline:strategy_execution:started", {
        pipelineId: `legacy-${event.executionId}`,
        strategyId: event.strategyId
      });
    }
  }
  
  /**
   * Handles legacy resolution completed event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyResolutionCompleted(event) {
    this.logger.debug(`Legacy resolution completed: ${event.executionId}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline) {
      this.strategyPipeline.emit("pipeline:strategy_execution:completed", {
        pipelineId: `legacy-${event.executionId}`,
        strategyId: event.strategyId,
        result: event
      });
    }
  }
  
  /**
   * Handles legacy resolution failed event.
   * @param {Object} event - Event data
   * @private
   */
  handleLegacyResolutionFailed(event) {
    this.logger.debug(`Legacy resolution failed: ${event.executionId}, Error: ${event.error}`);
    
    // Forward to new pipeline if appropriate
    if (this.strategyPipeline) {
      this.strategyPipeline.emit("pipeline:strategy_execution:failed", {
        pipelineId: `legacy-${event.executionId}`,
        strategyId: event.strategyId,
        error: event.error
      });
    }
  }
  
  /**
   * Handles new pipeline started event.
   * @param {Object} event - Event data
   * @private
   */
  handleNewPipelineStarted(event) {
    this.logger.debug(`New pipeline started: ${event.pipelineId}`);
    
    // No specific action needed for legacy components
  }
  
  /**
   * Handles new pipeline completed event.
   * @param {Object} event - Event data
   * @private
   */
  handleNewPipelineCompleted(event) {
    this.logger.debug(`New pipeline completed: ${event.pipelineId}`);
    
    // No specific action needed for legacy components
  }
  
  /**
   * Handles new pipeline failed event.
   * @param {Object} event - Event data
   * @private
   */
  handleNewPipelineFailed(event) {
    this.logger.debug(`New pipeline failed: ${event.pipelineId}, Error: ${event.error}`);
    
    // No specific action needed for legacy components
  }
  
  /**
   * Handles new strategy generation completed event.
   * @param {Object} event - Event data
   * @private
   */
  handleNewStrategyGenerationCompleted(event) {
    this.logger.debug(`New strategy generation completed: ${event.pipelineId}`);
    
    // Forward to legacy components if appropriate
    if (this.strategyGenerator && event.strategies) {
      this.strategyGenerator.emit("strategy:generation:completed", {
        generationId: `new-${event.pipelineId}`,
        strategies: event.strategies.map(s => this.translateNewToLegacyStrategy(s))
      });
    }
  }
  
  /**
   * Handles new strategy execution completed event.
   * @param {Object} event - Event data
   * @private
   */
  handleNewStrategyExecutionCompleted(event) {
    this.logger.debug(`New strategy execution completed: ${event.pipelineId}`);
    
    // Forward to legacy components if appropriate
    if (this.resolutionExecutor) {
      this.resolutionExecutor.emit("resolution:completed", {
        executionId: `new-${event.pipelineId}`,
        strategyId: event.strategyId,
        ...event.result
      });
    }
  }
  
  /**
   * Gets bridge operation status.
   * @param {string} bridgeId - Bridge operation ID
   * @returns {Object|null} Operation status or null if not found
   */
  getBridgeOperationStatus(bridgeId) {
    if (!this.bridgedOperations.has(bridgeId)) {
      return null;
    }
    
    const operation = this.bridgedOperations.get(bridgeId);
    return {
      bridgeId,
      errorId: operation.errorId,
      status: operation.status,
      usedPipeline: operation.usedPipeline,
      usedLegacy: operation.usedLegacy,
      startTime: operation.startTime,
      endTime: operation.endTime,
      duration: operation.duration
    };
  }
}

module.exports = StrategyPipelineBridge;
