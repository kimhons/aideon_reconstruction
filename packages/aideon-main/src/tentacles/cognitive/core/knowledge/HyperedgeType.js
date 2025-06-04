/**
 * @fileoverview Hyperedge types for the Knowledge Graph Manager.
 * Defines the types of hyperedges supported in the knowledge graph.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Types of hyperedges supported in the knowledge graph.
 * @enum {string}
 */
const HyperedgeType = {
  /**
   * Represents a group or collection of entities.
   */
  GROUP: 'group',
  
  /**
   * Represents a complex relationship involving multiple entities.
   */
  COMPLEX_RELATION: 'complex_relation',
  
  /**
   * Represents a hierarchical structure with multiple parents and children.
   */
  HIERARCHY: 'hierarchy',
  
  /**
   * Represents a semantic frame with multiple roles.
   */
  SEMANTIC_FRAME: 'semantic_frame',
  
  /**
   * Represents a temporal sequence involving multiple entities.
   */
  TEMPORAL_SEQUENCE: 'temporal_sequence',
  
  /**
   * Represents a causal network with multiple causes and effects.
   */
  CAUSAL_NETWORK: 'causal_network',
  
  /**
   * Represents a context that encompasses multiple entities.
   */
  CONTEXT: 'context',
  
  /**
   * Represents a multi-entity event.
   */
  EVENT: 'event',
  
  /**
   * Represents a scenario with multiple participants.
   */
  SCENARIO: 'scenario',
  
  /**
   * Represents a composite concept formed from multiple entities.
   */
  COMPOSITE_CONCEPT: 'composite_concept'
};

module.exports = { HyperedgeType };
