/**
 * @fileoverview ProbabilisticKnowledgeManager for the Knowledge Graph Manager.
 * Provides support for uncertainty representation and confidence scoring in knowledge.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Confidence level categories for probabilistic knowledge.
 * @enum {string}
 */
const ConfidenceLevel = {
  /**
   * Very high confidence (0.9-1.0).
   */
  VERY_HIGH: 'very_high',
  
  /**
   * High confidence (0.7-0.9).
   */
  HIGH: 'high',
  
  /**
   * Medium confidence (0.5-0.7).
   */
  MEDIUM: 'medium',
  
  /**
   * Low confidence (0.3-0.5).
   */
  LOW: 'low',
  
  /**
   * Very low confidence (0.0-0.3).
   */
  VERY_LOW: 'very_low'
};

/**
 * Uncertainty types for probabilistic knowledge.
 * @enum {string}
 */
const UncertaintyType = {
  /**
   * Aleatory uncertainty (inherent randomness).
   */
  ALEATORY: 'aleatory',
  
  /**
   * Epistemic uncertainty (lack of knowledge).
   */
  EPISTEMIC: 'epistemic',
  
  /**
   * Ontological uncertainty (ambiguity in definition).
   */
  ONTOLOGICAL: 'ontological',
  
  /**
   * Linguistic uncertainty (ambiguity in language).
   */
  LINGUISTIC: 'linguistic'
};

/**
 * Provides support for uncertainty representation and confidence scoring in knowledge.
 */
class ProbabilisticKnowledgeManager extends EventEmitter {
  /**
   * Creates a new ProbabilisticKnowledgeManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   */
  constructor(options = {}) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error('ProbabilisticKnowledgeManager requires a storageAdapter instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    this.initialized = false;
  }
  
  /**
   * Initializes the probabilistic knowledge manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing ProbabilisticKnowledgeManager');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.probabilistic', {
          defaultConfidenceThreshold: 0.5,
          enableConfidenceScoring: true,
          enableUncertaintyPropagation: true,
          enableBayesianUpdates: true,
          enableFuzzyLogic: true,
          defaultPriorProbability: 0.5
        });
        
        this.config = config;
      } else {
        this.config = {
          defaultConfidenceThreshold: 0.5,
          enableConfidenceScoring: true,
          enableUncertaintyPropagation: true,
          enableBayesianUpdates: true,
          enableFuzzyLogic: true,
          defaultPriorProbability: 0.5
        };
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('ProbabilisticKnowledgeManager initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('ProbabilisticKnowledgeManager initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`ProbabilisticKnowledgeManager initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Ensures the manager is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the manager is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ProbabilisticKnowledgeManager is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Assigns a confidence score to a knowledge entity.
   * 
   * @param {string} entityId - ID of the entity (node, edge, or hyperedge)
   * @param {number} confidenceScore - Confidence score (0.0-1.0)
   * @param {Object} [evidence={}] - Evidence supporting the confidence score
   * @param {UncertaintyType} [uncertaintyType=UncertaintyType.EPISTEMIC] - Type of uncertainty
   * @returns {Promise<Object>} - Updated entity with confidence information
   */
  async assignConfidence(entityId, confidenceScore, evidence = {}, uncertaintyType = UncertaintyType.EPISTEMIC) {
    this.ensureInitialized();
    
    if (!this.config.enableConfidenceScoring) {
      throw new Error('Confidence scoring is not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_assignConfidence');
    }
    
    try {
      // Validate confidence score
      if (typeof confidenceScore !== 'number' || confidenceScore < 0 || confidenceScore > 1) {
        throw new Error('Confidence score must be a number between 0 and 1');
      }
      
      // Validate uncertainty type
      if (!Object.values(UncertaintyType).includes(uncertaintyType)) {
        throw new Error(`Invalid uncertainty type: ${uncertaintyType}`);
      }
      
      // Retrieve entity
      let entity;
      try {
        // Try to get as node first
        entity = await this.storageAdapter.retrieveNode(entityId);
      } catch (e) {
        try {
          // Try to get as edge
          entity = await this.storageAdapter.retrieveEdge(entityId);
        } catch (e2) {
          try {
            // Try to get as hyperedge
            entity = await this.storageAdapter.retrieveHyperedge(entityId);
          } catch (e3) {
            throw new Error(`Entity ${entityId} not found`);
          }
        }
      }
      
      // Determine confidence level category
      let confidenceLevel;
      if (confidenceScore >= 0.9) {
        confidenceLevel = ConfidenceLevel.VERY_HIGH;
      } else if (confidenceScore >= 0.7) {
        confidenceLevel = ConfidenceLevel.HIGH;
      } else if (confidenceScore >= 0.5) {
        confidenceLevel = ConfidenceLevel.MEDIUM;
      } else if (confidenceScore >= 0.3) {
        confidenceLevel = ConfidenceLevel.LOW;
      } else {
        confidenceLevel = ConfidenceLevel.VERY_LOW;
      }
      
      // Prepare confidence data
      const confidenceData = {
        score: confidenceScore,
        level: confidenceLevel,
        uncertaintyType,
        evidence,
        timestamp: Date.now()
      };
      
      // Update entity metadata
      const updatedMetadata = {
        ...entity.metadata,
        confidence: confidenceData
      };
      
      // Update entity
      let success;
      if (entity.type) {
        // It's a node
        success = await this.storageAdapter.updateNodeData(entityId, {
          metadata: updatedMetadata
        });
      } else if (entity.sourceId) {
        // It's an edge
        success = await this.storageAdapter.updateEdgeData(entityId, {
          metadata: updatedMetadata
        });
      } else {
        // It's a hyperedge
        success = await this.storageAdapter.updateHyperedgeData(entityId, {
          metadata: updatedMetadata
        });
      }
      
      if (!success) {
        throw new Error(`Failed to update entity ${entityId} with confidence data`);
      }
      
      // Get updated entity
      let updatedEntity;
      try {
        // Try to get as node first
        updatedEntity = await this.storageAdapter.retrieveNode(entityId);
      } catch (e) {
        try {
          // Try to get as edge
          updatedEntity = await this.storageAdapter.retrieveEdge(entityId);
        } catch (e2) {
          try {
            // Try to get as hyperedge
            updatedEntity = await this.storageAdapter.retrieveHyperedge(entityId);
          } catch (e3) {
            throw new Error(`Updated entity ${entityId} not found`);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Assigned confidence score ${confidenceScore} to entity ${entityId}`);
      }
      
      this.emit('confidenceAssigned', { entityId, confidenceScore, confidenceLevel, uncertaintyType });
      
      return updatedEntity;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to assign confidence to entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Updates confidence score based on new evidence using Bayesian update.
   * 
   * @param {string} entityId - ID of the entity
   * @param {number} likelihoodRatio - Likelihood ratio of evidence given hypothesis
   * @param {Object} [newEvidence={}] - New evidence supporting the update
   * @returns {Promise<Object>} - Updated entity with new confidence information
   */
  async updateConfidenceBayesian(entityId, likelihoodRatio, newEvidence = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableBayesianUpdates) {
      throw new Error('Bayesian updates are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_updateConfidenceBayesian');
    }
    
    try {
      // Validate likelihood ratio
      if (typeof likelihoodRatio !== 'number' || likelihoodRatio < 0) {
        throw new Error('Likelihood ratio must be a non-negative number');
      }
      
      // Retrieve entity
      let entity;
      try {
        // Try to get as node first
        entity = await this.storageAdapter.retrieveNode(entityId);
      } catch (e) {
        try {
          // Try to get as edge
          entity = await this.storageAdapter.retrieveEdge(entityId);
        } catch (e2) {
          try {
            // Try to get as hyperedge
            entity = await this.storageAdapter.retrieveHyperedge(entityId);
          } catch (e3) {
            throw new Error(`Entity ${entityId} not found`);
          }
        }
      }
      
      // Get current confidence score or use default prior
      const currentConfidence = entity.metadata?.confidence?.score || this.config.defaultPriorProbability;
      
      // Calculate prior odds
      const priorOdds = currentConfidence / (1 - currentConfidence);
      
      // Calculate posterior odds using Bayes' rule
      const posteriorOdds = priorOdds * likelihoodRatio;
      
      // Convert back to probability
      const posteriorProbability = posteriorOdds / (1 + posteriorOdds);
      
      // Combine evidence
      const combinedEvidence = {
        ...entity.metadata?.confidence?.evidence || {},
        ...newEvidence,
        bayesianUpdate: {
          priorProbability: currentConfidence,
          likelihoodRatio,
          posteriorProbability,
          timestamp: Date.now()
        }
      };
      
      // Update confidence with new score
      return this.assignConfidence(
        entityId,
        posteriorProbability,
        combinedEvidence,
        entity.metadata?.confidence?.uncertaintyType || UncertaintyType.EPISTEMIC
      );
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update confidence for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Propagates confidence scores through connected entities.
   * 
   * @param {string} sourceEntityId - ID of the source entity
   * @param {number} [propagationFactor=0.9] - Factor to reduce confidence during propagation (0-1)
   * @param {number} [maxDepth=2] - Maximum propagation depth
   * @returns {Promise<Array<Object>>} - List of updated entities
   */
  async propagateConfidence(sourceEntityId, propagationFactor = 0.9, maxDepth = 2) {
    this.ensureInitialized();
    
    if (!this.config.enableUncertaintyPropagation) {
      throw new Error('Uncertainty propagation is not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_propagateConfidence');
    }
    
    try {
      // Validate parameters
      if (typeof propagationFactor !== 'number' || propagationFactor <= 0 || propagationFactor > 1) {
        throw new Error('Propagation factor must be a number between 0 (exclusive) and 1 (inclusive)');
      }
      
      if (typeof maxDepth !== 'number' || maxDepth < 1) {
        throw new Error('Max depth must be a positive integer');
      }
      
      // Retrieve source entity
      let sourceEntity;
      try {
        // Try to get as node first
        sourceEntity = await this.storageAdapter.retrieveNode(sourceEntityId);
      } catch (e) {
        try {
          // Try to get as edge
          sourceEntity = await this.storageAdapter.retrieveEdge(sourceEntityId);
        } catch (e2) {
          try {
            // Try to get as hyperedge
            sourceEntity = await this.storageAdapter.retrieveHyperedge(sourceEntityId);
          } catch (e3) {
            throw new Error(`Source entity ${sourceEntityId} not found`);
          }
        }
      }
      
      // Get source confidence score
      const sourceConfidence = sourceEntity.metadata?.confidence?.score;
      if (sourceConfidence === undefined) {
        throw new Error(`Source entity ${sourceEntityId} has no confidence score`);
      }
      
      // Track visited entities to avoid cycles
      const visited = new Set([sourceEntityId]);
      
      // Track updated entities
      const updatedEntities = [];
      
      // Perform breadth-first propagation
      await this._propagateConfidenceRecursive(
        sourceEntityId,
        sourceConfidence,
        propagationFactor,
        maxDepth,
        1,
        visited,
        updatedEntities
      );
      
      if (this.logger) {
        this.logger.debug(`Propagated confidence from entity ${sourceEntityId} to ${updatedEntities.length} connected entities`);
      }
      
      this.emit('confidencePropagated', { 
        sourceEntityId, 
        propagationFactor, 
        maxDepth, 
        updatedCount: updatedEntities.length 
      });
      
      return updatedEntities;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to propagate confidence from entity ${sourceEntityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Helper method for recursive confidence propagation.
   * 
   * @private
   * @param {string} entityId - Current entity ID
   * @param {number} parentConfidence - Confidence score of parent entity
   * @param {number} propagationFactor - Factor to reduce confidence during propagation
   * @param {number} maxDepth - Maximum propagation depth
   * @param {number} currentDepth - Current propagation depth
   * @param {Set<string>} visited - Set of visited entity IDs
   * @param {Array<Object>} updatedEntities - List of updated entities
   * @returns {Promise<void>}
   */
  async _propagateConfidenceRecursive(
    entityId,
    parentConfidence,
    propagationFactor,
    maxDepth,
    currentDepth,
    visited,
    updatedEntities
  ) {
    if (currentDepth > maxDepth) {
      return;
    }
    
    // Get connected entities
    const connectedEntities = await this._getConnectedEntities(entityId);
    
    // Calculate propagated confidence
    const propagatedConfidence = parentConfidence * Math.pow(propagationFactor, currentDepth - 1);
    
    // Process each connected entity
    for (const connectedEntity of connectedEntities) {
      const connectedId = connectedEntity.id;
      
      // Skip if already visited
      if (visited.has(connectedId)) {
        continue;
      }
      
      // Mark as visited
      visited.add(connectedId);
      
      // Get current confidence of connected entity
      const currentConfidence = connectedEntity.metadata?.confidence?.score;
      
      // Only update if propagated confidence is higher than current
      if (currentConfidence === undefined || propagatedConfidence > currentConfidence) {
        // Update confidence
        const evidence = {
          propagatedFrom: entityId,
          originalConfidence: parentConfidence,
          propagationFactor,
          propagationDepth: currentDepth
        };
        
        const updatedEntity = await this.assignConfidence(
          connectedId,
          propagatedConfidence,
          evidence,
          UncertaintyType.EPISTEMIC
        );
        
        updatedEntities.push(updatedEntity);
        
        // Continue propagation
        await this._propagateConfidenceRecursive(
          connectedId,
          propagatedConfidence,
          propagationFactor,
          maxDepth,
          currentDepth + 1,
          visited,
          updatedEntities
        );
      }
    }
  }
  
  /**
   * Helper method to get all entities connected to a given entity.
   * 
   * @private
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array<Object>>} - List of connected entities
   */
  async _getConnectedEntities(entityId) {
    // Try to get connected entities as if entityId is a node
    try {
      // Get outgoing edges
      const outgoingEdges = await this.storageAdapter.queryEdges({ sourceId: entityId });
      
      // Get incoming edges
      const incomingEdges = await this.storageAdapter.queryEdges({ targetId: entityId });
      
      // Get target nodes of outgoing edges
      const targetNodePromises = outgoingEdges.map(edge => 
        this.storageAdapter.retrieveNode(edge.targetId)
      );
      
      // Get source nodes of incoming edges
      const sourceNodePromises = incomingEdges.map(edge => 
        this.storageAdapter.retrieveNode(edge.sourceId)
      );
      
      // Wait for all promises
      const [targetNodes, sourceNodes] = await Promise.all([
        Promise.all(targetNodePromises),
        Promise.all(sourceNodePromises)
      ]);
      
      // Combine all connected entities
      return [...outgoingEdges, ...incomingEdges, ...targetNodes, ...sourceNodes];
    } catch (e) {
      // If entityId is not a node, return empty array
      return [];
    }
  }
  
  /**
   * Evaluates a fuzzy logic rule on knowledge entities.
   * 
   * @param {Object} rule - Fuzzy logic rule
   * @param {string} rule.antecedent - Antecedent expression
   * @param {string} rule.consequent - Consequent expression
   * @param {Array<string>} entityIds - IDs of entities to evaluate
   * @returns {Promise<Object>} - Evaluation results
   */
  async evaluateFuzzyRule(rule, entityIds) {
    this.ensureInitialized();
    
    if (!this.config.enableFuzzyLogic) {
      throw new Error('Fuzzy logic is not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_evaluateFuzzyRule');
    }
    
    try {
      // Validate rule
      if (!rule || !rule.antecedent || !rule.consequent) {
        throw new Error('Rule must have antecedent and consequent expressions');
      }
      
      // Validate entity IDs
      if (!Array.isArray(entityIds) || entityIds.length === 0) {
        throw new Error('Entity IDs must be a non-empty array');
      }
      
      // Retrieve entities
      const entityPromises = entityIds.map(async (id) => {
        try {
          // Try to get as node first
          return await this.storageAdapter.retrieveNode(id);
        } catch (e) {
          try {
            // Try to get as edge
            return await this.storageAdapter.retrieveEdge(id);
          } catch (e2) {
            try {
              // Try to get as hyperedge
              return await this.storageAdapter.retrieveHyperedge(id);
            } catch (e3) {
              throw new Error(`Entity ${id} not found`);
            }
          }
        }
      });
      
      const entities = await Promise.all(entityPromises);
      
      // Evaluate rule using fuzzy logic
      const results = this._evaluateFuzzyExpression(rule, entities);
      
      if (this.logger) {
        this.logger.debug(`Evaluated fuzzy rule on ${entityIds.length} entities with result ${results.truthValue}`);
      }
      
      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to evaluate fuzzy rule', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Helper method to evaluate fuzzy expressions.
   * 
   * @private
   * @param {Object} rule - Fuzzy logic rule
   * @param {Array<Object>} entities - Entities to evaluate
   * @returns {Object} - Evaluation results
   */
  _evaluateFuzzyExpression(rule, entities) {
    // This is a simplified implementation of fuzzy logic evaluation
    // In a real implementation, this would parse and evaluate complex fuzzy expressions
    
    // For demonstration, we'll use a simple approach:
    // 1. Calculate average confidence of entities as antecedent truth value
    // 2. Apply a simple fuzzy implication to get consequent truth value
    
    // Calculate average confidence
    let totalConfidence = 0;
    let entitiesWithConfidence = 0;
    
    for (const entity of entities) {
      const confidence = entity.metadata?.confidence?.score;
      if (confidence !== undefined) {
        totalConfidence += confidence;
        entitiesWithConfidence++;
      }
    }
    
    const antecedentTruthValue = entitiesWithConfidence > 0 
      ? totalConfidence / entitiesWithConfidence 
      : 0;
    
    // Apply fuzzy implication (using Mamdani min implication)
    // For simplicity, we'll use a fixed certainty factor for the rule
    const ruleCertainty = 0.8;
    const consequentTruthValue = Math.min(antecedentTruthValue, ruleCertainty);
    
    return {
      antecedentTruthValue,
      consequentTruthValue,
      ruleCertainty,
      entities: entities.map(e => e.id),
      rule: {
        antecedent: rule.antecedent,
        consequent: rule.consequent
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Queries entities based on confidence threshold.
   * 
   * @param {Object} queryOptions - Query options
   * @param {number} [queryOptions.minConfidence] - Minimum confidence threshold
   * @param {number} [queryOptions.maxConfidence] - Maximum confidence threshold
   * @param {ConfidenceLevel} [queryOptions.confidenceLevel] - Specific confidence level
   * @param {UncertaintyType} [queryOptions.uncertaintyType] - Specific uncertainty type
   * @returns {Promise<Array<Object>>} - Matching entities
   */
  async queryByConfidence(queryOptions = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('probabilisticKnowledgeManager_queryByConfidence');
    }
    
    try {
      // Set default min confidence if not specified
      if (queryOptions.minConfidence === undefined && queryOptions.confidenceLevel === undefined) {
        queryOptions.minConfidence = this.config.defaultConfidenceThreshold;
      }
      
      // Convert confidence level to min/max if specified
      if (queryOptions.confidenceLevel) {
        switch (queryOptions.confidenceLevel) {
          case ConfidenceLevel.VERY_HIGH:
            queryOptions.minConfidence = 0.9;
            queryOptions.maxConfidence = 1.0;
            break;
          case ConfidenceLevel.HIGH:
            queryOptions.minConfidence = 0.7;
            queryOptions.maxConfidence = 0.9;
            break;
          case ConfidenceLevel.MEDIUM:
            queryOptions.minConfidence = 0.5;
            queryOptions.maxConfidence = 0.7;
            break;
          case ConfidenceLevel.LOW:
            queryOptions.minConfidence = 0.3;
            queryOptions.maxConfidence = 0.5;
            break;
          case ConfidenceLevel.VERY_LOW:
            queryOptions.minConfidence = 0.0;
            queryOptions.maxConfidence = 0.3;
            break;
          default:
            throw new Error(`Invalid confidence level: ${queryOptions.confidenceLevel}`);
        }
      }
      
      // Query nodes
      const nodeQuery = {
        metadata: {
          confidence: {}
        }
      };
      
      if (queryOptions.minConfidence !== undefined) {
        nodeQuery.metadata.confidence.score = { $gte: queryOptions.minConfidence };
      }
      
      if (queryOptions.maxConfidence !== undefined) {
        if (!nodeQuery.metadata.confidence.score) {
          nodeQuery.metadata.confidence.score = {};
        }
        nodeQuery.metadata.confidence.score.$lte = queryOptions.maxConfidence;
      }
      
      if (queryOptions.uncertaintyType) {
        nodeQuery.metadata.confidence.uncertaintyType = queryOptions.uncertaintyType;
      }
      
      const nodes = await this.storageAdapter.queryNodes(nodeQuery);
      
      // Query edges
      const edgeQuery = {
        metadata: {
          confidence: {}
        }
      };
      
      if (queryOptions.minConfidence !== undefined) {
        edgeQuery.metadata.confidence.score = { $gte: queryOptions.minConfidence };
      }
      
      if (queryOptions.maxConfidence !== undefined) {
        if (!edgeQuery.metadata.confidence.score) {
          edgeQuery.metadata.confidence.score = {};
        }
        edgeQuery.metadata.confidence.score.$lte = queryOptions.maxConfidence;
      }
      
      if (queryOptions.uncertaintyType) {
        edgeQuery.metadata.confidence.uncertaintyType = queryOptions.uncertaintyType;
      }
      
      const edges = await this.storageAdapter.queryEdges(edgeQuery);
      
      // Combine results
      const results = [...nodes, ...edges];
      
      if (this.logger) {
        this.logger.debug(`Query by confidence returned ${results.length} entities`);
      }
      
      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to query by confidence', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

// Export classes and enums
module.exports = {
  ProbabilisticKnowledgeManager,
  ConfidenceLevel,
  UncertaintyType
};
