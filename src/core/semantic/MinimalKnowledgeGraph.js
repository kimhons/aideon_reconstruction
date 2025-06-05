/**
 * @fileoverview Minimal knowledge graph implementation with direct method exposure
 * for compatibility with CrossDomainQueryProcessor's duck typing checks.
 * 
 * @module core/semantic/MinimalKnowledgeGraph
 */

/**
 * Creates a minimal knowledge graph object with only the essential methods
 * directly defined as own properties to ensure duck typing compatibility.
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} A minimal knowledge graph object
 */
function createMinimalKnowledgeGraph(options = {}) {
  const logger = options.logger || console;
  
  // Create a minimal object with only the required methods
  const minimalGraph = {
    // Required methods as own properties
    query: function(query, queryLanguage = "semantic", parameters = {}, options = {}) {
      logger.info(`MinimalKnowledgeGraph.query called with: ${query}`);
      // Return empty array as minimal implementation
      return [];
    },
    
    getEntity: function(entityId, options = {}) {
      logger.info(`MinimalKnowledgeGraph.getEntity called with: ${entityId}`);
      // Return minimal entity object
      return { 
        id: entityId, 
        type: 'minimal', 
        attributes: {}, 
        metadata: {} 
      };
    }
  };
  
  // Add debugging helper
  minimalGraph.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`MinimalKnowledgeGraph has these methods: ${methods.join(', ')}`);
    
    // Explicitly check critical methods
    logger.info(`query method type: ${typeof this.query}`);
    logger.info(`getEntity method type: ${typeof this.getEntity}`);
    
    return methods;
  };
  
  // Log available methods immediately
  minimalGraph.debugMethods();
  
  return minimalGraph;
}

module.exports = createMinimalKnowledgeGraph;
