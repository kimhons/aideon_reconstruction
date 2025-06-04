/**
 * @fileoverview Abductive Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements inference to the best explanation through hypothesis generation and evaluation.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Abductive Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements inference to the best explanation through hypothesis generation and evaluation.
 * 
 * @extends EventEmitter
 */
class AbductiveReasoner extends EventEmitter {
  /**
   * Creates a new AbductiveReasoner instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.knowledgeGraphManager - Knowledge Graph Manager instance
   * @param {Object} options.securityManager - Security manager
   * @param {Object} [options.modelStrategyManager] - Model Strategy Manager for LLM integration
   * @param {Object} [options.vectorService] - Vector Service for embedding-based operations
   */
  constructor(options) {
    super();
    
    if (!options.knowledgeGraphManager) {
      throw new Error("AbductiveReasoner requires a knowledgeGraphManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.securityManager = options.securityManager;
    this.modelStrategyManager = options.modelStrategyManager;
    this.vectorService = options.vectorService;
    
    // Abductive reasoning components
    this.explanations = new Map(); // Map of explanationId -> explanation
    this.observations = new Map(); // Map of observationId -> observation
    
    // Inference tracing
    this.inferenceTraces = new Map(); // Map of traceId -> trace
    
    // Configuration
    this.maxExplanations = this.configService ? 
      this.configService.get('reasoning.abductive.maxExplanations', 10) : 10;
    this.minPlausibilityThreshold = this.configService ? 
      this.configService.get('reasoning.abductive.minPlausibilityThreshold', 0.3) : 0.3;
    this.useLLMForExplanationGeneration = this.configService ? 
      this.configService.get('reasoning.abductive.useLLMForExplanationGeneration', true) : true;
    this.useLLMForExplanationEvaluation = this.configService ? 
      this.configService.get('reasoning.abductive.useLLMForExplanationEvaluation', true) : true;
    
    this.initialized = false;
  }

  /**
   * Initializes the Abductive Reasoner.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing AbductiveReasoner");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_initialize");
    }

    try {
      // Load predefined explanations if available
      await this._loadPredefinedExplanations();
      
      this.initialized = true;

      if (this.logger) {
        this.logger.info("AbductiveReasoner initialized successfully", {
          explanationCount: this.explanations.size
        });
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("AbductiveReasoner initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`AbductiveReasoner initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Loads predefined explanations from configuration or knowledge graph.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPredefinedExplanations() {
    try {
      // Check if explanations are defined in configuration
      const configExplanations = this.configService ? 
        this.configService.get('reasoning.abductive.predefinedExplanations', []) : [];
      
      for (const explanationConfig of configExplanations) {
        await this.addExplanation(explanationConfig);
      }
      
      // Load explanations from knowledge graph if enabled
      const loadFromKG = this.configService ? 
        this.configService.get('reasoning.abductive.loadExplanationsFromKnowledgeGraph', true) : true;
      
      if (loadFromKG && this.knowledgeGraphManager) {
        const explanationNodes = await this.knowledgeGraphManager.findNodes({
          nodeType: 'Explanation',
          properties: {
            explanationType: 'abductive'
          }
        });
        
        for (const explanationNode of explanationNodes) {
          const explanation = this._convertNodeToExplanation(explanationNode);
          if (explanation) {
            await this.addExplanation(explanation);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Loaded ${this.explanations.size} predefined explanations`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load predefined explanations: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Converts a knowledge graph node to an explanation object.
   * 
   * @private
   * @param {Object} node - Knowledge graph node
   * @returns {Object|null} - Explanation object or null if conversion failed
   */
  _convertNodeToExplanation(node) {
    try {
      if (!node || !node.properties) {
        return null;
      }
      
      const { 
        title, 
        description, 
        hypothesis, 
        observations, 
        plausibility, 
        simplicity, 
        coherence, 
        coverage 
      } = node.properties;
      
      if (!hypothesis) {
        return null;
      }
      
      return {
        id: node.id,
        title: title || `Explanation_${node.id}`,
        description: description || '',
        hypothesis: hypothesis,
        observations: typeof observations === 'string' ? JSON.parse(observations) : observations || [],
        plausibility: plausibility || 0,
        simplicity: simplicity || 0,
        coherence: coherence || 0,
        coverage: coverage || 0,
        source: 'knowledge_graph',
        sourceNodeId: node.id
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to convert node to explanation: ${error.message}`, { 
          nodeId: node.id, 
          error: error.stack 
        });
      }
      return null;
    }
  }

  /**
   * Ensures the reasoner is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the reasoner is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("AbductiveReasoner is not initialized. Call initialize() first.");
    }
  }

  /**
   * Adds an observation to the reasoner.
   * 
   * @param {Object} observation - Observation definition
   * @param {string} [observation.id] - Unique identifier (generated if not provided)
   * @param {string} observation.description - Description of the observation
   * @param {Object} [observation.data] - Associated data
   * @param {string} [observation.source='user'] - Source of the observation
   * @returns {Promise<string>} - ID of the added observation
   */
  async addObservation(observation) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_addObservation");
    }

    try {
      // Validate observation
      if (!observation.description) {
        throw new Error("Observation must have a description");
      }
      
      // Generate ID if not provided
      const observationId = observation.id || uuidv4();
      
      // Create observation object
      const observationObj = {
        id: observationId,
        description: observation.description,
        data: observation.data || {},
        source: observation.source || 'user',
        createdAt: Date.now(),
        explanations: [] // IDs of explanations that explain this observation
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyObservationSecurityPolicies) {
        await this.securityManager.applyObservationSecurityPolicies(observationObj);
      }
      
      // Store observation
      this.observations.set(observationId, observationObj);
      
      if (this.logger) {
        this.logger.debug(`Added observation: ${observationId}`, { 
          description: observationObj.description
        });
      }
      
      this.emit("observationAdded", { observationId, observation: observationObj });
      return observationId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add observation: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes an observation from the reasoner.
   * 
   * @param {string} observationId - ID of the observation to remove
   * @returns {Promise<boolean>} - True if the observation was removed
   */
  async removeObservation(observationId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_removeObservation");
    }

    try {
      // Check if observation exists
      if (!this.observations.has(observationId)) {
        throw new Error(`Observation not found: ${observationId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyObservationRemovalPolicies) {
        const observation = this.observations.get(observationId);
        await this.securityManager.applyObservationRemovalPolicies(observation);
      }
      
      // Remove observation
      this.observations.delete(observationId);
      
      if (this.logger) {
        this.logger.debug(`Removed observation: ${observationId}`);
      }
      
      this.emit("observationRemoved", { observationId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove observation: ${error.message}`, { 
          observationId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Adds an explanation to the reasoner.
   * 
   * @param {Object} explanation - Explanation definition
   * @param {string} [explanation.id] - Unique identifier (generated if not provided)
   * @param {string} explanation.title - Title of the explanation
   * @param {string} [explanation.description] - Description of the explanation
   * @param {string} explanation.hypothesis - The hypothesis that explains the observations
   * @param {Array<string>} [explanation.observations=[]] - IDs of observations explained by this explanation
   * @param {number} [explanation.plausibility=0] - Plausibility score (0-1)
   * @param {number} [explanation.simplicity=0] - Simplicity score (0-1)
   * @param {number} [explanation.coherence=0] - Coherence score (0-1)
   * @param {number} [explanation.coverage=0] - Coverage score (0-1)
   * @param {string} [explanation.source='user'] - Source of the explanation
   * @returns {Promise<string>} - ID of the added explanation
   */
  async addExplanation(explanation) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_addExplanation");
    }

    try {
      // Validate explanation
      if (!explanation.hypothesis) {
        throw new Error("Explanation must have a hypothesis");
      }
      
      // Generate ID if not provided
      const explanationId = explanation.id || uuidv4();
      
      // Create explanation object
      const explanationObj = {
        id: explanationId,
        title: explanation.title || `Explanation_${explanationId}`,
        description: explanation.description || '',
        hypothesis: explanation.hypothesis,
        observations: explanation.observations || [],
        plausibility: explanation.plausibility || 0,
        simplicity: explanation.simplicity || 0,
        coherence: explanation.coherence || 0,
        coverage: explanation.coverage || 0,
        source: explanation.source || 'user',
        createdAt: Date.now(),
        lastEvaluated: null
      };
      
      // Calculate overall score if not provided
      if (!explanation.overallScore) {
        explanationObj.overallScore = this._calculateOverallScore(explanationObj);
      } else {
        explanationObj.overallScore = explanation.overallScore;
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyExplanationSecurityPolicies) {
        await this.securityManager.applyExplanationSecurityPolicies(explanationObj);
      }
      
      // Store explanation
      this.explanations.set(explanationId, explanationObj);
      
      // Update observations to reference this explanation
      for (const observationId of explanationObj.observations) {
        if (this.observations.has(observationId)) {
          const observation = this.observations.get(observationId);
          if (!observation.explanations.includes(explanationId)) {
            observation.explanations.push(explanationId);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Added explanation: ${explanationId}`, { 
          title: explanationObj.title,
          overallScore: explanationObj.overallScore
        });
      }
      
      this.emit("explanationAdded", { explanationId, explanation: explanationObj });
      return explanationId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add explanation: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes an explanation from the reasoner.
   * 
   * @param {string} explanationId - ID of the explanation to remove
   * @returns {Promise<boolean>} - True if the explanation was removed
   */
  async removeExplanation(explanationId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_removeExplanation");
    }

    try {
      // Check if explanation exists
      if (!this.explanations.has(explanationId)) {
        throw new Error(`Explanation not found: ${explanationId}`);
      }
      
      // Get explanation
      const explanation = this.explanations.get(explanationId);
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyExplanationRemovalPolicies) {
        await this.securityManager.applyExplanationRemovalPolicies(explanation);
      }
      
      // Remove explanation from observations
      for (const observationId of explanation.observations) {
        if (this.observations.has(observationId)) {
          const observation = this.observations.get(observationId);
          observation.explanations = observation.explanations.filter(id => id !== explanationId);
        }
      }
      
      // Remove explanation
      this.explanations.delete(explanationId);
      
      if (this.logger) {
        this.logger.debug(`Removed explanation: ${explanationId}`);
      }
      
      this.emit("explanationRemoved", { explanationId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove explanation: ${error.message}`, { 
          explanationId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Calculates the overall score for an explanation.
   * 
   * @private
   * @param {Object} explanation - Explanation object
   * @returns {number} - Overall score (0-1)
   */
  _calculateOverallScore(explanation) {
    // Get weights from configuration
    const weights = {
      plausibility: this.configService ? 
        this.configService.get('reasoning.abductive.weights.plausibility', 0.4) : 0.4,
      simplicity: this.configService ? 
        this.configService.get('reasoning.abductive.weights.simplicity', 0.2) : 0.2,
      coherence: this.configService ? 
        this.configService.get('reasoning.abductive.weights.coherence', 0.2) : 0.2,
      coverage: this.configService ? 
        this.configService.get('reasoning.abductive.weights.coverage', 0.2) : 0.2
    };
    
    // Calculate weighted score
    const score = 
      (explanation.plausibility * weights.plausibility) +
      (explanation.simplicity * weights.simplicity) +
      (explanation.coherence * weights.coherence) +
      (explanation.coverage * weights.coverage);
    
    return Math.min(1, Math.max(0, score)); // Ensure score is between 0 and 1
  }

  /**
   * Performs abductive reasoning based on provided observations.
   * 
   * @param {Object} options - Reasoning options
   * @param {Array<string>} options.observationIds - IDs of observations to explain
   * @param {Object} [options.context] - Context information
   * @param {boolean} [options.useLLM=true] - Whether to use LLM for explanation generation
   * @param {number} [options.maxExplanations=10] - Maximum number of explanations to generate
   * @returns {Promise<Object>} - Reasoning result with generated explanations
   */
  async reason(options) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_reason");
    }

    try {
      const { 
        observationIds, 
        context = {}, 
        useLLM = this.useLLMForExplanationGeneration,
        maxExplanations = this.maxExplanations
      } = options;
      
      if (!observationIds || !Array.isArray(observationIds) || observationIds.length === 0) {
        throw new Error("Observation IDs are required for abductive reasoning");
      }
      
      // Validate observation IDs
      const observations = [];
      for (const observationId of observationIds) {
        if (!this.observations.has(observationId)) {
          throw new Error(`Observation not found: ${observationId}`);
        }
        observations.push(this.observations.get(observationId));
      }
      
      // Create inference trace
      const traceId = uuidv4();
      const trace = {
        id: traceId,
        observationIds,
        context,
        startTime: Date.now(),
        endTime: null,
        explanationsGenerated: [],
        explanationsEvaluated: [],
        bestExplanationId: null,
        status: 'running'
      };
      
      this.inferenceTraces.set(traceId, trace);
      
      // Check for existing explanations that cover these observations
      const existingExplanations = this._findExistingExplanations(observationIds);
      
      // Generate new explanations if needed
      let generatedExplanations = [];
      if (existingExplanations.length < maxExplanations) {
        const numToGenerate = maxExplanations - existingExplanations.length;
        
        if (useLLM && this.modelStrategyManager) {
          generatedExplanations = await this._generateExplanationsWithLLM(
            observations, context, numToGenerate
          );
        } else {
          generatedExplanations = await this._generateExplanationsWithAlgorithms(
            observations, context, numToGenerate
          );
        }
        
        // Add generated explanations
        for (const explanation of generatedExplanations) {
          const explanationId = await this.addExplanation({
            ...explanation,
            observations: observationIds
          });
          trace.explanationsGenerated.push(explanationId);
        }
      }
      
      // Combine existing and generated explanations
      const allExplanations = [
        ...existingExplanations,
        ...trace.explanationsGenerated.map(id => this.explanations.get(id))
      ];
      
      // Evaluate explanations
      const evaluatedExplanations = [];
      for (const explanation of allExplanations) {
        const evaluationResult = await this.evaluateExplanation(
          explanation.id, observations, context, useLLM
        );
        evaluatedExplanations.push(evaluationResult);
        trace.explanationsEvaluated.push(explanation.id);
      }
      
      // Sort evaluated explanations by overall score
      evaluatedExplanations.sort((a, b) => b.overallScore - a.overallScore);
      
      // Get best explanation
      const bestExplanation = evaluatedExplanations.length > 0 ? evaluatedExplanations[0] : null;
      if (bestExplanation) {
        trace.bestExplanationId = bestExplanation.id;
      }
      
      // Update trace
      trace.endTime = Date.now();
      trace.status = 'completed';
      
      if (this.logger) {
        this.logger.debug(`Completed abductive reasoning`, { 
          traceId,
          observationCount: observations.length,
          existingExplanationCount: existingExplanations.length,
          generatedExplanationCount: generatedExplanations.length,
          evaluatedExplanationCount: evaluatedExplanations.length,
          bestExplanationScore: bestExplanation ? bestExplanation.overallScore : null
        });
      }
      
      return {
        traceId,
        explanations: evaluatedExplanations,
        bestExplanation: bestExplanation,
        executionTime: trace.endTime - trace.startTime
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to perform abductive reasoning: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Finds existing explanations that cover the specified observations.
   * 
   * @private
   * @param {Array<string>} observationIds - IDs of observations to explain
   * @returns {Array<Object>} - Existing explanations
   */
  _findExistingExplanations(observationIds) {
    const explanations = [];
    
    // Check each explanation
    for (const explanation of this.explanations.values()) {
      // Check if explanation covers all observations
      const coversAll = observationIds.every(id => explanation.observations.includes(id));
      
      if (coversAll) {
        explanations.push(explanation);
      }
    }
    
    return explanations;
  }

  /**
   * Generates explanations using algorithms.
   * 
   * @private
   * @param {Array<Object>} observations - Observations to explain
   * @param {Object} context - Context information
   * @param {number} maxExplanations - Maximum number of explanations to generate
   * @returns {Promise<Array<Object>>} - Generated explanations
   */
  async _generateExplanationsWithAlgorithms(observations, context, maxExplanations) {
    // Placeholder for actual algorithm implementation
    // Example: Simple pattern matching and template-based explanation generation
    if (this.logger) {
      this.logger.warn("Algorithmic explanation generation not fully implemented. Using basic templates.");
    }
    
    const explanations = [];
    
    // Basic template-based generation
    const templates = [
      "The observations are caused by {subject}",
      "The {subject} is responsible for these observations",
      "These observations can be explained by {subject}",
      "The presence of {subject} explains these observations"
    ];
    
    // Extract potential subjects from observations
    const subjects = new Set();
    for (const observation of observations) {
      // Simple keyword extraction (would be more sophisticated in production)
      const words = observation.description.split(/\s+/);
      for (const word of words) {
        if (word.length > 4 && !['these', 'those', 'there', 'their', 'about'].includes(word.toLowerCase())) {
          subjects.add(word);
        }
      }
    }
    
    // Generate explanations from templates and subjects
    const subjectArray = Array.from(subjects);
    for (let i = 0; i < Math.min(maxExplanations, subjectArray.length * templates.length); i++) {
      const templateIndex = i % templates.length;
      const subjectIndex = Math.floor(i / templates.length) % subjectArray.length;
      
      const template = templates[templateIndex];
      const subject = subjectArray[subjectIndex];
      
      const hypothesis = template.replace('{subject}', subject);
      
      explanations.push({
        title: `Explanation for ${subject}`,
        description: `Generated explanation based on observations`,
        hypothesis,
        plausibility: 0.5, // Default plausibility
        simplicity: 0.7, // Templates are simple
        coherence: 0.5, // Default coherence
        coverage: 0.5, // Default coverage
        source: 'algorithmic_abduction'
      });
    }
    
    return explanations;
  }

  /**
   * Generates explanations using LLM.
   * 
   * @private
   * @param {Array<Object>} observations - Observations to explain
   * @param {Object} context - Context information
   * @param {number} maxExplanations - Maximum number of explanations to generate
   * @returns {Promise<Array<Object>>} - Generated explanations
   */
  async _generateExplanationsWithLLM(observations, context, maxExplanations) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM explanation generation");
      }
      
      // Prepare observations for LLM
      const observationsText = observations.map(o => `- ${o.description}`).join('\n');
      
      // Prepare prompt for LLM
      const prompt = `
        Generate plausible explanations for the following observations using abductive reasoning.
        
        Observations:
        ${observationsText}
        
        Context:
        ${JSON.stringify(context)}
        
        Generate up to ${maxExplanations} explanations in the following JSON format:
        [
          {
            "title": "Brief title for the explanation",
            "hypothesis": "The explanation hypothesis that accounts for the observations",
            "description": "Detailed description of how this explanation accounts for the observations",
            "plausibility": 0.X, // How plausible is this explanation (0-1)
            "simplicity": 0.X, // How simple is this explanation (0-1)
            "coherence": 0.X, // How coherent is this explanation with existing knowledge (0-1)
            "coverage": 0.X // How well this explanation covers all observations (0-1)
          }
        ]
        
        Focus on explanations that are plausible, simple, coherent, and cover all observations.
        Consider multiple alternative explanations with different levels of plausibility.
      `;
      
      // Call LLM to generate explanations
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for explanation generation with multilingual support
        temperature: 0.7, // Higher temperature for creative explanations
        maxTokens: 2000,
        responseFormat: 'json'
      });
      
      // Parse and validate explanations
      let explanations = [];
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        if (Array.isArray(parsedResult)) {
          explanations = parsedResult;
        } else if (parsedResult.explanations && Array.isArray(parsedResult.explanations)) {
          explanations = parsedResult.explanations;
        }
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM explanation generation result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        // Fallback to empty explanations
        explanations = [];
      }
      
      // Validate and format explanations
      const validExplanations = [];
      for (const e of explanations) {
        if (e.hypothesis) {
          validExplanations.push({
            title: e.title || 'Generated Explanation',
            description: e.description || '',
            hypothesis: e.hypothesis,
            plausibility: e.plausibility || 0.5,
            simplicity: e.simplicity || 0.5,
            coherence: e.coherence || 0.5,
            coverage: e.coverage || 0.5,
            source: 'llm_abduction',
            sourceModel: 'llama-multilingual'
          });
        }
      }
      
      return validExplanations.slice(0, maxExplanations);
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM explanation generation error: ${error.message}`, { error: error.stack });
      }
      // Fallback to algorithmic generation on LLM failure
      return this._generateExplanationsWithAlgorithms(observations, context, maxExplanations);
    }
  }

  /**
   * Evaluates an explanation against provided observations.
   * 
   * @param {string} explanationId - ID of the explanation to evaluate
   * @param {Array<Object>} observations - Observations for evaluation
   * @param {Object} context - Context information
   * @param {boolean} useLLM - Whether to use LLM for evaluation
   * @returns {Promise<Object>} - Evaluated explanation with updated scores
   */
  async evaluateExplanation(explanationId, observations, context, useLLM) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_evaluateExplanation");
    }

    try {
      // Get explanation
      if (!this.explanations.has(explanationId)) {
        throw new Error(`Explanation not found: ${explanationId}`);
      }
      const explanation = this.explanations.get(explanationId);
      
      // Perform evaluation
      let evaluationResult;
      if (useLLM && this.modelStrategyManager && this.useLLMForExplanationEvaluation) {
        evaluationResult = await this._evaluateExplanationWithLLM(explanation, observations, context);
      } else {
        evaluationResult = await this._evaluateExplanationWithAlgorithms(explanation, observations, context);
      }
      
      // Update explanation
      explanation.plausibility = evaluationResult.plausibility;
      explanation.simplicity = evaluationResult.simplicity;
      explanation.coherence = evaluationResult.coherence;
      explanation.coverage = evaluationResult.coverage;
      explanation.overallScore = this._calculateOverallScore(explanation);
      explanation.lastEvaluated = Date.now();
      
      if (this.logger) {
        this.logger.debug(`Evaluated explanation: ${explanationId}`, { 
          hypothesis: explanation.hypothesis,
          overallScore: explanation.overallScore
        });
      }
      
      this.emit("explanationEvaluated", { explanationId, explanation });
      return explanation;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to evaluate explanation: ${error.message}`, { 
          explanationId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Evaluates an explanation using algorithms.
   * 
   * @private
   * @param {Object} explanation - Explanation to evaluate
   * @param {Array<Object>} observations - Observations for evaluation
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Evaluation result (plausibility, simplicity, coherence, coverage)
   */
  async _evaluateExplanationWithAlgorithms(explanation, observations, context) {
    // Placeholder for actual algorithm implementation
    // Example: Simple heuristic-based evaluation
    if (this.logger) {
      this.logger.warn("Algorithmic explanation evaluation not fully implemented. Using basic heuristics.");
    }
    
    // Simplicity: based on hypothesis length and complexity
    const simplicity = this._evaluateSimplicity(explanation.hypothesis);
    
    // Coverage: check if explanation mentions key terms from observations
    const coverage = this._evaluateCoverage(explanation.hypothesis, observations);
    
    // Plausibility: check against knowledge graph if available
    const plausibility = await this._evaluatePlausibility(explanation.hypothesis);
    
    // Coherence: check internal consistency
    const coherence = this._evaluateCoherence(explanation.hypothesis);
    
    return {
      plausibility,
      simplicity,
      coherence,
      coverage
    };
  }

  /**
   * Evaluates the simplicity of a hypothesis.
   * 
   * @private
   * @param {string} hypothesis - Hypothesis to evaluate
   * @returns {number} - Simplicity score (0-1)
   */
  _evaluateSimplicity(hypothesis) {
    // Simple heuristic: shorter hypotheses are simpler
    const words = hypothesis.split(/\s+/).length;
    const maxWords = 50; // Hypotheses longer than this get minimum simplicity
    
    return Math.max(0, Math.min(1, 1 - (words / maxWords)));
  }

  /**
   * Evaluates the coverage of a hypothesis for observations.
   * 
   * @private
   * @param {string} hypothesis - Hypothesis to evaluate
   * @param {Array<Object>} observations - Observations to cover
   * @returns {number} - Coverage score (0-1)
   */
  _evaluateCoverage(hypothesis, observations) {
    let coveredCount = 0;
    const hypothesisLower = hypothesis.toLowerCase();
    
    for (const observation of observations) {
      // Extract key terms from observation
      const terms = observation.description.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .map(word => word.replace(/[.,;:!?]$/, '')); // Remove trailing punctuation
      
      // Check if any key term is in the hypothesis
      const covered = terms.some(term => hypothesisLower.includes(term));
      if (covered) {
        coveredCount++;
      }
    }
    
    return observations.length > 0 ? coveredCount / observations.length : 0;
  }

  /**
   * Evaluates the plausibility of a hypothesis.
   * 
   * @private
   * @param {string} hypothesis - Hypothesis to evaluate
   * @returns {Promise<number>} - Plausibility score (0-1)
   */
  async _evaluatePlausibility(hypothesis) {
    try {
      // Check against knowledge graph if available
      if (this.knowledgeGraphManager) {
        // Search for related nodes
        const relatedNodes = await this.knowledgeGraphManager.findNodes({
          query: hypothesis,
          limit: 10
        });
        
        // More related nodes suggests higher plausibility
        const plausibility = Math.min(1, relatedNodes.length / 10);
        return plausibility;
      }
      
      // Default plausibility if knowledge graph is not available
      return 0.5;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Plausibility evaluation error: ${error.message}`, { error: error.stack });
      }
      return 0.5; // Default on error
    }
  }

  /**
   * Evaluates the coherence of a hypothesis.
   * 
   * @private
   * @param {string} hypothesis - Hypothesis to evaluate
   * @returns {number} - Coherence score (0-1)
   */
  _evaluateCoherence(hypothesis) {
    // Simple heuristic: check for contradictory terms
    const contradictoryPairs = [
      ['increase', 'decrease'],
      ['more', 'less'],
      ['higher', 'lower'],
      ['larger', 'smaller'],
      ['always', 'never'],
      ['all', 'none']
    ];
    
    const hypothesisLower = hypothesis.toLowerCase();
    
    for (const [term1, term2] of contradictoryPairs) {
      if (hypothesisLower.includes(term1) && hypothesisLower.includes(term2)) {
        return 0.3; // Low coherence due to contradiction
      }
    }
    
    // Default coherence
    return 0.7;
  }

  /**
   * Evaluates an explanation using LLM.
   * 
   * @private
   * @param {Object} explanation - Explanation to evaluate
   * @param {Array<Object>} observations - Observations for evaluation
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Evaluation result (plausibility, simplicity, coherence, coverage)
   */
  async _evaluateExplanationWithLLM(explanation, observations, context) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM explanation evaluation");
      }
      
      // Prepare observations for LLM
      const observationsText = observations.map(o => `- ${o.description}`).join('\n');
      
      // Prepare prompt for LLM
      const prompt = `
        Evaluate the following explanation for the given observations.
        
        Explanation:
        ${explanation.hypothesis}
        
        Observations:
        ${observationsText}
        
        Context:
        ${JSON.stringify(context)}
        
        Evaluate the explanation on the following criteria and provide your assessment in JSON format:
        {
          "plausibility": 0.X, // How plausible is this explanation (0-1)
          "simplicity": 0.X, // How simple is this explanation (0-1)
          "coherence": 0.X, // How coherent is this explanation with existing knowledge (0-1)
          "coverage": 0.X, // How well this explanation covers all observations (0-1)
          "reasoning": "Your reasoning for the scores"
        }
        
        Plausibility: Consider how likely the explanation is to be true based on common knowledge.
        Simplicity: Consider Occam's razor - simpler explanations are preferred.
        Coherence: Consider how well the explanation fits with existing knowledge.
        Coverage: Consider how well the explanation accounts for all observations.
      `;
      
      // Call LLM to evaluate explanation
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for explanation evaluation with multilingual support
        temperature: 0.1, // Low temperature for consistent evaluation
        maxTokens: 1000,
        responseFormat: 'json'
      });
      
      // Parse result
      let plausibility, simplicity, coherence, coverage;
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        plausibility = parsedResult.plausibility || 0.5;
        simplicity = parsedResult.simplicity || 0.5;
        coherence = parsedResult.coherence || 0.5;
        coverage = parsedResult.coverage || 0.5;
        
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM explanation evaluation result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        // Fallback to default values
        plausibility = 0.5;
        simplicity = 0.5;
        coherence = 0.5;
        coverage = 0.5;
      }
      
      return {
        plausibility,
        simplicity,
        coherence,
        coverage
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM explanation evaluation error: ${error.message}`, { 
          explanationId: explanation.id, 
          error: error.stack 
        });
      }
      // Fallback to algorithmic evaluation on LLM failure
      return this._evaluateExplanationWithAlgorithms(explanation, observations, context);
    }
  }

  /**
   * Gets an inference trace by ID.
   * 
   * @param {string} traceId - ID of the trace to retrieve
   * @returns {Promise<Object>} - Inference trace
   */
  async getInferenceTrace(traceId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_getInferenceTrace");
    }

    try {
      // Check if trace exists
      if (!this.inferenceTraces.has(traceId)) {
        throw new Error(`Inference trace not found: ${traceId}`);
      }
      
      // Get trace
      const trace = this.inferenceTraces.get(traceId);
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTraceAccessPolicies) {
        await this.securityManager.applyTraceAccessPolicies(trace);
      }
      
      return trace;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get inference trace: ${error.message}`, { 
          traceId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates an explanation for an inference trace.
   * 
   * @param {string} traceId - ID of the trace to explain
   * @param {Object} [options] - Explanation options
   * @param {string} [options.format='text'] - Explanation format (text, html, json)
   * @param {boolean} [options.detailed=false] - Whether to include detailed steps
   * @param {boolean} [options.useLLM=true] - Whether to use LLM for explanation generation
   * @returns {Promise<Object>} - Explanation
   */
  async explainInference(traceId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_explainInference");
    }

    try {
      const { 
        format = 'text', 
        detailed = false,
        useLLM = this.configService ? 
          this.configService.get('reasoning.abductive.useLLMForExplanation', true) : true
      } = options;
      
      // Get trace
      const trace = await this.getInferenceTrace(traceId);
      
      // Generate explanation
      let explanation;
      
      if (useLLM && this.modelStrategyManager) {
        explanation = await this._generateExplanationWithLLM(trace, format, detailed);
      } else {
        explanation = this._generateBasicExplanation(trace, format, detailed);
      }
      
      if (this.logger) {
        this.logger.debug(`Generated explanation for trace: ${traceId}`, { 
          format,
          detailed,
          useLLM
        });
      }
      
      return explanation;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to explain inference: ${error.message}`, { 
          traceId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates a basic explanation for an inference trace.
   * 
   * @private
   * @param {Object} trace - Inference trace
   * @param {string} format - Explanation format
   * @param {boolean} detailed - Whether to include detailed steps
   * @returns {Object} - Explanation
   */
  _generateBasicExplanation(trace, format, detailed) {
    try {
      // Get observations
      const observations = trace.observationIds.map(id => 
        this.observations.has(id) ? this.observations.get(id) : null
      ).filter(o => o);
      
      // Get best explanation
      const bestExplanation = trace.bestExplanationId && this.explanations.has(trace.bestExplanationId) ?
        this.explanations.get(trace.bestExplanationId) : null;
      
      // Basic explanation components
      const components = {
        summary: `Abductive reasoning performed for ${observations.length} observations`,
        observationsText: observations.map(o => o.description).join(', '),
        explanationCount: `Generated ${trace.explanationsGenerated.length} explanations, evaluated ${trace.explanationsEvaluated.length}`,
        bestExplanation: bestExplanation ? 
          `Best explanation: ${bestExplanation.hypothesis} (Score: ${bestExplanation.overallScore.toFixed(2)})` : 
          'No viable explanation found'
      };
      
      // Generate explanation based on format
      let content;
      
      switch (format.toLowerCase()) {
        case 'html':
          content = `
            <div class="reasoning-explanation">
              <h3>Abductive Reasoning Explanation</h3>
              <p>${components.summary}</p>
              <p><strong>Observations:</strong> ${components.observationsText}</p>
              <p>${components.explanationCount}</p>
              <h4>Best Explanation</h4>
              <p>${components.bestExplanation}</p>
              ${detailed ? this._generateDetailedHtml(trace) : ''}
            </div>
          `;
          break;
          
        case 'json':
          content = {
            summary: components.summary,
            observations: observations.map(o => ({
              id: o.id,
              description: o.description
            })),
            explanationCount: {
              generated: trace.explanationsGenerated.length,
              evaluated: trace.explanationsEvaluated.length
            },
            bestExplanation: bestExplanation ? {
              id: bestExplanation.id,
              hypothesis: bestExplanation.hypothesis,
              overallScore: bestExplanation.overallScore,
              plausibility: bestExplanation.plausibility,
              simplicity: bestExplanation.simplicity,
              coherence: bestExplanation.coherence,
              coverage: bestExplanation.coverage
            } : null,
            executionTime: trace.endTime - trace.startTime,
            details: detailed ? this._generateDetailedJson(trace) : undefined
          };
          break;
          
        case 'text':
        default:
          content = [
            components.summary,
            `Observations: ${components.observationsText}`,
            components.explanationCount,
            '',
            'Best Explanation:',
            components.bestExplanation,
            '',
            detailed ? this._generateDetailedText(trace) : ''
          ].join('\n');
          break;
      }
      
      return {
        format,
        content,
        traceId: trace.id
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Basic explanation generation error: ${error.message}`, { 
          traceId: trace.id, 
          error: error.stack 
        });
      }
      
      return {
        format: 'text',
        content: `Error generating explanation: ${error.message}`,
        traceId: trace.id
      };
    }
  }

  /**
   * Generates detailed explanation text.
   * 
   * @private
   * @param {Object} trace - Inference trace
   * @returns {string} - Detailed explanation text
   */
  _generateDetailedText(trace) {
    try {
      const lines = ['Detailed Explanations:'];
      
      // Add evaluated explanations
      for (const explanationId of trace.explanationsEvaluated) {
        const explanation = this.explanations.get(explanationId);
        if (explanation) {
          lines.push(`- Explanation: ${explanation.hypothesis} (${explanationId})`);
          lines.push(`  Title: ${explanation.title}`);
          lines.push(`  Overall Score: ${explanation.overallScore.toFixed(2)}`);
          lines.push(`  Plausibility: ${explanation.plausibility.toFixed(2)}`);
          lines.push(`  Simplicity: ${explanation.simplicity.toFixed(2)}`);
          lines.push(`  Coherence: ${explanation.coherence.toFixed(2)}`);
          lines.push(`  Coverage: ${explanation.coverage.toFixed(2)}`);
          lines.push('');
        }
      }
      
      return lines.join('\n');
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Detailed text generation error: ${error.message}`, { 
          traceId: trace.id, 
          error: error.stack 
        });
      }
      return 'Error generating detailed explanation.';
    }
  }

  /**
   * Generates detailed explanation HTML.
   * 
   * @private
   * @param {Object} trace - Inference trace
   * @returns {string} - Detailed explanation HTML
   */
  _generateDetailedHtml(trace) {
    try {
      let html = '<div class="detailed-explanations">';
      
      // Add evaluated explanations
      html += '<h4>All Explanations</h4>';
      html += '<ul>';
      for (const explanationId of trace.explanationsEvaluated) {
        const explanation = this.explanations.get(explanationId);
        if (explanation) {
          html += `<li>
            <strong>${explanation.title}</strong> (${explanationId})<br>
            <em>${explanation.hypothesis}</em><br>
            Overall Score: ${explanation.overallScore.toFixed(2)}<br>
            Plausibility: ${explanation.plausibility.toFixed(2)}, 
            Simplicity: ${explanation.simplicity.toFixed(2)}, 
            Coherence: ${explanation.coherence.toFixed(2)}, 
            Coverage: ${explanation.coverage.toFixed(2)}
          </li>`;
        }
      }
      html += '</ul>';
      
      html += '</div>';
      return html;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Detailed HTML generation error: ${error.message}`, { 
          traceId: trace.id, 
          error: error.stack 
        });
      }
      return '<p>Error generating detailed explanation.</p>';
    }
  }

  /**
   * Generates detailed explanation JSON.
   * 
   * @private
   * @param {Object} trace - Inference trace
   * @returns {Object} - Detailed explanation JSON
   */
  _generateDetailedJson(trace) {
    try {
      const explanations = [];
      
      // Add evaluated explanations
      for (const explanationId of trace.explanationsEvaluated) {
        const explanation = this.explanations.get(explanationId);
        if (explanation) {
          explanations.push({
            id: explanation.id,
            title: explanation.title,
            hypothesis: explanation.hypothesis,
            overallScore: explanation.overallScore,
            plausibility: explanation.plausibility,
            simplicity: explanation.simplicity,
            coherence: explanation.coherence,
            coverage: explanation.coverage
          });
        }
      }
      
      return {
        explanations
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Detailed JSON generation error: ${error.message}`, { 
          traceId: trace.id, 
          error: error.stack 
        });
      }
      return { error: 'Error generating detailed explanation.' };
    }
  }

  /**
   * Generates an explanation using LLM.
   * 
   * @private
   * @param {Object} trace - Inference trace
   * @param {string} format - Explanation format
   * @param {boolean} detailed - Whether to include detailed steps
   * @returns {Promise<Object>} - Explanation
   */
  async _generateExplanationWithLLM(trace, format, detailed) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM explanation generation");
      }
      
      // Get observations
      const observations = trace.observationIds.map(id => 
        this.observations.has(id) ? this.observations.get(id) : null
      ).filter(o => o);
      
      // Get best explanation
      const bestExplanation = trace.bestExplanationId && this.explanations.has(trace.bestExplanationId) ?
        this.explanations.get(trace.bestExplanationId) : null;
      
      // Prepare trace data for LLM
      const traceData = {
        observations: observations.map(o => o.description),
        explanationCount: {
          generated: trace.explanationsGenerated.length,
          evaluated: trace.explanationsEvaluated.length
        },
        bestExplanation: bestExplanation ? {
          hypothesis: bestExplanation.hypothesis,
          overallScore: bestExplanation.overallScore,
          plausibility: bestExplanation.plausibility,
          simplicity: bestExplanation.simplicity,
          coherence: bestExplanation.coherence,
          coverage: bestExplanation.coverage
        } : null,
        executionTime: trace.endTime - trace.startTime
      };
      
      // Add detailed data if requested
      if (detailed) {
        traceData.allExplanations = trace.explanationsEvaluated
          .map(id => this.explanations.get(id))
          .filter(e => e)
          .map(e => ({
            hypothesis: e.hypothesis,
            overallScore: e.overallScore,
            plausibility: e.plausibility,
            simplicity: e.simplicity,
            coherence: e.coherence,
            coverage: e.coverage
          }));
      }
      
      // Prepare prompt for LLM
      const prompt = `
        Generate a clear explanation of the following abductive reasoning process.
        
        Reasoning Trace:
        ${JSON.stringify(traceData, null, 2)}
        
        ${detailed ? 'Include detailed explanations of all considered explanations and their evaluation.' : 'Provide a concise summary of the reasoning process.'}
        
        Generate the explanation in ${format} format.
        ${format === 'json' ? 'Ensure the output is valid JSON.' : ''}
        ${format === 'html' ? 'Ensure the output is valid HTML with appropriate formatting.' : ''}
        
        Focus on explaining:
        1. The observations that needed explanation
        2. The process of generating and evaluating explanations
        3. The best explanation and why it was selected
        4. The criteria used for evaluation (plausibility, simplicity, coherence, coverage)
        5. Any limitations or uncertainties in the reasoning process
      `;
      
      // Call LLM to generate explanation
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for complex explanation with multilingual support
        temperature: 0.2,
        maxTokens: detailed ? 2000 : 1000,
        responseFormat: format === 'json' ? 'json' : 'text'
      });
      
      // Process result based on format
      let content;
      
      if (format === 'json') {
        try {
          content = typeof llmResult === 'string' ? 
            JSON.parse(llmResult) : llmResult;
        } catch (parseError) {
          if (this.logger) {
            this.logger.error(`Failed to parse LLM JSON explanation: ${parseError.message}`, { 
              result: llmResult, 
              error: parseError.stack 
            });
          }
          content = { explanation: llmResult };
        }
      } else {
        content = llmResult;
      }
      
      return {
        format,
        content,
        traceId: trace.id,
        generatedByLLM: true
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM explanation generation error: ${error.message}`, { 
          traceId: trace.id, 
          error: error.stack 
        });
      }
      
      // Fallback to basic explanation
      return this._generateBasicExplanation(trace, format, detailed);
    }
  }

  /**
   * Gets statistics about the abductive reasoner.
   * 
   * @returns {Promise<Object>} - Reasoner statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_getStatistics");
    }

    try {
      // Count explanations by source
      const explanationsBySource = {};
      for (const explanation of this.explanations.values()) {
        const source = explanation.source || 'unknown';
        explanationsBySource[source] = (explanationsBySource[source] || 0) + 1;
      }
      
      // Count observations by source
      const observationsBySource = {};
      for (const observation of this.observations.values()) {
        const source = observation.source || 'unknown';
        observationsBySource[source] = (observationsBySource[source] || 0) + 1;
      }
      
      // Calculate average scores
      let totalPlausibility = 0;
      let totalSimplicity = 0;
      let totalCoherence = 0;
      let totalCoverage = 0;
      let totalOverallScore = 0;
      
      for (const explanation of this.explanations.values()) {
        totalPlausibility += explanation.plausibility;
        totalSimplicity += explanation.simplicity;
        totalCoherence += explanation.coherence;
        totalCoverage += explanation.coverage;
        totalOverallScore += explanation.overallScore;
      }
      
      const explanationCount = this.explanations.size;
      const avgPlausibility = explanationCount > 0 ? totalPlausibility / explanationCount : 0;
      const avgSimplicity = explanationCount > 0 ? totalSimplicity / explanationCount : 0;
      const avgCoherence = explanationCount > 0 ? totalCoherence / explanationCount : 0;
      const avgCoverage = explanationCount > 0 ? totalCoverage / explanationCount : 0;
      const avgOverallScore = explanationCount > 0 ? totalOverallScore / explanationCount : 0;
      
      // Compile statistics
      const statistics = {
        explanationCount,
        observationCount: this.observations.size,
        traceCount: this.inferenceTraces.size,
        explanationsBySource,
        observationsBySource,
        averageScores: {
          plausibility: avgPlausibility,
          simplicity: avgSimplicity,
          coherence: avgCoherence,
          coverage: avgCoverage,
          overallScore: avgOverallScore
        },
        configuration: {
          maxExplanations: this.maxExplanations,
          minPlausibilityThreshold: this.minPlausibilityThreshold,
          useLLMForExplanationGeneration: this.useLLMForExplanationGeneration,
          useLLMForExplanationEvaluation: this.useLLMForExplanationEvaluation
        }
      };
      
      return statistics;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get statistics: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Clears the explanations and observations.
   * 
   * @param {Object} [options] - Clear options
   * @param {boolean} [options.clearExplanations=true] - Whether to clear explanations
   * @param {boolean} [options.clearObservations=false] - Whether to clear observations
   * @param {boolean} [options.clearTraces=false] - Whether to clear inference traces
   * @param {string} [options.source] - Only clear items from this source
   * @returns {Promise<Object>} - Clear result
   */
  async clear(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("abductiveReasoner_clear");
    }

    try {
      const { 
        clearExplanations = true, 
        clearObservations = false,
        clearTraces = false,
        source
      } = options;
      
      let explanationsCleared = 0;
      let observationsCleared = 0;
      let tracesCleared = 0;
      
      // Clear explanations if requested
      if (clearExplanations) {
        if (source) {
          // Clear explanations from specific source
          for (const [explanationId, explanation] of this.explanations.entries()) {
            if (explanation.source === source) {
              this.explanations.delete(explanationId);
              explanationsCleared++;
            }
          }
        } else {
          // Clear all explanations
          explanationsCleared = this.explanations.size;
          this.explanations.clear();
        }
      }
      
      // Clear observations if requested
      if (clearObservations) {
        if (source) {
          // Clear observations from specific source
          for (const [observationId, observation] of this.observations.entries()) {
            if (observation.source === source) {
              this.observations.delete(observationId);
              observationsCleared++;
            }
          }
        } else {
          // Clear all observations
          observationsCleared = this.observations.size;
          this.observations.clear();
        }
      }
      
      // Clear traces if requested
      if (clearTraces) {
        tracesCleared = this.inferenceTraces.size;
        this.inferenceTraces.clear();
      }
      
      if (this.logger) {
        this.logger.debug(`Cleared reasoner memory`, { 
          explanationsCleared,
          observationsCleared,
          tracesCleared,
          source
        });
      }
      
      return {
        explanationsCleared,
        observationsCleared,
        tracesCleared
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to clear memory: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = { AbductiveReasoner };
