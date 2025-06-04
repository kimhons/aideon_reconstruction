/**
 * @fileoverview Node types for the Knowledge Graph Manager.
 * Defines the types of nodes supported in the knowledge graph.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Types of nodes supported in the knowledge graph.
 * @enum {string}
 */
const NodeType = {
  /**
   * Represents an abstract concept or idea.
   */
  CONCEPT: 'concept',
  
  /**
   * Represents a concrete entity or object.
   */
  ENTITY: 'entity',
  
  /**
   * Represents an event or occurrence.
   */
  EVENT: 'event',
  
  /**
   * Represents a property or attribute.
   */
  PROPERTY: 'property',
  
  /**
   * Represents a relation between entities.
   */
  RELATION: 'relation',
  
  /**
   * Represents a rule or constraint.
   */
  RULE: 'rule',
  
  /**
   * Represents a context or situation.
   */
  CONTEXT: 'context',
  
  /**
   * Represents metadata about other nodes.
   */
  METADATA: 'metadata',
  
  /**
   * Represents knowledge with uncertainty.
   */
  UNCERTAIN: 'uncertain',
  
  /**
   * Represents a composite structure containing other nodes.
   */
  COMPOSITE: 'composite'
};

module.exports = { NodeType };
