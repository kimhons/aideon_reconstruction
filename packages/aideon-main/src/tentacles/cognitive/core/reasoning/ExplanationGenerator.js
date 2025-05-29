/**
 * @fileoverview ExplanationGenerator for the Aideon AI Desktop Agent's Reasoning Engine.
 * Captures reasoning traces and generates natural language explanations for reasoning processes.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * ExplanationGenerator for the Aideon AI Desktop Agent's Reasoning Engine.
 * Captures reasoning traces and generates natural language explanations for reasoning processes.
 * 
 * @extends EventEmitter
 */
class ExplanationGenerator extends EventEmitter {
  /**
   * Creates a new ExplanationGenerator instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.modelManager - Model manager for LLM integration
   * @param {Object} [options.uncertaintyHandler] - Uncertainty handler for confidence integration
   * @param {Object} [options.securityManager] - Security manager
   */
  constructor(options) {
    super();
    
    if (!options) {
      throw new Error("ExplanationGenerator requires options");
    }
    
    if (!options.logger) {
      throw new Error("ExplanationGenerator requires a logger instance");
    }
    
    if (!options.configService) {
      throw new Error("ExplanationGenerator requires a configService instance");
    }
    
    if (!options.performanceMonitor) {
      throw new Error("ExplanationGenerator requires a performanceMonitor instance");
    }
    
    if (!options.modelManager) {
      throw new Error("ExplanationGenerator requires a modelManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.modelManager = options.modelManager;
    this.uncertaintyHandler = options.uncertaintyHandler;
    this.securityManager = options.securityManager;
    
    // Trace storage
    this.reasoningTraces = new Map(); // Map of traceId -> trace data
    
    // Explanation templates
    this.explanationTemplates = new Map(); // Map of templateId -> template
    
    // Configuration
    this.maxTraceSize = this.configService.get('reasoning.explanation.maxTraceSize', 1000);
    this.maxTraceAge = this.configService.get('reasoning.explanation.maxTraceAge', 86400000); // 24 hours in ms
    this.defaultExplanationLevel = this.configService.get('reasoning.explanation.defaultLevel', 'standard');
    this.enableVisualExplanations = this.configService.get('reasoning.explanation.enableVisual', true);
    this.enableStructuredExplanations = this.configService.get('reasoning.explanation.enableStructured', true);
    this.enableMultilingualExplanations = this.configService.get('reasoning.explanation.enableMultilingual', true);
    
    // System tier (Core, Pro, Enterprise)
    this.systemTier = this.configService.get('system.tier', 'Core');
    
    this.initialized = false;
  }

  /**
   * Initializes the ExplanationGenerator.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.logger.debug("Initializing ExplanationGenerator");

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_initialize");
    }

    try {
      // Load explanation templates
      await this._loadExplanationTemplates();
      
      // Set up trace cleanup interval
      this._setupTraceCleanup();
      
      this.initialized = true;

      this.logger.info("ExplanationGenerator initialized successfully", {
        maxTraceSize: this.maxTraceSize,
        defaultExplanationLevel: this.defaultExplanationLevel,
        systemTier: this.systemTier
      });

      this.emit("initialized");
    } catch (error) {
      this.logger.error("ExplanationGenerator initialization failed", { error: error.message, stack: error.stack });
      throw new Error(`ExplanationGenerator initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Loads explanation templates from configuration.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadExplanationTemplates() {
    try {
      // Load default templates from configuration
      const defaultTemplates = this.configService.get('reasoning.explanation.templates', {});
      
      for (const [templateId, template] of Object.entries(defaultTemplates)) {
        this.explanationTemplates.set(templateId, {
          ...template,
          source: 'default',
          timestamp: Date.now()
        });
      }
      
      // Load strategy-specific templates
      await this._loadStrategyTemplates('deductive');
      await this._loadStrategyTemplates('inductive');
      await this._loadStrategyTemplates('abductive');
      await this._loadStrategyTemplates('analogical');
      
      this.logger.debug(`Loaded ${this.explanationTemplates.size} explanation templates`);
    } catch (error) {
      this.logger.error(`Failed to load explanation templates: ${error.message}`, { error: error.stack });
      // Continue initialization even if loading fails
    }
  }

  /**
   * Loads strategy-specific explanation templates.
   * 
   * @private
   * @param {string} strategy - Reasoning strategy
   * @returns {Promise<void>}
   */
  async _loadStrategyTemplates(strategy) {
    try {
      const strategyTemplates = this.configService.get(`reasoning.explanation.${strategy}Templates`, {});
      
      for (const [templateId, template] of Object.entries(strategyTemplates)) {
        this.explanationTemplates.set(`${strategy}_${templateId}`, {
          ...template,
          strategy,
          source: 'strategy',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.logger.error(`Failed to load ${strategy} templates: ${error.message}`, { error: error.stack });
      // Continue loading other templates
    }
  }

  /**
   * Sets up periodic trace cleanup.
   * 
   * @private
   */
  _setupTraceCleanup() {
    // Clean up old traces periodically
    const cleanupInterval = this.configService.get('reasoning.explanation.cleanupIntervalMs', 3600000); // 1 hour
    
    if (this._traceCleanupInterval) {
      clearInterval(this._traceCleanupInterval);
    }
    
    this._traceCleanupInterval = setInterval(() => {
      try {
        this._cleanupOldTraces();
      } catch (error) {
        this.logger.error(`Trace cleanup error: ${error.message}`, { error: error.stack });
      }
    }, cleanupInterval);
  }

  /**
   * Cleans up old reasoning traces.
   * 
   * @private
   */
  _cleanupOldTraces() {
    try {
      const now = Date.now();
      let removedCount = 0;
      
      // Find traces older than maxTraceAge
      for (const [traceId, trace] of this.reasoningTraces.entries()) {
        if (trace.timestamp && (now - trace.timestamp > this.maxTraceAge)) {
          this.reasoningTraces.delete(traceId);
          removedCount++;
        }
      }
      
      // If we're still over maxTraceSize, remove oldest traces
      if (this.reasoningTraces.size > this.maxTraceSize) {
        const tracesToRemove = this.reasoningTraces.size - this.maxTraceSize;
        
        // Convert to array and sort by timestamp
        const traces = Array.from(this.reasoningTraces.entries());
        traces.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
        
        // Remove oldest traces
        for (let i = 0; i < tracesToRemove; i++) {
          if (i < traces.length) {
            this.reasoningTraces.delete(traces[i][0]);
            removedCount++;
          }
        }
      }
      
      if (removedCount > 0) {
        this.logger.debug(`Cleaned up ${removedCount} old reasoning traces`);
      }
    } catch (error) {
      this.logger.error(`Failed to clean up old traces: ${error.message}`, { error: error.stack });
    }
  }

  /**
   * Ensures the generator is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the generator is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("ExplanationGenerator is not initialized. Call initialize() first.");
    }
  }

  /**
   * Starts a new reasoning trace.
   * 
   * @param {Object} options - Trace options
   * @param {string} options.taskId - Task identifier
   * @param {string} options.strategy - Reasoning strategy
   * @param {Object} [options.context] - Reasoning context
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Promise<string>} - Trace identifier
   */
  async startTrace(options) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_startTrace");
    }

    try {
      // Validate options
      if (!options || !options.taskId || !options.strategy) {
        throw new Error("Invalid options for starting trace");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTraceStartPolicies) {
        options = await this.securityManager.applyTraceStartPolicies(options);
      }
      
      // Generate trace ID
      const traceId = options.traceId || uuidv4();
      
      // Create trace
      const trace = {
        traceId,
        taskId: options.taskId,
        strategy: options.strategy,
        context: options.context || {},
        metadata: options.metadata || {},
        steps: [],
        startTime: Date.now(),
        endTime: null,
        timestamp: Date.now()
      };
      
      // Store trace
      this.reasoningTraces.set(traceId, trace);
      
      this.logger.debug(`Started reasoning trace ${traceId} for task ${options.taskId}`, {
        strategy: options.strategy
      });
      
      return traceId;
    } catch (error) {
      this.logger.error(`Failed to start trace: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Adds a step to an existing reasoning trace.
   * 
   * @param {string} traceId - Trace identifier
   * @param {Object} step - Step information
   * @returns {Promise<number>} - Step index
   */
  async addTraceStep(traceId, step) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_addTraceStep");
    }

    try {
      // Validate inputs
      if (!traceId || !step) {
        throw new Error("Invalid inputs for adding trace step");
      }
      
      // Check if trace exists
      if (!this.reasoningTraces.has(traceId)) {
        throw new Error(`Trace ${traceId} not found`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTraceStepPolicies) {
        step = await this.securityManager.applyTraceStepPolicies(traceId, step);
      }
      
      // Get trace
      const trace = this.reasoningTraces.get(traceId);
      
      // Add timestamp to step
      const enhancedStep = {
        ...step,
        timestamp: Date.now(),
        stepIndex: trace.steps.length
      };
      
      // Add step to trace
      trace.steps.push(enhancedStep);
      
      // Update trace timestamp
      trace.timestamp = Date.now();
      
      this.logger.debug(`Added step to trace ${traceId}`, {
        stepType: step.type,
        stepIndex: enhancedStep.stepIndex
      });
      
      return enhancedStep.stepIndex;
    } catch (error) {
      this.logger.error(`Failed to add trace step: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Ends a reasoning trace.
   * 
   * @param {string} traceId - Trace identifier
   * @param {Object} [result] - Reasoning result
   * @returns {Promise<Object>} - Completed trace
   */
  async endTrace(traceId, result = null) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_endTrace");
    }

    try {
      // Validate trace ID
      if (!traceId) {
        throw new Error("Invalid trace ID for ending trace");
      }
      
      // Check if trace exists
      if (!this.reasoningTraces.has(traceId)) {
        throw new Error(`Trace ${traceId} not found`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTraceEndPolicies) {
        result = await this.securityManager.applyTraceEndPolicies(traceId, result);
      }
      
      // Get trace
      const trace = this.reasoningTraces.get(traceId);
      
      // Update trace
      trace.endTime = Date.now();
      trace.result = result;
      trace.duration = trace.endTime - trace.startTime;
      
      // Update trace timestamp
      trace.timestamp = Date.now();
      
      this.logger.debug(`Ended reasoning trace ${traceId}`, {
        duration: trace.duration,
        stepCount: trace.steps.length
      });
      
      return trace;
    } catch (error) {
      this.logger.error(`Failed to end trace: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves a reasoning trace.
   * 
   * @param {string} traceId - Trace identifier
   * @returns {Promise<Object>} - Reasoning trace
   */
  async getTrace(traceId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_getTrace");
    }

    try {
      // Validate trace ID
      if (!traceId) {
        throw new Error("Invalid trace ID for retrieval");
      }
      
      // Check if trace exists
      if (!this.reasoningTraces.has(traceId)) {
        throw new Error(`Trace ${traceId} not found`);
      }
      
      // Get trace
      const trace = this.reasoningTraces.get(traceId);
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTraceRetrievalPolicies) {
        const secureTrace = await this.securityManager.applyTraceRetrievalPolicies(traceId, trace);
        return secureTrace;
      }
      
      return trace;
    } catch (error) {
      this.logger.error(`Failed to retrieve trace: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates an explanation for a reasoning trace.
   * 
   * @param {string} traceId - Trace identifier
   * @param {Object} [options] - Explanation options
   * @param {string} [options.level] - Explanation detail level (basic, standard, detailed, expert)
   * @param {string} [options.format] - Explanation format (text, structured, visual)
   * @param {string} [options.language] - Explanation language
   * @param {boolean} [options.includeConfidence] - Whether to include confidence information
   * @returns {Promise<Object>} - Generated explanation
   */
  async generateExplanation(traceId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_generateExplanation");
    }

    try {
      // Validate trace ID
      if (!traceId) {
        throw new Error("Invalid trace ID for explanation generation");
      }
      
      // Check if trace exists
      if (!this.reasoningTraces.has(traceId)) {
        throw new Error(`Trace ${traceId} not found`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyExplanationPolicies) {
        options = await this.securityManager.applyExplanationPolicies(traceId, options);
      }
      
      // Get trace
      const trace = this.reasoningTraces.get(traceId);
      
      // Check if trace is complete
      if (!trace.endTime) {
        throw new Error(`Trace ${traceId} is not complete`);
      }
      
      // Set default options
      const level = options.level || this.defaultExplanationLevel;
      const format = options.format || 'text';
      const language = options.language || 'en';
      const includeConfidence = options.includeConfidence !== undefined ? options.includeConfidence : true;
      
      // Validate format
      if (format === 'visual' && !this.enableVisualExplanations) {
        throw new Error("Visual explanations are not enabled");
      }
      
      if (format === 'structured' && !this.enableStructuredExplanations) {
        throw new Error("Structured explanations are not enabled");
      }
      
      // Validate language
      if (language !== 'en' && !this.enableMultilingualExplanations) {
        throw new Error("Multilingual explanations are not enabled");
      }
      
      // Generate explanation based on format
      let explanation;
      
      switch (format) {
        case 'visual':
          explanation = await this._generateVisualExplanation(trace, level, language, includeConfidence);
          break;
        case 'structured':
          explanation = await this._generateStructuredExplanation(trace, level, language, includeConfidence);
          break;
        case 'text':
        default:
          explanation = await this._generateTextExplanation(trace, level, language, includeConfidence);
      }
      
      this.logger.debug(`Generated ${format} explanation for trace ${traceId}`, {
        level,
        language,
        includeConfidence
      });
      
      return {
        traceId,
        taskId: trace.taskId,
        strategy: trace.strategy,
        explanation,
        format,
        level,
        language,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Failed to generate explanation: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates a text explanation for a reasoning trace.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @param {boolean} includeConfidence - Whether to include confidence information
   * @returns {Promise<Object>} - Text explanation
   */
  async _generateTextExplanation(trace, level, language, includeConfidence) {
    try {
      // Get appropriate template
      const templateId = this._getTemplateId(trace.strategy, 'text', level);
      const template = this.explanationTemplates.get(templateId);
      
      // If no template found, use LLM to generate explanation
      if (!template) {
        return this._generateExplanationWithLLM(trace, 'text', level, language, includeConfidence);
      }
      
      // Extract key information from trace
      const traceInfo = this._extractTraceInfo(trace, level);
      
      // Apply template
      let explanation = template.template;
      
      // Replace placeholders
      for (const [key, value] of Object.entries(traceInfo)) {
        explanation = explanation.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      
      // Add confidence information if requested
      if (includeConfidence && trace.result && trace.result.confidence !== undefined) {
        explanation += this._generateConfidenceStatement(trace.result.confidence, level, language);
      }
      
      // Translate if needed
      if (language !== 'en') {
        explanation = await this._translateExplanation(explanation, language);
      }
      
      return {
        content: explanation,
        templateId: templateId,
        generationMethod: 'template'
      };
    } catch (error) {
      this.logger.error(`Failed to generate text explanation: ${error.message}`, { error: error.stack });
      
      // Fallback to LLM generation
      return this._generateExplanationWithLLM(trace, 'text', level, language, includeConfidence);
    }
  }

  /**
   * Generates a structured explanation for a reasoning trace.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @param {boolean} includeConfidence - Whether to include confidence information
   * @returns {Promise<Object>} - Structured explanation
   */
  async _generateStructuredExplanation(trace, level, language, includeConfidence) {
    try {
      // Extract key information from trace
      const traceInfo = this._extractTraceInfo(trace, level);
      
      // Create structured explanation
      const structuredExplanation = {
        strategy: trace.strategy,
        steps: [],
        conclusion: trace.result ? trace.result.conclusion : null
      };
      
      // Add steps based on level
      switch (level) {
        case 'expert':
        case 'detailed':
          // Include all steps
          for (const step of trace.steps) {
            structuredExplanation.steps.push({
              type: step.type,
              description: step.description,
              data: step.data,
              timestamp: step.timestamp
            });
          }
          break;
        case 'standard':
          // Include key steps
          for (const step of trace.steps) {
            if (step.type !== 'intermediate') {
              structuredExplanation.steps.push({
                type: step.type,
                description: step.description,
                timestamp: step.timestamp
              });
            }
          }
          break;
        case 'basic':
        default:
          // Include only major steps
          for (const step of trace.steps) {
            if (step.type === 'major') {
              structuredExplanation.steps.push({
                type: step.type,
                description: step.description,
                timestamp: step.timestamp
              });
            }
          }
      }
      
      // Add confidence information if requested
      if (includeConfidence && trace.result && trace.result.confidence !== undefined) {
        structuredExplanation.confidence = {
          value: trace.result.confidence,
          interpretation: this._interpretConfidence(trace.result.confidence)
        };
      }
      
      // Translate if needed
      if (language !== 'en') {
        structuredExplanation.steps = await Promise.all(
          structuredExplanation.steps.map(async (step) => {
            return {
              ...step,
              description: await this._translateExplanation(step.description, language)
            };
          })
        );
        
        if (structuredExplanation.conclusion) {
          structuredExplanation.conclusion = await this._translateExplanation(
            structuredExplanation.conclusion, 
            language
          );
        }
      }
      
      return {
        content: structuredExplanation,
        generationMethod: 'structured'
      };
    } catch (error) {
      this.logger.error(`Failed to generate structured explanation: ${error.message}`, { error: error.stack });
      
      // Fallback to simpler structured format
      return {
        content: {
          strategy: trace.strategy,
          steps: trace.steps.length,
          conclusion: trace.result ? trace.result.conclusion : null,
          error: `Failed to generate full structured explanation: ${error.message}`
        },
        generationMethod: 'fallback'
      };
    }
  }

  /**
   * Generates a visual explanation for a reasoning trace.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @param {boolean} includeConfidence - Whether to include confidence information
   * @returns {Promise<Object>} - Visual explanation
   */
  async _generateVisualExplanation(trace, level, language, includeConfidence) {
    try {
      // Extract key information from trace
      const traceInfo = this._extractTraceInfo(trace, level);
      
      // Create visual explanation data
      const visualData = {
        type: 'reasoning_flow',
        strategy: trace.strategy,
        nodes: [],
        edges: [],
        metadata: {
          level,
          language,
          includeConfidence
        }
      };
      
      // Add nodes and edges based on strategy and level
      switch (trace.strategy) {
        case 'deductive':
          await this._buildDeductiveVisualData(trace, visualData, level, language);
          break;
        case 'inductive':
          await this._buildInductiveVisualData(trace, visualData, level, language);
          break;
        case 'abductive':
          await this._buildAbductiveVisualData(trace, visualData, level, language);
          break;
        case 'analogical':
          await this._buildAnalogicalVisualData(trace, visualData, level, language);
          break;
        default:
          await this._buildGenericVisualData(trace, visualData, level, language);
      }
      
      // Add confidence information if requested
      if (includeConfidence && trace.result && trace.result.confidence !== undefined) {
        visualData.confidence = {
          value: trace.result.confidence,
          interpretation: this._interpretConfidence(trace.result.confidence)
        };
        
        // Add confidence node
        visualData.nodes.push({
          id: 'confidence',
          type: 'confidence',
          label: `Confidence: ${Math.round(trace.result.confidence * 100)}%`,
          data: {
            value: trace.result.confidence,
            interpretation: this._interpretConfidence(trace.result.confidence)
          }
        });
        
        // Add edge from conclusion to confidence
        visualData.edges.push({
          id: `conclusion_confidence`,
          source: 'conclusion',
          target: 'confidence',
          type: 'confidence'
        });
      }
      
      return {
        content: visualData,
        generationMethod: 'visual'
      };
    } catch (error) {
      this.logger.error(`Failed to generate visual explanation: ${error.message}`, { error: error.stack });
      
      // Fallback to simpler visual format
      return {
        content: {
          type: 'reasoning_flow',
          strategy: trace.strategy,
          nodes: [
            {
              id: 'start',
              type: 'start',
              label: 'Start'
            },
            {
              id: 'conclusion',
              type: 'conclusion',
              label: trace.result ? trace.result.conclusion : 'No conclusion'
            }
          ],
          edges: [
            {
              id: 'start_conclusion',
              source: 'start',
              target: 'conclusion',
              type: 'flow'
            }
          ],
          error: `Failed to generate full visual explanation: ${error.message}`
        },
        generationMethod: 'fallback'
      };
    }
  }

  /**
   * Builds visual data for deductive reasoning.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {Object} visualData - Visual data object to populate
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {Promise<void>}
   */
  async _buildDeductiveVisualData(trace, visualData, level, language) {
    // Add start node
    visualData.nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });
    
    // Add premises
    const premises = trace.steps.filter(step => step.type === 'premise');
    
    for (let i = 0; i < premises.length; i++) {
      const premise = premises[i];
      const nodeId = `premise_${i}`;
      
      let label = premise.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: nodeId,
        type: 'premise',
        label: label,
        data: premise.data
      });
      
      // Connect start to premises
      visualData.edges.push({
        id: `start_${nodeId}`,
        source: 'start',
        target: nodeId,
        type: 'flow'
      });
    }
    
    // Add rules based on level
    if (level === 'detailed' || level === 'expert') {
      const rules = trace.steps.filter(step => step.type === 'rule');
      
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const nodeId = `rule_${i}`;
        
        let label = rule.description;
        
        // Translate if needed
        if (language !== 'en') {
          label = await this._translateExplanation(label, language);
        }
        
        visualData.nodes.push({
          id: nodeId,
          type: 'rule',
          label: label,
          data: rule.data
        });
        
        // Connect premises to rules based on dependencies
        if (rule.dependencies) {
          for (const dep of rule.dependencies) {
            const sourceId = dep.type === 'premise' ? 
              `premise_${premises.findIndex(p => p.stepIndex === dep.stepIndex)}` : 
              `rule_${rules.findIndex(r => r.stepIndex === dep.stepIndex)}`;
            
            visualData.edges.push({
              id: `${sourceId}_${nodeId}`,
              source: sourceId,
              target: nodeId,
              type: 'inference'
            });
          }
        }
      }
    }
    
    // Add conclusion
    let conclusionLabel = trace.result ? trace.result.conclusion : 'No conclusion';
    
    // Translate if needed
    if (language !== 'en' && conclusionLabel) {
      conclusionLabel = await this._translateExplanation(conclusionLabel, language);
    }
    
    visualData.nodes.push({
      id: 'conclusion',
      type: 'conclusion',
      label: conclusionLabel
    });
    
    // Connect last nodes to conclusion
    const lastNodes = level === 'detailed' || level === 'expert' ? 
      trace.steps.filter(step => step.type === 'rule') : 
      trace.steps.filter(step => step.type === 'premise');
    
    if (lastNodes.length > 0) {
      for (let i = 0; i < lastNodes.length; i++) {
        const lastNode = lastNodes[i];
        const sourceId = lastNode.type === 'premise' ? 
          `premise_${premises.findIndex(p => p.stepIndex === lastNode.stepIndex)}` : 
          `rule_${i}`;
        
        // Only connect if this node has no outgoing edges
        const hasOutgoing = visualData.edges.some(edge => edge.source === sourceId);
        
        if (!hasOutgoing) {
          visualData.edges.push({
            id: `${sourceId}_conclusion`,
            source: sourceId,
            target: 'conclusion',
            type: 'inference'
          });
        }
      }
    } else {
      // If no nodes, connect start to conclusion
      visualData.edges.push({
        id: 'start_conclusion',
        source: 'start',
        target: 'conclusion',
        type: 'flow'
      });
    }
  }

  /**
   * Builds visual data for inductive reasoning.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {Object} visualData - Visual data object to populate
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {Promise<void>}
   */
  async _buildInductiveVisualData(trace, visualData, level, language) {
    // Add start node
    visualData.nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });
    
    // Add observations
    const observations = trace.steps.filter(step => step.type === 'observation');
    
    for (let i = 0; i < observations.length; i++) {
      const observation = observations[i];
      const nodeId = `observation_${i}`;
      
      let label = observation.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: nodeId,
        type: 'observation',
        label: label,
        data: observation.data
      });
      
      // Connect start to observations
      visualData.edges.push({
        id: `start_${nodeId}`,
        source: 'start',
        target: nodeId,
        type: 'flow'
      });
    }
    
    // Add patterns based on level
    if (level === 'detailed' || level === 'expert') {
      const patterns = trace.steps.filter(step => step.type === 'pattern');
      
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const nodeId = `pattern_${i}`;
        
        let label = pattern.description;
        
        // Translate if needed
        if (language !== 'en') {
          label = await this._translateExplanation(label, language);
        }
        
        visualData.nodes.push({
          id: nodeId,
          type: 'pattern',
          label: label,
          data: pattern.data
        });
        
        // Connect observations to patterns
        if (pattern.dependencies) {
          for (const dep of pattern.dependencies) {
            if (dep.type === 'observation') {
              const sourceId = `observation_${observations.findIndex(o => o.stepIndex === dep.stepIndex)}`;
              
              visualData.edges.push({
                id: `${sourceId}_${nodeId}`,
                source: sourceId,
                target: nodeId,
                type: 'induction'
              });
            }
          }
        } else {
          // If no specific dependencies, connect all observations
          for (let j = 0; j < observations.length; j++) {
            visualData.edges.push({
              id: `observation_${j}_${nodeId}`,
              source: `observation_${j}`,
              target: nodeId,
              type: 'induction'
            });
          }
        }
      }
    }
    
    // Add hypothesis
    const hypotheses = trace.steps.filter(step => step.type === 'hypothesis');
    let hypothesisNodeId = 'hypothesis';
    
    if (hypotheses.length > 0) {
      const hypothesis = hypotheses[hypotheses.length - 1]; // Use last hypothesis
      
      let label = hypothesis.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: hypothesisNodeId,
        type: 'hypothesis',
        label: label,
        data: hypothesis.data
      });
      
      // Connect patterns to hypothesis
      if (level === 'detailed' || level === 'expert') {
        const patterns = trace.steps.filter(step => step.type === 'pattern');
        
        for (let i = 0; i < patterns.length; i++) {
          visualData.edges.push({
            id: `pattern_${i}_hypothesis`,
            source: `pattern_${i}`,
            target: hypothesisNodeId,
            type: 'induction'
          });
        }
      } else {
        // Connect observations directly to hypothesis
        for (let i = 0; i < observations.length; i++) {
          visualData.edges.push({
            id: `observation_${i}_hypothesis`,
            source: `observation_${i}`,
            target: hypothesisNodeId,
            type: 'induction'
          });
        }
      }
    }
    
    // Add conclusion
    let conclusionLabel = trace.result ? trace.result.conclusion : 'No conclusion';
    
    // Translate if needed
    if (language !== 'en' && conclusionLabel) {
      conclusionLabel = await this._translateExplanation(conclusionLabel, language);
    }
    
    visualData.nodes.push({
      id: 'conclusion',
      type: 'conclusion',
      label: conclusionLabel
    });
    
    // Connect hypothesis to conclusion
    if (hypotheses.length > 0) {
      visualData.edges.push({
        id: `hypothesis_conclusion`,
        source: hypothesisNodeId,
        target: 'conclusion',
        type: 'generalization'
      });
    } else {
      // If no hypothesis, connect observations to conclusion
      for (let i = 0; i < observations.length; i++) {
        visualData.edges.push({
          id: `observation_${i}_conclusion`,
          source: `observation_${i}`,
          target: 'conclusion',
          type: 'generalization'
        });
      }
    }
  }

  /**
   * Builds visual data for abductive reasoning.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {Object} visualData - Visual data object to populate
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {Promise<void>}
   */
  async _buildAbductiveVisualData(trace, visualData, level, language) {
    // Add start node
    visualData.nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });
    
    // Add observation (phenomenon to explain)
    const observations = trace.steps.filter(step => step.type === 'observation');
    let observationNodeId = 'observation';
    
    if (observations.length > 0) {
      const observation = observations[0]; // Use first observation
      
      let label = observation.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: observationNodeId,
        type: 'observation',
        label: label,
        data: observation.data
      });
      
      // Connect start to observation
      visualData.edges.push({
        id: `start_observation`,
        source: 'start',
        target: observationNodeId,
        type: 'flow'
      });
    }
    
    // Add hypotheses
    const hypotheses = trace.steps.filter(step => step.type === 'hypothesis');
    
    for (let i = 0; i < hypotheses.length; i++) {
      const hypothesis = hypotheses[i];
      const nodeId = `hypothesis_${i}`;
      
      let label = hypothesis.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: nodeId,
        type: 'hypothesis',
        label: label,
        data: hypothesis.data
      });
      
      // Connect observation to hypotheses
      if (observations.length > 0) {
        visualData.edges.push({
          id: `observation_${nodeId}`,
          source: observationNodeId,
          target: nodeId,
          type: 'abduction'
        });
      } else {
        // If no observation, connect start to hypotheses
        visualData.edges.push({
          id: `start_${nodeId}`,
          source: 'start',
          target: nodeId,
          type: 'flow'
        });
      }
    }
    
    // Add evaluations based on level
    if ((level === 'detailed' || level === 'expert') && hypotheses.length > 0) {
      const evaluations = trace.steps.filter(step => step.type === 'evaluation');
      
      for (let i = 0; i < evaluations.length; i++) {
        const evaluation = evaluations[i];
        const nodeId = `evaluation_${i}`;
        
        let label = evaluation.description;
        
        // Translate if needed
        if (language !== 'en') {
          label = await this._translateExplanation(label, language);
        }
        
        visualData.nodes.push({
          id: nodeId,
          type: 'evaluation',
          label: label,
          data: evaluation.data
        });
        
        // Connect hypothesis to evaluation
        if (evaluation.dependencies) {
          for (const dep of evaluation.dependencies) {
            if (dep.type === 'hypothesis') {
              const sourceId = `hypothesis_${hypotheses.findIndex(h => h.stepIndex === dep.stepIndex)}`;
              
              visualData.edges.push({
                id: `${sourceId}_${nodeId}`,
                source: sourceId,
                target: nodeId,
                type: 'evaluation'
              });
            }
          }
        }
      }
    }
    
    // Add best explanation
    const bestExplanations = trace.steps.filter(step => step.type === 'best_explanation');
    let bestExplanationNodeId = 'best_explanation';
    
    if (bestExplanations.length > 0) {
      const bestExplanation = bestExplanations[bestExplanations.length - 1]; // Use last best explanation
      
      let label = bestExplanation.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: bestExplanationNodeId,
        type: 'best_explanation',
        label: label,
        data: bestExplanation.data
      });
      
      // Connect hypotheses to best explanation
      if (level === 'detailed' || level === 'expert') {
        const evaluations = trace.steps.filter(step => step.type === 'evaluation');
        
        for (let i = 0; i < evaluations.length; i++) {
          visualData.edges.push({
            id: `evaluation_${i}_best_explanation`,
            source: `evaluation_${i}`,
            target: bestExplanationNodeId,
            type: 'selection'
          });
        }
      } else {
        // Connect hypotheses directly to best explanation
        for (let i = 0; i < hypotheses.length; i++) {
          visualData.edges.push({
            id: `hypothesis_${i}_best_explanation`,
            source: `hypothesis_${i}`,
            target: bestExplanationNodeId,
            type: 'selection'
          });
        }
      }
    }
    
    // Add conclusion
    let conclusionLabel = trace.result ? trace.result.conclusion : 'No conclusion';
    
    // Translate if needed
    if (language !== 'en' && conclusionLabel) {
      conclusionLabel = await this._translateExplanation(conclusionLabel, language);
    }
    
    visualData.nodes.push({
      id: 'conclusion',
      type: 'conclusion',
      label: conclusionLabel
    });
    
    // Connect best explanation to conclusion
    if (bestExplanations.length > 0) {
      visualData.edges.push({
        id: `best_explanation_conclusion`,
        source: bestExplanationNodeId,
        target: 'conclusion',
        type: 'inference'
      });
    } else if (hypotheses.length > 0) {
      // If no best explanation, connect last hypothesis to conclusion
      visualData.edges.push({
        id: `hypothesis_${hypotheses.length - 1}_conclusion`,
        source: `hypothesis_${hypotheses.length - 1}`,
        target: 'conclusion',
        type: 'inference'
      });
    } else {
      // If no hypotheses, connect observation to conclusion
      if (observations.length > 0) {
        visualData.edges.push({
          id: `observation_conclusion`,
          source: observationNodeId,
          target: 'conclusion',
          type: 'inference'
        });
      } else {
        // If no observation, connect start to conclusion
        visualData.edges.push({
          id: 'start_conclusion',
          source: 'start',
          target: 'conclusion',
          type: 'flow'
        });
      }
    }
  }

  /**
   * Builds visual data for analogical reasoning.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {Object} visualData - Visual data object to populate
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {Promise<void>}
   */
  async _buildAnalogicalVisualData(trace, visualData, level, language) {
    // Add start node
    visualData.nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });
    
    // Add source domain
    const sourceDomains = trace.steps.filter(step => step.type === 'source_domain');
    let sourceDomainNodeId = 'source_domain';
    
    if (sourceDomains.length > 0) {
      const sourceDomain = sourceDomains[0]; // Use first source domain
      
      let label = sourceDomain.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: sourceDomainNodeId,
        type: 'source_domain',
        label: label,
        data: sourceDomain.data
      });
      
      // Connect start to source domain
      visualData.edges.push({
        id: `start_source_domain`,
        source: 'start',
        target: sourceDomainNodeId,
        type: 'flow'
      });
    }
    
    // Add target domain
    const targetDomains = trace.steps.filter(step => step.type === 'target_domain');
    let targetDomainNodeId = 'target_domain';
    
    if (targetDomains.length > 0) {
      const targetDomain = targetDomains[0]; // Use first target domain
      
      let label = targetDomain.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: targetDomainNodeId,
        type: 'target_domain',
        label: label,
        data: targetDomain.data
      });
      
      // Connect start to target domain
      visualData.edges.push({
        id: `start_target_domain`,
        source: 'start',
        target: targetDomainNodeId,
        type: 'flow'
      });
    }
    
    // Add mappings based on level
    if (level === 'detailed' || level === 'expert') {
      const mappings = trace.steps.filter(step => step.type === 'mapping');
      
      for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        const nodeId = `mapping_${i}`;
        
        let label = mapping.description;
        
        // Translate if needed
        if (language !== 'en') {
          label = await this._translateExplanation(label, language);
        }
        
        visualData.nodes.push({
          id: nodeId,
          type: 'mapping',
          label: label,
          data: mapping.data
        });
        
        // Connect source and target domains to mapping
        if (sourceDomains.length > 0) {
          visualData.edges.push({
            id: `source_domain_${nodeId}`,
            source: sourceDomainNodeId,
            target: nodeId,
            type: 'mapping'
          });
        }
        
        if (targetDomains.length > 0) {
          visualData.edges.push({
            id: `target_domain_${nodeId}`,
            source: targetDomainNodeId,
            target: nodeId,
            type: 'mapping'
          });
        }
      }
    }
    
    // Add inference
    const inferences = trace.steps.filter(step => step.type === 'inference');
    let inferenceNodeId = 'inference';
    
    if (inferences.length > 0) {
      const inference = inferences[inferences.length - 1]; // Use last inference
      
      let label = inference.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: inferenceNodeId,
        type: 'inference',
        label: label,
        data: inference.data
      });
      
      // Connect mappings to inference
      if ((level === 'detailed' || level === 'expert') && 
          trace.steps.some(step => step.type === 'mapping')) {
        const mappings = trace.steps.filter(step => step.type === 'mapping');
        
        for (let i = 0; i < mappings.length; i++) {
          visualData.edges.push({
            id: `mapping_${i}_inference`,
            source: `mapping_${i}`,
            target: inferenceNodeId,
            type: 'analogy'
          });
        }
      } else {
        // Connect source and target domains directly to inference
        if (sourceDomains.length > 0) {
          visualData.edges.push({
            id: `source_domain_inference`,
            source: sourceDomainNodeId,
            target: inferenceNodeId,
            type: 'analogy'
          });
        }
        
        if (targetDomains.length > 0) {
          visualData.edges.push({
            id: `target_domain_inference`,
            source: targetDomainNodeId,
            target: inferenceNodeId,
            type: 'analogy'
          });
        }
      }
    }
    
    // Add conclusion
    let conclusionLabel = trace.result ? trace.result.conclusion : 'No conclusion';
    
    // Translate if needed
    if (language !== 'en' && conclusionLabel) {
      conclusionLabel = await this._translateExplanation(conclusionLabel, language);
    }
    
    visualData.nodes.push({
      id: 'conclusion',
      type: 'conclusion',
      label: conclusionLabel
    });
    
    // Connect inference to conclusion
    if (inferences.length > 0) {
      visualData.edges.push({
        id: `inference_conclusion`,
        source: inferenceNodeId,
        target: 'conclusion',
        type: 'inference'
      });
    } else {
      // If no inference, connect source and target domains to conclusion
      if (sourceDomains.length > 0) {
        visualData.edges.push({
          id: `source_domain_conclusion`,
          source: sourceDomainNodeId,
          target: 'conclusion',
          type: 'analogy'
        });
      }
      
      if (targetDomains.length > 0) {
        visualData.edges.push({
          id: `target_domain_conclusion`,
          source: targetDomainNodeId,
          target: 'conclusion',
          type: 'analogy'
        });
      }
      
      // If no domains, connect start to conclusion
      if (sourceDomains.length === 0 && targetDomains.length === 0) {
        visualData.edges.push({
          id: 'start_conclusion',
          source: 'start',
          target: 'conclusion',
          type: 'flow'
        });
      }
    }
  }

  /**
   * Builds visual data for generic reasoning.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {Object} visualData - Visual data object to populate
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {Promise<void>}
   */
  async _buildGenericVisualData(trace, visualData, level, language) {
    // Add start node
    visualData.nodes.push({
      id: 'start',
      type: 'start',
      label: 'Start'
    });
    
    // Add steps based on level
    const steps = trace.steps.filter(step => {
      if (level === 'expert') {
        return true; // Include all steps
      } else if (level === 'detailed') {
        return step.type !== 'intermediate'; // Exclude intermediate steps
      } else if (level === 'standard') {
        return ['major', 'premise', 'hypothesis', 'conclusion'].includes(step.type);
      } else {
        return step.type === 'major'; // Basic level only includes major steps
      }
    });
    
    // Add step nodes
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nodeId = `step_${i}`;
      
      let label = step.description;
      
      // Translate if needed
      if (language !== 'en') {
        label = await this._translateExplanation(label, language);
      }
      
      visualData.nodes.push({
        id: nodeId,
        type: step.type,
        label: label,
        data: step.data
      });
      
      // Connect nodes
      if (i === 0) {
        // Connect start to first step
        visualData.edges.push({
          id: `start_${nodeId}`,
          source: 'start',
          target: nodeId,
          type: 'flow'
        });
      } else {
        // Connect previous step to current step
        visualData.edges.push({
          id: `step_${i-1}_${nodeId}`,
          source: `step_${i-1}`,
          target: nodeId,
          type: 'flow'
        });
      }
    }
    
    // Add conclusion
    let conclusionLabel = trace.result ? trace.result.conclusion : 'No conclusion';
    
    // Translate if needed
    if (language !== 'en' && conclusionLabel) {
      conclusionLabel = await this._translateExplanation(conclusionLabel, language);
    }
    
    visualData.nodes.push({
      id: 'conclusion',
      type: 'conclusion',
      label: conclusionLabel
    });
    
    // Connect last step to conclusion
    if (steps.length > 0) {
      visualData.edges.push({
        id: `step_${steps.length-1}_conclusion`,
        source: `step_${steps.length-1}`,
        target: 'conclusion',
        type: 'flow'
      });
    } else {
      // If no steps, connect start to conclusion
      visualData.edges.push({
        id: 'start_conclusion',
        source: 'start',
        target: 'conclusion',
        type: 'flow'
      });
    }
  }

  /**
   * Generates an explanation using LLM.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {string} format - Explanation format
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @param {boolean} includeConfidence - Whether to include confidence information
   * @returns {Promise<Object>} - Generated explanation
   */
  async _generateExplanationWithLLM(trace, format, level, language, includeConfidence) {
    try {
      // Extract key information from trace
      const traceInfo = this._extractTraceInfo(trace, level);
      
      // Prepare prompt
      let prompt = `Generate a ${level} level explanation in ${language} language for the following ${trace.strategy} reasoning process:\n\n`;
      
      // Add trace information
      prompt += `Strategy: ${trace.strategy}\n`;
      prompt += `Steps: ${traceInfo.steps}\n`;
      
      if (traceInfo.premises) {
        prompt += `Premises: ${traceInfo.premises}\n`;
      }
      
      if (traceInfo.observations) {
        prompt += `Observations: ${traceInfo.observations}\n`;
      }
      
      if (traceInfo.hypotheses) {
        prompt += `Hypotheses: ${traceInfo.hypotheses}\n`;
      }
      
      if (traceInfo.rules) {
        prompt += `Rules: ${traceInfo.rules}\n`;
      }
      
      prompt += `Conclusion: ${traceInfo.conclusion}\n\n`;
      
      // Add format instructions
      if (format === 'structured') {
        prompt += `Format the explanation as a structured JSON object with steps and conclusion.\n`;
      } else if (format === 'visual') {
        prompt += `Describe how this reasoning process would be visualized as a flow diagram.\n`;
      } else {
        prompt += `Format the explanation as natural language text.\n`;
      }
      
      // Add level-specific instructions
      switch (level) {
        case 'expert':
          prompt += `Include technical details and formal logic notation where appropriate.\n`;
          break;
        case 'detailed':
          prompt += `Include all reasoning steps and intermediate conclusions.\n`;
          break;
        case 'standard':
          prompt += `Include key reasoning steps and main conclusions.\n`;
          break;
        case 'basic':
          prompt += `Keep the explanation simple and concise, focusing only on the most important points.\n`;
          break;
      }
      
      // Add confidence instructions
      if (includeConfidence && trace.result && trace.result.confidence !== undefined) {
        prompt += `Include information about the confidence level: ${trace.result.confidence * 100}%.\n`;
      }
      
      // Call LLM
      const modelResponse = await this._callExplanationModel(prompt, format, language);
      
      // Process response based on format
      let content;
      
      if (format === 'structured') {
        try {
          content = JSON.parse(modelResponse);
        } catch (error) {
          this.logger.error(`Failed to parse structured explanation: ${error.message}`);
          content = { text: modelResponse };
        }
      } else {
        content = modelResponse;
      }
      
      return {
        content,
        generationMethod: 'llm'
      };
    } catch (error) {
      this.logger.error(`Failed to generate explanation with LLM: ${error.message}`, { error: error.stack });
      
      // Return simple explanation as fallback
      return {
        content: `${trace.strategy} reasoning was used to reach the conclusion: ${trace.result ? trace.result.conclusion : 'No conclusion'}`,
        generationMethod: 'fallback'
      };
    }
  }

  /**
   * Calls LLM to generate explanation.
   * 
   * @private
   * @param {string} prompt - Prompt for LLM
   * @param {string} format - Explanation format
   * @param {string} language - Explanation language
   * @returns {Promise<string>} - LLM response
   */
  async _callExplanationModel(prompt, format, language) {
    try {
      // Select appropriate model based on format and language
      let model = 'llama-multilingual'; // Default to Llama Multilingual
      
      // Call model
      const response = await this.modelManager.callModel({
        model,
        prompt,
        temperature: 0.3, // Lower temperature for more deterministic explanations
        maxTokens: 1000,
        context: {
          purpose: 'explanation_generation',
          format,
          language
        }
      });
      
      return response.text;
    } catch (error) {
      this.logger.error(`Failed to call explanation model: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Translates explanation text to target language.
   * 
   * @private
   * @param {string} text - Text to translate
   * @param {string} language - Target language
   * @returns {Promise<string>} - Translated text
   */
  async _translateExplanation(text, language) {
    try {
      if (!text || language === 'en') {
        return text;
      }
      
      // Call translation model
      const response = await this.modelManager.callModel({
        model: 'llama-multilingual',
        prompt: `Translate the following text to ${language}:\n\n${text}`,
        temperature: 0.2, // Lower temperature for more accurate translations
        maxTokens: 500,
        context: {
          purpose: 'translation',
          sourceLanguage: 'en',
          targetLanguage: language
        }
      });
      
      return response.text;
    } catch (error) {
      this.logger.error(`Failed to translate explanation: ${error.message}`, { error: error.stack });
      return text; // Return original text as fallback
    }
  }

  /**
   * Extracts key information from a reasoning trace.
   * 
   * @private
   * @param {Object} trace - Reasoning trace
   * @param {string} level - Explanation detail level
   * @returns {Object} - Extracted trace information
   */
  _extractTraceInfo(trace, level) {
    try {
      const traceInfo = {
        strategy: trace.strategy,
        steps: trace.steps.length,
        conclusion: trace.result ? trace.result.conclusion : 'No conclusion'
      };
      
      // Extract premises
      const premises = trace.steps.filter(step => step.type === 'premise');
      if (premises.length > 0) {
        traceInfo.premises = premises.map(p => p.description).join('; ');
      }
      
      // Extract observations
      const observations = trace.steps.filter(step => step.type === 'observation');
      if (observations.length > 0) {
        traceInfo.observations = observations.map(o => o.description).join('; ');
      }
      
      // Extract hypotheses
      const hypotheses = trace.steps.filter(step => step.type === 'hypothesis');
      if (hypotheses.length > 0) {
        traceInfo.hypotheses = hypotheses.map(h => h.description).join('; ');
      }
      
      // Extract rules for detailed levels
      if (level === 'detailed' || level === 'expert') {
        const rules = trace.steps.filter(step => step.type === 'rule');
        if (rules.length > 0) {
          traceInfo.rules = rules.map(r => r.description).join('; ');
        }
      }
      
      return traceInfo;
    } catch (error) {
      this.logger.error(`Failed to extract trace info: ${error.message}`, { error: error.stack });
      
      // Return minimal info as fallback
      return {
        strategy: trace.strategy,
        steps: trace.steps.length,
        conclusion: trace.result ? trace.result.conclusion : 'No conclusion'
      };
    }
  }

  /**
   * Gets template ID for explanation.
   * 
   * @private
   * @param {string} strategy - Reasoning strategy
   * @param {string} format - Explanation format
   * @param {string} level - Explanation detail level
   * @returns {string} - Template ID
   */
  _getTemplateId(strategy, format, level) {
    // Try strategy-specific template first
    const strategyTemplateId = `${strategy}_${format}_${level}`;
    if (this.explanationTemplates.has(strategyTemplateId)) {
      return strategyTemplateId;
    }
    
    // Try format-level template
    const formatTemplateId = `${format}_${level}`;
    if (this.explanationTemplates.has(formatTemplateId)) {
      return formatTemplateId;
    }
    
    // Try level template
    const levelTemplateId = level;
    if (this.explanationTemplates.has(levelTemplateId)) {
      return levelTemplateId;
    }
    
    // Return default template ID
    return 'default';
  }

  /**
   * Generates a confidence statement.
   * 
   * @private
   * @param {number} confidence - Confidence value (0-1)
   * @param {string} level - Explanation detail level
   * @param {string} language - Explanation language
   * @returns {string} - Confidence statement
   */
  _generateConfidenceStatement(confidence, level, language) {
    try {
      const percentage = Math.round(confidence * 100);
      const interpretation = this._interpretConfidence(confidence);
      
      // Generate statement based on level
      let statement;
      
      switch (level) {
        case 'expert':
          statement = `\n\nConfidence: ${percentage}% (${interpretation}). This represents the system's probabilistic assessment of the conclusion's validity based on the available evidence and reasoning process.`;
          break;
        case 'detailed':
          statement = `\n\nConfidence: ${percentage}% (${interpretation}). This indicates the system's degree of certainty in the conclusion.`;
          break;
        case 'standard':
          statement = `\n\nConfidence: ${percentage}% (${interpretation}).`;
          break;
        case 'basic':
        default:
          statement = `\n\nConfidence: ${interpretation}.`;
      }
      
      return statement;
    } catch (error) {
      this.logger.error(`Failed to generate confidence statement: ${error.message}`, { error: error.stack });
      
      // Return simple statement as fallback
      return `\n\nConfidence: ${Math.round(confidence * 100)}%.`;
    }
  }

  /**
   * Interprets a confidence value.
   * 
   * @private
   * @param {number} confidence - Confidence value (0-1)
   * @returns {string} - Confidence interpretation
   */
  _interpretConfidence(confidence) {
    if (confidence >= 0.9) {
      return 'Very High';
    } else if (confidence >= 0.7) {
      return 'High';
    } else if (confidence >= 0.5) {
      return 'Moderate';
    } else if (confidence >= 0.3) {
      return 'Low';
    } else {
      return 'Very Low';
    }
  }

  /**
   * Gets statistics about the explanation generator.
   * 
   * @returns {Promise<Object>} - Generator statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_getStatistics");
    }

    try {
      // Get trace statistics
      const traceStats = {
        count: this.reasoningTraces.size,
        maxSize: this.maxTraceSize,
        byStrategy: {}
      };
      
      // Count traces by strategy
      for (const trace of this.reasoningTraces.values()) {
        const strategy = trace.strategy || 'unknown';
        traceStats.byStrategy[strategy] = (traceStats.byStrategy[strategy] || 0) + 1;
      }
      
      // Get template statistics
      const templateStats = {
        count: this.explanationTemplates.size,
        byType: {}
      };
      
      // Count templates by type
      for (const template of this.explanationTemplates.values()) {
        const source = template.source || 'unknown';
        templateStats.byType[source] = (templateStats.byType[source] || 0) + 1;
      }
      
      // Compile statistics
      const statistics = {
        traceStats,
        templateStats,
        configuration: {
          maxTraceSize: this.maxTraceSize,
          maxTraceAge: this.maxTraceAge,
          defaultExplanationLevel: this.defaultExplanationLevel,
          enableVisualExplanations: this.enableVisualExplanations,
          enableStructuredExplanations: this.enableStructuredExplanations,
          enableMultilingualExplanations: this.enableMultilingualExplanations,
          systemTier: this.systemTier
        }
      };
      
      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Cleans up traces and resources.
   * 
   * @param {Object} [options] - Cleanup options
   * @param {boolean} [options.clearAllTraces] - Whether to clear all traces
   * @param {number} [options.olderThan] - Clear traces older than this timestamp
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanup(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("explanationGenerator_cleanup");
    }

    try {
      const clearAllTraces = options.clearAllTraces !== undefined ? options.clearAllTraces : false;
      const olderThan = options.olderThan || 0;
      
      let tracesRemoved = 0;
      
      // Clear all traces if requested
      if (clearAllTraces) {
        tracesRemoved = this.reasoningTraces.size;
        this.reasoningTraces.clear();
      } else if (olderThan > 0) {
        // Clear traces older than specified timestamp
        for (const [traceId, trace] of this.reasoningTraces.entries()) {
          if (trace.timestamp && trace.timestamp < olderThan) {
            this.reasoningTraces.delete(traceId);
            tracesRemoved++;
          }
        }
      } else {
        // Run normal cleanup
        this._cleanupOldTraces();
        tracesRemoved = 0; // We don't know how many were removed
      }
      
      this.logger.debug(`Cleaned up explanation generator`, { 
        tracesRemoved,
        clearAllTraces,
        olderThan
      });
      
      return {
        tracesRemoved,
        remainingTraces: this.reasoningTraces.size
      };
    } catch (error) {
      this.logger.error(`Failed to clean up: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = { ExplanationGenerator };
