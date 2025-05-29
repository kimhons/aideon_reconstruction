/**
 * @fileoverview Edge types for the Knowledge Graph Manager.
 * Defines the types of edges supported in the knowledge graph.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Types of edges supported in the knowledge graph.
 * @enum {string}
 */
const EdgeType = {
  /**
   * Represents an "is a" relationship (inheritance or type).
   */
  IS_A: 'is_a',
  
  /**
   * Represents a "has property" relationship.
   */
  HAS_PROPERTY: 'has_property',
  
  /**
   * Represents a general relationship between entities.
   */
  RELATED_TO: 'related_to',
  
  /**
   * Represents a "part of" relationship (composition).
   */
  PART_OF: 'part_of',
  
  /**
   * Represents a causal relationship.
   */
  CAUSES: 'causes',
  
  /**
   * Represents a temporal precedence relationship.
   */
  PRECEDES: 'precedes',
  
  /**
   * Represents a logical implication.
   */
  IMPLIES: 'implies',
  
  /**
   * Represents a contradiction between entities.
   */
  CONTRADICTS: 'contradicts',
  
  /**
   * Represents a similarity relationship.
   */
  SIMILAR_TO: 'similar_to',
  
  /**
   * Represents an "instance of" relationship.
   */
  INSTANCE_OF: 'instance_of',
  
  /**
   * Represents a "defined by" relationship.
   */
  DEFINED_BY: 'defined_by',
  
  /**
   * Represents a reference relationship.
   */
  REFERENCES: 'references',
  
  /**
   * Represents a temporal relationship.
   */
  TEMPORAL_RELATION: 'temporal_relation',
  
  /**
   * Represents a probabilistic relationship with uncertainty.
   */
  PROBABILISTIC: 'probabilistic',
  
  /**
   * Represents a bidirectional relationship.
   */
  BIDIRECTIONAL: 'bidirectional'
};

module.exports = { EdgeType };
