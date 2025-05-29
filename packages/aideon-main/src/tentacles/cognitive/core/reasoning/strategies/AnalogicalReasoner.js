/**
 * @fileoverview Analogical Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements analogical reasoning through domain mapping and similarity-based inference.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Analogical Reasoner for the Aideon AI Desktop Agent's Reasoning Engine.
 * Implements analogical reasoning through domain mapping and similarity-based inference.
 * 
 * @extends EventEmitter
 */
class AnalogicalReasoner extends EventEmitter {
  /**
   * Creates a new AnalogicalReasoner instance.
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
      throw new Error("AnalogicalReasoner requires a knowledgeGraphManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.securityManager = options.securityManager;
    this.modelStrategyManager = options.modelStrategyManager;
    this.vectorService = options.vectorService;
    
    // Analogical reasoning components
    this.sourceDomains = new Map(); // Map of domainId -> domain
    this.targetDomains = new Map(); // Map of domainId -> domain
    this.analogies = new Map(); // Map of analogyId -> analogy
    
    // Inference tracing
    this.inferenceTraces = new Map(); // Map of traceId -> trace
    
    // Configuration
    this.maxMappings = this.configService ? 
      this.configService.get('reasoning.analogical.maxMappings', 10) : 10;
    this.similarityThreshold = this.configService ? 
      this.configService.get('reasoning.analogical.similarityThreshold', 0.6) : 0.6;
    this.useLLMForDomainMapping = this.configService ? 
      this.configService.get('reasoning.analogical.useLLMForDomainMapping', true) : true;
    this.useLLMForInferenceGeneration = this.configService ? 
      this.configService.get('reasoning.analogical.useLLMForInferenceGeneration', true) : true;
    
    this.initialized = false;
  }

  /**
   * Initializes the Analogical Reasoner.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing AnalogicalReasoner");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_initialize");
    }

    try {
      // Load predefined domains and analogies if available
      await this._loadPredefinedDomains();
      await this._loadPredefinedAnalogies();
      
      this.initialized = true;

      if (this.logger) {
        this.logger.info("AnalogicalReasoner initialized successfully", {
          sourceDomainsCount: this.sourceDomains.size,
          targetDomainsCount: this.targetDomains.size,
          analogiesCount: this.analogies.size
        });
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("AnalogicalReasoner initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`AnalogicalReasoner initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Loads predefined domains from configuration or knowledge graph.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPredefinedDomains() {
    try {
      // Check if domains are defined in configuration
      const configSourceDomains = this.configService ? 
        this.configService.get('reasoning.analogical.predefinedSourceDomains', []) : [];
      
      for (const domainConfig of configSourceDomains) {
        await this.addSourceDomain(domainConfig);
      }
      
      const configTargetDomains = this.configService ? 
        this.configService.get('reasoning.analogical.predefinedTargetDomains', []) : [];
      
      for (const domainConfig of configTargetDomains) {
        await this.addTargetDomain(domainConfig);
      }
      
      // Load domains from knowledge graph if enabled
      const loadFromKG = this.configService ? 
        this.configService.get('reasoning.analogical.loadDomainsFromKnowledgeGraph', true) : true;
      
      if (loadFromKG && this.knowledgeGraphManager) {
        // Load source domains
        const sourceDomainNodes = await this.knowledgeGraphManager.findNodes({
          nodeType: 'Domain',
          properties: {
            domainType: 'source'
          }
        });
        
        for (const domainNode of sourceDomainNodes) {
          const domain = this._convertNodeToDomain(domainNode);
          if (domain) {
            await this.addSourceDomain(domain);
          }
        }
        
        // Load target domains
        const targetDomainNodes = await this.knowledgeGraphManager.findNodes({
          nodeType: 'Domain',
          properties: {
            domainType: 'target'
          }
        });
        
        for (const domainNode of targetDomainNodes) {
          const domain = this._convertNodeToDomain(domainNode);
          if (domain) {
            await this.addTargetDomain(domain);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Loaded ${this.sourceDomains.size} source domains and ${this.targetDomains.size} target domains`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load predefined domains: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Loads predefined analogies from configuration or knowledge graph.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPredefinedAnalogies() {
    try {
      // Check if analogies are defined in configuration
      const configAnalogies = this.configService ? 
        this.configService.get('reasoning.analogical.predefinedAnalogies', []) : [];
      
      for (const analogyConfig of configAnalogies) {
        await this.addAnalogy(analogyConfig);
      }
      
      // Load analogies from knowledge graph if enabled
      const loadFromKG = this.configService ? 
        this.configService.get('reasoning.analogical.loadAnalogiesFromKnowledgeGraph', true) : true;
      
      if (loadFromKG && this.knowledgeGraphManager) {
        const analogyNodes = await this.knowledgeGraphManager.findNodes({
          nodeType: 'Analogy'
        });
        
        for (const analogyNode of analogyNodes) {
          const analogy = this._convertNodeToAnalogy(analogyNode);
          if (analogy) {
            await this.addAnalogy(analogy);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Loaded ${this.analogies.size} predefined analogies`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load predefined analogies: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Converts a knowledge graph node to a domain object.
   * 
   * @private
   * @param {Object} node - Knowledge graph node
   * @returns {Object|null} - Domain object or null if conversion failed
   */
  _convertNodeToDomain(node) {
    try {
      if (!node || !node.properties) {
        return null;
      }
      
      const { 
        name, 
        description, 
        entities, 
        relations, 
        attributes, 
        domainType 
      } = node.properties;
      
      if (!name) {
        return null;
      }
      
      return {
        id: node.id,
        name,
        description: description || '',
        entities: typeof entities === 'string' ? JSON.parse(entities) : entities || [],
        relations: typeof relations === 'string' ? JSON.parse(relations) : relations || [],
        attributes: typeof attributes === 'string' ? JSON.parse(attributes) : attributes || [],
        domainType: domainType || 'source',
        source: 'knowledge_graph',
        sourceNodeId: node.id
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to convert node to domain: ${error.message}`, { 
          nodeId: node.id, 
          error: error.stack 
        });
      }
      return null;
    }
  }

  /**
   * Converts a knowledge graph node to an analogy object.
   * 
   * @private
   * @param {Object} node - Knowledge graph node
   * @returns {Object|null} - Analogy object or null if conversion failed
   */
  _convertNodeToAnalogy(node) {
    try {
      if (!node || !node.properties) {
        return null;
      }
      
      const { 
        name, 
        description, 
        sourceDomainId, 
        targetDomainId, 
        mappings, 
        similarity, 
        inferences 
      } = node.properties;
      
      if (!sourceDomainId || !targetDomainId) {
        return null;
      }
      
      return {
        id: node.id,
        name: name || `Analogy_${node.id}`,
        description: description || '',
        sourceDomainId,
        targetDomainId,
        mappings: typeof mappings === 'string' ? JSON.parse(mappings) : mappings || [],
        similarity: similarity || 0,
        inferences: typeof inferences === 'string' ? JSON.parse(inferences) : inferences || [],
        source: 'knowledge_graph',
        sourceNodeId: node.id
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to convert node to analogy: ${error.message}`, { 
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
      throw new Error("AnalogicalReasoner is not initialized. Call initialize() first.");
    }
  }

  /**
   * Adds a source domain to the reasoner.
   * 
   * @param {Object} domain - Source domain definition
   * @param {string} [domain.id] - Unique identifier (generated if not provided)
   * @param {string} domain.name - Name of the domain
   * @param {string} [domain.description] - Description of the domain
   * @param {Array<Object>} [domain.entities=[]] - Entities in the domain
   * @param {Array<Object>} [domain.relations=[]] - Relations in the domain
   * @param {Array<Object>} [domain.attributes=[]] - Attributes in the domain
   * @param {string} [domain.source='user'] - Source of the domain
   * @returns {Promise<string>} - ID of the added domain
   */
  async addSourceDomain(domain) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_addSourceDomain");
    }

    try {
      // Validate domain
      if (!domain.name) {
        throw new Error("Domain must have a name");
      }
      
      // Generate ID if not provided
      const domainId = domain.id || uuidv4();
      
      // Create domain object
      const domainObj = {
        id: domainId,
        name: domain.name,
        description: domain.description || '',
        entities: domain.entities || [],
        relations: domain.relations || [],
        attributes: domain.attributes || [],
        domainType: 'source',
        source: domain.source || 'user',
        createdAt: Date.now()
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyDomainSecurityPolicies) {
        await this.securityManager.applyDomainSecurityPolicies(domainObj);
      }
      
      // Store domain
      this.sourceDomains.set(domainId, domainObj);
      
      if (this.logger) {
        this.logger.debug(`Added source domain: ${domainId}`, { 
          name: domainObj.name
        });
      }
      
      this.emit("sourceDomainAdded", { domainId, domain: domainObj });
      return domainId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add source domain: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Adds a target domain to the reasoner.
   * 
   * @param {Object} domain - Target domain definition
   * @param {string} [domain.id] - Unique identifier (generated if not provided)
   * @param {string} domain.name - Name of the domain
   * @param {string} [domain.description] - Description of the domain
   * @param {Array<Object>} [domain.entities=[]] - Entities in the domain
   * @param {Array<Object>} [domain.relations=[]] - Relations in the domain
   * @param {Array<Object>} [domain.attributes=[]] - Attributes in the domain
   * @param {string} [domain.source='user'] - Source of the domain
   * @returns {Promise<string>} - ID of the added domain
   */
  async addTargetDomain(domain) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_addTargetDomain");
    }

    try {
      // Validate domain
      if (!domain.name) {
        throw new Error("Domain must have a name");
      }
      
      // Generate ID if not provided
      const domainId = domain.id || uuidv4();
      
      // Create domain object
      const domainObj = {
        id: domainId,
        name: domain.name,
        description: domain.description || '',
        entities: domain.entities || [],
        relations: domain.relations || [],
        attributes: domain.attributes || [],
        domainType: 'target',
        source: domain.source || 'user',
        createdAt: Date.now()
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyDomainSecurityPolicies) {
        await this.securityManager.applyDomainSecurityPolicies(domainObj);
      }
      
      // Store domain
      this.targetDomains.set(domainId, domainObj);
      
      if (this.logger) {
        this.logger.debug(`Added target domain: ${domainId}`, { 
          name: domainObj.name
        });
      }
      
      this.emit("targetDomainAdded", { domainId, domain: domainObj });
      return domainId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add target domain: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes a domain from the reasoner.
   * 
   * @param {string} domainId - ID of the domain to remove
   * @param {string} domainType - Type of domain ('source' or 'target')
   * @returns {Promise<boolean>} - True if the domain was removed
   */
  async removeDomain(domainId, domainType) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_removeDomain");
    }

    try {
      // Check domain type
      if (domainType !== 'source' && domainType !== 'target') {
        throw new Error(`Invalid domain type: ${domainType}. Must be 'source' or 'target'.`);
      }
      
      // Get domain map
      const domainMap = domainType === 'source' ? this.sourceDomains : this.targetDomains;
      
      // Check if domain exists
      if (!domainMap.has(domainId)) {
        throw new Error(`${domainType} domain not found: ${domainId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyDomainRemovalPolicies) {
        const domain = domainMap.get(domainId);
        await this.securityManager.applyDomainRemovalPolicies(domain);
      }
      
      // Remove domain
      domainMap.delete(domainId);
      
      // Remove analogies that use this domain
      for (const [analogyId, analogy] of this.analogies.entries()) {
        if ((domainType === 'source' && analogy.sourceDomainId === domainId) ||
            (domainType === 'target' && analogy.targetDomainId === domainId)) {
          this.analogies.delete(analogyId);
          
          if (this.logger) {
            this.logger.debug(`Removed analogy ${analogyId} due to domain removal`);
          }
          
          this.emit("analogyRemoved", { analogyId });
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Removed ${domainType} domain: ${domainId}`);
      }
      
      this.emit(`${domainType}DomainRemoved`, { domainId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove domain: ${error.message}`, { 
          domainId, 
          domainType,
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
   * Adds an analogy to the reasoner.
   * 
   * @param {Object} analogy - Analogy definition
   * @param {string} [analogy.id] - Unique identifier (generated if not provided)
   * @param {string} analogy.name - Name of the analogy
   * @param {string} [analogy.description] - Description of the analogy
   * @param {string} analogy.sourceDomainId - ID of the source domain
   * @param {string} analogy.targetDomainId - ID of the target domain
   * @param {Array<Object>} [analogy.mappings=[]] - Mappings between source and target domains
   * @param {number} [analogy.similarity=0] - Similarity score (0-1)
   * @param {Array<Object>} [analogy.inferences=[]] - Inferences derived from the analogy
   * @param {string} [analogy.source='user'] - Source of the analogy
   * @returns {Promise<string>} - ID of the added analogy
   */
  async addAnalogy(analogy) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_addAnalogy");
    }

    try {
      // Validate analogy
      if (!analogy.sourceDomainId || !analogy.targetDomainId) {
        throw new Error("Analogy must have source and target domain IDs");
      }
      
      // Check if domains exist
      if (!this.sourceDomains.has(analogy.sourceDomainId)) {
        throw new Error(`Source domain not found: ${analogy.sourceDomainId}`);
      }
      
      if (!this.targetDomains.has(analogy.targetDomainId)) {
        throw new Error(`Target domain not found: ${analogy.targetDomainId}`);
      }
      
      // Generate ID if not provided
      const analogyId = analogy.id || uuidv4();
      
      // Create analogy object
      const analogyObj = {
        id: analogyId,
        name: analogy.name || `Analogy_${analogyId}`,
        description: analogy.description || '',
        sourceDomainId: analogy.sourceDomainId,
        targetDomainId: analogy.targetDomainId,
        mappings: analogy.mappings || [],
        similarity: analogy.similarity || 0,
        inferences: analogy.inferences || [],
        source: analogy.source || 'user',
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyAnalogySecurityPolicies) {
        await this.securityManager.applyAnalogySecurityPolicies(analogyObj);
      }
      
      // Store analogy
      this.analogies.set(analogyId, analogyObj);
      
      if (this.logger) {
        this.logger.debug(`Added analogy: ${analogyId}`, { 
          name: analogyObj.name,
          sourceDomainId: analogyObj.sourceDomainId,
          targetDomainId: analogyObj.targetDomainId
        });
      }
      
      this.emit("analogyAdded", { analogyId, analogy: analogyObj });
      return analogyId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add analogy: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Removes an analogy from the reasoner.
   * 
   * @param {string} analogyId - ID of the analogy to remove
   * @returns {Promise<boolean>} - True if the analogy was removed
   */
  async removeAnalogy(analogyId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_removeAnalogy");
    }

    try {
      // Check if analogy exists
      if (!this.analogies.has(analogyId)) {
        throw new Error(`Analogy not found: ${analogyId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyAnalogyRemovalPolicies) {
        const analogy = this.analogies.get(analogyId);
        await this.securityManager.applyAnalogyRemovalPolicies(analogy);
      }
      
      // Remove analogy
      this.analogies.delete(analogyId);
      
      if (this.logger) {
        this.logger.debug(`Removed analogy: ${analogyId}`);
      }
      
      this.emit("analogyRemoved", { analogyId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove analogy: ${error.message}`, { 
          analogyId, 
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
   * Performs analogical reasoning between source and target domains.
   * 
   * @param {Object} options - Reasoning options
   * @param {string} options.sourceDomainId - ID of the source domain
   * @param {string} options.targetDomainId - ID of the target domain
   * @param {Object} [options.context] - Context information
   * @param {boolean} [options.useLLM=true] - Whether to use LLM for domain mapping
   * @param {number} [options.maxMappings=10] - Maximum number of mappings to generate
   * @returns {Promise<Object>} - Reasoning result with generated analogy
   */
  async reason(options) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_reason");
    }

    try {
      const { 
        sourceDomainId, 
        targetDomainId, 
        context = {}, 
        useLLM = this.useLLMForDomainMapping,
        maxMappings = this.maxMappings
      } = options;
      
      // Validate domain IDs
      if (!sourceDomainId || !targetDomainId) {
        throw new Error("Source and target domain IDs are required for analogical reasoning");
      }
      
      // Check if domains exist
      if (!this.sourceDomains.has(sourceDomainId)) {
        throw new Error(`Source domain not found: ${sourceDomainId}`);
      }
      
      if (!this.targetDomains.has(targetDomainId)) {
        throw new Error(`Target domain not found: ${targetDomainId}`);
      }
      
      // Get domains
      const sourceDomain = this.sourceDomains.get(sourceDomainId);
      const targetDomain = this.targetDomains.get(targetDomainId);
      
      // Create inference trace
      const traceId = uuidv4();
      const trace = {
        id: traceId,
        sourceDomainId,
        targetDomainId,
        context,
        startTime: Date.now(),
        endTime: null,
        mappingsGenerated: [],
        inferencesGenerated: [],
        analogyId: null,
        status: 'running'
      };
      
      this.inferenceTraces.set(traceId, trace);
      
      // Check for existing analogy
      const existingAnalogy = this._findExistingAnalogy(sourceDomainId, targetDomainId);
      
      let analogy;
      
      if (existingAnalogy) {
        // Use existing analogy
        analogy = existingAnalogy;
        trace.analogyId = existingAnalogy.id;
        
        if (this.logger) {
          this.logger.debug(`Using existing analogy: ${existingAnalogy.id}`);
        }
      } else {
        // Generate new analogy
        
        // Generate mappings
        let mappings;
        if (useLLM && this.modelStrategyManager) {
          mappings = await this._generateMappingsWithLLM(
            sourceDomain, targetDomain, context, maxMappings
          );
        } else {
          mappings = await this._generateMappingsWithAlgorithms(
            sourceDomain, targetDomain, context, maxMappings
          );
        }
        
        trace.mappingsGenerated = mappings.map(m => m.id);
        
        // Calculate similarity
        const similarity = this._calculateSimilarity(mappings, sourceDomain, targetDomain);
        
        // Generate inferences
        let inferences = [];
        if (similarity >= this.similarityThreshold) {
          if (useLLM && this.modelStrategyManager && this.useLLMForInferenceGeneration) {
            inferences = await this._generateInferencesWithLLM(
              sourceDomain, targetDomain, mappings, context
            );
          } else {
            inferences = await this._generateInferencesWithAlgorithms(
              sourceDomain, targetDomain, mappings, context
            );
          }
          
          trace.inferencesGenerated = inferences.map(i => i.id);
        }
        
        // Create analogy
        const analogyId = await this.addAnalogy({
          name: `${sourceDomain.name} to ${targetDomain.name}`,
          description: `Analogy between ${sourceDomain.name} and ${targetDomain.name}`,
          sourceDomainId,
          targetDomainId,
          mappings,
          similarity,
          inferences,
          source: 'analogical_reasoning'
        });
        
        analogy = this.analogies.get(analogyId);
        trace.analogyId = analogyId;
      }
      
      // Update trace
      trace.endTime = Date.now();
      trace.status = 'completed';
      
      if (this.logger) {
        this.logger.debug(`Completed analogical reasoning`, { 
          traceId,
          sourceDomainId,
          targetDomainId,
          mappingCount: analogy.mappings.length,
          inferenceCount: analogy.inferences.length,
          similarity: analogy.similarity
        });
      }
      
      return {
        traceId,
        analogy,
        executionTime: trace.endTime - trace.startTime
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to perform analogical reasoning: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Finds an existing analogy between source and target domains.
   * 
   * @private
   * @param {string} sourceDomainId - ID of the source domain
   * @param {string} targetDomainId - ID of the target domain
   * @returns {Object|null} - Existing analogy or null if not found
   */
  _findExistingAnalogy(sourceDomainId, targetDomainId) {
    for (const analogy of this.analogies.values()) {
      if (analogy.sourceDomainId === sourceDomainId && 
          analogy.targetDomainId === targetDomainId) {
        return analogy;
      }
    }
    
    return null;
  }

  /**
   * Generates mappings between domains using algorithms.
   * 
   * @private
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @param {Object} context - Context information
   * @param {number} maxMappings - Maximum number of mappings to generate
   * @returns {Promise<Array<Object>>} - Generated mappings
   */
  async _generateMappingsWithAlgorithms(sourceDomain, targetDomain, context, maxMappings) {
    try {
      const mappings = [];
      
      // Simple entity mapping based on name similarity
      for (const sourceEntity of sourceDomain.entities) {
        const sourceEntityName = sourceEntity.name.toLowerCase();
        
        for (const targetEntity of targetDomain.entities) {
          const targetEntityName = targetEntity.name.toLowerCase();
          
          // Calculate string similarity
          const similarity = this._calculateStringSimilarity(sourceEntityName, targetEntityName);
          
          if (similarity > 0.5) {
            mappings.push({
              id: uuidv4(),
              type: 'entity',
              sourceId: sourceEntity.id,
              sourceName: sourceEntity.name,
              targetId: targetEntity.id,
              targetName: targetEntity.name,
              similarity,
              description: `${sourceEntity.name} maps to ${targetEntity.name}`,
              confidence: similarity
            });
          }
        }
      }
      
      // Simple relation mapping based on name similarity
      for (const sourceRelation of sourceDomain.relations) {
        const sourceRelationName = sourceRelation.name.toLowerCase();
        
        for (const targetRelation of targetDomain.relations) {
          const targetRelationName = targetRelation.name.toLowerCase();
          
          // Calculate string similarity
          const similarity = this._calculateStringSimilarity(sourceRelationName, targetRelationName);
          
          if (similarity > 0.5) {
            mappings.push({
              id: uuidv4(),
              type: 'relation',
              sourceId: sourceRelation.id,
              sourceName: sourceRelation.name,
              targetId: targetRelation.id,
              targetName: targetRelation.name,
              similarity,
              description: `${sourceRelation.name} maps to ${targetRelation.name}`,
              confidence: similarity
            });
          }
        }
      }
      
      // Simple attribute mapping based on name similarity
      for (const sourceAttribute of sourceDomain.attributes) {
        const sourceAttributeName = sourceAttribute.name.toLowerCase();
        
        for (const targetAttribute of targetDomain.attributes) {
          const targetAttributeName = targetAttribute.name.toLowerCase();
          
          // Calculate string similarity
          const similarity = this._calculateStringSimilarity(sourceAttributeName, targetAttributeName);
          
          if (similarity > 0.5) {
            mappings.push({
              id: uuidv4(),
              type: 'attribute',
              sourceId: sourceAttribute.id,
              sourceName: sourceAttribute.name,
              targetId: targetAttribute.id,
              targetName: targetAttribute.name,
              similarity,
              description: `${sourceAttribute.name} maps to ${targetAttribute.name}`,
              confidence: similarity
            });
          }
        }
      }
      
      // Sort mappings by similarity and limit to maxMappings
      mappings.sort((a, b) => b.similarity - a.similarity);
      return mappings.slice(0, maxMappings);
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Algorithmic mapping generation error: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }

  /**
   * Calculates string similarity using Levenshtein distance.
   * 
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  _calculateStringSimilarity(str1, str2) {
    // Simple Levenshtein distance implementation
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create matrix
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Calculate similarity
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return maxLen > 0 ? 1 - (distance / maxLen) : 1;
  }

  /**
   * Generates mappings between domains using LLM.
   * 
   * @private
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @param {Object} context - Context information
   * @param {number} maxMappings - Maximum number of mappings to generate
   * @returns {Promise<Array<Object>>} - Generated mappings
   */
  async _generateMappingsWithLLM(sourceDomain, targetDomain, context, maxMappings) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM mapping generation");
      }
      
      // Prepare domains for LLM
      const sourceDomainText = JSON.stringify({
        name: sourceDomain.name,
        description: sourceDomain.description,
        entities: sourceDomain.entities,
        relations: sourceDomain.relations,
        attributes: sourceDomain.attributes
      }, null, 2);
      
      const targetDomainText = JSON.stringify({
        name: targetDomain.name,
        description: targetDomain.description,
        entities: targetDomain.entities,
        relations: targetDomain.relations,
        attributes: targetDomain.attributes
      }, null, 2);
      
      // Prepare prompt for LLM
      const prompt = `
        Generate mappings between the following source and target domains using analogical reasoning.
        
        Source Domain:
        ${sourceDomainText}
        
        Target Domain:
        ${targetDomainText}
        
        Context:
        ${JSON.stringify(context)}
        
        Generate up to ${maxMappings} mappings in the following JSON format:
        [
          {
            "type": "entity|relation|attribute",
            "sourceId": "ID of source element",
            "sourceName": "Name of source element",
            "targetId": "ID of target element",
            "targetName": "Name of target element",
            "similarity": 0.X, // Similarity score (0-1)
            "description": "Description of the mapping",
            "confidence": 0.X // Confidence in the mapping (0-1)
          }
        ]
        
        Focus on mappings that capture meaningful analogical relationships between the domains.
        Consider structural similarities, functional roles, and semantic relationships.
      `;
      
      // Call LLM to generate mappings
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for domain mapping with multilingual support
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json'
      });
      
      // Parse and validate mappings
      let mappings = [];
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        if (Array.isArray(parsedResult)) {
          mappings = parsedResult;
        } else if (parsedResult.mappings && Array.isArray(parsedResult.mappings)) {
          mappings = parsedResult.mappings;
        }
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM mapping generation result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        // Fallback to empty mappings
        mappings = [];
      }
      
      // Validate and format mappings
      const validMappings = [];
      for (const m of mappings) {
        if (m.sourceId && m.targetId) {
          validMappings.push({
            id: uuidv4(),
            type: m.type || 'entity',
            sourceId: m.sourceId,
            sourceName: m.sourceName || m.sourceId,
            targetId: m.targetId,
            targetName: m.targetName || m.targetId,
            similarity: m.similarity || 0.5,
            description: m.description || `${m.sourceName || m.sourceId} maps to ${m.targetName || m.targetId}`,
            confidence: m.confidence || 0.5
          });
        }
      }
      
      return validMappings;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM mapping generation error: ${error.message}`, { error: error.stack });
      }
      // Fallback to algorithmic generation on LLM failure
      return this._generateMappingsWithAlgorithms(sourceDomain, targetDomain, context, maxMappings);
    }
  }

  /**
   * Calculates similarity between domains based on mappings.
   * 
   * @private
   * @param {Array<Object>} mappings - Mappings between domains
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @returns {number} - Similarity score (0-1)
   */
  _calculateSimilarity(mappings, sourceDomain, targetDomain) {
    try {
      if (mappings.length === 0) {
        return 0;
      }
      
      // Calculate average mapping similarity
      const avgMappingSimilarity = mappings.reduce((sum, m) => sum + m.similarity, 0) / mappings.length;
      
      // Calculate coverage
      const sourceEntityIds = new Set(sourceDomain.entities.map(e => e.id));
      const targetEntityIds = new Set(targetDomain.entities.map(e => e.id));
      
      const sourceRelationIds = new Set(sourceDomain.relations.map(r => r.id));
      const targetRelationIds = new Set(targetDomain.relations.map(r => r.id));
      
      const sourceAttributeIds = new Set(sourceDomain.attributes.map(a => a.id));
      const targetAttributeIds = new Set(targetDomain.attributes.map(a => a.id));
      
      const mappedSourceEntityIds = new Set();
      const mappedTargetEntityIds = new Set();
      const mappedSourceRelationIds = new Set();
      const mappedTargetRelationIds = new Set();
      const mappedSourceAttributeIds = new Set();
      const mappedTargetAttributeIds = new Set();
      
      for (const mapping of mappings) {
        if (mapping.type === 'entity') {
          if (sourceEntityIds.has(mapping.sourceId)) {
            mappedSourceEntityIds.add(mapping.sourceId);
          }
          if (targetEntityIds.has(mapping.targetId)) {
            mappedTargetEntityIds.add(mapping.targetId);
          }
        } else if (mapping.type === 'relation') {
          if (sourceRelationIds.has(mapping.sourceId)) {
            mappedSourceRelationIds.add(mapping.sourceId);
          }
          if (targetRelationIds.has(mapping.targetId)) {
            mappedTargetRelationIds.add(mapping.targetId);
          }
        } else if (mapping.type === 'attribute') {
          if (sourceAttributeIds.has(mapping.sourceId)) {
            mappedSourceAttributeIds.add(mapping.sourceId);
          }
          if (targetAttributeIds.has(mapping.targetId)) {
            mappedTargetAttributeIds.add(mapping.targetId);
          }
        }
      }
      
      // Calculate coverage ratios
      const sourceEntityCoverage = sourceEntityIds.size > 0 ? 
        mappedSourceEntityIds.size / sourceEntityIds.size : 0;
      
      const targetEntityCoverage = targetEntityIds.size > 0 ? 
        mappedTargetEntityIds.size / targetEntityIds.size : 0;
      
      const sourceRelationCoverage = sourceRelationIds.size > 0 ? 
        mappedSourceRelationIds.size / sourceRelationIds.size : 0;
      
      const targetRelationCoverage = targetRelationIds.size > 0 ? 
        mappedTargetRelationIds.size / targetRelationIds.size : 0;
      
      const sourceAttributeCoverage = sourceAttributeIds.size > 0 ? 
        mappedSourceAttributeIds.size / sourceAttributeIds.size : 0;
      
      const targetAttributeCoverage = targetAttributeIds.size > 0 ? 
        mappedTargetAttributeIds.size / targetAttributeIds.size : 0;
      
      // Calculate overall coverage
      const sourceCoverage = (sourceEntityCoverage + sourceRelationCoverage + sourceAttributeCoverage) / 3;
      const targetCoverage = (targetEntityCoverage + targetRelationCoverage + targetAttributeCoverage) / 3;
      const overallCoverage = (sourceCoverage + targetCoverage) / 2;
      
      // Calculate overall similarity
      const similarity = (avgMappingSimilarity * 0.6) + (overallCoverage * 0.4);
      
      return Math.min(1, Math.max(0, similarity));
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Similarity calculation error: ${error.message}`, { error: error.stack });
      }
      return 0;
    }
  }

  /**
   * Generates inferences using algorithms.
   * 
   * @private
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @param {Array<Object>} mappings - Mappings between domains
   * @param {Object} context - Context information
   * @returns {Promise<Array<Object>>} - Generated inferences
   */
  async _generateInferencesWithAlgorithms(sourceDomain, targetDomain, mappings, context) {
    try {
      const inferences = [];
      
      // Simple inference generation based on relation mappings
      // For each relation in the source domain that has a mapping
      for (const sourceRelation of sourceDomain.relations) {
        // Find mapping for this relation
        const relationMapping = mappings.find(m => 
          m.type === 'relation' && m.sourceId === sourceRelation.id
        );
        
        if (relationMapping) {
          // Find entity mappings for the entities involved in this relation
          const sourceEntityIds = sourceRelation.entityIds || [];
          
          for (const sourceEntityId of sourceEntityIds) {
            const entityMapping = mappings.find(m => 
              m.type === 'entity' && m.sourceId === sourceEntityId
            );
            
            if (entityMapping) {
              // Generate inference
              inferences.push({
                id: uuidv4(),
                type: 'relation_transfer',
                description: `If ${entityMapping.sourceName} ${sourceRelation.name} in the source domain, then ${entityMapping.targetName} ${relationMapping.targetName} in the target domain`,
                confidence: (relationMapping.confidence + entityMapping.confidence) / 2,
                sourceMappingIds: [relationMapping.id, entityMapping.id],
                generatedAt: Date.now()
              });
            }
          }
        }
      }
      
      // Simple inference generation based on attribute mappings
      // For each attribute in the source domain that has a mapping
      for (const sourceAttribute of sourceDomain.attributes) {
        // Find mapping for this attribute
        const attributeMapping = mappings.find(m => 
          m.type === 'attribute' && m.sourceId === sourceAttribute.id
        );
        
        if (attributeMapping) {
          // Find entity mapping for the entity that has this attribute
          const sourceEntityId = sourceAttribute.entityId;
          
          if (sourceEntityId) {
            const entityMapping = mappings.find(m => 
              m.type === 'entity' && m.sourceId === sourceEntityId
            );
            
            if (entityMapping) {
              // Generate inference
              inferences.push({
                id: uuidv4(),
                type: 'attribute_transfer',
                description: `If ${entityMapping.sourceName} has attribute ${sourceAttribute.name} in the source domain, then ${entityMapping.targetName} may have attribute ${attributeMapping.targetName} in the target domain`,
                confidence: (attributeMapping.confidence + entityMapping.confidence) / 2,
                sourceMappingIds: [attributeMapping.id, entityMapping.id],
                generatedAt: Date.now()
              });
            }
          }
        }
      }
      
      return inferences;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Algorithmic inference generation error: ${error.message}`, { error: error.stack });
      }
      return [];
    }
  }

  /**
   * Generates inferences using LLM.
   * 
   * @private
   * @param {Object} sourceDomain - Source domain
   * @param {Object} targetDomain - Target domain
   * @param {Array<Object>} mappings - Mappings between domains
   * @param {Object} context - Context information
   * @returns {Promise<Array<Object>>} - Generated inferences
   */
  async _generateInferencesWithLLM(sourceDomain, targetDomain, mappings, context) {
    try {
      if (!this.modelStrategyManager) {
        throw new Error("ModelStrategyManager is required for LLM inference generation");
      }
      
      // Prepare domains and mappings for LLM
      const sourceDomainText = JSON.stringify({
        name: sourceDomain.name,
        description: sourceDomain.description,
        entities: sourceDomain.entities,
        relations: sourceDomain.relations,
        attributes: sourceDomain.attributes
      }, null, 2);
      
      const targetDomainText = JSON.stringify({
        name: targetDomain.name,
        description: targetDomain.description,
        entities: targetDomain.entities,
        relations: targetDomain.relations,
        attributes: targetDomain.attributes
      }, null, 2);
      
      const mappingsText = JSON.stringify(mappings, null, 2);
      
      // Prepare prompt for LLM
      const prompt = `
        Generate inferences based on the analogical mapping between the following source and target domains.
        
        Source Domain:
        ${sourceDomainText}
        
        Target Domain:
        ${targetDomainText}
        
        Mappings:
        ${mappingsText}
        
        Context:
        ${JSON.stringify(context)}
        
        Generate inferences in the following JSON format:
        [
          {
            "type": "relation_transfer|attribute_transfer|structure_transfer|causal_transfer",
            "description": "Detailed description of the inference",
            "confidence": 0.X, // Confidence in the inference (0-1)
            "sourceMappingIds": ["list", "of", "mapping", "ids"]
          }
        ]
        
        Focus on generating inferences that:
        1. Transfer knowledge from the source domain to the target domain
        2. Identify potential new relations or attributes in the target domain
        3. Predict causal relationships in the target domain based on the source domain
        4. Identify structural similarities that may not be explicitly mapped
        
        Ensure inferences are logically sound and follow from the established mappings.
      `;
      
      // Call LLM to generate inferences
      const llmResult = await this.modelStrategyManager.executePrompt({
        prompt,
        model: 'llama-multilingual', // Use Llama Multilingual for inference generation with multilingual support
        temperature: 0.4,
        maxTokens: 2000,
        responseFormat: 'json'
      });
      
      // Parse and validate inferences
      let inferences = [];
      try {
        const parsedResult = typeof llmResult === 'string' ? 
          JSON.parse(llmResult) : llmResult;
        
        if (Array.isArray(parsedResult)) {
          inferences = parsedResult;
        } else if (parsedResult.inferences && Array.isArray(parsedResult.inferences)) {
          inferences = parsedResult.inferences;
        }
      } catch (parseError) {
        if (this.logger) {
          this.logger.error(`Failed to parse LLM inference generation result: ${parseError.message}`, { 
            result: llmResult, 
            error: parseError.stack 
          });
        }
        // Fallback to empty inferences
        inferences = [];
      }
      
      // Validate and format inferences
      const validInferences = [];
      for (const i of inferences) {
        if (i.description) {
          validInferences.push({
            id: uuidv4(),
            type: i.type || 'relation_transfer',
            description: i.description,
            confidence: i.confidence || 0.5,
            sourceMappingIds: i.sourceMappingIds || [],
            generatedAt: Date.now()
          });
        }
      }
      
      return validInferences;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`LLM inference generation error: ${error.message}`, { error: error.stack });
      }
      // Fallback to algorithmic generation on LLM failure
      return this._generateInferencesWithAlgorithms(sourceDomain, targetDomain, mappings, context);
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
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_getInferenceTrace");
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
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_explainInference");
    }

    try {
      const { 
        format = 'text', 
        detailed = false,
        useLLM = this.configService ? 
          this.configService.get('reasoning.analogical.useLLMForExplanation', true) : true
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
      // Get domains
      const sourceDomain = this.sourceDomains.has(trace.sourceDomainId) ? 
        this.sourceDomains.get(trace.sourceDomainId) : null;
      
      const targetDomain = this.targetDomains.has(trace.targetDomainId) ? 
        this.targetDomains.get(trace.targetDomainId) : null;
      
      // Get analogy
      const analogy = trace.analogyId && this.analogies.has(trace.analogyId) ?
        this.analogies.get(trace.analogyId) : null;
      
      // Basic explanation components
      const components = {
        summary: `Analogical reasoning performed between ${sourceDomain ? sourceDomain.name : 'unknown source'} and ${targetDomain ? targetDomain.name : 'unknown target'}`,
        mappingCount: `Generated ${trace.mappingsGenerated.length} mappings`,
        inferenceCount: `Generated ${trace.inferencesGenerated.length} inferences`,
        similarity: analogy ? `Similarity: ${analogy.similarity.toFixed(2)}` : 'Similarity: unknown'
      };
      
      // Generate explanation based on format
      let content;
      
      switch (format.toLowerCase()) {
        case 'html':
          content = `
            <div class="reasoning-explanation">
              <h3>Analogical Reasoning Explanation</h3>
              <p>${components.summary}</p>
              <p>${components.mappingCount}</p>
              <p>${components.inferenceCount}</p>
              <p>${components.similarity}</p>
              ${detailed ? this._generateDetailedHtml(trace, analogy) : ''}
            </div>
          `;
          break;
          
        case 'json':
          content = {
            summary: components.summary,
            sourceDomain: sourceDomain ? {
              id: sourceDomain.id,
              name: sourceDomain.name,
              description: sourceDomain.description
            } : null,
            targetDomain: targetDomain ? {
              id: targetDomain.id,
              name: targetDomain.name,
              description: targetDomain.description
            } : null,
            mappingCount: trace.mappingsGenerated.length,
            inferenceCount: trace.inferencesGenerated.length,
            similarity: analogy ? analogy.similarity : null,
            executionTime: trace.endTime - trace.startTime,
            details: detailed ? this._generateDetailedJson(trace, analogy) : undefined
          };
          break;
          
        case 'text':
        default:
          content = [
            components.summary,
            components.mappingCount,
            components.inferenceCount,
            components.similarity,
            '',
            detailed ? this._generateDetailedText(trace, analogy) : ''
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
   * @param {Object} analogy - Analogy object
   * @returns {string} - Detailed explanation text
   */
  _generateDetailedText(trace, analogy) {
    try {
      if (!analogy) {
        return 'No analogy details available.';
      }
      
      const lines = ['Detailed Explanation:'];
      
      // Add mappings
      lines.push('Mappings:');
      for (const mapping of analogy.mappings) {
        lines.push(`- ${mapping.sourceName} (${mapping.sourceId}) maps to ${mapping.targetName} (${mapping.targetId})`);
        lines.push(`  Type: ${mapping.type}, Similarity: ${mapping.similarity.toFixed(2)}`);
        lines.push(`  Description: ${mapping.description}`);
        lines.push('');
      }
      
      // Add inferences
      lines.push('Inferences:');
      for (const inference of analogy.inferences) {
        lines.push(`- ${inference.description}`);
        lines.push(`  Type: ${inference.type}, Confidence: ${inference.confidence.toFixed(2)}`);
        lines.push('');
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
   * @param {Object} analogy - Analogy object
   * @returns {string} - Detailed explanation HTML
   */
  _generateDetailedHtml(trace, analogy) {
    try {
      if (!analogy) {
        return '<p>No analogy details available.</p>';
      }
      
      let html = '<div class="detailed-explanation">';
      
      // Add mappings
      html += '<h4>Mappings</h4>';
      html += '<ul>';
      for (const mapping of analogy.mappings) {
        html += `<li>
          <strong>${mapping.sourceName}</strong> maps to <strong>${mapping.targetName}</strong><br>
          Type: ${mapping.type}, Similarity: ${mapping.similarity.toFixed(2)}<br>
          Description: ${mapping.description}
        </li>`;
      }
      html += '</ul>';
      
      // Add inferences
      html += '<h4>Inferences</h4>';
      html += '<ul>';
      for (const inference of analogy.inferences) {
        html += `<li>
          ${inference.description}<br>
          Type: ${inference.type}, Confidence: ${inference.confidence.toFixed(2)}
        </li>`;
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
   * @param {Object} analogy - Analogy object
   * @returns {Object} - Detailed explanation JSON
   */
  _generateDetailedJson(trace, analogy) {
    try {
      if (!analogy) {
        return { error: 'No analogy details available.' };
      }
      
      return {
        mappings: analogy.mappings.map(m => ({
          sourceId: m.sourceId,
          sourceName: m.sourceName,
          targetId: m.targetId,
          targetName: m.targetName,
          type: m.type,
          similarity: m.similarity,
          description: m.description
        })),
        inferences: analogy.inferences.map(i => ({
          type: i.type,
          description: i.description,
          confidence: i.confidence
        }))
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
      
      // Get domains
      const sourceDomain = this.sourceDomains.has(trace.sourceDomainId) ? 
        this.sourceDomains.get(trace.sourceDomainId) : null;
      
      const targetDomain = this.targetDomains.has(trace.targetDomainId) ? 
        this.targetDomains.get(trace.targetDomainId) : null;
      
      // Get analogy
      const analogy = trace.analogyId && this.analogies.has(trace.analogyId) ?
        this.analogies.get(trace.analogyId) : null;
      
      // Prepare trace data for LLM
      const traceData = {
        sourceDomain: sourceDomain ? {
          name: sourceDomain.name,
          description: sourceDomain.description
        } : null,
        targetDomain: targetDomain ? {
          name: targetDomain.name,
          description: targetDomain.description
        } : null,
        mappingCount: trace.mappingsGenerated.length,
        inferenceCount: trace.inferencesGenerated.length,
        similarity: analogy ? analogy.similarity : null,
        executionTime: trace.endTime - trace.startTime
      };
      
      // Add detailed data if requested
      if (detailed && analogy) {
        traceData.mappings = analogy.mappings;
        traceData.inferences = analogy.inferences;
      }
      
      // Prepare prompt for LLM
      const prompt = `
        Generate a clear explanation of the following analogical reasoning process.
        
        Reasoning Trace:
        ${JSON.stringify(traceData, null, 2)}
        
        ${detailed ? 'Include detailed explanations of all mappings and inferences.' : 'Provide a concise summary of the reasoning process.'}
        
        Generate the explanation in ${format} format.
        ${format === 'json' ? 'Ensure the output is valid JSON.' : ''}
        ${format === 'html' ? 'Ensure the output is valid HTML with appropriate formatting.' : ''}
        
        Focus on explaining:
        1. The analogical relationship between the source and target domains
        2. The key mappings between elements in the domains
        3. The inferences that can be drawn from the analogy
        4. The strength and limitations of the analogy
        5. The practical implications of the analogical reasoning
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
   * Gets statistics about the analogical reasoner.
   * 
   * @returns {Promise<Object>} - Reasoner statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_getStatistics");
    }

    try {
      // Count domains by source
      const sourceDomainsCount = this.sourceDomains.size;
      const targetDomainsCount = this.targetDomains.size;
      
      // Count analogies by source
      const analogiesBySource = {};
      for (const analogy of this.analogies.values()) {
        const source = analogy.source || 'unknown';
        analogiesBySource[source] = (analogiesBySource[source] || 0) + 1;
      }
      
      // Calculate average similarity
      let totalSimilarity = 0;
      for (const analogy of this.analogies.values()) {
        totalSimilarity += analogy.similarity;
      }
      
      const analogyCount = this.analogies.size;
      const avgSimilarity = analogyCount > 0 ? totalSimilarity / analogyCount : 0;
      
      // Count mappings and inferences
      let totalMappings = 0;
      let totalInferences = 0;
      
      for (const analogy of this.analogies.values()) {
        totalMappings += analogy.mappings.length;
        totalInferences += analogy.inferences.length;
      }
      
      const avgMappingsPerAnalogy = analogyCount > 0 ? totalMappings / analogyCount : 0;
      const avgInferencesPerAnalogy = analogyCount > 0 ? totalInferences / analogyCount : 0;
      
      // Compile statistics
      const statistics = {
        sourceDomainsCount,
        targetDomainsCount,
        analogyCount,
        traceCount: this.inferenceTraces.size,
        analogiesBySource,
        mappingStats: {
          totalMappings,
          avgMappingsPerAnalogy
        },
        inferenceStats: {
          totalInferences,
          avgInferencesPerAnalogy
        },
        similarityStats: {
          avgSimilarity
        },
        configuration: {
          maxMappings: this.maxMappings,
          similarityThreshold: this.similarityThreshold,
          useLLMForDomainMapping: this.useLLMForDomainMapping,
          useLLMForInferenceGeneration: this.useLLMForInferenceGeneration
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
   * Clears the domains and analogies.
   * 
   * @param {Object} [options] - Clear options
   * @param {boolean} [options.clearSourceDomains=false] - Whether to clear source domains
   * @param {boolean} [options.clearTargetDomains=false] - Whether to clear target domains
   * @param {boolean} [options.clearAnalogies=true] - Whether to clear analogies
   * @param {boolean} [options.clearTraces=false] - Whether to clear inference traces
   * @param {string} [options.source] - Only clear items from this source
   * @returns {Promise<Object>} - Clear result
   */
  async clear(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("analogicalReasoner_clear");
    }

    try {
      const { 
        clearSourceDomains = false, 
        clearTargetDomains = false,
        clearAnalogies = true,
        clearTraces = false,
        source
      } = options;
      
      let sourceDomainsCleared = 0;
      let targetDomainsCleared = 0;
      let analogiesCleared = 0;
      let tracesCleared = 0;
      
      // Clear source domains if requested
      if (clearSourceDomains) {
        if (source) {
          // Clear source domains from specific source
          for (const [domainId, domain] of this.sourceDomains.entries()) {
            if (domain.source === source) {
              this.sourceDomains.delete(domainId);
              sourceDomainsCleared++;
            }
          }
        } else {
          // Clear all source domains
          sourceDomainsCleared = this.sourceDomains.size;
          this.sourceDomains.clear();
        }
      }
      
      // Clear target domains if requested
      if (clearTargetDomains) {
        if (source) {
          // Clear target domains from specific source
          for (const [domainId, domain] of this.targetDomains.entries()) {
            if (domain.source === source) {
              this.targetDomains.delete(domainId);
              targetDomainsCleared++;
            }
          }
        } else {
          // Clear all target domains
          targetDomainsCleared = this.targetDomains.size;
          this.targetDomains.clear();
        }
      }
      
      // Clear analogies if requested
      if (clearAnalogies) {
        if (source) {
          // Clear analogies from specific source
          for (const [analogyId, analogy] of this.analogies.entries()) {
            if (analogy.source === source) {
              this.analogies.delete(analogyId);
              analogiesCleared++;
            }
          }
        } else {
          // Clear all analogies
          analogiesCleared = this.analogies.size;
          this.analogies.clear();
        }
      }
      
      // Clear traces if requested
      if (clearTraces) {
        tracesCleared = this.inferenceTraces.size;
        this.inferenceTraces.clear();
      }
      
      if (this.logger) {
        this.logger.debug(`Cleared reasoner memory`, { 
          sourceDomainsCleared,
          targetDomainsCleared,
          analogiesCleared,
          tracesCleared,
          source
        });
      }
      
      return {
        sourceDomainsCleared,
        targetDomainsCleared,
        analogiesCleared,
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

module.exports = { AnalogicalReasoner };
