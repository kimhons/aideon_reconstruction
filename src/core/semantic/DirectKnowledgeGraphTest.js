/**
 * @fileoverview Direct test for knowledge graph integration with CrossDomainQueryProcessor
 * This file tests object integrity across module boundaries by creating objects in different ways.
 */

const CrossDomainQueryProcessor = require('./CrossDomainQueryProcessor');

// Create a global object for testing
global.testKnowledgeGraph = {
  query: function(query, queryLanguage, parameters, options) {
    console.log(`Global KG query called with: ${query}`);
    return [];
  },
  
  getEntity: function(entityId, options) {
    console.log(`Global KG getEntity called with: ${entityId}`);
    return { id: entityId, type: 'global', attributes: {}, metadata: {} };
  }
};

// Log methods on global object
console.log("Global object methods:", 
  Object.keys(global.testKnowledgeGraph).filter(key => typeof global.testKnowledgeGraph[key] === 'function'));
console.log("Global query type:", typeof global.testKnowledgeGraph.query);
console.log("Global getEntity type:", typeof global.testKnowledgeGraph.getEntity);

// Create a direct object in this file
const directKnowledgeGraph = {
  query: function(query, queryLanguage, parameters, options) {
    console.log(`Direct KG query called with: ${query}`);
    return [];
  },
  
  getEntity: function(entityId, options) {
    console.log(`Direct KG getEntity called with: ${entityId}`);
    return { id: entityId, type: 'direct', attributes: {}, metadata: {} };
  }
};

// Log methods on direct object
console.log("Direct object methods:", 
  Object.keys(directKnowledgeGraph).filter(key => typeof directKnowledgeGraph[key] === 'function'));
console.log("Direct query type:", typeof directKnowledgeGraph.query);
console.log("Direct getEntity type:", typeof directKnowledgeGraph.getEntity);

// Create a mock translator
const mockTranslator = {
  translateConcept: function(concept, sourceDomain, targetDomain) {
    return concept;
  },
  translateConcepts: function(concepts, sourceDomain, targetDomain) {
    return concepts;
  }
};

// Test with direct object
try {
  console.log("\n--- Testing with direct object ---");
  const directProcessor = new CrossDomainQueryProcessor(directKnowledgeGraph, mockTranslator);
  console.log("SUCCESS: Direct object passed validation");
} catch (error) {
  console.error("FAILURE: Direct object failed validation:", error.message);
}

// Test with global object
try {
  console.log("\n--- Testing with global object ---");
  const globalProcessor = new CrossDomainQueryProcessor(global.testKnowledgeGraph, mockTranslator);
  console.log("SUCCESS: Global object passed validation");
} catch (error) {
  console.error("FAILURE: Global object failed validation:", error.message);
}

// Test with factory function
function createTestKnowledgeGraph() {
  return {
    query: function(query, queryLanguage, parameters, options) {
      console.log(`Factory KG query called with: ${query}`);
      return [];
    },
    
    getEntity: function(entityId, options) {
      console.log(`Factory KG getEntity called with: ${entityId}`);
      return { id: entityId, type: 'factory', attributes: {}, metadata: {} };
    }
  };
}

const factoryKnowledgeGraph = createTestKnowledgeGraph();

// Log methods on factory object
console.log("\nFactory object methods:", 
  Object.keys(factoryKnowledgeGraph).filter(key => typeof factoryKnowledgeGraph[key] === 'function'));
console.log("Factory query type:", typeof factoryKnowledgeGraph.query);
console.log("Factory getEntity type:", typeof factoryKnowledgeGraph.getEntity);

// Test with factory object
try {
  console.log("\n--- Testing with factory object ---");
  const factoryProcessor = new CrossDomainQueryProcessor(factoryKnowledgeGraph, mockTranslator);
  console.log("SUCCESS: Factory object passed validation");
} catch (error) {
  console.error("FAILURE: Factory object failed validation:", error.message);
}

// Test with JSON serialization/deserialization (simulating module boundaries)
try {
  console.log("\n--- Testing with serialized/deserialized object ---");
  
  // Create object with methods
  const originalObject = {
    query: function(q) { return []; },
    getEntity: function(id) { return { id }; }
  };
  
  // Simulate serialization/deserialization across module boundary
  const serialized = JSON.stringify(originalObject);
  const deserializedObject = JSON.parse(serialized);
  
  // Log what happened to methods
  console.log("Original methods:", Object.keys(originalObject).filter(k => typeof originalObject[k] === 'function'));
  console.log("After serialization/deserialization:", 
    Object.keys(deserializedObject).filter(k => typeof deserializedObject[k] === 'function'));
  
  // This will fail because JSON serialization strips functions
  const serializedProcessor = new CrossDomainQueryProcessor(deserializedObject, mockTranslator);
  console.log("SUCCESS: Serialized object passed validation (unexpected!)");
} catch (error) {
  console.error("FAILURE: Serialized object failed validation (expected):", error.message);
}

console.log("\nEnvironment investigation complete. Check results above to determine the root cause.");
