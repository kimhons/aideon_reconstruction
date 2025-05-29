/**
 * @fileoverview UncertaintyHandler for the Aideon AI Desktop Agent's Reasoning Engine.
 * Manages probabilistic knowledge, confidence scores, Bayesian networks, and belief revision.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * UncertaintyHandler for the Aideon AI Desktop Agent's Reasoning Engine.
 * Manages probabilistic knowledge, confidence scores, Bayesian networks, and belief revision.
 * 
 * @extends EventEmitter
 */
class UncertaintyHandler extends EventEmitter {
  /**
   * Creates a new UncertaintyHandler instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.knowledgeGraphManager - Knowledge Graph Manager instance
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.modelStrategyManager] - Model Strategy Manager for LLM integration
   */
  constructor(options) {
    super();
    
    if (!options) {
      throw new Error("UncertaintyHandler requires options");
    }
    
    if (!options.logger) {
      throw new Error("UncertaintyHandler requires a logger instance");
    }
    
    if (!options.configService) {
      throw new Error("UncertaintyHandler requires a configService instance");
    }
    
    if (!options.performanceMonitor) {
      throw new Error("UncertaintyHandler requires a performanceMonitor instance");
    }
    
    if (!options.knowledgeGraphManager) {
      throw new Error("UncertaintyHandler requires a knowledgeGraphManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.securityManager = options.securityManager;
    this.modelStrategyManager = options.modelStrategyManager;
    
    // Uncertainty management components
    this.confidenceScores = new Map(); // Map of entityId/statementId -> confidence score
    this.bayesianNetworks = new Map(); // Map of domainId -> bayesian network
    this.evidenceStore = new Map(); // Map of evidenceId -> evidence
    this.beliefSets = new Map(); // Map of contextId -> belief set
    
    // Configuration
    this.defaultConfidenceThreshold = this.configService.get('reasoning.uncertainty.defaultConfidenceThreshold', 0.7);
    this.useBayesianNetworks = this.configService.get('reasoning.uncertainty.useBayesianNetworks', true);
    this.useDempsterShafer = this.configService.get('reasoning.uncertainty.useDempsterShafer', true);
    this.useLLMForUncertainty = this.configService.get('reasoning.uncertainty.useLLMForUncertainty', true);
    this.maxEvidenceAge = this.configService.get('reasoning.uncertainty.maxEvidenceAge', 7 * 24 * 60 * 60 * 1000); // 7 days in ms
    
    this.initialized = false;
  }

  /**
   * Initializes the UncertaintyHandler.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.logger.debug("Initializing UncertaintyHandler");

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_initialize");
    }

    try {
      // Load confidence scores from knowledge graph if available
      await this._loadConfidenceScores();
      
      // Initialize Bayesian networks for common domains
      if (this.useBayesianNetworks) {
        await this._initializeBayesianNetworks();
      }
      
      this.initialized = true;

      this.logger.info("UncertaintyHandler initialized successfully", {
        confidenceScoresCount: this.confidenceScores.size,
        bayesianNetworksCount: this.bayesianNetworks.size
      });

      this.emit("initialized");
    } catch (error) {
      this.logger.error("UncertaintyHandler initialization failed", { error: error.message, stack: error.stack });
      throw new Error(`UncertaintyHandler initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Loads confidence scores from the knowledge graph.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfidenceScores() {
    try {
      // Query knowledge graph for nodes with confidence scores
      const nodes = await this.knowledgeGraphManager.findNodes({
        properties: {
          hasConfidenceScore: true
        }
      });
      
      for (const node of nodes) {
        if (node.properties && node.properties.confidenceScore !== undefined) {
          this.confidenceScores.set(node.id, {
            value: node.properties.confidenceScore,
            source: 'knowledge_graph',
            timestamp: Date.now()
          });
        }
      }
      
      this.logger.debug(`Loaded ${this.confidenceScores.size} confidence scores from knowledge graph`);
    } catch (error) {
      this.logger.error(`Failed to load confidence scores: ${error.message}`, { error: error.stack });
      // Continue initialization even if loading fails
    }
  }

  /**
   * Initializes Bayesian networks for common domains.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _initializeBayesianNetworks() {
    try {
      // Get common domains from configuration
      const commonDomains = this.configService.get('reasoning.uncertainty.commonDomains', []);
      
      for (const domain of commonDomains) {
        await this.buildBayesianNetwork(domain.id, domain.variables, domain.relationships);
      }
      
      this.logger.debug(`Initialized ${this.bayesianNetworks.size} Bayesian networks for common domains`);
    } catch (error) {
      this.logger.error(`Failed to initialize Bayesian networks: ${error.message}`, { error: error.stack });
      // Continue initialization even if loading fails
    }
  }

  /**
   * Ensures the handler is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the handler is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("UncertaintyHandler is not initialized. Call initialize() first.");
    }
  }

  /**
   * Calculates confidence score based on provided evidence.
   * 
   * @param {Array<Object>} evidence - Evidence to consider
   * @param {Object} context - Context information
   * @returns {Promise<number>} - Confidence score (0-1)
   */
  async calculateConfidence(evidence, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_calculateConfidence");
    }

    try {
      // Validate evidence
      if (!Array.isArray(evidence) || evidence.length === 0) {
        return 0;
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyEvidenceAccessPolicies) {
        evidence = await this.securityManager.applyEvidenceAccessPolicies(evidence, context);
      }
      
      // Store evidence for future reference
      for (const item of evidence) {
        if (item.id) {
          this.evidenceStore.set(item.id, {
            ...item,
            timestamp: Date.now()
          });
        }
      }
      
      let confidenceScore;
      
      // Check if we should use LLM for uncertainty estimation
      if (this.useLLMForUncertainty && this.modelStrategyManager && 
          context.complexScenario && evidence.length > 5) {
        confidenceScore = await this._calculateConfidenceWithLLM(evidence, context);
      } else if (this.useDempsterShafer && evidence.length > 1) {
        // Use Dempster-Shafer for multiple pieces of evidence
        confidenceScore = this._calculateConfidenceWithDempsterShafer(evidence);
      } else {
        // Use weighted average for simple cases
        confidenceScore = this._calculateConfidenceWithWeightedAverage(evidence);
      }
      
      // Normalize and return
      return Math.min(1, Math.max(0, confidenceScore));
    } catch (error) {
      this.logger.error(`Failed to calculate confidence: ${error.message}`, { error: error.stack });
      // Return default confidence in case of error
      return 0.5;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Calculates confidence score using weighted average.
   * 
   * @private
   * @param {Array<Object>} evidence - Evidence to consider
   * @returns {number} - Confidence score (0-1)
   */
  _calculateConfidenceWithWeightedAverage(evidence) {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const item of evidence) {
      const confidence = item.confidence !== undefined ? item.confidence : 0.5;
      const weight = item.weight !== undefined ? item.weight : 1;
      
      weightedSum += confidence * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Calculates confidence score using Dempster-Shafer theory.
   * 
   * @private
   * @param {Array<Object>} evidence - Evidence to consider
   * @returns {number} - Confidence score (0-1)
   */
  _calculateConfidenceWithDempsterShafer(evidence) {
    // Initialize belief masses
    // In Dempster-Shafer theory, we assign belief masses to:
    // - Belief in proposition (true)
    // - Belief in negation (false)
    // - Uncertainty (don't know)
    
    let combinedMass = {
      true: 0,
      false: 0,
      uncertain: 1 // Start with full uncertainty
    };
    
    // Combine evidence using Dempster's rule of combination
    for (const item of evidence) {
      const confidence = item.confidence !== undefined ? item.confidence : 0.5;
      const reliability = item.reliability !== undefined ? item.reliability : 0.8;
      
      // Convert confidence to mass functions
      // Higher confidence means more mass assigned to "true"
      // Lower confidence means more mass assigned to "false"
      // Reliability affects how much mass is assigned to "uncertain"
      const mass = {
        true: confidence * reliability,
        false: (1 - confidence) * reliability,
        uncertain: 1 - reliability
      };
      
      // Apply Dempster's rule of combination
      combinedMass = this._dempsterCombination(combinedMass, mass);
    }
    
    // Calculate belief in proposition (true)
    // In Dempster-Shafer, belief is the sum of all masses that support the proposition
    const belief = combinedMass.true;
    
    // Calculate plausibility (upper bound of probability)
    // Plausibility = 1 - belief in negation
    const plausibility = 1 - combinedMass.false;
    
    // Return the average of belief and plausibility as the confidence score
    return (belief + plausibility) / 2;
  }

  /**
   * Combines two mass functions using Dempster's rule of combination.
   * 
   * @private
   * @param {Object} mass1 - First mass function
   * @param {Object} mass2 - Second mass function
   * @returns {Object} - Combined mass function
   */
  _dempsterCombination(mass1, mass2) {
    // Calculate normalization factor (1 - K), where K is the conflict
    const conflict = mass1.true * mass2.false + mass1.false * mass2.true;
    const normalizationFactor = 1 - conflict;
    
    // If conflict is complete (K = 1), return equal distribution
    if (normalizationFactor === 0) {
      return {
        true: 0.5,
        false: 0.5,
        uncertain: 0
      };
    }
    
    // Calculate combined masses
    const combinedMass = {
      true: (mass1.true * mass2.true + mass1.true * mass2.uncertain + mass1.uncertain * mass2.true) / normalizationFactor,
      false: (mass1.false * mass2.false + mass1.false * mass2.uncertain + mass1.uncertain * mass2.false) / normalizationFactor,
      uncertain: (mass1.uncertain * mass2.uncertain) / normalizationFactor
    };
    
    return combinedMass;
  }

  /**
   * Calculates confidence score using LLM.
   * 
   * @private
   * @param {Array<Object>} evidence - Evidence to consider
   * @param {Object} context - Context information
   * @returns {Promise<number>} - Confidence score (0-1)
   */
  async _calculateConfidenceWithLLM(evidence, context) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM confidence calculation");
      }
      
      // Prepare evidence for LLM
      const evidenceText = evidence.map(item => {
        return `- ${item.description || 'Evidence'} (Confidence: ${item.confidence !== undefined ? item.confidence : 'unknown'}, Weight: ${item.weight !== undefined ? item.weight : '1'})`;
      }).join('\n');
      
      // Prepare context for LLM
      const contextText = Object.entries(context).map(([key, value]) => {
        return `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
      }).join('\n');
      
      // Prepare prompt for LLM
      const prompt = `
        Analyze the following evidence and context to determine a confidence score (0-1) for the proposition.
        
        Evidence:
        ${evidenceText}
        
        Context:
        ${contextText}
        
        Consider the reliability, relevance, and consistency of the evidence.
        Evaluate potential contradictions and supporting relationships between evidence items.
        Provide a confidence score between 0 (completely uncertain) and 1 (completely certain).
        
        Return only a single number representing the confidence score.
      `;
      
      // Call LLM to calculate confidence
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for uncertainty estimation with multilingual support
        temperature: 0.1,
        maxTokens: 50
      });
      
      // Extract confidence score from result
      const confidenceScore = this._extractConfidenceFromLLMResult(llmResult);
      
      return confidenceScore;
    } catch (error) {
      this.logger.error(`LLM confidence calculation error: ${error.message}`, { error: error.stack });
      // Fallback to weighted average on LLM failure
      return this._calculateConfidenceWithWeightedAverage(evidence);
    }
  }

  /**
   * Extracts confidence score from LLM result.
   * 
   * @private
   * @param {string} llmResult - Result from LLM
   * @returns {number} - Confidence score (0-1)
   */
  _extractConfidenceFromLLMResult(llmResult) {
    try {
      // Try to extract a number from the result
      const matches = llmResult.match(/(\d+(\.\d+)?)/);
      if (matches && matches.length > 1) {
        const score = parseFloat(matches[1]);
        
        // Normalize to 0-1 range
        if (score >= 0 && score <= 1) {
          return score;
        } else if (score > 1 && score <= 10) {
          // Handle 0-10 scale
          return score / 10;
        } else if (score > 10 && score <= 100) {
          // Handle percentage
          return score / 100;
        }
      }
      
      // If no valid number found, return default
      return 0.5;
    } catch (error) {
      this.logger.error(`Failed to extract confidence from LLM result: ${error.message}`, { 
        result: llmResult, 
        error: error.stack 
      });
      return 0.5;
    }
  }

  /**
   * Updates beliefs based on new evidence.
   * 
   * @param {Array<Object>} newEvidence - New evidence to consider
   * @param {Object} existingBeliefs - Existing beliefs to update
   * @param {string} [contextId] - Context identifier for belief set
   * @returns {Promise<Object>} - Updated beliefs
   */
  async updateBeliefs(newEvidence, existingBeliefs, contextId = null) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_updateBeliefs");
    }

    try {
      // Validate inputs
      if (!Array.isArray(newEvidence) || !existingBeliefs || typeof existingBeliefs !== 'object') {
        throw new Error("Invalid inputs for belief update");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyBeliefUpdatePolicies) {
        newEvidence = await this.securityManager.applyBeliefUpdatePolicies(newEvidence, existingBeliefs);
      }
      
      // Create a copy of existing beliefs to update
      const updatedBeliefs = { ...existingBeliefs };
      
      // Process each piece of new evidence
      for (const evidence of newEvidence) {
        if (!evidence.proposition || evidence.proposition.trim() === '') {
          continue;
        }
        
        const proposition = evidence.proposition;
        const confidence = evidence.confidence !== undefined ? evidence.confidence : 0.5;
        const impact = evidence.impact !== undefined ? evidence.impact : 1;
        
        // Check if proposition exists in beliefs
        if (updatedBeliefs[proposition] !== undefined) {
          // Update existing belief using belief revision formula
          updatedBeliefs[proposition] = this._reviseBeliefConfidence(
            updatedBeliefs[proposition],
            confidence,
            impact
          );
        } else {
          // Add new belief
          updatedBeliefs[proposition] = confidence;
        }
      }
      
      // Store updated beliefs if contextId is provided
      if (contextId) {
        this.beliefSets.set(contextId, {
          beliefs: updatedBeliefs,
          lastUpdated: Date.now()
        });
      }
      
      return updatedBeliefs;
    } catch (error) {
      this.logger.error(`Failed to update beliefs: ${error.message}`, { error: error.stack });
      // Return original beliefs in case of error
      return existingBeliefs;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Revises belief confidence based on new evidence.
   * 
   * @private
   * @param {number} existingConfidence - Existing confidence in belief
   * @param {number} newConfidence - Confidence from new evidence
   * @param {number} impact - Impact factor of new evidence (0-1)
   * @returns {number} - Revised confidence
   */
  _reviseBeliefConfidence(existingConfidence, newConfidence, impact) {
    // Normalize impact to 0-1 range
    const normalizedImpact = Math.min(1, Math.max(0, impact));
    
    // Calculate weighted average based on impact
    const revisedConfidence = (existingConfidence * (1 - normalizedImpact)) + (newConfidence * normalizedImpact);
    
    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, revisedConfidence));
  }

  /**
   * Builds a Bayesian network for a specific domain.
   * 
   * @param {string} domainId - Domain identifier
   * @param {Array<Object>} variables - Variables in the network
   * @param {Array<Object>} relationships - Relationships between variables
   * @returns {Promise<Object>} - Bayesian network
   */
  async buildBayesianNetwork(domainId, variables, relationships) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_buildBayesianNetwork");
    }

    try {
      // Validate inputs
      if (!domainId || !Array.isArray(variables) || !Array.isArray(relationships)) {
        throw new Error("Invalid inputs for Bayesian network construction");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyBayesianNetworkPolicies) {
        variables = await this.securityManager.applyBayesianNetworkPolicies(variables, relationships);
      }
      
      // Create network structure
      const network = {
        id: domainId,
        variables: new Map(),
        edges: [],
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };
      
      // Add variables to network
      for (const variable of variables) {
        if (!variable.id || !variable.states || !Array.isArray(variable.states)) {
          continue;
        }
        
        network.variables.set(variable.id, {
          id: variable.id,
          name: variable.name || variable.id,
          states: variable.states,
          cpt: variable.cpt || this._generateDefaultCPT(variable.states)
        });
      }
      
      // Add relationships (edges) to network
      for (const relationship of relationships) {
        if (!relationship.from || !relationship.to) {
          continue;
        }
        
        // Verify that both variables exist
        if (!network.variables.has(relationship.from) || !network.variables.has(relationship.to)) {
          continue;
        }
        
        network.edges.push({
          from: relationship.from,
          to: relationship.to,
          strength: relationship.strength !== undefined ? relationship.strength : 1
        });
        
        // Update conditional probability table for child node
        await this._updateCPT(network, relationship.to);
      }
      
      // Store network
      this.bayesianNetworks.set(domainId, network);
      
      this.logger.debug(`Built Bayesian network for domain: ${domainId}`, {
        variableCount: network.variables.size,
        edgeCount: network.edges.length
      });
      
      return network;
    } catch (error) {
      this.logger.error(`Failed to build Bayesian network: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates a default conditional probability table for a variable.
   * 
   * @private
   * @param {Array<string>} states - Possible states of the variable
   * @returns {Object} - Default CPT
   */
  _generateDefaultCPT(states) {
    // For variables with no parents, generate uniform distribution
    const probability = 1 / states.length;
    const cpt = {};
    
    for (const state of states) {
      cpt[state] = probability;
    }
    
    return cpt;
  }

  /**
   * Updates the conditional probability table for a variable.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {string} variableId - Variable identifier
   * @returns {Promise<void>}
   */
  async _updateCPT(network, variableId) {
    try {
      // Get variable
      const variable = network.variables.get(variableId);
      if (!variable) {
        return;
      }
      
      // Find parent variables
      const parents = network.edges
        .filter(edge => edge.to === variableId)
        .map(edge => edge.from);
      
      // If no parents, keep default CPT
      if (parents.length === 0) {
        return;
      }
      
      // Get parent variables
      const parentVariables = parents.map(parentId => network.variables.get(parentId));
      
      // Generate CPT based on parent configurations
      const cpt = {};
      
      // Generate all possible parent configurations
      const parentConfigurations = this._generateParentConfigurations(parentVariables);
      
      // For each parent configuration, assign probabilities to child states
      for (const config of parentConfigurations) {
        const configKey = this._configurationToKey(config);
        
        // Initialize probabilities for this configuration
        cpt[configKey] = {};
        
        // Assign probabilities to child states
        // For now, use a simple heuristic; in a real system, these would be learned or specified
        let remainingProbability = 1;
        
        for (let i = 0; i < variable.states.length; i++) {
          const state = variable.states[i];
          
          // Last state gets remaining probability
          if (i === variable.states.length - 1) {
            cpt[configKey][state] = remainingProbability;
          } else {
            // Distribute probability among states
            const probability = remainingProbability / (variable.states.length - i);
            cpt[configKey][state] = probability;
            remainingProbability -= probability;
          }
        }
      }
      
      // Update variable's CPT
      variable.cpt = cpt;
      
      // Update network's last updated timestamp
      network.lastUpdated = Date.now();
    } catch (error) {
      this.logger.error(`Failed to update CPT: ${error.message}`, { error: error.stack });
      // Continue without updating CPT
    }
  }

  /**
   * Generates all possible parent configurations.
   * 
   * @private
   * @param {Array<Object>} parentVariables - Parent variables
   * @returns {Array<Object>} - All possible parent configurations
   */
  _generateParentConfigurations(parentVariables) {
    // Base case: no parents
    if (parentVariables.length === 0) {
      return [{}];
    }
    
    // Base case: one parent
    if (parentVariables.length === 1) {
      const parent = parentVariables[0];
      return parent.states.map(state => ({ [parent.id]: state }));
    }
    
    // Recursive case: multiple parents
    const firstParent = parentVariables[0];
    const restParents = parentVariables.slice(1);
    
    // Generate configurations for rest of parents
    const restConfigurations = this._generateParentConfigurations(restParents);
    
    // Combine with first parent's states
    const configurations = [];
    
    for (const state of firstParent.states) {
      for (const restConfig of restConfigurations) {
        configurations.push({
          [firstParent.id]: state,
          ...restConfig
        });
      }
    }
    
    return configurations;
  }

  /**
   * Converts a parent configuration to a string key.
   * 
   * @private
   * @param {Object} configuration - Parent configuration
   * @returns {string} - Configuration key
   */
  _configurationToKey(configuration) {
    return Object.entries(configuration)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }

  /**
   * Performs inference on a Bayesian network.
   * 
   * @param {string} domainId - Domain identifier
   * @param {Object} evidence - Observed evidence (variable assignments)
   * @param {Array<string>} queryVariables - Variables to query
   * @returns {Promise<Object>} - Inference results
   */
  async performBayesianInference(domainId, evidence, queryVariables) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_performBayesianInference");
    }

    try {
      // Check if network exists
      if (!this.bayesianNetworks.has(domainId)) {
        throw new Error(`Bayesian network not found for domain: ${domainId}`);
      }
      
      // Get network
      const network = this.bayesianNetworks.get(domainId);
      
      // Validate evidence and query variables
      if (!evidence || typeof evidence !== 'object') {
        throw new Error("Invalid evidence for Bayesian inference");
      }
      
      if (!Array.isArray(queryVariables) || queryVariables.length === 0) {
        throw new Error("Invalid query variables for Bayesian inference");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyInferencePolicies) {
        evidence = await this.securityManager.applyInferencePolicies(evidence, queryVariables);
      }
      
      // Perform inference
      // For small networks, use exact inference (variable elimination)
      // For larger networks, use approximate inference (likelihood weighting)
      const results = {};
      
      if (network.variables.size <= 10) {
        // Use exact inference for small networks
        for (const variable of queryVariables) {
          results[variable] = await this._exactInference(network, variable, evidence);
        }
      } else {
        // Use approximate inference for larger networks
        const samples = await this._likelihoodWeighting(network, evidence, queryVariables, 1000);
        
        for (const variable of queryVariables) {
          results[variable] = this._calculatePosteriorFromSamples(samples, variable);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to perform Bayesian inference: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Performs exact inference using variable elimination.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {string} queryVariable - Variable to query
   * @param {Object} evidence - Observed evidence
   * @returns {Promise<Object>} - Posterior distribution
   */
  async _exactInference(network, queryVariable, evidence) {
    try {
      // Check if query variable exists
      if (!network.variables.has(queryVariable)) {
        throw new Error(`Query variable not found: ${queryVariable}`);
      }
      
      // Get query variable
      const variable = network.variables.get(queryVariable);
      
      // If query variable is observed, return the observed value with probability 1
      if (evidence[queryVariable] !== undefined) {
        const result = {};
        for (const state of variable.states) {
          result[state] = state === evidence[queryVariable] ? 1 : 0;
        }
        return result;
      }
      
      // Identify variables to eliminate
      const variablesToEliminate = Array.from(network.variables.keys())
        .filter(id => id !== queryVariable && evidence[id] === undefined);
      
      // Create factors from CPTs
      let factors = this._createFactorsFromCPTs(network, evidence);
      
      // Eliminate variables one by one
      for (const varToEliminate of variablesToEliminate) {
        factors = this._eliminateVariable(factors, varToEliminate);
      }
      
      // Multiply remaining factors
      let resultFactor = factors[0];
      for (let i = 1; i < factors.length; i++) {
        resultFactor = this._multiplyFactors(resultFactor, factors[i]);
      }
      
      // Normalize to get posterior distribution
      const posterior = {};
      let sum = 0;
      
      for (const state of variable.states) {
        const assignment = { [queryVariable]: state };
        const probability = this._evaluateFactor(resultFactor, assignment);
        posterior[state] = probability;
        sum += probability;
      }
      
      // Normalize
      for (const state in posterior) {
        posterior[state] /= sum;
      }
      
      return posterior;
    } catch (error) {
      this.logger.error(`Exact inference error: ${error.message}`, { error: error.stack });
      
      // Return uniform distribution as fallback
      const variable = network.variables.get(queryVariable);
      const uniform = {};
      const probability = 1 / variable.states.length;
      
      for (const state of variable.states) {
        uniform[state] = probability;
      }
      
      return uniform;
    }
  }

  /**
   * Creates factors from conditional probability tables.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {Object} evidence - Observed evidence
   * @returns {Array<Object>} - Factors
   */
  _createFactorsFromCPTs(network, evidence) {
    const factors = [];
    
    // Create a factor for each variable
    for (const [variableId, variable] of network.variables.entries()) {
      // Find parents
      const parents = network.edges
        .filter(edge => edge.to === variableId)
        .map(edge => edge.from);
      
      // Create factor
      const factor = {
        variables: [variableId, ...parents],
        values: new Map()
      };
      
      // If variable is observed, create a simple factor
      if (evidence[variableId] !== undefined) {
        const assignment = { [variableId]: evidence[variableId] };
        factor.values.set(this._assignmentToKey(assignment), 1);
        
        // Remove unobserved parents
        factor.variables = factor.variables.filter(v => evidence[v] !== undefined);
      } else {
        // Create factor from CPT
        if (parents.length === 0) {
          // No parents, simple factor
          for (const state in variable.cpt) {
            const assignment = { [variableId]: state };
            factor.values.set(this._assignmentToKey(assignment), variable.cpt[state]);
          }
        } else {
          // With parents, more complex factor
          // Generate all possible assignments
          const assignments = this._generateAssignments(network, factor.variables, evidence);
          
          for (const assignment of assignments) {
            // Get parent configuration
            const parentConfig = {};
            for (const parent of parents) {
              if (assignment[parent] !== undefined) {
                parentConfig[parent] = assignment[parent];
              }
            }
            
            const configKey = this._configurationToKey(parentConfig);
            const state = assignment[variableId];
            
            // Get probability from CPT
            let probability = 0;
            if (variable.cpt[configKey] && variable.cpt[configKey][state] !== undefined) {
              probability = variable.cpt[configKey][state];
            }
            
            factor.values.set(this._assignmentToKey(assignment), probability);
          }
        }
      }
      
      factors.push(factor);
    }
    
    return factors;
  }

  /**
   * Generates all possible variable assignments.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {Array<string>} variables - Variables to assign
   * @param {Object} evidence - Observed evidence
   * @returns {Array<Object>} - All possible assignments
   */
  _generateAssignments(network, variables, evidence) {
    // Start with empty assignment
    let assignments = [{}];
    
    // Add variables one by one
    for (const variableId of variables) {
      // Skip observed variables
      if (evidence[variableId] !== undefined) {
        // Add observed value to all assignments
        assignments = assignments.map(assignment => ({
          ...assignment,
          [variableId]: evidence[variableId]
        }));
        continue;
      }
      
      // Get variable
      const variable = network.variables.get(variableId);
      if (!variable) continue;
      
      // Generate new assignments with all possible states
      const newAssignments = [];
      
      for (const assignment of assignments) {
        for (const state of variable.states) {
          newAssignments.push({
            ...assignment,
            [variableId]: state
          });
        }
      }
      
      assignments = newAssignments;
    }
    
    return assignments;
  }

  /**
   * Converts a variable assignment to a string key.
   * 
   * @private
   * @param {Object} assignment - Variable assignment
   * @returns {string} - Assignment key
   */
  _assignmentToKey(assignment) {
    return Object.entries(assignment)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }

  /**
   * Eliminates a variable from a set of factors.
   * 
   * @private
   * @param {Array<Object>} factors - Factors
   * @param {string} variable - Variable to eliminate
   * @returns {Array<Object>} - Updated factors
   */
  _eliminateVariable(factors, variable) {
    // Find factors containing the variable
    const relevantFactors = factors.filter(factor => factor.variables.includes(variable));
    const otherFactors = factors.filter(factor => !factor.variables.includes(variable));
    
    // If no relevant factors, return original factors
    if (relevantFactors.length === 0) {
      return factors;
    }
    
    // Multiply relevant factors
    let product = relevantFactors[0];
    for (let i = 1; i < relevantFactors.length; i++) {
      product = this._multiplyFactors(product, relevantFactors[i]);
    }
    
    // Sum out the variable
    const newFactor = this._sumOutVariable(product, variable);
    
    // Return new set of factors
    return [...otherFactors, newFactor];
  }

  /**
   * Multiplies two factors.
   * 
   * @private
   * @param {Object} factor1 - First factor
   * @param {Object} factor2 - Second factor
   * @returns {Object} - Product factor
   */
  _multiplyFactors(factor1, factor2) {
    // Combine variables
    const variables = [...new Set([...factor1.variables, ...factor2.variables])];
    
    // Create product factor
    const product = {
      variables,
      values: new Map()
    };
    
    // Generate all possible assignments for combined variables
    const assignments = this._generateAllAssignments(variables);
    
    // Calculate product values
    for (const assignment of assignments) {
      const value1 = this._evaluateFactor(factor1, assignment);
      const value2 = this._evaluateFactor(factor2, assignment);
      
      product.values.set(this._assignmentToKey(assignment), value1 * value2);
    }
    
    return product;
  }

  /**
   * Generates all possible assignments for a set of variables.
   * 
   * @private
   * @param {Array<string>} variables - Variables
   * @returns {Array<Object>} - All possible assignments
   */
  _generateAllAssignments(variables) {
    // Simplified implementation for demonstration
    // In a real system, this would be more efficient
    
    // Start with empty assignment
    let assignments = [{}];
    
    // Add variables one by one
    for (const variable of variables) {
      // Assume binary variables for simplicity
      const newAssignments = [];
      
      for (const assignment of assignments) {
        newAssignments.push({
          ...assignment,
          [variable]: true
        });
        
        newAssignments.push({
          ...assignment,
          [variable]: false
        });
      }
      
      assignments = newAssignments;
    }
    
    return assignments;
  }

  /**
   * Evaluates a factor for a given assignment.
   * 
   * @private
   * @param {Object} factor - Factor
   * @param {Object} assignment - Variable assignment
   * @returns {number} - Factor value
   */
  _evaluateFactor(factor, assignment) {
    // Create relevant assignment (only variables in the factor)
    const relevantAssignment = {};
    for (const variable of factor.variables) {
      if (assignment[variable] !== undefined) {
        relevantAssignment[variable] = assignment[variable];
      }
    }
    
    // Get value from factor
    const key = this._assignmentToKey(relevantAssignment);
    return factor.values.has(key) ? factor.values.get(key) : 0;
  }

  /**
   * Sums out a variable from a factor.
   * 
   * @private
   * @param {Object} factor - Factor
   * @param {string} variable - Variable to sum out
   * @returns {Object} - New factor
   */
  _sumOutVariable(factor, variable) {
    // Create new factor without the variable
    const newFactor = {
      variables: factor.variables.filter(v => v !== variable),
      values: new Map()
    };
    
    // Group assignments by the values of remaining variables
    const groups = new Map();
    
    for (const [key, value] of factor.values.entries()) {
      // Parse assignment from key
      const assignment = this._keyToAssignment(key);
      
      // Remove the variable to sum out
      const { [variable]: _, ...remainingAssignment } = assignment;
      
      // Create key for remaining assignment
      const remainingKey = this._assignmentToKey(remainingAssignment);
      
      // Add to group
      if (!groups.has(remainingKey)) {
        groups.set(remainingKey, []);
      }
      
      groups.get(remainingKey).push(value);
    }
    
    // Sum values in each group
    for (const [key, values] of groups.entries()) {
      newFactor.values.set(key, values.reduce((sum, value) => sum + value, 0));
    }
    
    return newFactor;
  }

  /**
   * Converts a key to a variable assignment.
   * 
   * @private
   * @param {string} key - Assignment key
   * @returns {Object} - Variable assignment
   */
  _keyToAssignment(key) {
    const assignment = {};
    
    if (!key) return assignment;
    
    const pairs = key.split(',');
    
    for (const pair of pairs) {
      const [variable, value] = pair.split('=');
      assignment[variable] = value;
    }
    
    return assignment;
  }

  /**
   * Performs approximate inference using likelihood weighting.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {Object} evidence - Observed evidence
   * @param {Array<string>} queryVariables - Variables to query
   * @param {number} numSamples - Number of samples to generate
   * @returns {Promise<Array<Object>>} - Weighted samples
   */
  async _likelihoodWeighting(network, evidence, queryVariables, numSamples) {
    try {
      const samples = [];
      
      // Generate weighted samples
      for (let i = 0; i < numSamples; i++) {
        const sample = {};
        let weight = 1.0;
        
        // Topologically sort variables
        const sortedVariables = this._topologicalSort(network);
        
        // Sample each variable in topological order
        for (const variableId of sortedVariables) {
          // If variable is observed, use evidence
          if (evidence[variableId] !== undefined) {
            sample[variableId] = evidence[variableId];
            
            // Update weight based on probability of evidence
            const probability = this._calculateProbability(network, variableId, sample);
            weight *= probability;
          } else {
            // Sample variable based on parents
            sample[variableId] = this._sampleVariable(network, variableId, sample);
          }
        }
        
        // Add sample with weight
        samples.push({ sample, weight });
      }
      
      return samples;
    } catch (error) {
      this.logger.error(`Likelihood weighting error: ${error.message}`, { error: error.stack });
      return [];
    }
  }

  /**
   * Topologically sorts variables in a Bayesian network.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @returns {Array<string>} - Topologically sorted variables
   */
  _topologicalSort(network) {
    // Create adjacency list
    const adjacencyList = new Map();
    
    // Initialize adjacency list
    for (const [variableId] of network.variables) {
      adjacencyList.set(variableId, []);
    }
    
    // Add edges
    for (const edge of network.edges) {
      if (adjacencyList.has(edge.from)) {
        adjacencyList.get(edge.from).push(edge.to);
      }
    }
    
    // Perform topological sort
    const visited = new Set();
    const temp = new Set();
    const order = [];
    
    // Visit function for DFS
    const visit = (variableId) => {
      // Check for cycle
      if (temp.has(variableId)) {
        throw new Error("Cycle detected in Bayesian network");
      }
      
      // Skip if already visited
      if (visited.has(variableId)) {
        return;
      }
      
      // Mark as temporarily visited
      temp.add(variableId);
      
      // Visit children
      for (const child of adjacencyList.get(variableId) || []) {
        visit(child);
      }
      
      // Mark as visited
      temp.delete(variableId);
      visited.add(variableId);
      
      // Add to order
      order.unshift(variableId);
    };
    
    // Visit all variables
    for (const [variableId] of network.variables) {
      if (!visited.has(variableId)) {
        visit(variableId);
      }
    }
    
    return order;
  }

  /**
   * Calculates the probability of a variable given its parents.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {string} variableId - Variable identifier
   * @param {Object} assignment - Current assignment
   * @returns {number} - Probability
   */
  _calculateProbability(network, variableId, assignment) {
    try {
      // Get variable
      const variable = network.variables.get(variableId);
      if (!variable) {
        return 0;
      }
      
      // Get variable's state in assignment
      const state = assignment[variableId];
      if (state === undefined) {
        return 0;
      }
      
      // Find parents
      const parents = network.edges
        .filter(edge => edge.to === variableId)
        .map(edge => edge.from);
      
      // If no parents, use simple probability
      if (parents.length === 0) {
        return variable.cpt[state] || 0;
      }
      
      // Get parent configuration
      const parentConfig = {};
      for (const parent of parents) {
        if (assignment[parent] !== undefined) {
          parentConfig[parent] = assignment[parent];
        } else {
          // If any parent is not assigned, return 0
          return 0;
        }
      }
      
      // Get probability from CPT
      const configKey = this._configurationToKey(parentConfig);
      
      if (variable.cpt[configKey] && variable.cpt[configKey][state] !== undefined) {
        return variable.cpt[configKey][state];
      }
      
      return 0;
    } catch (error) {
      this.logger.error(`Probability calculation error: ${error.message}`, { error: error.stack });
      return 0;
    }
  }

  /**
   * Samples a variable based on its parents.
   * 
   * @private
   * @param {Object} network - Bayesian network
   * @param {string} variableId - Variable identifier
   * @param {Object} assignment - Current assignment
   * @returns {string} - Sampled state
   */
  _sampleVariable(network, variableId, assignment) {
    try {
      // Get variable
      const variable = network.variables.get(variableId);
      if (!variable) {
        return null;
      }
      
      // Find parents
      const parents = network.edges
        .filter(edge => edge.to === variableId)
        .map(edge => edge.from);
      
      // Get distribution based on parents
      let distribution;
      
      if (parents.length === 0) {
        // No parents, use simple distribution
        distribution = variable.cpt;
      } else {
        // Get parent configuration
        const parentConfig = {};
        for (const parent of parents) {
          if (assignment[parent] !== undefined) {
            parentConfig[parent] = assignment[parent];
          } else {
            // If any parent is not assigned, use uniform distribution
            distribution = this._generateDefaultCPT(variable.states);
            break;
          }
        }
        
        if (!distribution) {
          // Get distribution from CPT
          const configKey = this._configurationToKey(parentConfig);
          distribution = variable.cpt[configKey] || this._generateDefaultCPT(variable.states);
        }
      }
      
      // Sample from distribution
      return this._sampleFromDistribution(distribution, variable.states);
    } catch (error) {
      this.logger.error(`Variable sampling error: ${error.message}`, { error: error.stack });
      
      // Return random state as fallback
      const variable = network.variables.get(variableId);
      const randomIndex = Math.floor(Math.random() * variable.states.length);
      return variable.states[randomIndex];
    }
  }

  /**
   * Samples a state from a probability distribution.
   * 
   * @private
   * @param {Object} distribution - Probability distribution
   * @param {Array<string>} states - Possible states
   * @returns {string} - Sampled state
   */
  _sampleFromDistribution(distribution, states) {
    // Generate random number
    const random = Math.random();
    
    // Cumulative probability
    let cumulativeProbability = 0;
    
    // Sample based on distribution
    for (const state of states) {
      cumulativeProbability += distribution[state] || 0;
      
      if (random < cumulativeProbability) {
        return state;
      }
    }
    
    // Fallback to last state
    return states[states.length - 1];
  }

  /**
   * Calculates posterior distribution from weighted samples.
   * 
   * @private
   * @param {Array<Object>} samples - Weighted samples
   * @param {string} variableId - Variable identifier
   * @returns {Object} - Posterior distribution
   */
  _calculatePosteriorFromSamples(samples, variableId) {
    try {
      // Count weighted occurrences of each state
      const counts = {};
      let totalWeight = 0;
      
      for (const { sample, weight } of samples) {
        const state = sample[variableId];
        
        if (state !== undefined) {
          counts[state] = (counts[state] || 0) + weight;
          totalWeight += weight;
        }
      }
      
      // Normalize to get probabilities
      const posterior = {};
      
      for (const state in counts) {
        posterior[state] = totalWeight > 0 ? counts[state] / totalWeight : 0;
      }
      
      return posterior;
    } catch (error) {
      this.logger.error(`Posterior calculation error: ${error.message}`, { error: error.stack });
      return {};
    }
  }

  /**
   * Propagates uncertainty through a reasoning chain.
   * 
   * @param {Array<Object>} reasoningChain - Chain of reasoning steps
   * @returns {Promise<Object>} - Propagated uncertainty
   */
  async propagateUncertainty(reasoningChain) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_propagateUncertainty");
    }

    try {
      // Validate reasoning chain
      if (!Array.isArray(reasoningChain) || reasoningChain.length === 0) {
        throw new Error("Invalid reasoning chain for uncertainty propagation");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyUncertaintyPropagationPolicies) {
        reasoningChain = await this.securityManager.applyUncertaintyPropagationPolicies(reasoningChain);
      }
      
      // Initialize propagated chain with original steps
      const propagatedChain = reasoningChain.map(step => ({ ...step }));
      
      // Propagate uncertainty through chain
      for (let i = 0; i < propagatedChain.length; i++) {
        const step = propagatedChain[i];
        
        // Skip steps with manually assigned confidence
        if (step.manualConfidence) {
          continue;
        }
        
        // Calculate confidence based on step type and dependencies
        if (i === 0) {
          // First step, confidence based on evidence
          if (step.evidence) {
            step.confidence = await this.calculateConfidence(step.evidence, step.context || {});
          } else {
            // No evidence, use default confidence
            step.confidence = 0.5;
          }
        } else {
          // Subsequent step, confidence based on previous steps
          const dependencies = step.dependsOn || [i - 1]; // Default to previous step
          
          // Get confidence of dependencies
          const dependencyConfidences = dependencies.map(depIndex => {
            if (depIndex >= 0 && depIndex < i) {
              return propagatedChain[depIndex].confidence || 0;
            }
            return 0;
          });
          
          // Propagate confidence based on reasoning type
          switch (step.type) {
            case 'deductive':
              // Deductive reasoning: confidence is minimum of dependencies
              step.confidence = Math.min(...dependencyConfidences);
              break;
              
            case 'inductive':
              // Inductive reasoning: confidence decays with each step
              step.confidence = Math.max(...dependencyConfidences) * 0.9;
              break;
              
            case 'abductive':
              // Abductive reasoning: confidence is lower than dependencies
              step.confidence = Math.max(...dependencyConfidences) * 0.8;
              break;
              
            case 'analogical':
              // Analogical reasoning: confidence based on similarity
              step.confidence = Math.max(...dependencyConfidences) * (step.similarity || 0.7);
              break;
              
            default:
              // Default: weighted average of dependencies
              const totalWeight = dependencies.length;
              const weightedSum = dependencyConfidences.reduce((sum, conf) => sum + conf, 0);
              step.confidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
          }
          
          // Apply any modifiers
          if (step.confidenceModifier) {
            step.confidence *= step.confidenceModifier;
          }
          
          // Ensure confidence is in valid range
          step.confidence = Math.min(1, Math.max(0, step.confidence));
        }
      }
      
      // Calculate overall confidence
      const finalStep = propagatedChain[propagatedChain.length - 1];
      const overallConfidence = finalStep ? finalStep.confidence : 0;
      
      return {
        propagatedChain,
        overallConfidence
      };
    } catch (error) {
      this.logger.error(`Failed to propagate uncertainty: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Handles uncertainty in deductive reasoning.
   * 
   * @param {Array<Object>} premises - Premises
   * @param {Object} conclusion - Conclusion
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Uncertainty result
   */
  async handleDeductiveUncertainty(premises, conclusion, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_handleDeductiveUncertainty");
    }

    try {
      // Validate inputs
      if (!Array.isArray(premises) || premises.length === 0 || !conclusion) {
        throw new Error("Invalid inputs for deductive uncertainty handling");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyDeductiveUncertaintyPolicies) {
        premises = await this.securityManager.applyDeductiveUncertaintyPolicies(premises, conclusion);
      }
      
      // Get confidence scores for premises
      const premiseConfidences = [];
      
      for (const premise of premises) {
        let confidence;
        
        if (premise.confidence !== undefined) {
          // Use provided confidence
          confidence = premise.confidence;
        } else if (premise.id && this.confidenceScores.has(premise.id)) {
          // Use stored confidence
          confidence = this.confidenceScores.get(premise.id).value;
        } else if (premise.evidence) {
          // Calculate confidence from evidence
          confidence = await this.calculateConfidence(premise.evidence, context);
        } else {
          // Default confidence
          confidence = 0.8; // Higher default for premises
        }
        
        premiseConfidences.push(confidence);
      }
      
      // In deductive reasoning, conclusion confidence is limited by the weakest premise
      // (logical conjunction)
      const minPremiseConfidence = Math.min(...premiseConfidences);
      
      // Apply deductive decay factor (to account for potential logical fallacies)
      const deductiveDecayFactor = this.configService.get('reasoning.uncertainty.deductiveDecayFactor', 0.95);
      let conclusionConfidence = minPremiseConfidence * deductiveDecayFactor;
      
      // Check for logical validity using LLM if available and appropriate
      if (this.useLLMForUncertainty && this.modelStrategyManager && 
          context.complexDeduction && premises.length > 2) {
        const validityScore = await this._checkDeductiveValidityWithLLM(premises, conclusion);
        conclusionConfidence *= validityScore;
      }
      
      // Store confidence for conclusion
      if (conclusion.id) {
        this.confidenceScores.set(conclusion.id, {
          value: conclusionConfidence,
          source: 'deductive_reasoning',
          timestamp: Date.now()
        });
      }
      
      return {
        conclusionConfidence,
        premiseConfidences,
        reasoningType: 'deductive'
      };
    } catch (error) {
      this.logger.error(`Failed to handle deductive uncertainty: ${error.message}`, { error: error.stack });
      
      // Return default confidence in case of error
      return {
        conclusionConfidence: 0.5,
        premiseConfidences: premises.map(() => 0.8),
        reasoningType: 'deductive',
        error: error.message
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Checks the logical validity of a deductive argument using LLM.
   * 
   * @private
   * @param {Array<Object>} premises - Premises
   * @param {Object} conclusion - Conclusion
   * @returns {Promise<number>} - Validity score (0-1)
   */
  async _checkDeductiveValidityWithLLM(premises, conclusion) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM validity checking");
      }
      
      // Prepare premises for LLM
      const premisesText = premises.map((premise, index) => {
        return `Premise ${index + 1}: ${premise.statement || premise.description || JSON.stringify(premise)}`;
      }).join('\n');
      
      // Prepare conclusion for LLM
      const conclusionText = conclusion.statement || conclusion.description || JSON.stringify(conclusion);
      
      // Prepare prompt for LLM
      const prompt = `
        Analyze the logical validity of the following deductive argument:
        
        ${premisesText}
        
        Conclusion: ${conclusionText}
        
        Evaluate whether the conclusion logically follows from the premises.
        Consider formal logical validity, not factual truth of premises.
        Identify any logical fallacies or invalid reasoning.
        
        Provide a validity score between 0 (completely invalid) and 1 (perfectly valid).
        Return only a single number representing the validity score.
      `;
      
      // Call LLM to check validity
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for logical analysis with multilingual support
        temperature: 0.1,
        maxTokens: 50
      });
      
      // Extract validity score from result
      const validityScore = this._extractConfidenceFromLLMResult(llmResult);
      
      return validityScore;
    } catch (error) {
      this.logger.error(`LLM validity checking error: ${error.message}`, { error: error.stack });
      // Return default validity score on LLM failure
      return 0.9; // High default for deductive reasoning
    }
  }

  /**
   * Handles uncertainty in inductive reasoning.
   * 
   * @param {Array<Object>} observations - Observations
   * @param {Object} hypothesis - Hypothesis
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Uncertainty result
   */
  async handleInductiveUncertainty(observations, hypothesis, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_handleInductiveUncertainty");
    }

    try {
      // Validate inputs
      if (!Array.isArray(observations) || observations.length === 0 || !hypothesis) {
        throw new Error("Invalid inputs for inductive uncertainty handling");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyInductiveUncertaintyPolicies) {
        observations = await this.securityManager.applyInductiveUncertaintyPolicies(observations, hypothesis);
      }
      
      // Get confidence scores for observations
      const observationConfidences = [];
      
      for (const observation of observations) {
        let confidence;
        
        if (observation.confidence !== undefined) {
          // Use provided confidence
          confidence = observation.confidence;
        } else if (observation.id && this.confidenceScores.has(observation.id)) {
          // Use stored confidence
          confidence = this.confidenceScores.get(observation.id).value;
        } else if (observation.evidence) {
          // Calculate confidence from evidence
          confidence = await this.calculateConfidence(observation.evidence, context);
        } else {
          // Default confidence
          confidence = 0.9; // Higher default for observations (assumed to be factual)
        }
        
        observationConfidences.push(confidence);
      }
      
      // Calculate base confidence from observations
      // In inductive reasoning, more observations generally increase confidence
      // but with diminishing returns
      const observationCount = observations.length;
      const averageObservationConfidence = observationConfidences.reduce((sum, conf) => sum + conf, 0) / observationCount;
      
      // Apply sample size factor (more observations increase confidence, but with diminishing returns)
      const sampleSizeFactor = 1 - (1 / (1 + observationCount));
      
      // Apply inductive strength factor (how well the hypothesis explains the observations)
      const inductiveStrengthFactor = hypothesis.inductiveStrength !== undefined ? 
        hypothesis.inductiveStrength : 0.8;
      
      // Calculate hypothesis confidence
      let hypothesisConfidence = averageObservationConfidence * sampleSizeFactor * inductiveStrengthFactor;
      
      // Check for inductive strength using LLM if available and appropriate
      if (this.useLLMForUncertainty && this.modelStrategyManager && 
          context.complexInduction && observations.length > 3) {
        const strengthScore = await this._checkInductiveStrengthWithLLM(observations, hypothesis);
        hypothesisConfidence = (hypothesisConfidence + strengthScore) / 2;
      }
      
      // Store confidence for hypothesis
      if (hypothesis.id) {
        this.confidenceScores.set(hypothesis.id, {
          value: hypothesisConfidence,
          source: 'inductive_reasoning',
          timestamp: Date.now()
        });
      }
      
      return {
        hypothesisConfidence,
        observationConfidences,
        sampleSizeFactor,
        inductiveStrengthFactor,
        reasoningType: 'inductive'
      };
    } catch (error) {
      this.logger.error(`Failed to handle inductive uncertainty: ${error.message}`, { error: error.stack });
      
      // Return default confidence in case of error
      return {
        hypothesisConfidence: 0.6,
        observationConfidences: observations.map(() => 0.9),
        sampleSizeFactor: 0.8,
        inductiveStrengthFactor: 0.8,
        reasoningType: 'inductive',
        error: error.message
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Checks the inductive strength of a hypothesis using LLM.
   * 
   * @private
   * @param {Array<Object>} observations - Observations
   * @param {Object} hypothesis - Hypothesis
   * @returns {Promise<number>} - Strength score (0-1)
   */
  async _checkInductiveStrengthWithLLM(observations, hypothesis) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM strength checking");
      }
      
      // Prepare observations for LLM
      const observationsText = observations.map((observation, index) => {
        return `Observation ${index + 1}: ${observation.statement || observation.description || JSON.stringify(observation)}`;
      }).join('\n');
      
      // Prepare hypothesis for LLM
      const hypothesisText = hypothesis.statement || hypothesis.description || JSON.stringify(hypothesis);
      
      // Prepare prompt for LLM
      const prompt = `
        Analyze the inductive strength of the following hypothesis based on the observations:
        
        ${observationsText}
        
        Hypothesis: ${hypothesisText}
        
        Evaluate how well the hypothesis explains the observations.
        Consider:
        1. How many observations are explained by the hypothesis
        2. Whether there are alternative explanations
        3. The simplicity and coherence of the hypothesis
        4. Whether the hypothesis makes novel predictions
        
        Provide a strength score between 0 (very weak) and 1 (very strong).
        Return only a single number representing the strength score.
      `;
      
      // Call LLM to check inductive strength
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for inductive analysis with multilingual support
        temperature: 0.1,
        maxTokens: 50
      });
      
      // Extract strength score from result
      const strengthScore = this._extractConfidenceFromLLMResult(llmResult);
      
      return strengthScore;
    } catch (error) {
      this.logger.error(`LLM inductive strength checking error: ${error.message}`, { error: error.stack });
      // Return default strength score on LLM failure
      return 0.7; // Moderate default for inductive reasoning
    }
  }

  /**
   * Handles uncertainty in abductive reasoning.
   * 
   * @param {Object} observation - Observation
   * @param {Array<Object>} explanations - Possible explanations
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Uncertainty result
   */
  async handleAbductiveUncertainty(observation, explanations, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_handleAbductiveUncertainty");
    }

    try {
      // Validate inputs
      if (!observation || !Array.isArray(explanations) || explanations.length === 0) {
        throw new Error("Invalid inputs for abductive uncertainty handling");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyAbductiveUncertaintyPolicies) {
        explanations = await this.securityManager.applyAbductiveUncertaintyPolicies(observation, explanations);
      }
      
      // Get confidence score for observation
      let observationConfidence;
      
      if (observation.confidence !== undefined) {
        // Use provided confidence
        observationConfidence = observation.confidence;
      } else if (observation.id && this.confidenceScores.has(observation.id)) {
        // Use stored confidence
        observationConfidence = this.confidenceScores.get(observation.id).value;
      } else if (observation.evidence) {
        // Calculate confidence from evidence
        observationConfidence = await this.calculateConfidence(observation.evidence, context);
      } else {
        // Default confidence
        observationConfidence = 0.9; // Higher default for observations (assumed to be factual)
      }
      
      // Calculate explanation scores
      const scoredExplanations = [];
      
      for (const explanation of explanations) {
        // Calculate explanation score based on multiple factors
        
        // 1. Explanatory power (how well it explains the observation)
        const explanatoryPower = explanation.explanatoryPower !== undefined ? 
          explanation.explanatoryPower : 0.7;
        
        // 2. Simplicity (simpler explanations are preferred)
        const simplicity = explanation.simplicity !== undefined ? 
          explanation.simplicity : 0.8;
        
        // 3. Coherence (how well it fits with existing knowledge)
        const coherence = explanation.coherence !== undefined ? 
          explanation.coherence : 0.7;
        
        // 4. Prior probability (how likely the explanation is a priori)
        const priorProbability = explanation.priorProbability !== undefined ? 
          explanation.priorProbability : 0.5;
        
        // Calculate overall score
        // Weighted average of factors
        const score = (
          (explanatoryPower * 0.4) + 
          (simplicity * 0.2) + 
          (coherence * 0.2) + 
          (priorProbability * 0.2)
        ) * observationConfidence;
        
        // Add to scored explanations
        scoredExplanations.push({
          explanation,
          score,
          factors: {
            explanatoryPower,
            simplicity,
            coherence,
            priorProbability
          }
        });
      }
      
      // Sort explanations by score
      scoredExplanations.sort((a, b) => b.score - a.score);
      
      // Calculate relative probabilities
      const totalScore = scoredExplanations.reduce((sum, item) => sum + item.score, 0);
      
      if (totalScore > 0) {
        for (const item of scoredExplanations) {
          item.relativeProbability = item.score / totalScore;
        }
      } else {
        // Equal probabilities if total score is 0
        const equalProbability = 1 / scoredExplanations.length;
        for (const item of scoredExplanations) {
          item.relativeProbability = equalProbability;
        }
      }
      
      // Store confidence for best explanation
      if (scoredExplanations.length > 0) {
        const bestExplanation = scoredExplanations[0].explanation;
        
        if (bestExplanation.id) {
          this.confidenceScores.set(bestExplanation.id, {
            value: scoredExplanations[0].score,
            source: 'abductive_reasoning',
            timestamp: Date.now()
          });
        }
      }
      
      return {
        observationConfidence,
        explanations: scoredExplanations,
        reasoningType: 'abductive'
      };
    } catch (error) {
      this.logger.error(`Failed to handle abductive uncertainty: ${error.message}`, { error: error.stack });
      
      // Return default confidence in case of error
      return {
        observationConfidence: 0.9,
        explanations: explanations.map(explanation => ({
          explanation,
          score: 0.6,
          relativeProbability: 1 / explanations.length,
          factors: {
            explanatoryPower: 0.7,
            simplicity: 0.8,
            coherence: 0.7,
            priorProbability: 0.5
          }
        })),
        reasoningType: 'abductive',
        error: error.message
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Handles uncertainty in analogical reasoning.
   * 
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @param {Object} mapping - Mapping between domains
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Uncertainty result
   */
  async handleAnalogicalUncertainty(sourceDomain, targetDomain, mapping, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_handleAnalogicalUncertainty");
    }

    try {
      // Validate inputs
      if (!sourceDomain || !targetDomain || !mapping) {
        throw new Error("Invalid inputs for analogical uncertainty handling");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyAnalogicalUncertaintyPolicies) {
        mapping = await this.securityManager.applyAnalogicalUncertaintyPolicies(sourceDomain, targetDomain, mapping);
      }
      
      // Calculate similarity score
      let similarity;
      
      if (mapping.similarity !== undefined) {
        // Use provided similarity
        similarity = mapping.similarity;
      } else {
        // Calculate similarity based on mapping
        similarity = this._calculateMappingSimilarity(mapping);
      }
      
      // Calculate confidence factors
      
      // 1. Structural consistency (how well the mapping preserves structure)
      const structuralConsistency = mapping.structuralConsistency !== undefined ? 
        mapping.structuralConsistency : 0.7;
      
      // 2. Relevance (how relevant the source domain is to the target)
      const relevance = mapping.relevance !== undefined ? 
        mapping.relevance : 0.8;
      
      // 3. Abstraction level (higher abstraction can lead to more valid analogies)
      const abstractionLevel = mapping.abstractionLevel !== undefined ? 
        mapping.abstractionLevel : 0.6;
      
      // Calculate confidence for inferences
      const inferenceConfidences = [];
      
      if (mapping.inferences && Array.isArray(mapping.inferences)) {
        for (const inference of mapping.inferences) {
          // Calculate inference confidence
          const inferenceConfidence = similarity * 
            structuralConsistency * 
            relevance * 
            (inference.specificConfidence || 1.0);
          
          // Add to inference confidences
          inferenceConfidences.push({
            inference,
            confidence: inferenceConfidence
          });
          
          // Store confidence for inference
          if (inference.id) {
            this.confidenceScores.set(inference.id, {
              value: inferenceConfidence,
              source: 'analogical_reasoning',
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Calculate overall confidence
      const overallConfidence = similarity * structuralConsistency * relevance * abstractionLevel;
      
      return {
        similarity,
        structuralConsistency,
        relevance,
        abstractionLevel,
        overallConfidence,
        inferenceConfidences,
        reasoningType: 'analogical'
      };
    } catch (error) {
      this.logger.error(`Failed to handle analogical uncertainty: ${error.message}`, { error: error.stack });
      
      // Return default confidence in case of error
      return {
        similarity: 0.7,
        structuralConsistency: 0.7,
        relevance: 0.8,
        abstractionLevel: 0.6,
        overallConfidence: 0.5,
        inferenceConfidences: [],
        reasoningType: 'analogical',
        error: error.message
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Calculates similarity based on mapping.
   * 
   * @private
   * @param {Object} mapping - Mapping between domains
   * @returns {number} - Similarity score (0-1)
   */
  _calculateMappingSimilarity(mapping) {
    try {
      // If mapping has correspondences, calculate based on them
      if (mapping.correspondences && Array.isArray(mapping.correspondences)) {
        // Calculate average similarity of correspondences
        let totalSimilarity = 0;
        
        for (const correspondence of mapping.correspondences) {
          totalSimilarity += correspondence.similarity || 0.5;
        }
        
        return mapping.correspondences.length > 0 ? 
          totalSimilarity / mapping.correspondences.length : 0.5;
      }
      
      // If mapping has a direct similarity score, use it
      if (mapping.similarity !== undefined) {
        return mapping.similarity;
      }
      
      // Default similarity
      return 0.7;
    } catch (error) {
      this.logger.error(`Mapping similarity calculation error: ${error.message}`, { error: error.stack });
      return 0.5;
    }
  }

  /**
   * Normalizes confidence scores.
   * 
   * @param {Array<Object>} scores - Confidence scores to normalize
   * @returns {Promise<Array<Object>>} - Normalized confidence scores
   */
  async normalizeConfidenceScores(scores) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_normalizeConfidenceScores");
    }

    try {
      // Validate scores
      if (!Array.isArray(scores) || scores.length === 0) {
        return [];
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyNormalizationPolicies) {
        scores = await this.securityManager.applyNormalizationPolicies(scores);
      }
      
      // Find min and max scores
      let minScore = 1;
      let maxScore = 0;
      
      for (const score of scores) {
        if (score.value !== undefined) {
          minScore = Math.min(minScore, score.value);
          maxScore = Math.max(maxScore, score.value);
        }
      }
      
      // Normalize scores
      const normalizedScores = [];
      
      for (const score of scores) {
        if (score.value !== undefined) {
          // Min-max normalization
          let normalizedValue;
          
          if (maxScore === minScore) {
            // All scores are the same
            normalizedValue = 0.5;
          } else {
            normalizedValue = (score.value - minScore) / (maxScore - minScore);
          }
          
          normalizedScores.push({
            ...score,
            originalValue: score.value,
            value: normalizedValue
          });
        }
      }
      
      return normalizedScores;
    } catch (error) {
      this.logger.error(`Failed to normalize confidence scores: ${error.message}`, { error: error.stack });
      return scores;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Aggregates evidence with weights.
   * 
   * @param {Array<Object>} evidenceList - Evidence to aggregate
   * @param {Array<number>} weights - Weights for evidence
   * @returns {Promise<Object>} - Aggregated evidence
   */
  async aggregateEvidence(evidenceList, weights = null) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_aggregateEvidence");
    }

    try {
      // Validate evidence
      if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
        throw new Error("Invalid evidence list for aggregation");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyEvidenceAggregationPolicies) {
        evidenceList = await this.securityManager.applyEvidenceAggregationPolicies(evidenceList);
      }
      
      // Normalize weights if provided
      let normalizedWeights;
      
      if (weights && Array.isArray(weights) && weights.length === evidenceList.length) {
        // Use provided weights
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        normalizedWeights = totalWeight > 0 ? 
          weights.map(weight => weight / totalWeight) : 
          weights.map(() => 1 / weights.length);
      } else {
        // Equal weights
        normalizedWeights = evidenceList.map(() => 1 / evidenceList.length);
      }
      
      // Aggregate evidence
      const aggregatedEvidence = {
        id: uuidv4(),
        type: 'aggregated',
        confidence: 0,
        sources: evidenceList.map(evidence => evidence.id || 'unknown'),
        timestamp: Date.now()
      };
      
      // Calculate weighted confidence
      let weightedConfidence = 0;
      
      for (let i = 0; i < evidenceList.length; i++) {
        const evidence = evidenceList[i];
        const weight = normalizedWeights[i];
        
        const confidence = evidence.confidence !== undefined ? evidence.confidence : 0.5;
        weightedConfidence += confidence * weight;
      }
      
      aggregatedEvidence.confidence = weightedConfidence;
      
      // Store aggregated evidence
      this.evidenceStore.set(aggregatedEvidence.id, aggregatedEvidence);
      
      return aggregatedEvidence;
    } catch (error) {
      this.logger.error(`Failed to aggregate evidence: ${error.message}`, { error: error.stack });
      
      // Return simple aggregation in case of error
      return {
        id: uuidv4(),
        type: 'aggregated',
        confidence: 0.5,
        sources: evidenceList.map(evidence => evidence.id || 'unknown'),
        timestamp: Date.now(),
        error: error.message
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Gets statistics about the uncertainty handler.
   * 
   * @returns {Promise<Object>} - Handler statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_getStatistics");
    }

    try {
      // Count confidence scores by source
      const confidenceScoresBySource = {};
      
      for (const [, score] of this.confidenceScores.entries()) {
        const source = score.source || 'unknown';
        confidenceScoresBySource[source] = (confidenceScoresBySource[source] || 0) + 1;
      }
      
      // Calculate average confidence
      let totalConfidence = 0;
      
      for (const [, score] of this.confidenceScores.entries()) {
        totalConfidence += score.value || 0;
      }
      
      const avgConfidence = this.confidenceScores.size > 0 ? 
        totalConfidence / this.confidenceScores.size : 0;
      
      // Count evidence by age
      const now = Date.now();
      const evidenceByAge = {
        recent: 0, // Less than 1 day
        medium: 0, // 1-3 days
        old: 0 // More than 3 days
      };
      
      for (const [, evidence] of this.evidenceStore.entries()) {
        const age = now - (evidence.timestamp || 0);
        
        if (age < 24 * 60 * 60 * 1000) {
          evidenceByAge.recent++;
        } else if (age < 3 * 24 * 60 * 60 * 1000) {
          evidenceByAge.medium++;
        } else {
          evidenceByAge.old++;
        }
      }
      
      // Compile statistics
      const statistics = {
        confidenceScoresCount: this.confidenceScores.size,
        confidenceScoresBySource,
        avgConfidence,
        bayesianNetworksCount: this.bayesianNetworks.size,
        evidenceCount: this.evidenceStore.size,
        evidenceByAge,
        beliefSetsCount: this.beliefSets.size,
        configuration: {
          defaultConfidenceThreshold: this.defaultConfidenceThreshold,
          useBayesianNetworks: this.useBayesianNetworks,
          useDempsterShafer: this.useDempsterShafer,
          useLLMForUncertainty: this.useLLMForUncertainty,
          maxEvidenceAge: this.maxEvidenceAge
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
   * Cleans up old evidence and confidence scores.
   * 
   * @param {Object} [options] - Cleanup options
   * @param {number} [options.maxEvidenceAge] - Maximum age of evidence in milliseconds
   * @param {number} [options.maxConfidenceAge] - Maximum age of confidence scores in milliseconds
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanup(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("uncertaintyHandler_cleanup");
    }

    try {
      const maxEvidenceAge = options.maxEvidenceAge || this.maxEvidenceAge;
      const maxConfidenceAge = options.maxConfidenceAge || (30 * 24 * 60 * 60 * 1000); // 30 days
      
      const now = Date.now();
      let evidenceRemoved = 0;
      let confidenceRemoved = 0;
      
      // Clean up old evidence
      for (const [id, evidence] of this.evidenceStore.entries()) {
        const age = now - (evidence.timestamp || 0);
        
        if (age > maxEvidenceAge) {
          this.evidenceStore.delete(id);
          evidenceRemoved++;
        }
      }
      
      // Clean up old confidence scores
      for (const [id, score] of this.confidenceScores.entries()) {
        const age = now - (score.timestamp || 0);
        
        if (age > maxConfidenceAge) {
          this.confidenceScores.delete(id);
          confidenceRemoved++;
        }
      }
      
      this.logger.debug(`Cleaned up uncertainty handler`, { 
        evidenceRemoved,
        confidenceRemoved
      });
      
      return {
        evidenceRemoved,
        confidenceRemoved
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

module.exports = { UncertaintyHandler };
