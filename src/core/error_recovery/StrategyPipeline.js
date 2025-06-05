/**
 * @fileoverview Implementation of the StrategyPipeline component for the Autonomous Error Recovery System.
 * This component provides a robust, context-preserving pipeline for strategy generation, validation,
 * and execution, ensuring reliable integration between neural, semantic, predictive, and learning systems.
 * 
 * @module core/error_recovery/StrategyPipeline
 * @requires events
 * @requires uuid
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");

/**
 * StrategyPipeline provides a robust, context-preserving pipeline for strategy generation,
 * validation, and execution, ensuring reliable integration between system components.
 */
class StrategyPipeline extends EventEmitter {
  /**
   * Creates a new StrategyPipeline instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.strategyGenerator - Strategy generator instance
   * @param {Object} options.resolutionExecutor - Resolution executor instance
   * @param {Object} options.bayesianPredictor - Bayesian predictor instance
   * @param {Object} options.neuralHub - Neural coordination hub instance
   * @param {Object} options.semanticProcessor - Semantic processor instance
   * @param {Object} options.learningSystem - Learning system instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.strategyGenerator = options.strategyGenerator;
    this.resolutionExecutor = options.resolutionExecutor;
    this.bayesianPredictor = options.bayesianPredictor;
    this.neuralHub = options.neuralHub;
    this.semanticProcessor = options.semanticProcessor;
    this.learningSystem = options.learningSystem;
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Pipeline state tracking
    this.activePipelines = new Map();
    this.pipelineHistory = new Map();
    this.contextRegistry = new Map();
    
    // Register event listeners for cross-component coordination
    this.registerEventListeners();
    
    this.logger.info("StrategyPipeline initialized");
  }
  
  /**
   * Registers event listeners for cross-component coordination.
   * @private
   */
  registerEventListeners() {
    // Listen for neural insights that might affect strategy generation
    if (this.neuralHub) {
      this.neuralHub.on("neural:insight", this.handleNeuralInsight.bind(this));
      this.neuralHub.on("neural:error", this.handleNeuralError.bind(this));
    }
    
    // Listen for semantic events
    if (this.semanticProcessor) {
      this.semanticProcessor.on("query:completed", this.handleSemanticQueryCompleted.bind(this));
      this.semanticProcessor.on("query:failed", this.handleSemanticQueryFailed.bind(this));
    }
    
    // Listen for strategy generation events
    if (this.strategyGenerator) {
      this.strategyGenerator.on("strategy:generation:completed", this.handleStrategyGenerationCompleted.bind(this));
      this.strategyGenerator.on("strategy:generation:failed", this.handleStrategyGenerationFailed.bind(this));
    }
    
    // Listen for execution events
    if (this.resolutionExecutor) {
      this.resolutionExecutor.on("resolution:completed", this.handleResolutionCompleted.bind(this));
      this.resolutionExecutor.on("resolution:failed", this.handleResolutionFailed.bind(this));
    }
    
    // Listen for learning events
    if (this.learningSystem) {
      this.learningSystem.on("learning:completed", this.handleLearningCompleted.bind(this));
    }
  }
  
  /**
   * Processes an error through the complete strategy pipeline.
   * @param {string} errorId - ID of the error
   * @param {Object} errorContext - Error context
   * @param {Object} [options] - Pipeline options
   * @param {boolean} [options.enrichWithNeural=true] - Whether to enrich context with neural insights
   * @param {boolean} [options.enrichWithSemantic=true] - Whether to enrich context with semantic insights
   * @param {boolean} [options.validateStrategies=true] - Whether to validate strategies before execution
   * @param {boolean} [options.learnFromExecution=true] - Whether to learn from execution results
   * @returns {Promise<Object>} Pipeline result
   */
  async processThroughPipeline(errorId, errorContext, options = {}) {
    const pipelineId = uuidv4();
    const startTime = Date.now();
    const {
      enrichWithNeural = true,
      enrichWithSemantic = true,
      validateStrategies = true,
      learnFromExecution = true
    } = options;
    
    // Create pipeline context to preserve state throughout the pipeline
    const pipelineContext = {
      pipelineId,
      errorId,
      originalContext: { ...errorContext },
      enrichedContext: { ...errorContext },
      analysisResult: null,
      strategies: [],
      selectedStrategy: null,
      executionResult: null,
      learningResult: null,
      startTime,
      status: "started",
      completedSteps: [],
      errors: []
    };
    
    // Register pipeline in active pipelines
    this.activePipelines.set(pipelineId, pipelineContext);
    
    // Emit pipeline started event
    this.emit("pipeline:started", { 
      pipelineId, 
      errorId, 
      context: { ...errorContext } 
    });
    
    try {
      this.logger.debug(`Starting strategy pipeline: ${pipelineId} for error: ${errorId}`);
      
      // Step 1: Enrich context with neural insights if enabled
      if (enrichWithNeural && this.neuralHub) {
        try {
          pipelineContext.enrichedContext = await this.enrichWithNeuralContext(
            pipelineContext.enrichedContext, 
            pipelineId
          );
          pipelineContext.completedSteps.push("neural_enrichment");
        } catch (error) {
          this.logger.warn(`Neural enrichment failed: ${error.message}`, error);
          pipelineContext.errors.push({
            step: "neural_enrichment",
            error: error.message,
            timestamp: Date.now()
          });
          // Continue pipeline despite error
        }
      }
      
      // Step 2: Enrich context with semantic insights if enabled
      if (enrichWithSemantic && this.semanticProcessor) {
        try {
          pipelineContext.enrichedContext = await this.enrichWithSemanticContext(
            pipelineContext.enrichedContext, 
            pipelineId
          );
          pipelineContext.completedSteps.push("semantic_enrichment");
        } catch (error) {
          this.logger.warn(`Semantic enrichment failed: ${error.message}`, error);
          pipelineContext.errors.push({
            step: "semantic_enrichment",
            error: error.message,
            timestamp: Date.now()
          });
          // Continue pipeline despite error
        }
      }
      
      // Step 3: Perform causal analysis
      try {
        pipelineContext.analysisResult = await this.performCausalAnalysis(
          pipelineContext.enrichedContext, 
          pipelineId
        );
        pipelineContext.completedSteps.push("causal_analysis");
      } catch (error) {
        this.logger.error(`Causal analysis failed: ${error.message}`, error);
        pipelineContext.errors.push({
          step: "causal_analysis",
          error: error.message,
          timestamp: Date.now()
        });
        
        // Create fallback analysis result to continue pipeline
        pipelineContext.analysisResult = this.createFallbackAnalysisResult(
          errorId, 
          pipelineContext.enrichedContext
        );
      }
      
      // Step 4: Generate strategies
      try {
        const generationResult = await this.generateStrategies(
          errorId, 
          pipelineContext.analysisResult, 
          pipelineId
        );
        pipelineContext.strategies = generationResult.strategies || [];
        pipelineContext.completedSteps.push("strategy_generation");
      } catch (error) {
        this.logger.error(`Strategy generation failed: ${error.message}`, error);
        pipelineContext.errors.push({
          step: "strategy_generation",
          error: error.message,
          timestamp: Date.now()
        });
        
        // Create fallback strategy to continue pipeline
        pipelineContext.strategies = [this.createFallbackStrategy(
          errorId, 
          pipelineContext.analysisResult
        )];
      }
      
      // Step 5: Validate strategies if enabled
      if (validateStrategies && pipelineContext.strategies.length > 0) {
        try {
          pipelineContext.strategies = await this.validateStrategies(
            pipelineContext.strategies, 
            pipelineContext.analysisResult, 
            pipelineId
          );
          pipelineContext.completedSteps.push("strategy_validation");
        } catch (error) {
          this.logger.warn(`Strategy validation failed: ${error.message}`, error);
          pipelineContext.errors.push({
            step: "strategy_validation",
            error: error.message,
            timestamp: Date.now()
          });
          // Continue with unvalidated strategies
        }
      }
      
      // Step 6: Select best strategy
      try {
        pipelineContext.selectedStrategy = await this.selectBestStrategy(
          pipelineContext.strategies, 
          pipelineContext.analysisResult, 
          pipelineId
        );
        pipelineContext.completedSteps.push("strategy_selection");
      } catch (error) {
        this.logger.error(`Strategy selection failed: ${error.message}`, error);
        pipelineContext.errors.push({
          step: "strategy_selection",
          error: error.message,
          timestamp: Date.now()
        });
        
        // Use first strategy as fallback if available
        if (pipelineContext.strategies.length > 0) {
          pipelineContext.selectedStrategy = pipelineContext.strategies[0];
        } else {
          // Create emergency fallback strategy
          pipelineContext.selectedStrategy = this.createFallbackStrategy(
            errorId, 
            pipelineContext.analysisResult
          );
        }
      }
      
      // Step 7: Execute selected strategy
      if (pipelineContext.selectedStrategy) {
        try {
          pipelineContext.executionResult = await this.executeStrategy(
            pipelineContext.selectedStrategy, 
            pipelineContext.enrichedContext, 
            pipelineId
          );
          pipelineContext.completedSteps.push("strategy_execution");
        } catch (error) {
          this.logger.error(`Strategy execution failed: ${error.message}`, error);
          pipelineContext.errors.push({
            step: "strategy_execution",
            error: error.message,
            timestamp: Date.now()
          });
          
          // Create fallback execution result
          pipelineContext.executionResult = {
            executionId: `fallback-execution-${uuidv4()}`,
            strategyId: pipelineContext.selectedStrategy.id,
            successful: false,
            actionResults: [],
            error: {
              message: error.message,
              stack: error.stack
            },
            completedAt: Date.now()
          };
        }
      }
      
      // Step 8: Learn from execution if enabled
      if (learnFromExecution && this.learningSystem && pipelineContext.executionResult) {
        try {
          pipelineContext.learningResult = await this.learnFromExecution(
            pipelineContext.executionResult, 
            pipelineContext.enrichedContext, 
            pipelineId
          );
          pipelineContext.completedSteps.push("execution_learning");
        } catch (error) {
          this.logger.warn(`Learning from execution failed: ${error.message}`, error);
          pipelineContext.errors.push({
            step: "execution_learning",
            error: error.message,
            timestamp: Date.now()
          });
          // Continue pipeline despite learning error
        }
      }
      
      // Step 9: Complete pipeline
      pipelineContext.status = "completed";
      pipelineContext.duration = Date.now() - startTime;
      
      // Move from active to history
      this.activePipelines.delete(pipelineId);
      this.pipelineHistory.set(pipelineId, pipelineContext);
      
      // Emit pipeline completed event
      this.emit("pipeline:completed", {
        pipelineId,
        errorId,
        duration: pipelineContext.duration,
        successful: pipelineContext.executionResult?.successful || false,
        completedSteps: pipelineContext.completedSteps,
        errors: pipelineContext.errors
      });
      
      // Record metrics
      if (this.metrics) {
        this.metrics.recordMetric("strategy_pipeline_duration", pipelineContext.duration);
        this.metrics.recordMetric("strategy_pipeline_success", 
          pipelineContext.executionResult?.successful ? 1 : 0);
        this.metrics.recordMetric("strategy_pipeline_steps_completed", 
          pipelineContext.completedSteps.length);
        this.metrics.recordMetric("strategy_pipeline_errors", 
          pipelineContext.errors.length);
      }
      
      this.logger.debug(`Completed strategy pipeline: ${pipelineId} in ${pipelineContext.duration}ms`);
      
      return {
        pipelineId,
        errorId,
        successful: pipelineContext.executionResult?.successful || false,
        executionResult: pipelineContext.executionResult,
        learningResult: pipelineContext.learningResult,
        duration: pipelineContext.duration,
        completedSteps: pipelineContext.completedSteps,
        errors: pipelineContext.errors
      };
      
    } catch (error) {
      // Handle catastrophic pipeline failure
      const duration = Date.now() - startTime;
      this.logger.error(`Catastrophic pipeline failure: ${error.message}`, error);
      
      // Update pipeline context
      pipelineContext.status = "failed";
      pipelineContext.duration = duration;
      pipelineContext.errors.push({
        step: "pipeline",
        error: error.message,
        timestamp: Date.now()
      });
      
      // Move from active to history
      this.activePipelines.delete(pipelineId);
      this.pipelineHistory.set(pipelineId, pipelineContext);
      
      // Emit pipeline failed event
      this.emit("pipeline:failed", {
        pipelineId,
        errorId,
        duration,
        error: error.message,
        completedSteps: pipelineContext.completedSteps,
        errors: pipelineContext.errors
      });
      
      // Record metrics
      if (this.metrics) {
        this.metrics.recordMetric("strategy_pipeline_duration", duration);
        this.metrics.recordMetric("strategy_pipeline_success", 0);
        this.metrics.recordMetric("strategy_pipeline_catastrophic_failure", 1);
      }
      
      return {
        pipelineId,
        errorId,
        successful: false,
        duration,
        completedSteps: pipelineContext.completedSteps,
        errors: pipelineContext.errors,
        catastrophicError: error.message
      };
    }
  }
  
  /**
   * Enriches error context with neural insights.
   * @param {Object} context - Error context
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Enriched context
   * @private
   */
  async enrichWithNeuralContext(context, pipelineId) {
    this.logger.debug(`Enriching context with neural insights for pipeline: ${pipelineId}`);
    
    if (!this.neuralHub) {
      return context;
    }
    
    try {
      // Get neural context for error
      const neuralContext = await this.neuralHub.getContextForError(context.errorMessage || "Unknown error");
      
      // Merge neural context with original context
      const enrichedContext = {
        ...context,
        neuralContext: neuralContext,
        neuralPathways: neuralContext?.activatedPathways || [],
        neuralConfidence: neuralContext?.confidence || 0
      };
      
      this.emit("pipeline:neural_enrichment:completed", {
        pipelineId,
        originalContext: context,
        enrichedContext
      });
      
      return enrichedContext;
    } catch (error) {
      this.logger.warn(`Failed to enrich context with neural insights: ${error.message}`, error);
      
      // Return original context if enrichment fails
      return context;
    }
  }
  
  /**
   * Enriches error context with semantic insights.
   * @param {Object} context - Error context
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Enriched context
   * @private
   */
  async enrichWithSemanticContext(context, pipelineId) {
    this.logger.debug(`Enriching context with semantic insights for pipeline: ${pipelineId}`);
    
    if (!this.semanticProcessor) {
      return context;
    }
    
    try {
      // Create semantic query
      const query = {
        queryId: `semantic-query-${uuidv4()}`,
        queryType: "ERROR_CONTEXT_ENRICHMENT",
        parameters: {
          errorMessage: context.errorMessage || "Unknown error",
          errorType: context.errorType || "Unknown",
          componentId: context.componentId || "Unknown"
        },
        domains: ["ErrorDomain", "ApplicationDomain", "SystemDomain"]
      };
      
      // Execute semantic query
      const queryResult = await this.semanticProcessor.executeQuery(query);
      
      // Merge semantic insights with original context
      const enrichedContext = {
        ...context,
        semanticInsights: queryResult.insights || [],
        crossDomainRelations: queryResult.crossDomainRelations || [],
        semanticConfidence: queryResult.confidence || 0
      };
      
      this.emit("pipeline:semantic_enrichment:completed", {
        pipelineId,
        originalContext: context,
        enrichedContext
      });
      
      return enrichedContext;
    } catch (error) {
      this.logger.warn(`Failed to enrich context with semantic insights: ${error.message}`, error);
      
      // Return original context if enrichment fails
      return context;
    }
  }
  
  /**
   * Performs causal analysis on the enriched context.
   * @param {Object} enrichedContext - Enriched error context
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async performCausalAnalysis(enrichedContext, pipelineId) {
    this.logger.debug(`Performing causal analysis for pipeline: ${pipelineId}`);
    
    // Create analysis ID
    const analysisId = `analysis_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    
    try {
      // If we have a causal analyzer, use it
      if (this.causalAnalyzer) {
        const analysisResult = await this.causalAnalyzer.analyzeError(
          enrichedContext.errorId || `error-${uuidv4()}`,
          enrichedContext
        );
        
        this.emit("pipeline:causal_analysis:completed", {
          pipelineId,
          analysisId: analysisResult.analysisId || analysisId,
          result: analysisResult
        });
        
        return analysisResult;
      }
      
      // Otherwise, create a simple analysis result
      const analysisResult = {
        analysisId,
        errorId: enrichedContext.errorId || `error-${uuidv4()}`,
        errorType: enrichedContext.errorType || "Unknown",
        componentId: enrichedContext.componentId || "Unknown",
        severity: enrichedContext.severity || "medium",
        rootCauses: [
          {
            cause: enrichedContext.errorMessage || "Unknown error",
            confidence: 0.8,
            evidence: ["Error message analysis"]
          }
        ],
        relatedFactors: enrichedContext.neuralPathways || [],
        crossDomainInsights: enrichedContext.semanticInsights || [],
        timestamp: Date.now()
      };
      
      this.emit("pipeline:causal_analysis:completed", {
        pipelineId,
        analysisId,
        result: analysisResult
      });
      
      return analysisResult;
    } catch (error) {
      this.logger.error(`Causal analysis failed: ${error.message}`, error);
      
      // Emit analysis failed event
      this.emit("pipeline:causal_analysis:failed", {
        pipelineId,
        analysisId,
        error: error.message
      });
      
      // Throw error to be handled by pipeline
      throw error;
    }
  }
  
  /**
   * Creates a fallback analysis result when causal analysis fails.
   * @param {string} errorId - Error ID
   * @param {Object} context - Error context
   * @returns {Object} Fallback analysis result
   * @private
   */
  createFallbackAnalysisResult(errorId, context) {
    const analysisId = `fallback_analysis_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    
    return {
      analysisId,
      errorId,
      errorType: context.errorType || "Unknown",
      componentId: context.componentId || "Unknown",
      severity: context.severity || "medium",
      rootCauses: [
        {
          cause: context.errorMessage || "Unknown error",
          confidence: 0.5,
          evidence: ["Fallback analysis"]
        }
      ],
      relatedFactors: [],
      crossDomainInsights: [],
      timestamp: Date.now(),
      isFallback: true
    };
  }
  
  /**
   * Generates strategies based on analysis result.
   * @param {string} errorId - Error ID
   * @param {Object} analysisResult - Analysis result
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Generation result
   * @private
   */
  async generateStrategies(errorId, analysisResult, pipelineId) {
    this.logger.debug(`Generating strategies for pipeline: ${pipelineId}`);
    
    if (!this.strategyGenerator) {
      // Create fallback strategy if no generator available
      const fallbackStrategy = this.createFallbackStrategy(errorId, analysisResult);
      
      return { strategies: [fallbackStrategy] };
    }
    
    try {
      // Generate strategies using strategy generator
      const generationResult = await this.strategyGenerator.generateStrategies(
        errorId,
        analysisResult,
        {
          maxStrategies: 5,
          minConfidence: 0.5,
          includeExperimental: false,
          useFallbackStrategy: true
        }
      );
      
      this.emit("pipeline:strategy_generation:completed", {
        pipelineId,
        strategies: generationResult.strategies || []
      });
      
      return generationResult;
    } catch (error) {
      this.logger.error(`Strategy generation failed: ${error.message}`, error);
      
      // Emit generation failed event
      this.emit("pipeline:strategy_generation:failed", {
        pipelineId,
        error: error.message
      });
      
      // Throw error to be handled by pipeline
      throw error;
    }
  }
  
  /**
   * Creates a fallback strategy when strategy generation fails.
   * @param {string} errorId - Error ID
   * @param {Object} analysisResult - Analysis result
   * @returns {Object} Fallback strategy
   * @private
   */
  createFallbackStrategy(errorId, analysisResult) {
    return {
      id: `emergency-fallback-strategy-${uuidv4()}`,
      name: "Emergency Fallback Recovery Strategy",
      description: `Emergency fallback recovery strategy for ${analysisResult.errorType || "unknown error"}`,
      confidence: 0.5,
      actions: [
        {
          actionId: "DiagnoseAction",
          parameters: { depth: "medium" }
        },
        {
          actionId: "RestartComponentAction",
          parameters: { 
            componentId: analysisResult.componentId || "unknown",
            mode: "safe"
          }
        }
      ],
      metadata: {
        tags: ["emergency", "fallback", "auto-generated"],
        source: "strategy-pipeline-emergency",
        analysisId: analysisResult.analysisId || "unknown",
        isFallback: true
      }
    };
  }
  
  /**
   * Validates strategies using the Bayesian predictor.
   * @param {Array<Object>} strategies - Strategies to validate
   * @param {Object} analysisResult - Analysis result
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Array<Object>>} Validated strategies
   * @private
   */
  async validateStrategies(strategies, analysisResult, pipelineId) {
    this.logger.debug(`Validating ${strategies.length} strategies for pipeline: ${pipelineId}`);
    
    if (!this.bayesianPredictor || strategies.length === 0) {
      return strategies;
    }
    
    try {
      // Validate each strategy
      const validationPromises = strategies.map(async (strategy) => {
        try {
          // Predict recovery success
          const prediction = await this.bayesianPredictor.predictRecoverySuccess(
            strategy,
            analysisResult
          );
          
          // Enhance strategy with prediction
          return {
            ...strategy,
            validationResult: {
              successProbability: prediction.probability || 0.5,
              confidence: prediction.confidence || 0.5,
              factors: prediction.factors || [],
              recommendations: prediction.recommendations || [],
              timestamp: Date.now()
            }
          };
        } catch (error) {
          this.logger.warn(`Strategy validation failed for ${strategy.id}: ${error.message}`);
          
          // Return strategy without validation
          return {
            ...strategy,
            validationResult: {
              successProbability: 0.5,
              confidence: 0.5,
              factors: [],
              recommendations: [],
              timestamp: Date.now(),
              error: error.message
            }
          };
        }
      });
      
      // Wait for all validations to complete
      const validatedStrategies = await Promise.all(validationPromises);
      
      this.emit("pipeline:strategy_validation:completed", {
        pipelineId,
        strategies: validatedStrategies
      });
      
      return validatedStrategies;
    } catch (error) {
      this.logger.warn(`Strategy validation failed: ${error.message}`, error);
      
      // Emit validation failed event
      this.emit("pipeline:strategy_validation:failed", {
        pipelineId,
        error: error.message
      });
      
      // Return original strategies if validation fails
      return strategies;
    }
  }
  
  /**
   * Selects the best strategy based on validation results.
   * @param {Array<Object>} strategies - Validated strategies
   * @param {Object} analysisResult - Analysis result
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Selected strategy
   * @private
   */
  async selectBestStrategy(strategies, analysisResult, pipelineId) {
    this.logger.debug(`Selecting best strategy from ${strategies.length} strategies for pipeline: ${pipelineId}`);
    
    if (strategies.length === 0) {
      throw new Error("No strategies available for selection");
    }
    
    try {
      // Sort strategies by success probability and confidence
      const sortedStrategies = [...strategies].sort((a, b) => {
        // First, prioritize strategies with validation results
        const aHasValidation = a.validationResult !== undefined;
        const bHasValidation = b.validationResult !== undefined;
        
        if (aHasValidation && !bHasValidation) return -1;
        if (!aHasValidation && bHasValidation) return 1;
        
        // If both have validation, compare success probability
        if (aHasValidation && bHasValidation) {
          const aProbability = a.validationResult.successProbability || 0;
          const bProbability = b.validationResult.successProbability || 0;
          
          if (aProbability !== bProbability) {
            return bProbability - aProbability; // Higher probability first
          }
          
          // If probabilities are equal, compare confidence
          const aConfidence = a.validationResult.confidence || 0;
          const bConfidence = b.validationResult.confidence || 0;
          
          if (aConfidence !== bConfidence) {
            return bConfidence - aConfidence; // Higher confidence first
          }
        }
        
        // If no validation or equal validation, compare strategy confidence
        return (b.confidence || 0) - (a.confidence || 0);
      });
      
      // Select the best strategy
      const selectedStrategy = sortedStrategies[0];
      
      this.emit("pipeline:strategy_selection:completed", {
        pipelineId,
        strategy: selectedStrategy
      });
      
      return selectedStrategy;
    } catch (error) {
      this.logger.error(`Strategy selection failed: ${error.message}`, error);
      
      // Emit selection failed event
      this.emit("pipeline:strategy_selection:failed", {
        pipelineId,
        error: error.message
      });
      
      // Throw error to be handled by pipeline
      throw error;
    }
  }
  
  /**
   * Executes the selected strategy.
   * @param {Object} strategy - Selected strategy
   * @param {Object} context - Enriched context
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async executeStrategy(strategy, context, pipelineId) {
    this.logger.debug(`Executing strategy ${strategy.id} for pipeline: ${pipelineId}`);
    
    if (!this.resolutionExecutor) {
      throw new Error("Resolution executor not available");
    }
    
    try {
      // Store context in registry for access during execution
      this.contextRegistry.set(strategy.id, {
        pipelineId,
        context,
        timestamp: Date.now()
      });
      
      // Execute strategy
      const executionResult = await this.resolutionExecutor.executeStrategy(
        strategy,
        context
      );
      
      // Clean up context registry
      this.contextRegistry.delete(strategy.id);
      
      this.emit("pipeline:strategy_execution:completed", {
        pipelineId,
        strategyId: strategy.id,
        result: executionResult
      });
      
      return executionResult;
    } catch (error) {
      this.logger.error(`Strategy execution failed: ${error.message}`, error);
      
      // Clean up context registry
      this.contextRegistry.delete(strategy.id);
      
      // Emit execution failed event
      this.emit("pipeline:strategy_execution:failed", {
        pipelineId,
        strategyId: strategy.id,
        error: error.message
      });
      
      // Throw error to be handled by pipeline
      throw error;
    }
  }
  
  /**
   * Learns from execution result.
   * @param {Object} executionResult - Execution result
   * @param {Object} context - Enriched context
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>} Learning result
   * @private
   */
  async learnFromExecution(executionResult, context, pipelineId) {
    this.logger.debug(`Learning from execution ${executionResult.executionId} for pipeline: ${pipelineId}`);
    
    if (!this.learningSystem) {
      return null;
    }
    
    try {
      // Learn from execution
      const learningResult = await this.learningSystem.learnFromExecution(
        executionResult,
        {
          errorType: context.errorType,
          componentId: context.componentId,
          severity: context.severity,
          neuralContext: context.neuralContext,
          semanticInsights: context.semanticInsights
        }
      );
      
      this.emit("pipeline:learning:completed", {
        pipelineId,
        executionId: executionResult.executionId,
        result: learningResult
      });
      
      return learningResult;
    } catch (error) {
      this.logger.warn(`Learning from execution failed: ${error.message}`, error);
      
      // Emit learning failed event
      this.emit("pipeline:learning:failed", {
        pipelineId,
        executionId: executionResult.executionId,
        error: error.message
      });
      
      // Return null if learning fails
      return null;
    }
  }
  
  /**
   * Gets the status of a pipeline.
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object|null} Pipeline status or null if not found
   */
  getPipelineStatus(pipelineId) {
    // Check active pipelines
    if (this.activePipelines.has(pipelineId)) {
      const pipeline = this.activePipelines.get(pipelineId);
      return {
        pipelineId,
        status: pipeline.status,
        startTime: pipeline.startTime,
        duration: Date.now() - pipeline.startTime,
        completedSteps: pipeline.completedSteps,
        errors: pipeline.errors
      };
    }
    
    // Check pipeline history
    if (this.pipelineHistory.has(pipelineId)) {
      const pipeline = this.pipelineHistory.get(pipelineId);
      return {
        pipelineId,
        status: pipeline.status,
        startTime: pipeline.startTime,
        duration: pipeline.duration,
        completedSteps: pipeline.completedSteps,
        errors: pipeline.errors,
        successful: pipeline.executionResult?.successful || false
      };
    }
    
    return null;
  }
  
  /**
   * Gets the context for a strategy.
   * @param {string} strategyId - Strategy ID
   * @returns {Object|null} Context or null if not found
   */
  getContextForStrategy(strategyId) {
    if (this.contextRegistry.has(strategyId)) {
      return this.contextRegistry.get(strategyId).context;
    }
    
    return null;
  }
  
  /**
   * Handles neural insight event.
   * @param {Object} event - Neural insight event
   * @private
   */
  handleNeuralInsight(event) {
    this.logger.debug(`Received neural insight: ${event.insightId}`);
    
    // Update active pipelines with neural insights if relevant
    for (const [pipelineId, pipeline] of this.activePipelines.entries()) {
      if (pipeline.status === "started" && 
          !pipeline.completedSteps.includes("causal_analysis")) {
        
        // Check if insight is relevant to this pipeline
        if (event.relatedErrors && event.relatedErrors.includes(pipeline.errorId)) {
          // Update enriched context with new insight
          pipeline.enrichedContext.neuralInsights = 
            pipeline.enrichedContext.neuralInsights || [];
          pipeline.enrichedContext.neuralInsights.push(event);
          
          this.logger.debug(`Updated pipeline ${pipelineId} with neural insight ${event.insightId}`);
        }
      }
    }
  }
  
  /**
   * Handles neural error event.
   * @param {Object} event - Neural error event
   * @private
   */
  handleNeuralError(event) {
    this.logger.warn(`Received neural error: ${event.error}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles semantic query completed event.
   * @param {Object} event - Semantic query completed event
   * @private
   */
  handleSemanticQueryCompleted(event) {
    this.logger.debug(`Semantic query completed: ${event.queryId}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles semantic query failed event.
   * @param {Object} event - Semantic query failed event
   * @private
   */
  handleSemanticQueryFailed(event) {
    this.logger.warn(`Semantic query failed: ${event.queryId}, Error: ${event.error}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles strategy generation completed event.
   * @param {Object} event - Strategy generation completed event
   * @private
   */
  handleStrategyGenerationCompleted(event) {
    this.logger.debug(`Strategy generation completed: ${event.generationId}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles strategy generation failed event.
   * @param {Object} event - Strategy generation failed event
   * @private
   */
  handleStrategyGenerationFailed(event) {
    this.logger.warn(`Strategy generation failed: ${event.generationId}, Error: ${event.error}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles resolution completed event.
   * @param {Object} event - Resolution completed event
   * @private
   */
  handleResolutionCompleted(event) {
    this.logger.debug(`Resolution completed: ${event.executionId}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles resolution failed event.
   * @param {Object} event - Resolution failed event
   * @private
   */
  handleResolutionFailed(event) {
    this.logger.warn(`Resolution failed: ${event.executionId}, Error: ${event.error}`);
    
    // No specific handling for now
  }
  
  /**
   * Handles learning completed event.
   * @param {Object} event - Learning completed event
   * @private
   */
  handleLearningCompleted(event) {
    this.logger.debug(`Learning completed: ${event.learningId}`);
    
    // No specific handling for now
  }
}

module.exports = StrategyPipeline;
