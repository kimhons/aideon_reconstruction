/**
 * @fileoverview Factory function implementation for CrossDomainQueryProcessor.
 * This module provides a factory function that creates a CrossDomainQueryProcessor object
 * with all methods directly on the instance to ensure compatibility with duck typing
 * checks across module boundaries.
 * 
 * @module core/semantic/CrossDomainQueryProcessorFactory
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// Define custom error types
class QuerySyntaxError extends Error { constructor(message) { super(message); this.name = "QuerySyntaxError"; } }
class QueryExecutionError extends Error { constructor(message) { super(message); this.name = "QueryExecutionError"; } }
class AccessDeniedError extends Error { constructor(message) { super(message); this.name = "AccessDeniedError"; } }
class BatchQueryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BatchQueryError";
    this.details = details; // { results: [], errors: [] }
  }
}
class ExecutionNotFoundError extends Error { constructor(message) { super(message); this.name = "ExecutionNotFoundError"; } }
class ResultNotReadyError extends Error { constructor(message) { super(message); this.name = "ResultNotReadyError"; } }
class CancellationError extends Error { constructor(message) { super(message); this.name = "CancellationError"; } }
class DuplicateEngineError extends Error { constructor(message) { super(message); this.name = "DuplicateEngineError"; } }
class EngineValidationError extends Error { constructor(message) { super(message); this.name = "EngineValidationError"; } }
class EngineNotFoundError extends Error { constructor(message) { super(message); this.name = "EngineNotFoundError"; } }
class ExplanationError extends Error { constructor(message) { super(message); this.name = "ExplanationError"; } }
class AnalysisError extends Error { constructor(message) { super(message); this.name = "AnalysisError"; } }
class OptimizationError extends Error { constructor(message) { super(message); this.name = "OptimizationError"; } }
class ValidationError extends Error { constructor(message) { super(message); this.name = "ValidationError"; } }
class LanguageNotSupportedError extends Error { constructor(message) { super(message); this.name = "LanguageNotSupportedError"; } }
class TemplateCreationError extends Error { constructor(message) { super(message); this.name = "TemplateCreationError"; } }
class ParameterError extends Error { constructor(message) { super(message); this.name = "ParameterError"; } }
class DuplicateFunctionError extends Error { constructor(message) { super(message); this.name = "DuplicateFunctionError"; } }
class FunctionValidationError extends Error { constructor(message) { super(message); this.name = "FunctionValidationError"; } }
class FunctionNotFoundError extends Error { constructor(message) { super(message); this.name = "FunctionNotFoundError"; } }
class DecompositionError extends Error { constructor(message) { super(message); this.name = "DecompositionError"; } }
class PlanGenerationError extends Error { constructor(message) { super(message); this.name = "PlanGenerationError"; } }
class ExecutionError extends Error { constructor(message) { super(message); this.name = "ExecutionError"; } }
class SubQueryExecutionError extends Error { constructor(message) { super(message); this.name = "SubQueryExecutionError"; } }
class AggregationError extends Error { constructor(message) { super(message); this.name = "AggregationError"; } }

/**
 * Creates a QueryDecomposer object with methods directly on the instance.
 * @param {Object} knowledgeGraph - Knowledge graph instance
 * @param {Object} translator - Semantic translator instance
 * @param {Object} options - Additional options
 * @returns {Object} QueryDecomposer instance
 */
function createQueryDecomposer(knowledgeGraph, translator, options = {}) {
  // Validate inputs using duck typing
  if (!knowledgeGraph || typeof knowledgeGraph !== 'object' || 
      typeof knowledgeGraph.query !== 'function' || 
      typeof knowledgeGraph.getEntity !== 'function') {
    throw new Error("Invalid UnifiedKnowledgeGraph instance provided to QueryDecomposer. Must have query and getEntity methods.");
  }
  
  if (!translator || typeof translator !== 'object' || 
      typeof translator.translateConcept !== 'function' || 
      typeof translator.translateConcepts !== 'function') {
    throw new Error("Invalid SemanticTranslator instance provided to QueryDecomposer. Must have translateConcept and translateConcepts methods.");
  }
  
  // Create decomposer with methods directly on the object
  const decomposer = {
    knowledgeGraph: knowledgeGraph,
    translator: translator,
    options: options,
    
    analyzeQuery: function(query, options = {}) {
      // Placeholder implementation
      // In a real implementation, this would parse the query and identify domain components
      console.warn("QueryDecomposer.analyzeQuery is not fully implemented.");
      if (!query || typeof query !== "object" || !query.queryText) {
        throw new QuerySyntaxError("Invalid query object provided.");
      }
      
      return {
        domains: ["general"],
        complexity: "simple",
        estimatedCost: 1.0,
        canDecompose: false
      };
    },
    
    decomposeQuery: function(query, context = {}, options = {}) {
      const analysis = this.analyzeQuery(query, options);
      
      if (!analysis.canDecompose) {
        return {
          original: query,
          subQueries: [query],
          plan: {
            type: "direct",
            steps: [{
              domainId: "general",
              query: query
            }]
          }
        };
      }
      
      // Placeholder implementation
      // In a real implementation, this would decompose the query into domain-specific sub-queries
      console.warn("QueryDecomposer.decomposeQuery is not fully implemented.");
      
      return {
        original: query,
        subQueries: [query],
        plan: {
          type: "decomposed",
          steps: [{
            domainId: "general",
            query: query
          }]
        }
      };
    },
    
    generateExecutionPlan: function(decomposition, context = {}, options = {}) {
      // Placeholder implementation
      // In a real implementation, this would generate an execution plan for the decomposed query
      console.warn("QueryDecomposer.generateExecutionPlan is not fully implemented.");
      
      return {
        id: uuidv4(),
        steps: decomposition.plan.steps,
        parallelizable: false,
        estimatedCost: 1.0,
        metadata: {
          generatedAt: Date.now(),
          context: context
        }
      };
    }
  };
  
  return decomposer;
}

/**
 * Creates a QueryEngine object with methods directly on the instance.
 * @param {string} domainId - Domain ID
 * @param {Object} options - Additional options
 * @returns {Object} QueryEngine instance
 */
function createQueryEngine(domainId, options = {}) {
  // Create engine with methods directly on the object
  const engine = {
    domainId: domainId,
    options: options,
    
    executeQuery: function(query, context, options = {}) {
      throw new Error("Method not implemented in base engine");
    },
    
    validate: function() {
      // Basic validation
      if (!this.domainId || typeof this.domainId !== "string") {
        return { valid: false, message: "Invalid domain ID" };
      }
      return { valid: true };
    }
  };
  
  return engine;
}

/**
 * Creates a new CrossDomainQueryProcessor instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} knowledgeGraph - Knowledge graph instance
 * @param {Object} translator - Semantic translator instance
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the processor
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {boolean} [config.enableCaching] - Whether to enable caching
 * @param {boolean} [config.enableParallelExecution] - Whether to enable parallel execution
 * @returns {Object} CrossDomainQueryProcessor instance with all methods as own properties
 */
function createCrossDomainQueryProcessor(knowledgeGraph, translator, config = {}) {
  // Validate inputs using duck typing
  if (!knowledgeGraph || typeof knowledgeGraph !== 'object' || 
      typeof knowledgeGraph.query !== 'function' || 
      typeof knowledgeGraph.getEntity !== 'function') {
    throw new Error("Invalid UnifiedKnowledgeGraph instance provided. Must have query and getEntity methods.");
  }
  
  if (!translator || typeof translator !== 'object' || 
      typeof translator.translateConcept !== 'function' || 
      typeof translator.translateConcepts !== 'function') {
    throw new Error("Invalid SemanticTranslator instance provided. Must have translateConcept and translateConcepts methods.");
  }
  
  // Create default dependencies if not provided
  const logger = config.logger || {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    debug: (message, ...args) => {},
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
  };
  
  const eventEmitter = config.eventEmitter || new EventEmitter();
  
  const metrics = config.metrics || {
    recordMetric: (name, data) => {}
  };
  
  // Create processor instance with all properties and methods directly on the object
  const processor = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "CrossDomainQueryProcessor",
    knowledgeGraph: knowledgeGraph,
    translator: translator,
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    engines: new Map(),
    executions: new Map(),
    templates: new Map(),
    functions: new Map(),
    enableCaching: config.enableCaching !== false,
    enableParallelExecution: config.enableParallelExecution !== false,
    
    // Create decomposer with methods directly on the object
    decomposer: createQueryDecomposer(knowledgeGraph, translator, config.decomposerOptions || {}),
    
    // Methods as direct properties to ensure preservation across module boundaries
    initialize: function() {
      this.logger.info(`Initializing CrossDomainQueryProcessor: ${this.name} (ID: ${this.id})`);
      
      // Register default engines
      this.registerEngine("general", createQueryEngine("general", {
        executeQuery: (query, context, options) => {
          // Simple passthrough to knowledge graph for general domain
          return this.knowledgeGraph.query(query.queryText, context);
        }
      }));
      
      // Register default templates
      this.registerTemplate("simple", {
        name: "Simple Query",
        description: "Template for simple queries",
        parameters: [{
          name: "entity",
          type: "string",
          description: "Entity to query"
        }, {
          name: "property",
          type: "string",
          description: "Property to retrieve"
        }],
        generateQuery: (params) => {
          return {
            queryText: `Get ${params.property} of ${params.entity}`,
            parameters: params
          };
        }
      });
      
      // Register default functions
      this.registerFunction("count", {
        name: "Count",
        description: "Count the number of results",
        apply: (results) => {
          return { count: Array.isArray(results) ? results.length : 0 };
        }
      });
      
      this.registerFunction("filter", {
        name: "Filter",
        description: "Filter results by condition",
        apply: (results, condition) => {
          if (!Array.isArray(results)) {
            return [];
          }
          return results.filter(item => {
            try {
              // Simple condition evaluation
              return eval(`item.${condition}`);
            } catch (error) {
              return false;
            }
          });
        }
      });
      
      this.eventEmitter.emit("processor:initialized", {
        processorId: this.id,
        name: this.name
      });
      
      return this;
    },
    
    registerEngine: function(domainId, engine) {
      if (this.engines.has(domainId)) {
        throw new DuplicateEngineError(`Engine for domain ${domainId} is already registered`);
      }
      
      // Validate engine
      const validation = engine.validate();
      if (!validation.valid) {
        throw new EngineValidationError(`Invalid engine for domain ${domainId}: ${validation.message}`);
      }
      
      this.logger.info(`Registering query engine for domain: ${domainId}`);
      
      this.engines.set(domainId, engine);
      
      this.eventEmitter.emit("engine:registered", {
        domainId,
        engineId: engine.id || domainId
      });
      
      return this;
    },
    
    executeQuery: function(query, context = {}, options = {}) {
      const executionId = options.executionId || uuidv4();
      
      this.logger.info(`Executing query (ID: ${executionId}): ${typeof query === 'string' ? query : JSON.stringify(query)}`);
      
      // Normalize query
      const normalizedQuery = this.normalizeQuery(query);
      
      // Create execution record
      const execution = {
        id: executionId,
        query: normalizedQuery,
        context: context,
        options: options,
        status: "PENDING",
        startTime: Date.now(),
        endTime: null,
        result: null,
        error: null,
        metadata: {
          domains: [],
          cost: 0,
          steps: []
        }
      };
      
      this.executions.set(executionId, execution);
      
      // Emit event
      this.eventEmitter.emit("query:submitted", {
        executionId,
        query: normalizedQuery
      });
      
      // Process query
      try {
        // Update status
        execution.status = "PROCESSING";
        
        // Analyze and decompose query
        const decomposition = this.decomposer.decomposeQuery(normalizedQuery, context, options);
        
        // Generate execution plan
        const plan = this.decomposer.generateExecutionPlan(decomposition, context, options);
        
        // Update metadata
        execution.metadata.plan = plan;
        
        // Execute plan
        const result = this.executePlan(plan, context, options);
        
        // Update execution record
        execution.status = "COMPLETED";
        execution.endTime = Date.now();
        execution.result = result;
        execution.metadata.duration = execution.endTime - execution.startTime;
        
        // Emit event
        this.eventEmitter.emit("query:completed", {
          executionId,
          duration: execution.metadata.duration
        });
        
        // Record metrics
        this.metrics.recordMetric("query_execution", {
          executionId,
          status: "COMPLETED",
          duration: execution.metadata.duration,
          domains: execution.metadata.domains
        });
        
        return {
          executionId,
          status: "COMPLETED",
          result: result,
          metadata: {
            duration: execution.metadata.duration,
            cost: execution.metadata.cost
          }
        };
      } catch (error) {
        // Update execution record
        execution.status = "FAILED";
        execution.endTime = Date.now();
        execution.error = {
          message: error.message,
          name: error.name,
          stack: error.stack
        };
        execution.metadata.duration = execution.endTime - execution.startTime;
        
        // Emit event
        this.eventEmitter.emit("query:failed", {
          executionId,
          error: error.message
        });
        
        // Record metrics
        this.metrics.recordMetric("query_execution", {
          executionId,
          status: "FAILED",
          error: error.message,
          duration: execution.metadata.duration
        });
        
        throw error;
      }
    },
    
    executeBatchQueries: function(queries, context = {}, options = {}) {
      const batchId = options.batchId || uuidv4();
      
      this.logger.info(`Executing batch of ${queries.length} queries (Batch ID: ${batchId})`);
      
      // Execute each query
      const results = [];
      const errors = [];
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        try {
          const result = this.executeQuery(query, context, {
            ...options,
            executionId: `${batchId}-${i}`
          });
          results.push(result);
        } catch (error) {
          this.logger.error(`Error executing query ${i} in batch ${batchId}: ${error.message}`);
          errors.push({
            index: i,
            query: query,
            error: error.message
          });
        }
      }
      
      // Record metrics
      this.metrics.recordMetric("batch_execution", {
        batchId,
        queryCount: queries.length,
        successCount: results.length,
        errorCount: errors.length
      });
      
      if (errors.length > 0 && options.failOnError) {
        throw new BatchQueryError(`${errors.length} of ${queries.length} queries failed`, {
          results,
          errors
        });
      }
      
      return {
        batchId,
        results,
        errors,
        metadata: {
          totalQueries: queries.length,
          successCount: results.length,
          errorCount: errors.length
        }
      };
    },
    
    normalizeQuery: function(query) {
      // Handle string queries
      if (typeof query === "string") {
        return {
          queryText: query,
          parameters: {}
        };
      }
      
      // Handle object queries
      if (typeof query === "object") {
        if (!query.queryText) {
          throw new QuerySyntaxError("Query must have a queryText property");
        }
        
        return {
          queryText: query.queryText,
          parameters: query.parameters || {},
          options: query.options || {}
        };
      }
      
      throw new QuerySyntaxError("Query must be a string or an object with a queryText property");
    },
    
    executePlan: function(plan, context = {}, options = {}) {
      this.logger.info(`Executing plan: ${plan.id}`);
      
      // Execute each step
      const stepResults = [];
      
      for (const step of plan.steps) {
        const engine = this.engines.get(step.domainId);
        
        if (!engine) {
          throw new EngineNotFoundError(`No engine registered for domain ${step.domainId}`);
        }
        
        try {
          const result = engine.executeQuery(step.query, context, options);
          stepResults.push({
            stepId: step.id || `step-${stepResults.length}`,
            domainId: step.domainId,
            result: result
          });
        } catch (error) {
          throw new SubQueryExecutionError(`Error executing step for domain ${step.domainId}: ${error.message}`);
        }
      }
      
      // Aggregate results
      return this.aggregateResults(stepResults, plan, context, options);
    },
    
    aggregateResults: function(stepResults, plan, context = {}, options = {}) {
      // For simple plans, just return the first result
      if (plan.type === "direct" || stepResults.length === 1) {
        return stepResults[0].result;
      }
      
      // For decomposed plans, aggregate results
      // This is a simplified implementation
      try {
        return {
          aggregated: true,
          results: stepResults.map(step => step.result),
          metadata: {
            stepCount: stepResults.length,
            domains: stepResults.map(step => step.domainId)
          }
        };
      } catch (error) {
        throw new AggregationError(`Error aggregating results: ${error.message}`);
      }
    },
    
    getExecution: function(executionId) {
      const execution = this.executions.get(executionId);
      
      if (!execution) {
        throw new ExecutionNotFoundError(`Execution with ID ${executionId} not found`);
      }
      
      return execution;
    },
    
    cancelExecution: function(executionId) {
      const execution = this.getExecution(executionId);
      
      if (execution.status !== "PENDING" && execution.status !== "PROCESSING") {
        throw new CancellationError(`Cannot cancel execution with status ${execution.status}`);
      }
      
      this.logger.info(`Cancelling execution: ${executionId}`);
      
      // Update execution record
      execution.status = "CANCELLED";
      execution.endTime = Date.now();
      execution.metadata.duration = execution.endTime - execution.startTime;
      
      // Emit event
      this.eventEmitter.emit("query:cancelled", {
        executionId
      });
      
      // Record metrics
      this.metrics.recordMetric("query_execution", {
        executionId,
        status: "CANCELLED",
        duration: execution.metadata.duration
      });
      
      return {
        executionId,
        status: "CANCELLED",
        metadata: {
          duration: execution.metadata.duration
        }
      };
    },
    
    explainQuery: function(query, context = {}, options = {}) {
      try {
        // Normalize query
        const normalizedQuery = this.normalizeQuery(query);
        
        // Analyze and decompose query
        const decomposition = this.decomposer.decomposeQuery(normalizedQuery, context, options);
        
        // Generate execution plan
        const plan = this.decomposer.generateExecutionPlan(decomposition, context, options);
        
        return {
          query: normalizedQuery,
          analysis: decomposition,
          plan: plan,
          metadata: {
            domains: plan.steps.map(step => step.domainId),
            estimatedCost: plan.estimatedCost,
            parallelizable: plan.parallelizable
          }
        };
      } catch (error) {
        throw new ExplanationError(`Error explaining query: ${error.message}`);
      }
    },
    
    optimizeQuery: function(query, context = {}, options = {}) {
      try {
        // Get explanation
        const explanation = this.explainQuery(query, context, options);
        
        // This is a simplified implementation
        // In a real implementation, this would optimize the query plan
        
        return {
          original: explanation.query,
          optimized: explanation.query,
          plan: explanation.plan,
          metadata: {
            optimizationApplied: false,
            reason: "Optimization not implemented"
          }
        };
      } catch (error) {
        throw new OptimizationError(`Error optimizing query: ${error.message}`);
      }
    },
    
    registerTemplate: function(templateId, template) {
      if (this.templates.has(templateId)) {
        throw new TemplateCreationError(`Template with ID ${templateId} already exists`);
      }
      
      this.logger.info(`Registering query template: ${templateId}`);
      
      // Validate template
      if (!template.name || !template.generateQuery || typeof template.generateQuery !== "function") {
        throw new ValidationError("Invalid template: must have name and generateQuery function");
      }
      
      this.templates.set(templateId, template);
      
      return this;
    },
    
    createQueryFromTemplate: function(templateId, parameters = {}) {
      const template = this.templates.get(templateId);
      
      if (!template) {
        throw new TemplateCreationError(`Template with ID ${templateId} not found`);
      }
      
      try {
        return template.generateQuery(parameters);
      } catch (error) {
        throw new TemplateCreationError(`Error generating query from template ${templateId}: ${error.message}`);
      }
    },
    
    registerFunction: function(functionId, func) {
      if (this.functions.has(functionId)) {
        throw new DuplicateFunctionError(`Function with ID ${functionId} already exists`);
      }
      
      this.logger.info(`Registering query function: ${functionId}`);
      
      // Validate function
      if (!func.name || !func.apply || typeof func.apply !== "function") {
        throw new FunctionValidationError("Invalid function: must have name and apply function");
      }
      
      this.functions.set(functionId, func);
      
      return this;
    },
    
    applyFunction: function(functionId, data, ...args) {
      const func = this.functions.get(functionId);
      
      if (!func) {
        throw new FunctionNotFoundError(`Function with ID ${functionId} not found`);
      }
      
      try {
        return func.apply(data, ...args);
      } catch (error) {
        throw new ExecutionError(`Error applying function ${functionId}: ${error.message}`);
      }
    },
    
    getStatistics: function() {
      return {
        engineCount: this.engines.size,
        executionCount: this.executions.size,
        templateCount: this.templates.size,
        functionCount: this.functions.size,
        pendingExecutions: Array.from(this.executions.values()).filter(e => e.status === "PENDING" || e.status === "PROCESSING").length,
        completedExecutions: Array.from(this.executions.values()).filter(e => e.status === "COMPLETED").length,
        failedExecutions: Array.from(this.executions.values()).filter(e => e.status === "FAILED").length,
        cancelledExecutions: Array.from(this.executions.values()).filter(e => e.status === "CANCELLED").length,
        timestamp: Date.now()
      };
    },
    
    // Event interface methods
    on: function(event, listener) {
      this.eventEmitter.on(event, listener);
      return this;
    },
    
    once: function(event, listener) {
      this.eventEmitter.once(event, listener);
      return this;
    },
    
    off: function(event, listener) {
      this.eventEmitter.off(event, listener);
      return this;
    },
    
    emit: function(event, ...args) {
      return this.eventEmitter.emit(event, ...args);
    }
  };
  
  // Initialize processor
  processor.initialize();
  
  // Log creation
  logger.info(`Created CrossDomainQueryProcessor: ${processor.name} (ID: ${processor.id})`);
  
  // Add debugging helper to verify method presence
  processor.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`CrossDomainQueryProcessor has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return processor;
}

module.exports = {
  createCrossDomainQueryProcessor,
  createQueryDecomposer,
  createQueryEngine,
  // Export error types
  QuerySyntaxError,
  QueryExecutionError,
  AccessDeniedError,
  BatchQueryError,
  ExecutionNotFoundError,
  ResultNotReadyError,
  CancellationError,
  DuplicateEngineError,
  EngineValidationError,
  EngineNotFoundError,
  ExplanationError,
  AnalysisError,
  OptimizationError,
  ValidationError,
  LanguageNotSupportedError,
  TemplateCreationError,
  ParameterError,
  DuplicateFunctionError,
  FunctionValidationError,
  FunctionNotFoundError,
  DecompositionError,
  PlanGenerationError,
  ExecutionError,
  SubQueryExecutionError,
  AggregationError
};
