/**
 * @fileoverview Hierarchical Reasoning Framework for the Aideon Cognitive Architecture.
 * This component provides advanced reasoning capabilities across multiple abstraction layers
 * and supports various reasoning strategies including deductive, inductive, abductive,
 * analogical, causal, counterfactual, and probabilistic reasoning.
 * 
 * The framework includes features for:
 * - Strategy management and selection
 * - Hierarchical reasoning across abstraction layers
 * - Caching of reasoning results
 * - Tracing of reasoning steps
 * - Explainability of reasoning processes
 * - Performance monitoring and optimization
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Reasoning strategies supported by the framework
 * @enum {string}
 */
const ReasoningStrategy = {
  DEDUCTIVE: 'deductive',
  INDUCTIVE: 'inductive',
  ABDUCTIVE: 'abductive',
  ANALOGICAL: 'analogical',
  CAUSAL: 'causal',
  COUNTERFACTUAL: 'counterfactual',
  PROBABILISTIC: 'probabilistic'
};

/**
 * Hierarchical Reasoning Framework for the Aideon Cognitive Architecture
 * @extends EventEmitter
 */
class HierarchicalReasoningFramework extends EventEmitter {
  /**
   * Creates a new HierarchicalReasoningFramework
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.performanceMonitor - Performance monitoring instance
   * @param {Object} options.configService - Configuration service instance
   * @param {Object} options.securityManager - Security manager instance
   * @param {Object} options.abstractionLayerManager - Abstraction layer manager instance
   */
  constructor(options) {
    super();
    
    this.logger = options.logger;
    this.performanceMonitor = options.performanceMonitor;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.abstractionLayerManager = options.abstractionLayerManager;
    
    // Load configuration
    this.config = this.configService.getConfig('cognitive.reasoning', {
      defaultStrategy: ReasoningStrategy.DEDUCTIVE,
      enabledStrategies: Object.values(ReasoningStrategy),
      maxReasoningDepth: 5,
      confidenceThreshold: 0.7,
      explainabilityEnabled: true,
      traceEnabled: true,
      cacheEnabled: true,
      cacheTTL: 3600000 // 1 hour in milliseconds
    });
    
    // Validate configuration
    this._validateConfiguration();
    
    // Initialize state
    this.currentStrategy = this.config.defaultStrategy;
    this.cacheEnabled = this.config.cacheEnabled;
    this.traceEnabled = this.config.traceEnabled;
    this.explainabilityEnabled = this.config.explainabilityEnabled;
    
    // Initialize caches and storage
    this.cache = new Map();
    this.traces = new Map();
    
    // Log initialization
    this.logger.info('HierarchicalReasoningFramework initialized', {
      strategies: this.config.enabledStrategies,
      currentStrategy: this.currentStrategy,
      cacheEnabled: this.cacheEnabled,
      traceEnabled: this.traceEnabled
    });
  }
  
  /**
   * Validates the configuration
   * @private
   * @throws {Error} If configuration is invalid
   */
  _validateConfiguration() {
    // Validate maxReasoningDepth
    if (this.config.maxReasoningDepth <= 0) {
      throw new Error('maxReasoningDepth must be greater than 0');
    }
    
    // Validate defaultStrategy
    if (!this.config.enabledStrategies.includes(this.config.defaultStrategy)) {
      throw new Error(`defaultStrategy '${this.config.defaultStrategy}' must be in enabledStrategies`);
    }
    
    // Validate confidenceThreshold
    if (this.config.confidenceThreshold < 0 || this.config.confidenceThreshold > 1) {
      throw new Error('confidenceThreshold must be between 0 and 1');
    }
  }
  
  /**
   * Gets available reasoning strategies
   * @returns {string[]} Array of available strategies
   */
  getAvailableStrategies() {
    return [...this.config.enabledStrategies];
  }
  
  /**
   * Checks if a strategy is available
   * @param {string} strategy - Strategy to check
   * @returns {boolean} True if strategy is available
   */
  hasStrategy(strategy) {
    return this.config.enabledStrategies.includes(strategy);
  }
  
  /**
   * Gets the current reasoning strategy
   * @returns {string} Current strategy
   */
  getCurrentStrategy() {
    return this.currentStrategy;
  }
  
  /**
   * Sets the current reasoning strategy
   * @param {string} strategy - Strategy to set
   * @returns {HierarchicalReasoningFramework} this
   * @throws {Error} If strategy is not available
   */
  setCurrentStrategy(strategy) {
    if (!this.hasStrategy(strategy)) {
      throw new Error(`Strategy '${strategy}' is not available`);
    }
    
    const previousStrategy = this.currentStrategy;
    this.currentStrategy = strategy;
    
    this.emit('strategyChanged', {
      previousStrategy,
      newStrategy: strategy
    });
    
    return this;
  }
  
  /**
   * Enables or disables caching
   * @param {boolean} enabled - Whether caching is enabled
   * @returns {HierarchicalReasoningFramework} this
   */
  setCacheEnabled(enabled) {
    this.cacheEnabled = enabled;
    this.logger.info(`Caching ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }
  
  /**
   * Clears the reasoning cache
   * @returns {HierarchicalReasoningFramework} this
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
    return this;
  }
  
  /**
   * Enables or disables tracing
   * @param {boolean} enabled - Whether tracing is enabled
   * @returns {HierarchicalReasoningFramework} this
   */
  setTraceEnabled(enabled) {
    this.traceEnabled = enabled;
    this.logger.info(`Tracing ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }
  
  /**
   * Clears all traces
   * @returns {HierarchicalReasoningFramework} this
   */
  clearTraces() {
    this.traces.clear();
    this.logger.info('Traces cleared');
    return this;
  }
  
  /**
   * Gets a trace by ID
   * @param {string} traceId - The trace ID
   * @returns {Object|null} The trace or null if not found
   */
  getTrace(traceId) {
    if (!traceId) return null;
    return this.traces.get(traceId) || null;
  }
  
  /**
   * Performs reasoning on input data
   * @param {Object} input - Input data
   * @param {Object} [options={}] - Reasoning options
   * @param {string} [options.strategy] - Reasoning strategy to use
   * @param {string} [options.layer] - Abstraction layer to use
   * @param {number} [options.depth=1] - Reasoning depth
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @returns {Object} Reasoning result
   * @throws {Error} If options are invalid
   */
  reason(input, options = {}) {
    const timerId = this.performanceMonitor.startTimer('reasoning');
    
    try {
      // Set default options
      const strategy = options.strategy || this.currentStrategy;
      const layer = options.layer || this.abstractionLayerManager.getCurrentLayer();
      const depth = options.depth || 1;
      const useCache = options.useCache !== false && this.cacheEnabled;
      
      // Validate options
      if (!this.hasStrategy(strategy)) {
        throw new Error(`Strategy '${strategy}' is not available`);
      }
      
      if (!this.abstractionLayerManager.hasLayer(layer)) {
        throw new Error(`Layer '${layer}' is not available`);
      }
      
      if (depth > this.config.maxReasoningDepth) {
        throw new Error(`Reasoning depth ${depth} exceeds maximum depth ${this.config.maxReasoningDepth}`);
      }
      
      // Generate cache key
      const cacheKey = this._generateCacheKey(input, { strategy, layer, depth });
      
      // Check cache
      if (useCache) {
        const cachedResult = this._getCachedResult(cacheKey);
        if (cachedResult) {
          this.logger.debug('Using cached reasoning result', { cacheKey });
          return cachedResult;
        }
      }
      
      // Initialize trace if enabled
      let traceId = null;
      if (this.traceEnabled) {
        traceId = this._generateTraceId();
        this.traces.set(traceId, {
          id: traceId,
          input,
          options: { strategy, layer, depth },
          startTime: Date.now(),
          steps: []
        });
      }
      
      // Perform reasoning
      const result = this._performReasoning(input, { strategy, layer, depth, traceId });
      
      // Add trace ID to result if tracing is enabled
      if (traceId) {
        result.traceId = traceId;
        
        // Finalize trace
        const trace = this.traces.get(traceId);
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.result = { ...result };
      }
      
      // Cache result if caching is enabled
      if (useCache) {
        this._cacheResult(cacheKey, result);
      }
      
      // Emit event
      this.emit('reasoningCompleted', {
        inputId: input.id,
        strategy,
        layer,
        depth,
        reasoningId: result.reasoningId,
        confidence: result.confidence
      });
      
      return result;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Performs reasoning across multiple abstraction layers
   * @param {Object} input - Input data
   * @param {Object} [options={}] - Reasoning options
   * @returns {Object} Hierarchical reasoning result
   */
  reasonAcrossLayers(input, options = {}) {
    const timerId = this.performanceMonitor.startTimer('hierarchicalReasoning');
    
    try {
      const strategy = options.strategy || this.currentStrategy;
      const layers = options.layers || this.abstractionLayerManager.getLayers();
      const maxDepth = options.maxDepth || this.config.maxReasoningDepth;
      
      // Initialize trace if enabled
      let traceId = null;
      if (this.traceEnabled) {
        traceId = this._generateTraceId();
        this.traces.set(traceId, {
          id: traceId,
          input,
          options: { strategy, layers, maxDepth },
          startTime: Date.now(),
          steps: [],
          layerResults: {}
        });
      }
      
      // Perform reasoning on each layer
      const layerResults = {};
      for (const layer of layers) {
        layerResults[layer] = this.reason(input, {
          strategy,
          layer,
          depth: 1,
          useCache: options.useCache
        });
        
        // Add to trace if enabled
        if (traceId) {
          const trace = this.traces.get(traceId);
          trace.layerResults[layer] = layerResults[layer];
        }
      }
      
      // Integrate results across layers
      const integratedResult = this._integrateLayerResults(layerResults, input);
      
      // Add trace ID to result if tracing is enabled
      if (traceId) {
        integratedResult.traceId = traceId;
        
        // Finalize trace
        const trace = this.traces.get(traceId);
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.result = { ...integratedResult };
      }
      
      // Emit event
      this.emit('hierarchicalReasoningCompleted', {
        inputId: input.id,
        strategy,
        layers,
        reasoningId: integratedResult.reasoningId,
        confidence: integratedResult.confidence
      });
      
      return integratedResult;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Performs reasoning with the specified options
   * @private
   * @param {Object} input - Input data
   * @param {Object} options - Reasoning options
   * @returns {Object} Reasoning result
   */
  _performReasoning(input, options) {
    const { strategy, layer, depth, traceId } = options;
    
    // Add step to trace if enabled
    if (traceId) {
      const trace = this.traces.get(traceId);
      trace.steps.push({
        timestamp: Date.now(),
        action: 'startReasoning',
        strategy,
        layer,
        depth
      });
    }
    
    // Process input through abstraction layer
    const processedInput = this.abstractionLayerManager.processInput(input, layer);
    
    // Apply reasoning strategy
    let conclusion;
    let confidence;
    let explanation;
    
    switch (strategy) {
      case ReasoningStrategy.DEDUCTIVE:
        ({ conclusion, confidence, explanation } = this._applyDeductiveReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.INDUCTIVE:
        ({ conclusion, confidence, explanation } = this._applyInductiveReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.ABDUCTIVE:
        ({ conclusion, confidence, explanation } = this._applyAbductiveReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.ANALOGICAL:
        ({ conclusion, confidence, explanation } = this._applyAnalogicalReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.CAUSAL:
        ({ conclusion, confidence, explanation } = this._applyCausalReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.COUNTERFACTUAL:
        ({ conclusion, confidence, explanation } = this._applyCounterfactualReasoning(processedInput, depth));
        break;
      case ReasoningStrategy.PROBABILISTIC:
        ({ conclusion, confidence, explanation } = this._applyProbabilisticReasoning(processedInput, depth));
        break;
      default:
        throw new Error(`Strategy '${strategy}' is not implemented`);
    }
    
    // Add step to trace if enabled
    if (traceId) {
      const trace = this.traces.get(traceId);
      trace.steps.push({
        timestamp: Date.now(),
        action: 'finishReasoning',
        strategy,
        layer,
        depth,
        confidence
      });
    }
    
    // Create result
    const reasoningId = this._generateReasoningId();
    const result = {
      reasoningId,
      strategy,
      layer,
      depth,
      conclusion,
      confidence,
      timestamp: Date.now()
    };
    
    // Add explanation if enabled
    if (this.explainabilityEnabled) {
      result.explanation = explanation;
    }
    
    return result;
  }
  
  /**
   * Integrates results from multiple layers
   * @private
   * @param {Object} layerResults - Results from each layer
   * @param {Object} originalInput - Original input data
   * @returns {Object} Integrated result
   */
  _integrateLayerResults(layerResults, originalInput) {
    // Extract conclusions from each layer
    const layerConclusions = {};
    let highestConfidence = 0;
    let highestConfidenceLayer = null;
    
    for (const [layer, result] of Object.entries(layerResults)) {
      layerConclusions[layer] = result.conclusion;
      
      if (result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        highestConfidenceLayer = layer;
      }
    }
    
    // Generate cross-layer insights
    const crossLayerInsights = this._generateCrossLayerInsights(layerConclusions, originalInput);
    
    // Create integrated conclusion
    const integratedConclusion = {
      primaryConclusion: layerResults[highestConfidenceLayer].conclusion,
      primaryLayer: highestConfidenceLayer,
      crossLayerInsights,
      layerConclusions
    };
    
    // Calculate integrated confidence
    const confidenceWeights = {
      raw: 0.1,
      syntactic: 0.15,
      semantic: 0.25,
      conceptual: 0.25,
      abstract: 0.25
    };
    
    let weightedConfidence = 0;
    let totalWeight = 0;
    
    for (const [layer, result] of Object.entries(layerResults)) {
      const weight = confidenceWeights[layer] || 0.2;
      weightedConfidence += result.confidence * weight;
      totalWeight += weight;
    }
    
    const integratedConfidence = weightedConfidence / totalWeight;
    
    // Create explanation
    const layerExplanations = {};
    for (const [layer, result] of Object.entries(layerResults)) {
      if (result.explanation) {
        layerExplanations[layer] = result.explanation;
      }
    }
    
    const explanation = {
      summary: 'Hierarchical reasoning across multiple abstraction layers',
      layerExplanations,
      crossLayerInsights,
      confidenceCalculation: {
        method: 'weightedAverage',
        weights: confidenceWeights,
        layerConfidences: Object.fromEntries(
          Object.entries(layerResults).map(([layer, result]) => [layer, result.confidence])
        ),
        integratedConfidence
      }
    };
    
    // Create result
    const reasoningId = this._generateReasoningId();
    return {
      reasoningId,
      strategy: 'hierarchical',
      conclusion: integratedConclusion,
      confidence: integratedConfidence,
      timestamp: Date.now(),
      explanation
    };
  }
  
  /**
   * Generates insights across layers
   * @private
   * @param {Object} layerConclusions - Conclusions from each layer
   * @param {Object} originalInput - Original input data
   * @returns {Array} Cross-layer insights
   */
  _generateCrossLayerInsights(layerConclusions, originalInput) {
    // This would be a complex implementation in a real system
    // For now, we'll return a simple placeholder
    return [
      {
        type: 'consistency',
        description: 'Consistency analysis across abstraction layers',
        details: 'Conclusions across layers show consistent patterns'
      },
      {
        type: 'emergence',
        description: 'Emergent properties identified',
        details: 'Higher abstraction layers reveal patterns not visible at lower levels'
      },
      {
        type: 'contradiction',
        description: 'Potential contradictions identified',
        details: 'Some lower-level details contradict higher-level abstractions'
      }
    ];
  }
  
  /**
   * Applies deductive reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyDeductiveReasoning(input, depth) {
    // In a real implementation, this would be a complex algorithm
    // For now, we'll return a placeholder result
    return {
      conclusion: {
        type: 'deductive',
        result: `Deductive conclusion for ${input.id}`,
        certainty: 'high'
      },
      confidence: 0.85 + (Math.random() * 0.1),
      explanation: {
        summary: 'Conclusion derived from general principles applied to specific case',
        factors: [
          'Premise 1: All instances of category X have property Y',
          `Premise 2: Input ${input.id} is an instance of category X`,
          `Conclusion: Input ${input.id} has property Y`
        ],
        certaintyFactors: {
          premiseValidity: 0.9,
          logicalSoundness: 0.95,
          evidenceStrength: 0.85
        }
      }
    };
  }
  
  /**
   * Applies inductive reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyInductiveReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'inductive',
        result: `Inductive conclusion for ${input.id}`,
        certainty: 'medium'
      },
      confidence: 0.7 + (Math.random() * 0.1),
      explanation: {
        summary: 'General pattern inferred from specific observations',
        factors: [
          `Observation 1: Input ${input.id} has property A`,
          'Observation 2: Other similar inputs have property B',
          'Inferred pattern: Inputs with property A likely have property B'
        ],
        certaintyFactors: {
          sampleSize: 0.65,
          patternStrength: 0.75,
          alternativeExplanations: 0.6
        }
      }
    };
  }
  
  /**
   * Applies abductive reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyAbductiveReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'abductive',
        result: `Abductive conclusion for ${input.id}`,
        certainty: 'medium-low'
      },
      confidence: 0.6 + (Math.random() * 0.1),
      explanation: {
        summary: 'Best explanation inferred for observed phenomena',
        factors: [
          `Observation: Input ${input.id} exhibits phenomenon Z`,
          'Hypothesis 1: Cause X could explain Z',
          'Hypothesis 2: Cause Y could explain Z',
          'Evaluation: Cause X is the most likely explanation'
        ],
        certaintyFactors: {
          explanatoryPower: 0.7,
          simplicity: 0.65,
          coherence: 0.6
        }
      }
    };
  }
  
  /**
   * Applies analogical reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyAnalogicalReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'analogical',
        result: `Analogical conclusion for ${input.id}`,
        certainty: 'medium'
      },
      confidence: 0.65 + (Math.random() * 0.1),
      explanation: {
        summary: 'Conclusion based on similarities with known cases',
        factors: [
          `Input ${input.id} shares properties P, Q, R with known case K`,
          'Known case K also has property S',
          `Inference: Input ${input.id} likely has property S`
        ],
        certaintyFactors: {
          similarityStrength: 0.7,
          relevantProperties: 0.65,
          knownExceptions: 0.6
        }
      }
    };
  }
  
  /**
   * Applies causal reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyCausalReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'causal',
        result: `Causal conclusion for ${input.id}`,
        certainty: 'medium-high'
      },
      confidence: 0.75 + (Math.random() * 0.1),
      explanation: {
        summary: 'Causal relationships identified in the input',
        factors: [
          `Event A in input ${input.id} preceded event B`,
          'Mechanism linking A to B identified',
          'No alternative explanations found for B',
          'Conclusion: A caused B'
        ],
        certaintyFactors: {
          temporalPrecedence: 0.9,
          mechanisticEvidence: 0.7,
          confoundingFactors: 0.65
        }
      }
    };
  }
  
  /**
   * Applies counterfactual reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyCounterfactualReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'counterfactual',
        result: `Counterfactual conclusion for ${input.id}`,
        certainty: 'medium'
      },
      confidence: 0.65 + (Math.random() * 0.1),
      explanation: {
        summary: 'Analysis of hypothetical alternatives to observed events',
        factors: [
          `Actual scenario: Input ${input.id} has property P and outcome Q`,
          'Counterfactual: If input lacked property P, outcome R would occur instead',
          'Conclusion: P is causally relevant to Q'
        ],
        certaintyFactors: {
          modelFidelity: 0.6,
          alternativePathways: 0.65,
          backgroundAssumptions: 0.7
        }
      }
    };
  }
  
  /**
   * Applies probabilistic reasoning
   * @private
   * @param {Object} input - Processed input
   * @param {number} depth - Reasoning depth
   * @returns {Object} Reasoning result
   */
  _applyProbabilisticReasoning(input, depth) {
    // Placeholder implementation
    return {
      conclusion: {
        type: 'probabilistic',
        result: `Probabilistic conclusion for ${input.id}`,
        certainty: 'variable'
      },
      confidence: 0.7 + (Math.random() * 0.2),
      explanation: {
        summary: 'Conclusion based on probabilistic analysis',
        factors: [
          `Prior probability of hypothesis H: 0.3`,
          `Likelihood of evidence E given H: 0.8`,
          `Likelihood of evidence E given not-H: 0.2`,
          `Posterior probability of H given E: 0.67`
        ],
        certaintyFactors: {
          priorReliability: 0.7,
          likelihoodEstimation: 0.8,
          probabilisticModel: 0.75
        }
      }
    };
  }
  
  /**
   * Generates a cache key for the given input and options
   * @private
   * @param {Object} input - Input data
   * @param {Object} options - Reasoning options
   * @returns {string} Cache key
   */
  _generateCacheKey(input, options) {
    const { strategy, layer, depth } = options;
    const inputHash = this._hashObject(input);
    return `${inputHash}:${strategy}:${layer}:${depth}`;
  }
  
  /**
   * Gets a cached result if available and not expired
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached result or null if not found or expired
   */
  _getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * Caches a reasoning result
   * @private
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Reasoning result
   */
  _cacheResult(cacheKey, result) {
    const timestamp = Date.now();
    const expiresAt = timestamp + this.config.cacheTTL;
    
    this.cache.set(cacheKey, {
      result,
      timestamp,
      expiresAt
    });
  }
  
  /**
   * Generates a unique reasoning ID
   * @private
   * @returns {string} Reasoning ID
   */
  _generateReasoningId() {
    return `reason-${crypto.randomBytes(8).toString('hex')}`;
  }
  
  /**
   * Generates a unique trace ID
   * @private
   * @returns {string} Trace ID
   */
  _generateTraceId() {
    return `trace-${crypto.randomBytes(8).toString('hex')}`;
  }
  
  /**
   * Creates a hash of an object
   * @private
   * @param {Object} obj - Object to hash
   * @returns {string} Hash
   */
  _hashObject(obj) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(obj));
    return hash.digest('hex');
  }
  
  /**
   * Disposes of resources
   */
  dispose() {
    this.logger.info('Disposing HierarchicalReasoningFramework');
    
    // Clear caches
    this.cache.clear();
    this.traces.clear();
    
    // Dispose of abstraction layer manager
    if (this.abstractionLayerManager) {
      this.abstractionLayerManager.dispose();
    }
    
    // Remove all listeners
    this.removeAllListeners();
    
    this.logger.info('HierarchicalReasoningFramework disposed');
  }
}

module.exports = {
  HierarchicalReasoningFramework,
  ReasoningStrategy
};
