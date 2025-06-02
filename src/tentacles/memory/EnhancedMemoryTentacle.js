/**
 * @fileoverview Enhanced Memory Tentacle with advanced multi-LLM orchestration capabilities.
 * Provides comprehensive memory management with collaborative intelligence for memory operations.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 * @version 2.0.0
 */

const WorkingMemoryManager = require('./WorkingMemoryManager');
const LongTermMemoryConsolidation = require('./LongTermMemoryConsolidation');
const AssociativeMemoryNetworks = require('./AssociativeMemoryNetworks');
const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');
const { ModelType, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');

/**
 * Enhanced Memory Tentacle with advanced multi-LLM orchestration capabilities
 * Provides comprehensive memory management with collaborative intelligence
 */
class EnhancedMemoryTentacle {
  /**
   * Create a new EnhancedMemoryTentacle
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Configuration object
   * @param {Object} options.modelOrchestrationSystem - Model orchestration system
   * @param {Object} [options.workingMemory] - Working memory manager instance
   * @param {Object} [options.longTermMemory] - Long-term memory consolidation instance
   * @param {Object} [options.associativeMemory] - Associative memory networks instance
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.config = options.config || {};
    this.modelOrchestrator = options.modelOrchestrationSystem;
    
    // Initialize enhanced integration for advanced multi-LLM orchestration
    this._initializeEnhancedIntegration(options);
    
    // Initialize memory components with enhanced integration
    this.workingMemory = options.workingMemory || new WorkingMemoryManager({
      logger: this.logger,
      config: this.config.workingMemory || {},
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.longTermMemory = options.longTermMemory || new LongTermMemoryConsolidation({
      logger: this.logger,
      config: this.config.longTermMemory || {},
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.associativeMemory = options.associativeMemory || new AssociativeMemoryNetworks({
      logger: this.logger,
      config: this.config.associativeMemory || {},
      enhancedIntegration: this.enhancedIntegration
    });
    
    // Advanced orchestration options
    this.advancedOptions = {
      collaborativeIntelligence: this.config.advanced?.collaborativeIntelligence !== false,
      specializedModelSelection: this.config.advanced?.specializedModelSelection !== false,
      adaptiveResourceAllocation: this.config.advanced?.adaptiveResourceAllocation !== false,
      selfEvaluation: this.config.advanced?.selfEvaluation !== false,
      offlineCapability: this.config.advanced?.offlineCapability || 'full' // 'limited', 'standard', 'full'
    };
    
    // Performance metrics for self-evaluation
    this.metrics = {
      retrievalLatency: [],
      retrievalAccuracy: [],
      consolidationEfficiency: [],
      associationQuality: [],
      modelUsage: new Map()
    };
    
    this.logger.info('EnhancedMemoryTentacle created with advanced multi-LLM orchestration capabilities');
  }
  
  /**
   * Initialize enhanced integration for advanced multi-LLM orchestration
   * @param {Object} options - Options passed to the constructor
   * @private
   */
  _initializeEnhancedIntegration(options) {
    this.logger.debug('Initializing enhanced integration for Memory Tentacle');
    
    // Configure enhanced tentacle integration
    this.enhancedIntegration = new EnhancedTentacleIntegration(
      {
        collaborativeIntelligence: this.config.advanced?.collaborativeIntelligence !== false,
        specializedModelSelection: this.config.advanced?.specializedModelSelection !== false,
        adaptiveResourceAllocation: this.config.advanced?.adaptiveResourceAllocation !== false,
        selfEvaluation: this.config.advanced?.selfEvaluation !== false,
        offlineCapability: this.config.advanced?.offlineCapability || 'full'
      },
      {
        logger: this.logger,
        modelOrchestrationSystem: this.modelOrchestrator
      }
    );
  }
  
  /**
   * Initialize the memory tentacle with advanced multi-LLM orchestration
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing EnhancedMemoryTentacle with advanced multi-LLM orchestration');
    
    try {
      // Initialize enhanced integration
      await this.enhancedIntegration.initialize();
      
      // Initialize collaboration sessions for advanced orchestration
      await this._initializeCollaborationSessions();
      
      // Initialize memory components
      await Promise.all([
        this.workingMemory.initialize(),
        this.longTermMemory.initialize(),
        this.associativeMemory.initialize()
      ]);
      
      this.logger.info('EnhancedMemoryTentacle initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize EnhancedMemoryTentacle: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Initialize collaboration sessions for advanced orchestration
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _initializeCollaborationSessions() {
    if (!this.advancedOptions.collaborativeIntelligence || !this.modelOrchestrator) {
      this.logger.info('Collaborative intelligence disabled or model orchestrator not available, skipping collaboration sessions');
      return;
    }
    
    this.logger.debug('Initializing collaboration sessions for Memory Tentacle');
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "memory_retrieval",
          modelType: ModelType.TEXT,
          taskType: "memory_retrieval",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: false
        },
        {
          name: "memory_consolidation",
          modelType: ModelType.TEXT,
          taskType: "memory_consolidation",
          collaborationStrategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          offlineOnly: true
        },
        {
          name: "memory_association",
          modelType: ModelType.TEXT,
          taskType: "memory_association",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: true
        },
        {
          name: "memory_analysis",
          modelType: ModelType.TEXT,
          taskType: "memory_analysis",
          collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
          offlineOnly: false
        },
        {
          name: "cross_modal_memory",
          modelType: ModelType.MULTIMODAL,
          taskType: "cross_modal_memory",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("memory", collaborationConfigs);
      
      this.logger.info('Collaboration sessions initialized successfully for Memory Tentacle');
      
    } catch (error) {
      this.logger.error(`Failed to initialize collaboration sessions: ${error.message}`);
      // Continue without collaborative intelligence
      this.advancedOptions.collaborativeIntelligence = false;
    }
  }
  
  /**
   * Add item to working memory with collaborative intelligence
   * @async
   * @param {Object} item - Item to add
   * @param {number} priority - Priority of the item (0-1)
   * @returns {Promise<Object>} Added item
   */
  async addToWorkingMemory(item, priority = 0.5) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    // Use collaborative intelligence to enhance item if available
    let enhancedItem = item;
    let enhancedPriority = priority;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_analysis",
          {
            task: "enhance_memory_item",
            item,
            priority,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedItem) {
          enhancedItem = enhancementResult.enhancedItem;
          this.logger.debug("Enhanced memory item with collaborative intelligence");
        }
        
        if (enhancementResult && enhancementResult.suggestedPriority !== undefined) {
          enhancedPriority = enhancementResult.suggestedPriority;
          this.logger.debug(`Enhanced priority with collaborative intelligence: ${enhancedPriority}`);
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance memory item with collaborative intelligence", enhancementError);
        // Continue with original item and priority
      }
    }
    
    // Ensure item has priority property set
    const itemWithPriority = {
      ...enhancedItem,
      priority: enhancedPriority,
      enhancedWithAI: this.advancedOptions.collaborativeIntelligence
    };
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Add item to working memory
    const result = await this.workingMemory.addItem(itemWithPriority);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    return result;
  }
  
  /**
   * Get item from working memory with collaborative intelligence
   * @async
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Retrieved item
   */
  async getFromWorkingMemory(itemId) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Get item from working memory
    const item = await this.workingMemory.getItem(itemId);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    return item;
  }
  
  /**
   * Remove item from working memory
   * @async
   * @param {string} itemId - Item ID
   * @returns {Promise<boolean>} Removal success
   */
  async removeFromWorkingMemory(itemId) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    return this.workingMemory.removeItem(itemId);
  }
  
  /**
   * Query working memory with collaborative intelligence
   * @async
   * @param {Object} query - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Query results
   */
  async queryWorkingMemory(query, options = {}) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    // Use collaborative intelligence to enhance query if available
    let enhancedQuery = query;
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_retrieval",
          {
            task: "enhance_memory_query",
            query,
            options,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedQuery) {
          enhancedQuery = enhancementResult.enhancedQuery;
          this.logger.debug("Enhanced memory query with collaborative intelligence");
        }
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced query options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance memory query with collaborative intelligence", enhancementError);
        // Continue with original query and options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Query working memory
    const results = await this.workingMemory.query(enhancedQuery, enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    // Use collaborative intelligence to post-process results if available
    if (this.advancedOptions.collaborativeIntelligence && results.length > 0) {
      try {
        const postProcessResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_analysis",
          {
            task: "post_process_query_results",
            results,
            query: enhancedQuery,
            options: enhancedOptions,
            context: await this._getCurrentContext()
          }
        );
        
        if (postProcessResult && postProcessResult.enhancedResults) {
          this.logger.debug("Post-processed query results with collaborative intelligence");
          return postProcessResult.enhancedResults;
        }
      } catch (postProcessError) {
        this.logger.warn("Failed to post-process query results with collaborative intelligence", postProcessError);
        // Continue with original results
      }
    }
    
    return results;
  }
  
  /**
   * Store item in long-term memory with collaborative intelligence
   * @async
   * @param {Object} item - Item to store
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Stored item
   */
  async storeInLongTermMemory(item, options = {}) {
    if (!this.longTermMemory) {
      throw new Error('Long-term memory consolidation not initialized');
    }
    
    // Use collaborative intelligence to enhance item if available
    let enhancedItem = item;
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_consolidation",
          {
            task: "enhance_memory_item",
            item,
            options,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedItem) {
          enhancedItem = enhancementResult.enhancedItem;
          this.logger.debug("Enhanced long-term memory item with collaborative intelligence");
        }
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced storage options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance long-term memory item with collaborative intelligence", enhancementError);
        // Continue with original item and options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Store item in long-term memory
    const result = await this.longTermMemory.storeItem(enhancedItem, enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.consolidationEfficiency.push(latency);
    }
    
    return result;
  }
  
  /**
   * Retrieve item from long-term memory with collaborative intelligence
   * @async
   * @param {string} itemId - Item ID
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved item
   */
  async retrieveFromLongTermMemory(itemId, options = {}) {
    if (!this.longTermMemory) {
      throw new Error('Long-term memory consolidation not initialized');
    }
    
    // Use collaborative intelligence to enhance retrieval if available
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_retrieval",
          {
            task: "enhance_retrieval_options",
            itemId,
            options,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced retrieval options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance retrieval options with collaborative intelligence", enhancementError);
        // Continue with original options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Retrieve item from long-term memory
    const item = await this.longTermMemory.retrieveItem(itemId, enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    return item;
  }
  
  /**
   * Query long-term memory with collaborative intelligence
   * @async
   * @param {Object} query - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Query results
   */
  async queryLongTermMemory(query, options = {}) {
    if (!this.longTermMemory) {
      throw new Error('Long-term memory consolidation not initialized');
    }
    
    // Use collaborative intelligence to enhance query if available
    let enhancedQuery = query;
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_retrieval",
          {
            task: "enhance_memory_query",
            query,
            options,
            memoryType: "long_term",
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedQuery) {
          enhancedQuery = enhancementResult.enhancedQuery;
          this.logger.debug("Enhanced long-term memory query with collaborative intelligence");
        }
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced query options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance long-term memory query with collaborative intelligence", enhancementError);
        // Continue with original query and options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Query long-term memory
    const results = await this.longTermMemory.query(enhancedQuery, enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    // Use collaborative intelligence to post-process results if available
    if (this.advancedOptions.collaborativeIntelligence && results.length > 0) {
      try {
        const postProcessResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_analysis",
          {
            task: "post_process_query_results",
            results,
            query: enhancedQuery,
            options: enhancedOptions,
            memoryType: "long_term",
            context: await this._getCurrentContext()
          }
        );
        
        if (postProcessResult && postProcessResult.enhancedResults) {
          this.logger.debug("Post-processed long-term memory query results with collaborative intelligence");
          return postProcessResult.enhancedResults;
        }
      } catch (postProcessError) {
        this.logger.warn("Failed to post-process long-term memory query results with collaborative intelligence", postProcessError);
        // Continue with original results
      }
    }
    
    return results;
  }
  
  /**
   * Create association between items with collaborative intelligence
   * @async
   * @param {string} sourceItemId - Source item ID
   * @param {string} targetItemId - Target item ID
   * @param {Object} associationData - Association data
   * @returns {Promise<Object>} Created association
   */
  async createAssociation(sourceItemId, targetItemId, associationData = {}) {
    if (!this.associativeMemory) {
      throw new Error('Associative memory networks not initialized');
    }
    
    // Use collaborative intelligence to enhance association if available
    let enhancedAssociationData = associationData;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_association",
          {
            task: "enhance_association",
            sourceItemId,
            targetItemId,
            associationData,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedAssociationData) {
          enhancedAssociationData = enhancementResult.enhancedAssociationData;
          this.logger.debug("Enhanced association data with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance association data with collaborative intelligence", enhancementError);
        // Continue with original association data
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Create association
    const result = await this.associativeMemory.createAssociation(sourceItemId, targetItemId, enhancedAssociationData);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.associationQuality.push(latency);
    }
    
    return result;
  }
  
  /**
   * Find associations with collaborative intelligence
   * @async
   * @param {string} itemId - Item ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Found associations
   */
  async findAssociations(itemId, options = {}) {
    if (!this.associativeMemory) {
      throw new Error('Associative memory networks not initialized');
    }
    
    // Use collaborative intelligence to enhance query if available
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_association",
          {
            task: "enhance_association_query",
            itemId,
            options,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced association query options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance association query options with collaborative intelligence", enhancementError);
        // Continue with original options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Find associations
    const associations = await this.associativeMemory.findAssociations(itemId, enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.retrievalLatency.push(latency);
    }
    
    // Use collaborative intelligence to post-process results if available
    if (this.advancedOptions.collaborativeIntelligence && associations.length > 0) {
      try {
        const postProcessResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_analysis",
          {
            task: "post_process_associations",
            associations,
            itemId,
            options: enhancedOptions,
            context: await this._getCurrentContext()
          }
        );
        
        if (postProcessResult && postProcessResult.enhancedAssociations) {
          this.logger.debug("Post-processed associations with collaborative intelligence");
          return postProcessResult.enhancedAssociations;
        }
      } catch (postProcessError) {
        this.logger.warn("Failed to post-process associations with collaborative intelligence", postProcessError);
        // Continue with original associations
      }
    }
    
    return associations;
  }
  
  /**
   * Perform memory consolidation with collaborative intelligence
   * @async
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidation results
   */
  async performMemoryConsolidation(options = {}) {
    if (!this.longTermMemory) {
      throw new Error('Long-term memory consolidation not initialized');
    }
    
    // Use collaborative intelligence to enhance consolidation if available
    let enhancedOptions = options;
    
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
          "memory_consolidation",
          {
            task: "enhance_consolidation_options",
            options,
            context: await this._getCurrentContext()
          }
        );
        
        if (enhancementResult && enhancementResult.enhancedOptions) {
          enhancedOptions = enhancementResult.enhancedOptions;
          this.logger.debug("Enhanced consolidation options with collaborative intelligence");
        }
      } catch (enhancementError) {
        this.logger.warn("Failed to enhance consolidation options with collaborative intelligence", enhancementError);
        // Continue with original options
      }
    }
    
    // Start performance monitoring if self-evaluation is enabled
    const startTime = this.advancedOptions.selfEvaluation ? Date.now() : null;
    
    // Perform memory consolidation
    const result = await this.longTermMemory.performConsolidation(enhancedOptions);
    
    // Record performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && startTime) {
      const latency = Date.now() - startTime;
      this.metrics.consolidationEfficiency.push(latency);
    }
    
    return result;
  }
  
  /**
   * Perform cross-modal memory operation with collaborative intelligence
   * @async
   * @param {string} operation - Operation type
   * @param {Object} data - Operation data
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Operation results
   */
  async performCrossModalMemoryOperation(operation, data, options = {}) {
    // Validate operation type
    const validOperations = ['store', 'retrieve', 'query', 'associate'];
    if (!validOperations.includes(operation)) {
      throw new Error(`Invalid cross-modal memory operation: ${operation}`);
    }
    
    // Use collaborative intelligence for cross-modal operations
    if (this.advancedOptions.collaborativeIntelligence) {
      try {
        const operationResult = await this.enhancedIntegration.executeCollaborativeTask(
          "cross_modal_memory",
          {
            task: operation,
            data,
            options,
            context: await this._getCurrentContext()
          }
        );
        
        this.logger.debug(`Performed cross-modal memory operation (${operation}) with collaborative intelligence`);
        return operationResult;
      } catch (operationError) {
        this.logger.warn(`Failed to perform cross-modal memory operation (${operation}) with collaborative intelligence`, operationError);
        // Fall back to standard operations
      }
    }
    
    // Fall back to appropriate standard operation
    switch (operation) {
      case 'store':
        return this.storeInLongTermMemory(data, options);
      case 'retrieve':
        return this.retrieveFromLongTermMemory(data.itemId, options);
      case 'query':
        return this.queryLongTermMemory(data, options);
      case 'associate':
        return this.createAssociation(data.sourceItemId, data.targetItemId, data.associationData);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
  
  /**
   * Gets the current context for collaborative intelligence
   * @private
   * @async
   * @returns {Promise<Object>} Current context
   */
  async _getCurrentContext() {
    try {
      // Get working memory stats
      const workingMemoryStats = await this.workingMemory.getStats();
      
      // Get long-term memory stats
      const longTermMemoryStats = await this.longTermMemory.getStats();
      
      // Get associative memory stats
      const associativeMemoryStats = await this.associativeMemory.getStats();
      
      return {
        workingMemory: workingMemoryStats,
        longTermMemory: longTermMemoryStats,
        associativeMemory: associativeMemoryStats,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.warn("Failed to get current context", error);
      return {
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
  
  /**
   * Perform self-evaluation of memory operations
   * @async
   * @returns {Promise<Object>} Evaluation results
   */
  async performSelfEvaluation() {
    if (!this.advancedOptions.selfEvaluation) {
      return { performed: false, reason: "Self-evaluation not enabled" };
    }
    
    this.logger.debug("Performing self-evaluation of memory operations");
    
    try {
      if (!this.enhancedIntegration) {
        return { performed: false, reason: "Enhanced integration not available" };
      }
      
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: 'memory_operations',
        metrics: this.metrics,
        criteria: {
          retrievalLatency: 100, // milliseconds
          retrievalAccuracy: 0.9,
          consolidationEfficiency: 0.85,
          associationQuality: 0.9
        }
      });
      
      return {
        performed: true,
        score: evaluationResult.score,
        feedback: evaluationResult.feedback,
        strengths: evaluationResult.strengths,
        weaknesses: evaluationResult.weaknesses,
        improvements: evaluationResult.improvements,
        metrics: evaluationResult.metrics
      };
    } catch (error) {
      this.logger.warn("Failed to perform self-evaluation", error);
      return { performed: false, error: error.message };
    }
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const modelUsageArray = Array.from(this.metrics.modelUsage.entries()).map(([modelId, usage]) => ({
      modelId,
      calls: usage.calls,
      successRate: usage.calls > 0 ? usage.successes / usage.calls : 0,
      averageLatency: usage.latency.length > 0 ? usage.latency.reduce((a, b) => a + b, 0) / usage.latency.length : 0
    }));
    
    return {
      retrievalLatency: {
        average: this.metrics.retrievalLatency.length > 0 ? 
          this.metrics.retrievalLatency.reduce((a, b) => a + b, 0) / this.metrics.retrievalLatency.length : 0,
        min: this.metrics.retrievalLatency.length > 0 ? Math.min(...this.metrics.retrievalLatency) : 0,
        max: this.metrics.retrievalLatency.length > 0 ? Math.max(...this.metrics.retrievalLatency) : 0
      },
      retrievalAccuracy: {
        average: this.metrics.retrievalAccuracy.length > 0 ? 
          this.metrics.retrievalAccuracy.reduce((a, b) => a + b, 0) / this.metrics.retrievalAccuracy.length : 0
      },
      consolidationEfficiency: {
        average: this.metrics.consolidationEfficiency.length > 0 ? 
          this.metrics.consolidationEfficiency.reduce((a, b) => a + b, 0) / this.metrics.consolidationEfficiency.length : 0
      },
      associationQuality: {
        average: this.metrics.associationQuality.length > 0 ? 
          this.metrics.associationQuality.reduce((a, b) => a + b, 0) / this.metrics.associationQuality.length : 0
      },
      modelUsage: modelUsageArray
    };
  }
  
  /**
   * Clean up resources
   * @async
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.info("Cleaning up EnhancedMemoryTentacle");
    
    try {
      // Clean up memory components
      await Promise.all([
        this.workingMemory.cleanup(),
        this.longTermMemory.cleanup(),
        this.associativeMemory.cleanup()
      ]);
      
      // Clean up enhanced integration
      if (this.enhancedIntegration) {
        await this.enhancedIntegration.cleanup();
      }
      
      this.logger.info("EnhancedMemoryTentacle cleaned up successfully");
    } catch (error) {
      this.logger.error(`Failed to clean up EnhancedMemoryTentacle: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EnhancedMemoryTentacle;
