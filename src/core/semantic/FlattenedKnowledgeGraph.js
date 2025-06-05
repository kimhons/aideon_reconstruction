/**
 * @fileoverview Implementation of the FlattenedKnowledgeGraph class.
 * This class provides a flattened object with all methods directly on the instance
 * to ensure compatibility with duck typing checks across module boundaries.
 * 
 * @module core/semantic/FlattenedKnowledgeGraph
 */

const UnifiedKnowledgeGraph = require('./UnifiedKnowledgeGraph');

/**
 * Creates a flattened knowledge graph object with all methods directly on the instance
 * rather than on the prototype chain, ensuring compatibility with duck typing checks.
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} A flattened knowledge graph object
 */
function createFlattenedKnowledgeGraph(options = {}) {
  const logger = options.logger || console;
  logger.info("Creating flattened knowledge graph");
  
  // Create the underlying knowledge graph
  const knowledgeGraph = new UnifiedKnowledgeGraph(options);
  
  // Create a plain object to hold all methods
  const flattenedGraph = {
    // Core properties
    _knowledgeGraph: knowledgeGraph,
    _logger: logger,
    _metrics: options.metrics,
    
    // Required methods explicitly defined as own properties
    query: function(query, queryLanguage = "semantic", parameters = {}, options = {}) {
      logger.debug(`Executing query: ${query} (${queryLanguage})`);
      try {
        return knowledgeGraph.query(query, queryLanguage, parameters, options);
      } catch (error) {
        logger.error(`Query execution failed: ${error.message}`, error);
        return [];
      }
    },
    
    getEntity: function(entityId, options = {}) {
      logger.debug(`Getting entity: ${entityId}`);
      try {
        return knowledgeGraph.getEntity(entityId, options);
      } catch (error) {
        logger.error(`Failed to get entity ${entityId}: ${error.message}`, error);
        return { id: entityId, type: 'unknown', attributes: {}, metadata: {} };
      }
    },
    
    addEntity: function(entity, domainId, options = {}) {
      logger.debug(`Adding entity to domain: ${domainId}`);
      try {
        return knowledgeGraph.addEntity(entity, domainId, options);
      } catch (error) {
        logger.error(`Failed to add entity: ${error.message}`, error);
        throw error;
      }
    },
    
    updateEntity: function(entityId, updatedEntityData, options = {}) {
      logger.debug(`Updating entity: ${entityId}`);
      try {
        return knowledgeGraph.updateEntity(entityId, updatedEntityData, options);
      } catch (error) {
        logger.error(`Failed to update entity ${entityId}: ${error.message}`, error);
        return false;
      }
    },
    
    removeEntity: function(entityId, options = {}) {
      logger.debug(`Removing entity: ${entityId}`);
      try {
        return knowledgeGraph.removeEntity(entityId, options);
      } catch (error) {
        logger.error(`Failed to remove entity ${entityId}: ${error.message}`, error);
        return false;
      }
    },
    
    addRelationship: function(sourceEntityId, targetEntityId, relationType, attributes = {}, options = {}) {
      logger.debug(`Adding relationship: ${sourceEntityId} -> ${targetEntityId} (${relationType})`);
      try {
        return knowledgeGraph.addRelationship(sourceEntityId, targetEntityId, relationType, attributes, options);
      } catch (error) {
        logger.error(`Failed to add relationship: ${error.message}`, error);
        throw error;
      }
    },
    
    getRelationship: function(relationshipId, options = {}) {
      logger.debug(`Getting relationship: ${relationshipId}`);
      try {
        return knowledgeGraph.getRelationship(relationshipId, options);
      } catch (error) {
        logger.error(`Failed to get relationship ${relationshipId}: ${error.message}`, error);
        return { id: relationshipId, sourceEntityId: 'unknown', targetEntityId: 'unknown', type: 'unknown', attributes: {}, metadata: {} };
      }
    },
    
    updateRelationship: function(relationshipId, updatedAttributes, options = {}) {
      logger.debug(`Updating relationship: ${relationshipId}`);
      try {
        return knowledgeGraph.updateRelationship(relationshipId, updatedAttributes, options);
      } catch (error) {
        logger.error(`Failed to update relationship ${relationshipId}: ${error.message}`, error);
        return false;
      }
    },
    
    removeRelationship: function(relationshipId, options = {}) {
      logger.debug(`Removing relationship: ${relationshipId}`);
      try {
        return knowledgeGraph.removeRelationship(relationshipId, options);
      } catch (error) {
        logger.error(`Failed to remove relationship ${relationshipId}: ${error.message}`, error);
        return false;
      }
    },
    
    getStatistics: function(specification, options = {}) {
      try {
        return knowledgeGraph.getStatistics(specification, options);
      } catch (error) {
        logger.error(`Failed to get statistics: ${error.message}`, error);
        return {
          entityCount: 0,
          relationshipCount: 0,
          error: error.message
        };
      }
    },
    
    // Add any other methods that might be needed
    validate: function(specification, options = {}) {
      try {
        return knowledgeGraph.validate(specification, options);
      } catch (error) {
        logger.error(`Validation failed: ${error.message}`, error);
        return { valid: false, issues: [error.message] };
      }
    },
    
    // Utility methods
    toString: function() {
      return `FlattenedKnowledgeGraph (entities: ${this.getStatistics().entityCount}, relationships: ${this.getStatistics().relationshipCount})`;
    }
  };
  
  // Log available methods for debugging
  const methods = Object.keys(flattenedGraph).filter(key => typeof flattenedGraph[key] === 'function');
  logger.debug(`FlattenedKnowledgeGraph has these methods: ${methods.join(', ')}`);
  
  return flattenedGraph;
}

module.exports = createFlattenedKnowledgeGraph;
