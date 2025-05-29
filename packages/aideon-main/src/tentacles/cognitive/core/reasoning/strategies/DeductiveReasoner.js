/**
 * @fileoverview Deductive Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements rule-based inference using a forward-chaining algorithm.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Deductive Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements rule-based inference using a forward-chaining algorithm.
 * 
 * @extends EventEmitter
 */
class DeductiveReasoner extends EventEmitter {
  /**
   * Creates a new DeductiveReasoner instance.
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
      throw new Error("DeductiveReasoner requires a knowledgeGraphManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.securityManager = options.securityManager;
    this.modelStrategyManager = options.modelStrategyManager;
    this.vectorService = options.vectorService;
    
    // Rule engine components
    this.rules = new Map(); // Map of ruleId -> rule
    this.facts = new Map(); // Map of factId -> fact
    
    // Inference tracing
    this.inferenceTraces = new Map(); // Map of traceId -> trace
    
    // Configuration
    this.maxIterations = this.configService ? 
      this.configService.get('reasoning.deductive.maxIterations', 100) : 100;
    this.confidenceThreshold = this.configService ? 
      this.configService.get('reasoning.deductive.confidenceThreshold', 0.7) : 0.7;
    this.useLLMForRuleExtraction = this.configService ? 
      this.configService.get('reasoning.deductive.useLLMForRuleExtraction', true) : true;
    this.useLLMForConflictResolution = this.configService ? 
      this.configService.get('reasoning.deductive.useLLMForConflictResolution', true) : true;
    
    this.initialized = false;
  }

  /**
   * Initializes the Deductive Reasoner.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing DeductiveReasoner");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_initialize");
    }

    try {
      // Load predefined rules if available
      await this._loadPredefinedRules();
      
      this.initialized = true;

      if (this.logger) {
        this.logger.info("DeductiveReasoner initialized successfully", {
          ruleCount: this.rules.size
        });
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("DeductiveReasoner initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`DeductiveReasoner initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Loads predefined rules from configuration or knowledge graph.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPredefinedRules() {
    try {
      // Check if rules are defined in configuration
      const configRules = this.configService ? 
        this.configService.get('reasoning.deductive.predefinedRules', []) : [];
      
      for (const ruleConfig of configRules) {
        await this.addRule(ruleConfig);
      }
      
      // Load rules from knowledge graph if enabled
      const loadFromKG = this.configService ? 
        this.configService.get('reasoning.deductive.loadRulesFromKnowledgeGraph', true) : true;
      
      if (loadFromKG && this.knowledgeGraphManager) {
        const ruleNodes = await this.knowledgeGraphManager.findNodes({
          nodeType: 'Rule',
          properties: {
            ruleType: 'deductive'
          }
        });
        
        for (const ruleNode of ruleNodes) {
          const rule = this._convertNodeToRule(ruleNode);
          if (rule) {
            await this.addRule(rule);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Loaded ${this.rules.size} predefined rules`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load predefined rules: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Converts a knowledge graph node to a rule object.
   * 
   * @private
   * @param {Object} node - Knowledge graph node
   * @returns {Object|null} - Rule object or null if conversion failed
   */
  _convertNodeToRule(node) {
    try {
      if (!node || !node.properties) {
        return null;
      }
      
      const { name, description, conditions, actions, priority, confidence } = node.properties;
      
      if (!conditions || !actions) {
        return null;
      }
      
      return {
        id: node.id,
        name: name || `Rule_${node.id}`,
        description: description || '',
        conditions: typeof conditions === 'string' ? JSON.parse(conditions) : conditions,
        actions: typeof actions === 'string' ? JSON.parse(actions) : actions,
        priority: priority || 1,
        confidence: confidence || 1.0,
        source: 'knowledge_graph',
        sourceNodeId: node.id
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to convert node to rule: ${error.message}`, { 
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
      throw new Error("DeductiveReasoner is not initialized. Call initialize() first.");
    }
  }

  /**
   * Adds a rule to the rule engine.
   * 
   * @param {Object} rule - Rule definition
   * @param {string} [rule.id] - Unique identifier for the rule (generated if not provided)
   * @param {string} rule.name - Name of the rule
   * @param {string} [rule.description] - Description of the rule
   * @param {Array<Object>} rule.conditions - Conditions that must be met for the rule to fire
   * @param {Array<Object>} rule.actions - Actions to perform when the rule fires
   * @param {number} [rule.priority=1] - Priority of the rule (higher values have higher priority)
   * @param {number} [rule.confidence=1.0] - Confidence score for the rule (0-1)
   * @param {string} [rule.source='user'] - Source of the rule
   * @returns {Promise<string>} - ID of the added rule
   */
  async addRule(rule) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_addRule");
    }

    try {
      // Validate rule
      if (!rule.conditions || !Array.isArray(rule.conditions)) {
        throw new Error("Rule must have conditions array");
      }
      
      if (!rule.actions || !Array.isArray(rule.actions)) {
        throw new Error("Rule must have actions array");
      }
      
      // Generate ID if not provided
      const ruleId = rule.id || uuidv4();
      
      // Create rule object
      const ruleObj = {
        id: ruleId,
        name: rule.name || `Rule_${ruleId}`,
        description: rule.description || '',
        conditions: rule.conditions,
        actions: rule.actions,
        priority: rule.priority || 1,
        confidence: rule.confidence || 1.0,
        source: rule.source || 'user',
        createdAt: Date.now(),
        lastFired: null,
        fireCount: 0
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyRuleSecurityPolicies) {
        await this.securityManager.applyRuleSecurityPolicies(ruleObj);
      }
      
      // Store rule
      this.rules.set(ruleId, ruleObj);
      
      if (this.logger) {
        this.logger.debug(`Added rule: ${ruleId}`, { 
          name: ruleObj.name,
          conditionCount: ruleObj.conditions.length,
          actionCount: ruleObj.actions.length
        });
      }
      
      this.emit("ruleAdded", { ruleId, rule: ruleObj });
      return ruleId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add rule: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes a rule from the rule engine.
   * 
   * @param {string} ruleId - ID of the rule to remove
   * @returns {Promise<boolean>} - True if the rule was removed
   */
  async removeRule(ruleId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_removeRule");
    }

    try {
      // Check if rule exists
      if (!this.rules.has(ruleId)) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyRuleRemovalPolicies) {
        const rule = this.rules.get(ruleId);
        await this.securityManager.applyRuleRemovalPolicies(rule);
      }
      
      // Remove rule
      this.rules.delete(ruleId);
      
      if (this.logger) {
        this.logger.debug(`Removed rule: ${ruleId}`);
      }
      
      this.emit("ruleRemoved", { ruleId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove rule: ${error.message}`, { 
          ruleId, 
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
   * Adds a fact to the working memory.
   * 
   * @param {Object} fact - Fact definition
   * @param {string} [fact.id] - Unique identifier for the fact (generated if not provided)
   * @param {string} fact.predicate - Predicate of the fact
   * @param {Object} fact.arguments - Arguments of the fact
   * @param {number} [fact.confidence=1.0] - Confidence score for the fact (0-1)
   * @param {string} [fact.source='user'] - Source of the fact
   * @returns {Promise<string>} - ID of the added fact
   */
  async addFact(fact) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_addFact");
    }

    try {
      // Validate fact
      if (!fact.predicate) {
        throw new Error("Fact must have a predicate");
      }
      
      if (!fact.arguments || typeof fact.arguments !== 'object') {
        throw new Error("Fact must have arguments object");
      }
      
      // Generate ID if not provided
      const factId = fact.id || uuidv4();
      
      // Create fact object
      const factObj = {
        id: factId,
        predicate: fact.predicate,
        arguments: fact.arguments,
        confidence: fact.confidence || 1.0,
        source: fact.source || 'user',
        createdAt: Date.now(),
        derived: false,
        derivedFrom: null
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyFactSecurityPolicies) {
        await this.securityManager.applyFactSecurityPolicies(factObj);
      }
      
      // Store fact
      this.facts.set(factId, factObj);
      
      if (this.logger) {
        this.logger.debug(`Added fact: ${factId}`, { 
          predicate: factObj.predicate,
          confidence: factObj.confidence
        });
      }
      
      this.emit("factAdded", { factId, fact: factObj });
      return factId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add fact: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes a fact from the working memory.
   * 
   * @param {string} factId - ID of the fact to remove
   * @returns {Promise<boolean>} - True if the fact was removed
   */
  async removeFact(factId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_removeFact");
    }

    try {
      // Check if fact exists
      if (!this.facts.has(factId)) {
        throw new Error(`Fact not found: ${factId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyFactRemovalPolicies) {
        const fact = this.facts.get(factId);
        await this.securityManager.applyFactRemovalPolicies(fact);
      }
      
      // Remove fact
      this.facts.delete(factId);
      
      if (this.logger) {
        this.logger.debug(`Removed fact: ${factId}`);
      }
      
      this.emit("factRemoved", { factId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove fact: ${error.message}`, { 
          factId, 
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
   * Extracts rules and facts from the knowledge graph based on a query.
   * 
   * @param {Object} options - Extraction options
   * @param {string} options.query - Query to extract knowledge for
   * @param {Object} [options.context] - Context information
   * @param {boolean} [options.useLLM=true] - Whether to use LLM for extraction
   * @returns {Promise<Object>} - Extracted rules and facts
   */
  async extractKnowledge(options) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_extractKnowledge");
    }

    try {
      const { query, context = {}, useLLM = this.useLLMForRuleExtraction } = options;
      
      if (!query) {
        throw new Error("Query is required for knowledge extraction");
      }
      
      // Extract facts from knowledge graph
      const extractedFacts = await this._extractFactsFromKG(query, context);
      
      // Extract rules using LLM if enabled
      let extractedRules = [];
      if (useLLM && this.modelStrategyManager) {
        extractedRules = await this._extractRulesUsingLLM(query, context, extractedFacts);
      } else {
        // Fallback to pattern-based rule extraction
        extractedRules = await this._extractRulesFromKG(query, context);
      }
      
      if (this.logger) {
        this.logger.debug(`Extracted knowledge for query: ${query}`, { 
          factCount: extractedFacts.length,
          ruleCount: extractedRules.length
        });
      }
      
      return {
        facts: extractedFacts,
        rules: extractedRules
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to extract knowledge: ${error.message}`, { 
          query: options.query, 
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
   * Extracts facts from the knowledge graph.
   * 
   * @private
   * @param {string} query - Query to extract facts for
   * @param {Object} context - Context information
   * @returns {Promise<Array<Object>>} - Extracted facts
   */
  async _extractFactsFromKG(query, context) {
    try {
      // Find relevant nodes in knowledge graph
      const relevantNodes = await this.knowledgeGraphManager.findNodes({
        query,
        limit: 100,
        includeProperties: true
      });
      
      // Convert nodes to facts
      const facts = [];
      
      for (const node of relevantNodes) {
        // Skip rule nodes
        if (node.nodeType === 'Rule') {
          continue;
        }
        
        // Create fact from node
        const fact = {
          id: `fact_${node.id}`,
          predicate: 'hasProperty',
          arguments: {
            nodeId: node.id,
            nodeType: node.nodeType,
            properties: { ...node.properties }
          },
          confidence: node.confidence || 1.0,
          source: 'knowledge_graph',
          sourceNodeId: node.id
        };
        
        facts.push(fact);
        
        // Create facts for relationships
        if (node.relationships) {
          for (const rel of node.relationships) {
            const relFact = {
              id: `fact_rel_${rel.id}`,
              predicate: rel.type,
              arguments: {
                sourceId: node.id,
                targetId: rel.targetId,
                properties: { ...rel.properties }
              },
              confidence: rel.confidence || 1.0,
              source: 'knowledge_graph',
              sourceRelId: rel.id
            };
            
            facts.push(relFact);
          }
        }
      }
      
      return facts;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to extract facts from KG: ${error.message}`, { 
          query, 
          error: error.stack 
        });
      }
      throw error;
    }
  }

  /**
   * Extracts rules from the knowledge graph.
   * 
   * @private
   * @param {string} query - Query to extract rules for
   * @param {Object} context - Context information
   * @returns {Promise<Array<Object>>} - Extracted rules
   */
  async _extractRulesFromKG(query, context) {
    try {
      // Find rule nodes in knowledge graph
      const ruleNodes = await this.knowledgeGraphManager.findNodes({
        nodeType: 'Rule',
        query,
        limit: 50,
        includeProperties: true
      });
      
      // Convert nodes to rules
      const rules = [];
      
      for (const node of ruleNodes) {
        const rule = this._convertNodeToRule(node);
        if (rule) {
          rules.push(rule);
        }
      }
      
      return rules;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to extract rules from KG: ${error.message}`, { 
          query, 
          error: error.stack 
        });
      }
      throw error;
    }
  }

  /**
   * Extracts rules using LLM.
   * 
   * @private
   * @param {string} query - Query to extract rules for
   * @param {Object} context - Context information
   * @param {Array<Object>} extractedFacts - Facts extracted from knowledge graph
   * @returns {Promise<Array<Object>>} - Extracted rules
   */
  async _extractRulesUsingLLM(query, context, extractedFacts) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM rule extraction");
      }
      
      // Prepare prompt for LLM
      const factsText = extractedFacts.map(fact => 
        `Fact: ${fact.predicate}(${Object.entries(fact.arguments)
          .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ')})`
      ).join('\n');
      
      const prompt = `
        Given the following facts and the query "${query}", generate logical rules that can be used for deductive reasoning.
        
        Facts:
        ${factsText}
        
        Context:
        ${JSON.stringify(context)}
        
        Generate rules in the following JSON format:
        [
          {
            "name": "Rule name",
            "description": "Rule description",
            "conditions": [
              { "predicate": "predicate1", "arguments": { "arg1": "value1" }, "operator": "equals" },
              { "predicate": "predicate2", "arguments": { "arg1": "value1" }, "operator": "contains" }
            ],
            "actions": [
              { "type": "assert", "predicate": "conclusion", "arguments": { "arg1": "value1" } },
              { "type": "retract", "factId": "{{factId}}" }
            ],
            "priority": 1,
            "confidence": 0.9
          }
        ]
        
        Ensure the rules are logically sound and directly relevant to the query.
      `;
      
      // Call LLM to generate rules
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama3-70b', // Use Llama 3 70B for complex rule generation
        temperature: 0.2,
        maxTokens: 2000,
        stopSequences: [']'],
        responseFormat: 'json'
      });
      
      // Parse and validate rules
      let rules = [];
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        if (Array.isArray(parsedResult)) {
          rules = parsedResult;
        } else if (parsedResult.rules && Array.isArray(parsedResult.rules)) {
          rules = parsedResult.rules;
        }
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM rule extraction result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        // Fallback to empty rules
        rules = [];
      }
      
      // Validate and format rules
      const validRules = [];
      for (const rule of rules) {
        if (rule.conditions && Array.isArray(rule.conditions) && 
            rule.actions && Array.isArray(rule.actions)) {
          // Add source information
          rule.source = 'llm';
          rule.sourceModel = 'llama3-70b';
          rule.id = `rule_llm_${uuidv4()}`;
          
          validRules.push(rule);
        }
      }
      
      return validRules;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to extract rules using LLM: ${error.message}`, { 
          query, 
          error: error.stack 
        });
      }
      
      // Fallback to KG-based extraction on LLM failure
      return this._extractRulesFromKG(query, context);
    }
  }

  /**
   * Performs deductive reasoning on a query.
   * 
   * @param {Object} options - Reasoning options
   * @param {string} options.query - Query to reason about
   * @param {Object} [options.context] - Context information
   * @param {Array<Object>} [options.initialFacts] - Initial facts to use
   * @param {Array<Object>} [options.initialRules] - Initial rules to use
   * @param {boolean} [options.extractKnowledge=true] - Whether to extract knowledge from KG
   * @param {boolean} [options.useLLM=true] - Whether to use LLM for rule extraction and conflict resolution
   * @param {number} [options.maxIterations] - Maximum number of inference iterations
   * @returns {Promise<Object>} - Reasoning result
   */
  async reason(options) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_reason");
    }

    try {
      const { 
        query, 
        context = {}, 
        initialFacts = [], 
        initialRules = [],
        extractKnowledge = true,
        useLLM = this.useLLMForRuleExtraction,
        maxIterations = this.maxIterations
      } = options;
      
      if (!query) {
        throw new Error("Query is required for reasoning");
      }
      
      // Create inference trace
      const traceId = uuidv4();
      const trace = {
        id: traceId,
        query,
        context,
        startTime: Date.now(),
        endTime: null,
        iterations: 0,
        factsAdded: [],
        rulesTriggered: [],
        conclusion: null,
        confidence: 0,
        status: 'running'
      };
      
      this.inferenceTraces.set(traceId, trace);
      
      // Initialize working memory
      const workingMemory = new Map();
      
      // Add initial facts
      for (const fact of initialFacts) {
        const factId = await this.addFact(fact);
        workingMemory.set(factId, this.facts.get(factId));
        trace.factsAdded.push(factId);
      }
      
      // Add initial rules
      const workingRules = new Map();
      for (const rule of initialRules) {
        const ruleId = await this.addRule(rule);
        workingRules.set(ruleId, this.rules.get(ruleId));
      }
      
      // Extract knowledge if enabled
      if (extractKnowledge) {
        const extractedKnowledge = await this.extractKnowledge({
          query,
          context,
          useLLM
        });
        
        // Add extracted facts
        for (const fact of extractedKnowledge.facts) {
          const factId = await this.addFact(fact);
          workingMemory.set(factId, this.facts.get(factId));
          trace.factsAdded.push(factId);
        }
        
        // Add extracted rules
        for (const rule of extractedKnowledge.rules) {
          const ruleId = await this.addRule(rule);
          workingRules.set(ruleId, this.rules.get(ruleId));
        }
      }
      
      // Perform forward chaining inference
      const inferenceResult = await this._forwardChaining(workingMemory, workingRules, trace, maxIterations, useLLM);
      
      // Update trace
      trace.endTime = Date.now();
      trace.conclusion = inferenceResult.conclusion;
      trace.confidence = inferenceResult.confidence;
      trace.status = 'completed';
      
      if (this.logger) {
        this.logger.debug(`Completed reasoning for query: ${query}`, { 
          traceId,
          iterations: trace.iterations,
          factCount: trace.factsAdded.length,
          ruleCount: trace.rulesTriggered.length,
          confidence: inferenceResult.confidence
        });
      }
      
      return {
        traceId,
        conclusion: inferenceResult.conclusion,
        confidence: inferenceResult.confidence,
        derivedFacts: inferenceResult.derivedFacts,
        iterations: trace.iterations,
        executionTime: trace.endTime - trace.startTime
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to perform reasoning: ${error.message}`, { 
          query: options.query, 
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
   * Performs forward chaining inference.
   * 
   * @private
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {Map<string, Object>} workingRules - Working rules
   * @param {Object} trace - Inference trace
   * @param {number} maxIterations - Maximum number of iterations
   * @param {boolean} useLLM - Whether to use LLM for conflict resolution
   * @returns {Promise<Object>} - Inference result
   */
  async _forwardChaining(workingMemory, workingRules, trace, maxIterations, useLLM) {
    try {
      let iterations = 0;
      let changes = true;
      
      // Continue until no changes or max iterations reached
      while (changes && iterations < maxIterations) {
        changes = false;
        iterations++;
        trace.iterations = iterations;
        
        // Get rules sorted by priority (highest first)
        const sortedRules = Array.from(workingRules.values())
          .sort((a, b) => b.priority - a.priority);
        
        // Check each rule
        for (const rule of sortedRules) {
          // Check if rule conditions are satisfied
          const matchResult = await this._matchRule(rule, workingMemory);
          
          if (matchResult.matches) {
            // Rule triggered
            changes = true;
            trace.rulesTriggered.push(rule.id);
            
            // Update rule statistics
            rule.lastFired = Date.now();
            rule.fireCount++;
            
            // Execute rule actions
            for (const action of rule.actions) {
              await this._executeAction(action, workingMemory, matchResult.bindings, trace, rule);
            }
            
            // Emit rule fired event
            this.emit("ruleFired", { 
              ruleId: rule.id, 
              rule, 
              bindings: matchResult.bindings 
            });
            
            // Break after first rule if conflict resolution is not enabled
            const useConflictResolution = this.configService ? 
              this.configService.get('reasoning.deductive.useConflictResolution', true) : true;
            
            if (!useConflictResolution) {
              break;
            }
          }
        }
      }
      
      // Derive conclusion
      const conclusionResult = await this._deriveConclusion(workingMemory, trace.query, useLLM);
      
      return {
        conclusion: conclusionResult.conclusion,
        confidence: conclusionResult.confidence,
        derivedFacts: Array.from(workingMemory.values())
          .filter(fact => fact.derived)
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Forward chaining error: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Checks if a rule's conditions are satisfied by the working memory.
   * 
   * @private
   * @param {Object} rule - Rule to check
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @returns {Promise<Object>} - Match result with bindings
   */
  async _matchRule(rule, workingMemory) {
    try {
      // If no conditions, rule doesn't match
      if (!rule.conditions || rule.conditions.length === 0) {
        return { matches: false, bindings: {} };
      }
      
      // Initialize bindings
      let bindings = {};
      
      // Check each condition
      for (const condition of rule.conditions) {
        const { predicate, arguments: args, operator = 'equals' } = condition;
        
        // Find matching facts
        let matchFound = false;
        
        for (const fact of workingMemory.values()) {
          if (fact.predicate === predicate) {
            // Check if arguments match
            const argMatch = await this._matchArguments(args, fact.arguments, operator, bindings);
            
            if (argMatch.matches) {
              // Update bindings
              bindings = { ...bindings, ...argMatch.bindings };
              matchFound = true;
              break;
            }
          }
        }
        
        // If any condition doesn't match, rule doesn't match
        if (!matchFound) {
          return { matches: false, bindings: {} };
        }
      }
      
      return { matches: true, bindings };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Rule matching error: ${error.message}`, { 
          ruleId: rule.id, 
          error: error.stack 
        });
      }
      return { matches: false, bindings: {} };
    }
  }

  /**
   * Matches arguments against fact arguments.
   * 
   * @private
   * @param {Object} conditionArgs - Condition arguments
   * @param {Object} factArgs - Fact arguments
   * @param {string} operator - Comparison operator
   * @param {Object} bindings - Current variable bindings
   * @returns {Promise<Object>} - Match result with updated bindings
   */
  async _matchArguments(conditionArgs, factArgs, operator, bindings) {
    try {
      const newBindings = { ...bindings };
      
      // Check each argument in the condition
      for (const [key, value] of Object.entries(conditionArgs)) {
        // Skip if fact doesn't have this argument
        if (!(key in factArgs)) {
          return { matches: false, bindings: {} };
        }
        
        const factValue = factArgs[key];
        
        // Handle variables (starting with ?)
        if (typeof value === 'string' && value.startsWith('?')) {
          // Variable binding
          const varName = value.substring(1);
          
          if (varName in newBindings) {
            // Variable already bound, check if values match
            if (!this._compareValues(newBindings[varName], factValue, 'equals')) {
              return { matches: false, bindings: {} };
            }
          } else {
            // Bind variable
            newBindings[varName] = factValue;
          }
        } else {
          // Literal value, compare directly
          if (!this._compareValues(value, factValue, operator)) {
            return { matches: false, bindings: {} };
          }
        }
      }
      
      return { matches: true, bindings: newBindings };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Argument matching error: ${error.message}`, { error: error.stack });
      }
      return { matches: false, bindings: {} };
    }
  }

  /**
   * Compares two values using the specified operator.
   * 
   * @private
   * @param {*} value1 - First value
   * @param {*} value2 - Second value
   * @param {string} operator - Comparison operator
   * @returns {boolean} - True if values match according to operator
   */
  _compareValues(value1, value2, operator) {
    try {
      switch (operator.toLowerCase()) {
        case 'equals':
          if (typeof value1 === 'object' && typeof value2 === 'object') {
            return JSON.stringify(value1) === JSON.stringify(value2);
          }
          return value1 === value2;
          
        case 'notequals':
          if (typeof value1 === 'object' && typeof value2 === 'object') {
            return JSON.stringify(value1) !== JSON.stringify(value2);
          }
          return value1 !== value2;
          
        case 'contains':
          if (typeof value2 === 'string' && typeof value1 === 'string') {
            return value2.includes(value1);
          } else if (Array.isArray(value2)) {
            return value2.includes(value1);
          }
          return false;
          
        case 'notcontains':
          if (typeof value2 === 'string' && typeof value1 === 'string') {
            return !value2.includes(value1);
          } else if (Array.isArray(value2)) {
            return !value2.includes(value1);
          }
          return true;
          
        case 'startswith':
          if (typeof value2 === 'string' && typeof value1 === 'string') {
            return value2.startsWith(value1);
          }
          return false;
          
        case 'endswith':
          if (typeof value2 === 'string' && typeof value1 === 'string') {
            return value2.endsWith(value1);
          }
          return false;
          
        case 'greaterthan':
          return value2 > value1;
          
        case 'lessthan':
          return value2 < value1;
          
        case 'greaterthanorequal':
          return value2 >= value1;
          
        case 'lessthanorequal':
          return value2 <= value1;
          
        default:
          return false;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Value comparison error: ${error.message}`, { 
          value1, 
          value2, 
          operator, 
          error: error.stack 
        });
      }
      return false;
    }
  }

  /**
   * Executes a rule action.
   * 
   * @private
   * @param {Object} action - Action to execute
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {Object} bindings - Variable bindings
   * @param {Object} trace - Inference trace
   * @param {Object} rule - Rule that triggered the action
   * @returns {Promise<void>}
   */
  async _executeAction(action, workingMemory, bindings, trace, rule) {
    try {
      const { type } = action;
      
      switch (type.toLowerCase()) {
        case 'assert':
          await this._executeAssertAction(action, workingMemory, bindings, trace, rule);
          break;
          
        case 'retract':
          await this._executeRetractAction(action, workingMemory, bindings, trace);
          break;
          
        case 'modify':
          await this._executeModifyAction(action, workingMemory, bindings, trace);
          break;
          
        default:
          if (this.logger) {
            this.logger.warn(`Unknown action type: ${type}`, { action });
          }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Action execution error: ${error.message}`, { 
          action, 
          error: error.stack 
        });
      }
      // Continue execution despite errors
    }
  }

  /**
   * Executes an assert action.
   * 
   * @private
   * @param {Object} action - Assert action
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {Object} bindings - Variable bindings
   * @param {Object} trace - Inference trace
   * @param {Object} rule - Rule that triggered the action
   * @returns {Promise<void>}
   */
  async _executeAssertAction(action, workingMemory, bindings, trace, rule) {
    try {
      const { predicate, arguments: args } = action;
      
      if (!predicate) {
        throw new Error("Assert action must have a predicate");
      }
      
      if (!args || typeof args !== 'object') {
        throw new Error("Assert action must have arguments object");
      }
      
      // Substitute variables in arguments
      const substitutedArgs = {};
      
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.startsWith('?')) {
          const varName = value.substring(1);
          if (varName in bindings) {
            substitutedArgs[key] = bindings[varName];
          } else {
            substitutedArgs[key] = value; // Keep as is if not bound
          }
        } else {
          substitutedArgs[key] = value;
        }
      }
      
      // Create new fact
      const factId = uuidv4();
      const fact = {
        id: factId,
        predicate,
        arguments: substitutedArgs,
        confidence: rule.confidence,
        source: 'derived',
        derived: true,
        derivedFrom: rule.id,
        createdAt: Date.now()
      };
      
      // Add to working memory
      workingMemory.set(factId, fact);
      
      // Add to global facts if configured
      const addDerivedToGlobal = this.configService ? 
        this.configService.get('reasoning.deductive.addDerivedFactsToGlobal', false) : false;
      
      if (addDerivedToGlobal) {
        this.facts.set(factId, fact);
      }
      
      // Update trace
      trace.factsAdded.push(factId);
      
      if (this.logger) {
        this.logger.debug(`Asserted new fact: ${factId}`, { 
          predicate,
          confidence: fact.confidence,
          derivedFrom: rule.id
        });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Assert action error: ${error.message}`, { 
          action, 
          error: error.stack 
        });
      }
      throw error;
    }
  }

  /**
   * Executes a retract action.
   * 
   * @private
   * @param {Object} action - Retract action
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {Object} bindings - Variable bindings
   * @param {Object} trace - Inference trace
   * @returns {Promise<void>}
   */
  async _executeRetractAction(action, workingMemory, bindings, trace) {
    try {
      const { factId } = action;
      
      if (!factId) {
        throw new Error("Retract action must specify factId");
      }
      
      // Handle variable binding
      let actualFactId = factId;
      if (typeof factId === 'string' && factId.startsWith('?')) {
        const varName = factId.substring(1);
        if (varName in bindings) {
          actualFactId = bindings[varName];
        } else {
          throw new Error(`Variable ${factId} not bound`);
        }
      }
      
      // Remove from working memory
      if (workingMemory.has(actualFactId)) {
        workingMemory.delete(actualFactId);
        
        if (this.logger) {
          this.logger.debug(`Retracted fact: ${actualFactId}`);
        }
      } else {
        if (this.logger) {
          this.logger.warn(`Fact not found for retraction: ${actualFactId}`);
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Retract action error: ${error.message}`, { 
          action, 
          error: error.stack 
        });
      }
      throw error;
    }
  }

  /**
   * Executes a modify action.
   * 
   * @private
   * @param {Object} action - Modify action
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {Object} bindings - Variable bindings
   * @param {Object} trace - Inference trace
   * @returns {Promise<void>}
   */
  async _executeModifyAction(action, workingMemory, bindings, trace) {
    try {
      const { factId, arguments: args } = action;
      
      if (!factId) {
        throw new Error("Modify action must specify factId");
      }
      
      if (!args || typeof args !== 'object') {
        throw new Error("Modify action must have arguments object");
      }
      
      // Handle variable binding
      let actualFactId = factId;
      if (typeof factId === 'string' && factId.startsWith('?')) {
        const varName = factId.substring(1);
        if (varName in bindings) {
          actualFactId = bindings[varName];
        } else {
          throw new Error(`Variable ${factId} not bound`);
        }
      }
      
      // Check if fact exists
      if (!workingMemory.has(actualFactId)) {
        throw new Error(`Fact not found for modification: ${actualFactId}`);
      }
      
      // Get existing fact
      const fact = workingMemory.get(actualFactId);
      
      // Substitute variables in arguments
      const substitutedArgs = {};
      
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.startsWith('?')) {
          const varName = value.substring(1);
          if (varName in bindings) {
            substitutedArgs[key] = bindings[varName];
          } else {
            substitutedArgs[key] = value; // Keep as is if not bound
          }
        } else {
          substitutedArgs[key] = value;
        }
      }
      
      // Update fact arguments
      fact.arguments = {
        ...fact.arguments,
        ...substitutedArgs
      };
      
      if (this.logger) {
        this.logger.debug(`Modified fact: ${actualFactId}`, { 
          modifiedKeys: Object.keys(substitutedArgs)
        });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Modify action error: ${error.message}`, { 
          action, 
          error: error.stack 
        });
      }
      throw error;
    }
  }

  /**
   * Derives a conclusion from the working memory.
   * 
   * @private
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {string} query - Original query
   * @param {boolean} useLLM - Whether to use LLM for conclusion generation
   * @returns {Promise<Object>} - Conclusion and confidence
   */
  async _deriveConclusion(workingMemory, query, useLLM) {
    try {
      // Check if there's a direct conclusion fact
      const conclusionFacts = Array.from(workingMemory.values())
        .filter(fact => fact.predicate === 'conclusion' || fact.predicate === 'answer');
      
      if (conclusionFacts.length > 0) {
        // Sort by confidence (highest first)
        conclusionFacts.sort((a, b) => b.confidence - a.confidence);
        
        const topFact = conclusionFacts[0];
        return {
          conclusion: topFact.arguments.text || topFact.arguments.value || JSON.stringify(topFact.arguments),
          confidence: topFact.confidence
        };
      }
      
      // Use LLM to generate conclusion if enabled
      if (useLLM && this.modelStrategyManager) {
        return this._generateConclusionWithLLM(workingMemory, query);
      }
      
      // Fallback: use derived facts as conclusion
      const derivedFacts = Array.from(workingMemory.values())
        .filter(fact => fact.derived)
        .sort((a, b) => b.confidence - a.confidence);
      
      if (derivedFacts.length > 0) {
        // Use the highest confidence derived fact
        const topFact = derivedFacts[0];
        
        return {
          conclusion: `${topFact.predicate}(${JSON.stringify(topFact.arguments)})`,
          confidence: topFact.confidence
        };
      }
      
      // No conclusion derived
      return {
        conclusion: "No conclusion could be derived from the available facts and rules.",
        confidence: 0
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Conclusion derivation error: ${error.message}`, { error: error.stack });
      }
      
      return {
        conclusion: `Error deriving conclusion: ${error.message}`,
        confidence: 0
      };
    }
  }

  /**
   * Generates a conclusion using LLM.
   * 
   * @private
   * @param {Map<string, Object>} workingMemory - Working memory (facts)
   * @param {string} query - Original query
   * @returns {Promise<Object>} - Conclusion and confidence
   */
  async _generateConclusionWithLLM(workingMemory, query) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM conclusion generation");
      }
      
      // Prepare facts for LLM
      const factsText = Array.from(workingMemory.values())
        .map(fact => {
          const argsText = Object.entries(fact.arguments)
            .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(', ');
          
          return `Fact${fact.derived ? ' (Derived)' : ''}: ${fact.predicate}(${argsText}) [confidence: ${fact.confidence}]`;
        })
        .join('\n');
      
      // Prepare prompt for LLM
      const prompt = `
        Given the following facts and the query "${query}", generate a clear and concise conclusion.
        
        Facts:
        ${factsText}
        
        Provide your conclusion in the following format:
        {
          "conclusion": "Your conclusion text here",
          "confidence": 0.X,
          "reasoning": "Brief explanation of your reasoning"
        }
        
        Ensure your conclusion directly addresses the query and is supported by the facts.
        Assign a confidence score between 0 and 1 based on how well-supported the conclusion is.
      `;
      
      // Call LLM to generate conclusion
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama3-70b', // Use Llama 3 70B for complex reasoning
        temperature: 0.1,
        maxTokens: 1000,
        responseFormat: 'json'
      });
      
      // Parse result
      let conclusion, confidence, reasoning;
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        conclusion = parsedResult.conclusion;
        confidence = parsedResult.confidence;
        reasoning = parsedResult.reasoning;
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM conclusion result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        
        // Use raw result as conclusion
        conclusion = typeof llmResult === 'string' ? llmResult : JSON.stringify(llmResult);
        confidence = 0.5;
      }
      
      return {
        conclusion,
        confidence,
        reasoning
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM conclusion generation error: ${error.message}`, { 
          query, 
          error: error.stack 
        });
      }
      
      // Fallback to basic conclusion
      return {
        conclusion: "Unable to generate conclusion using LLM.",
        confidence: 0.1
      };
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
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_getInferenceTrace");
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
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_explainInference");
    }

    try {
      const { 
        format = 'text', 
        detailed = false,
        useLLM = this.configService ? 
          this.configService.get('reasoning.deductive.useLLMForExplanation', true) : true
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
      // Basic explanation components
      const components = {
        summary: `Reasoning performed for query: "${trace.query}"`,
        iterations: `Performed ${trace.iterations} inference iterations`,
        factCount: `Processed ${trace.factsAdded.length} facts`,
        ruleCount: `Triggered ${trace.rulesTriggered.length} rules`,
        conclusion: `Conclusion: ${trace.conclusion || 'None'}`,
        confidence: `Confidence: ${trace.confidence.toFixed(2)}`
      };
      
      // Generate explanation based on format
      let content;
      
      switch (format.toLowerCase()) {
        case 'html':
          content = `
            <div class="reasoning-explanation">
              <h3>Reasoning Explanation</h3>
              <p>${components.summary}</p>
              <p>${components.iterations}</p>
              <p>${components.factCount}</p>
              <p>${components.ruleCount}</p>
              <h4>Conclusion</h4>
              <p>${components.conclusion}</p>
              <p>${components.confidence}</p>
              ${detailed ? this._generateDetailedHtml(trace) : ''}
            </div>
          `;
          break;
          
        case 'json':
          content = {
            summary: components.summary,
            iterations: trace.iterations,
            factCount: trace.factsAdded.length,
            ruleCount: trace.rulesTriggered.length,
            conclusion: trace.conclusion,
            confidence: trace.confidence,
            executionTime: trace.endTime - trace.startTime,
            details: detailed ? {
              triggeredRules: trace.rulesTriggered,
              derivedFacts: trace.factsAdded.filter(factId => {
                const fact = this.facts.get(factId);
                return fact && fact.derived;
              })
            } : undefined
          };
          break;
          
        case 'text':
        default:
          content = [
            components.summary,
            components.iterations,
            components.factCount,
            components.ruleCount,
            '',
            components.conclusion,
            components.confidence,
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
      const lines = ['Detailed Steps:'];
      
      // Add triggered rules
      lines.push('Triggered Rules:');
      for (const ruleId of trace.rulesTriggered) {
        const rule = this.rules.get(ruleId);
        if (rule) {
          lines.push(`- Rule: ${rule.name} (${ruleId})`);
          lines.push(`  Description: ${rule.description}`);
          lines.push(`  Confidence: ${rule.confidence.toFixed(2)}`);
        }
      }
      
      // Add derived facts
      lines.push('');
      lines.push('Derived Facts:');
      for (const factId of trace.factsAdded) {
        const fact = this.facts.get(factId);
        if (fact && fact.derived) {
          lines.push(`- Fact: ${fact.predicate} (${factId})`);
          lines.push(`  Arguments: ${JSON.stringify(fact.arguments)}`);
          lines.push(`  Confidence: ${fact.confidence.toFixed(2)}`);
          if (fact.derivedFrom) {
            lines.push(`  Derived From: ${fact.derivedFrom}`);
          }
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
      let html = '<div class="detailed-steps">';
      
      // Add triggered rules
      html += '<h4>Triggered Rules</h4>';
      html += '<ul>';
      for (const ruleId of trace.rulesTriggered) {
        const rule = this.rules.get(ruleId);
        if (rule) {
          html += `<li>
            <strong>${rule.name}</strong> (${ruleId})<br>
            <em>${rule.description}</em><br>
            Confidence: ${rule.confidence.toFixed(2)}
          </li>`;
        }
      }
      html += '</ul>';
      
      // Add derived facts
      html += '<h4>Derived Facts</h4>';
      html += '<ul>';
      for (const factId of trace.factsAdded) {
        const fact = this.facts.get(factId);
        if (fact && fact.derived) {
          html += `<li>
            <strong>${fact.predicate}</strong> (${factId})<br>
            Arguments: ${JSON.stringify(fact.arguments)}<br>
            Confidence: ${fact.confidence.toFixed(2)}
            ${fact.derivedFrom ? `<br>Derived From: ${fact.derivedFrom}` : ''}
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
      
      // Prepare trace data for LLM
      const traceData = {
        query: trace.query,
        iterations: trace.iterations,
        factCount: trace.factsAdded.length,
        ruleCount: trace.rulesTriggered.length,
        conclusion: trace.conclusion,
        confidence: trace.confidence,
        executionTime: trace.endTime - trace.startTime
      };
      
      // Add detailed data if requested
      if (detailed) {
        // Get triggered rules
        const triggeredRules = [];
        for (const ruleId of trace.rulesTriggered) {
          const rule = this.rules.get(ruleId);
          if (rule) {
            triggeredRules.push({
              id: rule.id,
              name: rule.name,
              description: rule.description,
              confidence: rule.confidence
            });
          }
        }
        
        // Get derived facts
        const derivedFacts = [];
        for (const factId of trace.factsAdded) {
          const fact = this.facts.get(factId);
          if (fact && fact.derived) {
            derivedFacts.push({
              id: fact.id,
              predicate: fact.predicate,
              arguments: fact.arguments,
              confidence: fact.confidence,
              derivedFrom: fact.derivedFrom
            });
          }
        }
        
        traceData.triggeredRules = triggeredRules;
        traceData.derivedFacts = derivedFacts;
      }
      
      // Prepare prompt for LLM
      const prompt = `
        Generate a clear explanation of the following deductive reasoning process.
        
        Reasoning Trace:
        ${JSON.stringify(traceData, null, 2)}
        
        ${detailed ? 'Include detailed explanations of the reasoning steps, rules triggered, and facts derived.' : 'Provide a concise summary of the reasoning process.'}
        
        Generate the explanation in ${format} format.
        ${format === 'json' ? 'Ensure the output is valid JSON.' : ''}
        ${format === 'html' ? 'Ensure the output is valid HTML with appropriate formatting.' : ''}
        
        Focus on explaining:
        1. How the conclusion was reached
        2. The key rules and facts that contributed to the conclusion
        3. The confidence level and why it has that value
        4. Any limitations or uncertainties in the reasoning process
      `;
      
      // Call LLM to generate explanation
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama3-70b', // Use Llama 3 70B for complex explanation
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
   * Gets statistics about the deductive reasoner.
   * 
   * @returns {Promise<Object>} - Reasoner statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_getStatistics");
    }

    try {
      // Count rules by source
      const rulesBySource = {};
      for (const rule of this.rules.values()) {
        const source = rule.source || 'unknown';
        rulesBySource[source] = (rulesBySource[source] || 0) + 1;
      }
      
      // Count facts by source
      const factsBySource = {};
      for (const fact of this.facts.values()) {
        const source = fact.source || 'unknown';
        factsBySource[source] = (factsBySource[source] || 0) + 1;
      }
      
      // Count derived facts
      const derivedFactCount = Array.from(this.facts.values())
        .filter(fact => fact.derived).length;
      
      // Get rule firing statistics
      const ruleFiringStats = {
        totalFirings: 0,
        avgConfidence: 0,
        maxFireCount: 0,
        minFireCount: Number.MAX_SAFE_INTEGER
      };
      
      for (const rule of this.rules.values()) {
        ruleFiringStats.totalFirings += rule.fireCount;
        ruleFiringStats.maxFireCount = Math.max(ruleFiringStats.maxFireCount, rule.fireCount);
        if (rule.fireCount > 0) {
          ruleFiringStats.minFireCount = Math.min(ruleFiringStats.minFireCount, rule.fireCount);
        }
      }
      
      if (this.rules.size > 0) {
        ruleFiringStats.avgFireCount = ruleFiringStats.totalFirings / this.rules.size;
      }
      
      if (ruleFiringStats.minFireCount === Number.MAX_SAFE_INTEGER) {
        ruleFiringStats.minFireCount = 0;
      }
      
      // Compile statistics
      const statistics = {
        ruleCount: this.rules.size,
        factCount: this.facts.size,
        derivedFactCount,
        traceCount: this.inferenceTraces.size,
        rulesBySource,
        factsBySource,
        ruleFiringStats,
        configuration: {
          maxIterations: this.maxIterations,
          confidenceThreshold: this.confidenceThreshold,
          useLLMForRuleExtraction: this.useLLMForRuleExtraction,
          useLLMForConflictResolution: this.useLLMForConflictResolution
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
   * Clears the working memory and rules.
   * 
   * @param {Object} [options] - Clear options
   * @param {boolean} [options.clearRules=false] - Whether to clear rules
   * @param {boolean} [options.clearFacts=true] - Whether to clear facts
   * @param {boolean} [options.clearTraces=false] - Whether to clear inference traces
   * @param {string} [options.source] - Only clear items from this source
   * @returns {Promise<Object>} - Clear result
   */
  async clear(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("deductiveReasoner_clear");
    }

    try {
      const { 
        clearRules = false, 
        clearFacts = true,
        clearTraces = false,
        source
      } = options;
      
      let rulesCleared = 0;
      let factsCleared = 0;
      let tracesCleared = 0;
      
      // Clear rules if requested
      if (clearRules) {
        if (source) {
          // Clear rules from specific source
          for (const [ruleId, rule] of this.rules.entries()) {
            if (rule.source === source) {
              this.rules.delete(ruleId);
              rulesCleared++;
            }
          }
        } else {
          // Clear all rules
          rulesCleared = this.rules.size;
          this.rules.clear();
        }
      }
      
      // Clear facts if requested
      if (clearFacts) {
        if (source) {
          // Clear facts from specific source
          for (const [factId, fact] of this.facts.entries()) {
            if (fact.source === source) {
              this.facts.delete(factId);
              factsCleared++;
            }
          }
        } else {
          // Clear all facts
          factsCleared = this.facts.size;
          this.facts.clear();
        }
      }
      
      // Clear traces if requested
      if (clearTraces) {
        tracesCleared = this.inferenceTraces.size;
        this.inferenceTraces.clear();
      }
      
      if (this.logger) {
        this.logger.debug(`Cleared reasoner memory`, { 
          rulesCleared,
          factsCleared,
          tracesCleared,
          source
        });
      }
      
      return {
        rulesCleared,
        factsCleared,
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

module.exports = { DeductiveReasoner };
