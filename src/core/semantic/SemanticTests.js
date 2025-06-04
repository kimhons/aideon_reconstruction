/**
 * @fileoverview Test suite for the Cross-Domain Semantic Integration Framework.
 * This file contains comprehensive tests for the UnifiedKnowledgeGraph, SemanticTranslator,
 * and CrossDomainQueryProcessor components.
 * 
 * @module core/semantic/SemanticTests
 */

const assert = require('assert');
const { 
  UnifiedKnowledgeGraph, 
  KnowledgeEntity, 
  SemanticRelationship,
  DuplicateEntityError,
  EntityNotFoundError
} = require('./UnifiedKnowledgeGraph');

const {
  SemanticTranslator,
  Ontology,
  ConceptMapping,
  TranslationStrategy,
  ExactMatchStrategy,
  ApproximateMatchStrategy,
  FallbackStrategy,
  DomainNotFoundError,
  TranslationError
} = require('./SemanticTranslator');

const {
  CrossDomainQueryProcessor,
  QueryEngine,
  QuerySyntaxError,
  QueryExecutionError
} = require('./CrossDomainQueryProcessor');

// Test utilities
function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n')[1]}`);
    }
    return false;
  }
}

function runTestSuite(suiteName, tests) {
  console.log(`\n📋 Running test suite: ${suiteName}`);
  let passed = 0;
  let failed = 0;
  
  for (const [name, testFn] of Object.entries(tests)) {
    if (runTest(name, testFn)) {
      passed++;
    } else {
      failed++;
    }
  }
  
  const total = passed + failed;
  const passRate = (passed / total) * 100;
  
  // Calculate confidence interval using Wilson score interval
  // For 98% confidence with n trials and p success rate
  const z = 2.326; // z-score for 98% confidence
  const n = total;
  const p = passed / n;
  const numerator = p + (z * z) / (2 * n);
  const denominator = 1 + (z * z) / n;
  const marginOfError = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n) / denominator;
  const lowerBound = Math.max(0, (numerator - marginOfError) / denominator) * 100;
  const upperBound = Math.min(1, (numerator + marginOfError) / denominator) * 100;
  const confidenceInterval = upperBound - lowerBound;
  
  console.log(`\n📊 Test suite results: ${suiteName}`);
  console.log(`   Total tests: ${total}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Pass rate: ${passRate.toFixed(2)}%`);
  console.log(`   98% Confidence interval: ±${confidenceInterval.toFixed(2)}%`);
  console.log(`   Range: ${lowerBound.toFixed(2)}% - ${upperBound.toFixed(2)}%`);
  
  return {
    total,
    passed,
    failed,
    passRate,
    confidenceInterval,
    lowerBound,
    upperBound
  };
}

// Mock data for tests
const createMockData = () => {
  // Create mock entities
  const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John Doe', age: 30 });
  const entity2 = new KnowledgeEntity('entity2', 'Person', { name: 'Jane Smith', age: 28 });
  const entity3 = new KnowledgeEntity('entity3', 'Organization', { name: 'Acme Corp', founded: 1985 });
  
  // Create mock relationships
  const relationship1 = new SemanticRelationship('rel1', 'entity1', 'entity3', 'WORKS_FOR', { role: 'Engineer', since: 2018 });
  const relationship2 = new SemanticRelationship('rel2', 'entity2', 'entity3', 'WORKS_FOR', { role: 'Manager', since: 2015 });
  const relationship3 = new SemanticRelationship('rel3', 'entity1', 'entity2', 'KNOWS', { since: 2019 });
  
  // Create mock ontologies
  const ontology1 = new Ontology('domain1', 'HR Domain', {
    'person': { name: 'Person', properties: ['name', 'age', 'email'] },
    'employee': { name: 'Employee', properties: ['id', 'position', 'department'] },
    'department': { name: 'Department', properties: ['name', 'code', 'manager'] }
  }, {
    'worksIn': { name: 'WorksIn', source: 'employee', target: 'department' },
    'manages': { name: 'Manages', source: 'employee', target: 'department' }
  });
  
  const ontology2 = new Ontology('domain2', 'Finance Domain', {
    'individual': { name: 'Individual', properties: ['fullName', 'birthDate', 'taxId'] },
    'staff': { name: 'Staff', properties: ['staffId', 'role', 'division'] },
    'division': { name: 'Division', properties: ['title', 'budget', 'head'] }
  }, {
    'belongsTo': { name: 'BelongsTo', source: 'staff', target: 'division' },
    'leads': { name: 'Leads', source: 'staff', target: 'division' }
  });
  
  // Create mock concept mappings
  const mapping1 = new ConceptMapping('mapping1', 'domain1', 'domain2', 'person', 'individual', 'exact', 0.95);
  const mapping2 = new ConceptMapping('mapping2', 'domain1', 'domain2', 'employee', 'staff', 'exact', 0.9);
  const mapping3 = new ConceptMapping('mapping3', 'domain1', 'domain2', 'department', 'division', 'approximate', 0.8);
  
  return {
    entities: [entity1, entity2, entity3],
    relationships: [relationship1, relationship2, relationship3],
    ontologies: [ontology1, ontology2],
    mappings: [mapping1, mapping2, mapping3]
  };
};

// Mock query engine for testing
class MockQueryEngine extends QueryEngine {
  constructor(domainId, options = {}) {
    super(domainId, options);
    this.mockData = options.mockData || [];
  }
  
  executeQuery(query, context, options = {}) {
    // Simple mock implementation that returns data based on query text
    if (!query || !query.queryText) {
      throw new QuerySyntaxError("Invalid query");
    }
    
    // Mock filtering based on query text
    const filteredData = this.mockData.filter(item => {
      if (query.queryText.includes(item.type)) {
        return true;
      }
      return false;
    });
    
    return {
      data: filteredData,
      count: filteredData.length,
      query: query
    };
  }
}

// Test suites
const unifiedKnowledgeGraphTests = {
  'should create a new UnifiedKnowledgeGraph instance': () => {
    const kg = new UnifiedKnowledgeGraph();
    assert(kg instanceof UnifiedKnowledgeGraph);
  },
  
  'should add an entity': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity = new KnowledgeEntity('test1', 'TestType', { prop1: 'value1' });
    const entityId = kg.addEntity(entity, 'testDomain');
    assert.strictEqual(entityId, 'test1');
  },
  
  'should throw error when adding duplicate entity': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity = new KnowledgeEntity('test1', 'TestType', { prop1: 'value1' });
    kg.addEntity(entity, 'testDomain');
    
    assert.throws(() => {
      kg.addEntity(entity, 'testDomain');
    }, DuplicateEntityError);
  },
  
  'should get an entity by ID': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity = new KnowledgeEntity('test1', 'TestType', { prop1: 'value1' });
    kg.addEntity(entity, 'testDomain');
    
    const retrievedEntity = kg.getEntity('test1');
    assert(retrievedEntity instanceof KnowledgeEntity);
    assert.strictEqual(retrievedEntity.getId(), 'test1');
    assert.strictEqual(retrievedEntity.getType(), 'TestType');
    assert.strictEqual(retrievedEntity.getAttribute('prop1'), 'value1');
  },
  
  'should throw error when getting non-existent entity': () => {
    const kg = new UnifiedKnowledgeGraph();
    assert.throws(() => {
      kg.getEntity('nonexistent');
    }, EntityNotFoundError);
  },
  
  'should update an entity': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity = new KnowledgeEntity('test1', 'TestType', { prop1: 'value1' });
    kg.addEntity(entity, 'testDomain');
    
    const updatedEntity = new KnowledgeEntity('test1', 'TestType', { prop1: 'updated', prop2: 'new' });
    const result = kg.updateEntity('test1', updatedEntity);
    assert.strictEqual(result, true);
    
    const retrievedEntity = kg.getEntity('test1');
    assert.strictEqual(retrievedEntity.getAttribute('prop1'), 'updated');
    assert.strictEqual(retrievedEntity.getAttribute('prop2'), 'new');
  },
  
  'should remove an entity': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity = new KnowledgeEntity('test1', 'TestType', { prop1: 'value1' });
    kg.addEntity(entity, 'testDomain');
    
    const result = kg.removeEntity('test1');
    assert.strictEqual(result, true);
    
    assert.throws(() => {
      kg.getEntity('test1');
    }, EntityNotFoundError);
  },
  
  'should add a relationship between entities': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John' });
    const entity2 = new KnowledgeEntity('entity2', 'Organization', { name: 'Acme' });
    kg.addEntity(entity1, 'testDomain');
    kg.addEntity(entity2, 'testDomain');
    
    const relationshipId = kg.addRelationship('entity1', 'entity2', 'WORKS_FOR', { role: 'Engineer' });
    assert(relationshipId);
  },
  
  'should get a relationship by ID': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John' });
    const entity2 = new KnowledgeEntity('entity2', 'Organization', { name: 'Acme' });
    kg.addEntity(entity1, 'testDomain');
    kg.addEntity(entity2, 'testDomain');
    
    const relationshipId = kg.addRelationship('entity1', 'entity2', 'WORKS_FOR', { role: 'Engineer' });
    const relationship = kg.getRelationship(relationshipId);
    
    assert(relationship instanceof SemanticRelationship);
    assert.strictEqual(relationship.getSourceEntityId(), 'entity1');
    assert.strictEqual(relationship.getTargetEntityId(), 'entity2');
    assert.strictEqual(relationship.getType(), 'WORKS_FOR');
    assert.strictEqual(relationship.getAttribute('role'), 'Engineer');
  },
  
  'should update a relationship': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John' });
    const entity2 = new KnowledgeEntity('entity2', 'Organization', { name: 'Acme' });
    kg.addEntity(entity1, 'testDomain');
    kg.addEntity(entity2, 'testDomain');
    
    const relationshipId = kg.addRelationship('entity1', 'entity2', 'WORKS_FOR', { role: 'Engineer' });
    const result = kg.updateRelationship(relationshipId, { role: 'Manager', since: 2020 });
    
    assert.strictEqual(result, true);
    const relationship = kg.getRelationship(relationshipId);
    assert.strictEqual(relationship.getAttribute('role'), 'Manager');
    assert.strictEqual(relationship.getAttribute('since'), 2020);
  },
  
  'should remove a relationship': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John' });
    const entity2 = new KnowledgeEntity('entity2', 'Organization', { name: 'Acme' });
    kg.addEntity(entity1, 'testDomain');
    kg.addEntity(entity2, 'testDomain');
    
    const relationshipId = kg.addRelationship('entity1', 'entity2', 'WORKS_FOR', { role: 'Engineer' });
    const result = kg.removeRelationship(relationshipId);
    
    assert.strictEqual(result, true);
    assert.throws(() => {
      kg.getRelationship(relationshipId);
    });
  },
  
  'should perform basic queries': () => {
    const kg = new UnifiedKnowledgeGraph();
    const mockData = createMockData();
    
    // Add entities and relationships
    mockData.entities.forEach(entity => kg.addEntity(entity, 'testDomain'));
    mockData.relationships.forEach(rel => {
      const relId = kg.addRelationship(rel.getSourceEntityId(), rel.getTargetEntityId(), rel.getType(), rel.getAttributes());
      assert(relId);
    });
    
    // Test a simple query
    const result = kg.query('GET_ALL_ENTITIES', 'semantic');
    assert(Array.isArray(result));
    assert.strictEqual(result.length, mockData.entities.length);
  }
};

const semanticTranslatorTests = {
  'should create a new SemanticTranslator instance': () => {
    const translator = new SemanticTranslator();
    assert(translator instanceof SemanticTranslator);
  },
  
  'should register a domain ontology': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    const ontology = mockData.ontologies[0];
    
    const result = translator.registerDomainOntology('domain1', ontology);
    assert.strictEqual(result, true);
  },
  
  'should throw error when registering duplicate domain': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    const ontology = mockData.ontologies[0];
    
    translator.registerDomainOntology('domain1', ontology);
    assert.throws(() => {
      translator.registerDomainOntology('domain1', ontology);
    }, DuplicateDomainError);
  },
  
  'should get a registered domain ontology': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    const ontology = mockData.ontologies[0];
    
    translator.registerDomainOntology('domain1', ontology);
    const retrievedOntology = translator.getDomainOntology('domain1');
    
    assert(retrievedOntology instanceof Ontology);
    assert.strictEqual(retrievedOntology.id, ontology.id);
    assert.strictEqual(retrievedOntology.name, ontology.name);
  },
  
  'should throw error when getting non-existent domain': () => {
    const translator = new SemanticTranslator();
    assert.throws(() => {
      translator.getDomainOntology('nonexistent');
    }, DomainNotFoundError);
  },
  
  'should unregister a domain ontology': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    const ontology = mockData.ontologies[0];
    
    translator.registerDomainOntology('domain1', ontology);
    const result = translator.unregisterDomainOntology('domain1');
    
    assert.strictEqual(result, true);
    assert.throws(() => {
      translator.getDomainOntology('domain1');
    }, DomainNotFoundError);
  },
  
  'should create a concept mapping': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    const mapping = mockData.mappings[0];
    const result = translator.createConceptMapping('domain1', 'domain2', mapping);
    
    assert.strictEqual(result, true);
  },
  
  'should get a concept mapping': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    const mapping = mockData.mappings[0];
    translator.createConceptMapping('domain1', 'domain2', mapping);
    
    const retrievedMapping = translator.getConceptMapping('domain1', 'domain2', mapping.sourceConceptId);
    assert(retrievedMapping instanceof ConceptMapping);
    assert.strictEqual(retrievedMapping.id, mapping.id);
    assert.strictEqual(retrievedMapping.sourceConceptId, mapping.sourceConceptId);
    assert.strictEqual(retrievedMapping.targetConceptId, mapping.targetConceptId);
  },
  
  'should update a concept mapping': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    const mapping = mockData.mappings[0];
    translator.createConceptMapping('domain1', 'domain2', mapping);
    
    const updatedMapping = new ConceptMapping(
      mapping.id,
      mapping.sourceDomainId,
      mapping.targetDomainId,
      mapping.sourceConceptId,
      mapping.targetConceptId,
      'broader',
      0.75
    );
    
    const result = translator.updateConceptMapping('domain1', 'domain2', mapping.sourceConceptId, updatedMapping);
    assert.strictEqual(result, true);
    
    const retrievedMapping = translator.getConceptMapping('domain1', 'domain2', mapping.sourceConceptId);
    assert.strictEqual(retrievedMapping.mappingType, 'broader');
    assert.strictEqual(retrievedMapping.confidence, 0.75);
  },
  
  'should remove a concept mapping': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    const mapping = mockData.mappings[0];
    translator.createConceptMapping('domain1', 'domain2', mapping);
    
    const result = translator.removeConceptMapping('domain1', 'domain2', mapping.sourceConceptId);
    assert.strictEqual(result, true);
    
    assert.throws(() => {
      translator.getConceptMapping('domain1', 'domain2', mapping.sourceConceptId);
    });
  },
  
  'should register a custom translation strategy': () => {
    const translator = new SemanticTranslator();
    
    class CustomStrategy extends TranslationStrategy {
      canHandle() { return true; }
      execute() { return { success: true, result: { translated: true }, confidence: 0.8 }; }
      getPriority() { return 75; }
    }
    
    const strategy = new CustomStrategy();
    const result = translator.registerTranslationStrategy('custom', strategy);
    
    assert.strictEqual(result, true);
  },
  
  'should unregister a custom translation strategy': () => {
    const translator = new SemanticTranslator();
    
    class CustomStrategy extends TranslationStrategy {
      canHandle() { return true; }
      execute() { return { success: true, result: { translated: true }, confidence: 0.8 }; }
      getPriority() { return 75; }
    }
    
    const strategy = new CustomStrategy();
    translator.registerTranslationStrategy('custom', strategy);
    
    const result = translator.unregisterTranslationStrategy('custom');
    assert.strictEqual(result, true);
  },
  
  'should clear translation cache': () => {
    const translator = new SemanticTranslator({
      cacheConfig: { enabled: true, maxSize: 100, ttl: 3600000 }
    });
    
    const result = translator.clearCache();
    assert.strictEqual(result, true);
  },
  
  'should add and remove event listeners': () => {
    const translator = new SemanticTranslator();
    
    const listenerId = translator.addEventListener('translation:completed', () => {});
    assert(typeof listenerId === 'string');
    
    const result = translator.removeEventListener(listenerId);
    assert.strictEqual(result, true);
  }
};

const crossDomainQueryProcessorTests = {
  'should create a new CrossDomainQueryProcessor instance': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    assert(processor instanceof CrossDomainQueryProcessor);
  },
  
  'should register a query engine': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const engine = new MockQueryEngine('domain1');
    const result = processor.registerQueryEngine('domain1', engine);
    
    assert.strictEqual(result, true);
  },
  
  'should get a registered query engine': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const engine = new MockQueryEngine('domain1');
    processor.registerQueryEngine('domain1', engine);
    
    const retrievedEngine = processor.getQueryEngine('domain1');
    assert(retrievedEngine instanceof QueryEngine);
    assert.strictEqual(retrievedEngine.domainId, 'domain1');
  },
  
  'should unregister a query engine': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const engine = new MockQueryEngine('domain1');
    processor.registerQueryEngine('domain1', engine);
    
    const result = processor.unregisterQueryEngine('domain1');
    assert.strictEqual(result, true);
    
    assert.throws(() => {
      processor.getQueryEngine('domain1');
    });
  },
  
  'should execute a query': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const mockData = createMockData().entities;
    const engine = new MockQueryEngine('domain1', { mockData });
    processor.registerQueryEngine('domain1', engine);
    
    const query = { queryText: 'SELECT * FROM Person', language: 'semantic' };
    const result = await processor.executeQuery(query);
    
    assert(result);
    assert(Array.isArray(result.data));
    assert(result.data.length > 0);
  },
  
  'should execute a batch of queries': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const mockData = createMockData().entities;
    const engine = new MockQueryEngine('domain1', { mockData });
    processor.registerQueryEngine('domain1', engine);
    
    const queries = [
      { queryText: 'SELECT * FROM Person', language: 'semantic' },
      { queryText: 'SELECT * FROM Organization', language: 'semantic' }
    ];
    
    const results = await processor.executeBatch(queries);
    
    assert(Array.isArray(results));
    assert.strictEqual(results.length, 2);
    assert(results[0].data);
    assert(results[1].data);
  },
  
  'should execute a query asynchronously': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const mockData = createMockData().entities;
    const engine = new MockQueryEngine('domain1', { mockData });
    processor.registerQueryEngine('domain1', engine);
    
    const query = { queryText: 'SELECT * FROM Person', language: 'semantic' };
    const executionId = processor.executeQueryAsync(query);
    
    assert(typeof executionId === 'string');
  },
  
  'should analyze a query': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const query = { queryText: 'SELECT * FROM Person', language: 'semantic' };
    const analysis = processor.analyzeQuery(query);
    
    assert(analysis);
    assert(analysis.queryText);
    assert(analysis.language);
    assert(Array.isArray(analysis.involvedDomains));
  },
  
  'should validate a query': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const query = { queryText: 'SELECT * FROM Person', language: 'semantic' };
    const validation = processor.validateQuery(query);
    
    assert(validation);
    assert(typeof validation.valid === 'boolean');
    assert(Array.isArray(validation.issues));
  },
  
  'should clear query cache': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator, {
      cacheConfig: { enabled: true, maxSize: 100, ttl: 600000 }
    });
    
    const result = processor.clearCache();
    assert.strictEqual(result, true);
  },
  
  'should add and remove event listeners': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const listenerId = processor.addEventListener('query:completed', () => {});
    assert(typeof listenerId === 'string');
    
    const result = processor.removeEventListener(listenerId);
    assert.strictEqual(result, true);
  }
};

const integrationTests = {
  'should integrate UnifiedKnowledgeGraph with SemanticTranslator': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    // Add entities to knowledge graph
    mockData.entities.forEach(entity => kg.addEntity(entity, 'testDomain'));
    
    // Register ontologies with translator
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    // Create mappings
    mockData.mappings.forEach(mapping => 
      translator.createConceptMapping(mapping.sourceDomainId, mapping.targetDomainId, mapping)
    );
    
    // Verify integration
    const entity = kg.getEntity('entity1');
    assert(entity);
    
    const ontology = translator.getDomainOntology('domain1');
    assert(ontology);
    
    const mapping = translator.getConceptMapping('domain1', 'domain2', 'person');
    assert(mapping);
  },
  
  'should integrate SemanticTranslator with CrossDomainQueryProcessor': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    const mockData = createMockData();
    
    // Register ontologies with translator
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    // Create mappings
    mockData.mappings.forEach(mapping => 
      translator.createConceptMapping(mapping.sourceDomainId, mapping.targetDomainId, mapping)
    );
    
    // Register query engines with processor
    const engine1 = new MockQueryEngine('domain1', { mockData: mockData.entities.filter(e => e.getType() === 'Person') });
    const engine2 = new MockQueryEngine('domain2', { mockData: mockData.entities.filter(e => e.getType() === 'Organization') });
    
    processor.registerQueryEngine('domain1', engine1);
    processor.registerQueryEngine('domain2', engine2);
    
    // Execute a cross-domain query
    const query = { 
      queryText: 'SELECT * FROM Person, Organization WHERE Person.WORKS_FOR = Organization.id', 
      language: 'semantic' 
    };
    
    const result = await processor.executeQuery(query);
    assert(result);
    assert(result.data);
  },
  
  'should integrate all three components in a complete workflow': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    const mockData = createMockData();
    
    // 1. Add entities and relationships to knowledge graph
    mockData.entities.forEach(entity => kg.addEntity(entity, 'testDomain'));
    mockData.relationships.forEach(rel => {
      kg.addRelationship(rel.getSourceEntityId(), rel.getTargetEntityId(), rel.getType(), rel.getAttributes());
    });
    
    // 2. Register ontologies with translator
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    // 3. Create mappings
    mockData.mappings.forEach(mapping => 
      translator.createConceptMapping(mapping.sourceDomainId, mapping.targetDomainId, mapping)
    );
    
    // 4. Register query engines with processor
    const engine1 = new MockQueryEngine('domain1', { mockData: mockData.entities.filter(e => e.getType() === 'Person') });
    const engine2 = new MockQueryEngine('domain2', { mockData: mockData.entities.filter(e => e.getType() === 'Organization') });
    
    processor.registerQueryEngine('domain1', engine1);
    processor.registerQueryEngine('domain2', engine2);
    
    // 5. Execute a cross-domain query
    const query = { 
      queryText: 'SELECT * FROM Person, Organization WHERE Person.WORKS_FOR = Organization.id', 
      language: 'semantic' 
    };
    
    const result = await processor.executeQuery(query);
    assert(result);
    assert(result.data);
    
    // 6. Analyze the query
    const analysis = processor.analyzeQuery(query);
    assert(analysis);
    assert(analysis.involvedDomains.includes('domain1'));
    assert(analysis.involvedDomains.includes('domain2'));
  }
};

// Edge case tests
const edgeCaseTests = {
  'should handle empty knowledge graph gracefully': () => {
    const kg = new UnifiedKnowledgeGraph();
    const result = kg.query('GET_ALL_ENTITIES', 'semantic');
    assert(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  },
  
  'should handle translation with no mappings gracefully': () => {
    const translator = new SemanticTranslator();
    const mockData = createMockData();
    
    translator.registerDomainOntology('domain1', mockData.ontologies[0]);
    translator.registerDomainOntology('domain2', mockData.ontologies[1]);
    
    // No mappings registered
    
    assert.throws(() => {
      translator.translateConcept('domain1', 'domain2', { id: 'person', name: 'Person' });
    }, TranslationError);
  },
  
  'should handle query with no registered engines gracefully': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    // No engines registered
    
    const query = { queryText: 'SELECT * FROM Person', language: 'semantic' };
    
    try {
      await processor.executeQuery(query);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert(error instanceof QueryExecutionError);
    }
  },
  
  'should handle invalid query syntax gracefully': async () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const engine = new MockQueryEngine('domain1');
    processor.registerQueryEngine('domain1', engine);
    
    const invalidQuery = { queryText: '' }; // Empty query text
    
    try {
      await processor.executeQuery(invalidQuery);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert(error instanceof QuerySyntaxError || error instanceof QueryExecutionError);
    }
  },
  
  'should handle circular relationships in knowledge graph': () => {
    const kg = new UnifiedKnowledgeGraph();
    
    // Create entities
    const entity1 = new KnowledgeEntity('entity1', 'Person', { name: 'John' });
    const entity2 = new KnowledgeEntity('entity2', 'Person', { name: 'Jane' });
    
    kg.addEntity(entity1, 'testDomain');
    kg.addEntity(entity2, 'testDomain');
    
    // Create circular relationship
    const rel1Id = kg.addRelationship('entity1', 'entity2', 'KNOWS', { since: 2019 });
    const rel2Id = kg.addRelationship('entity2', 'entity1', 'KNOWS', { since: 2019 });
    
    assert(rel1Id);
    assert(rel2Id);
    
    // Verify relationships
    const rel1 = kg.getRelationship(rel1Id);
    const rel2 = kg.getRelationship(rel2Id);
    
    assert.strictEqual(rel1.getSourceEntityId(), 'entity1');
    assert.strictEqual(rel1.getTargetEntityId(), 'entity2');
    assert.strictEqual(rel2.getSourceEntityId(), 'entity2');
    assert.strictEqual(rel2.getTargetEntityId(), 'entity1');
  }
};

// Performance tests
const performanceTests = {
  'should handle large number of entities efficiently': () => {
    const kg = new UnifiedKnowledgeGraph();
    const entityCount = 1000;
    
    console.time('Add 1000 entities');
    for (let i = 0; i < entityCount; i++) {
      const entity = new KnowledgeEntity(`entity${i}`, 'TestType', { index: i });
      kg.addEntity(entity, 'testDomain');
    }
    console.timeEnd('Add 1000 entities');
    
    console.time('Query 1000 entities');
    const result = kg.query('GET_ALL_ENTITIES', 'semantic');
    console.timeEnd('Query 1000 entities');
    
    assert.strictEqual(result.length, entityCount);
  },
  
  'should handle multiple domain ontologies efficiently': () => {
    const translator = new SemanticTranslator();
    const domainCount = 10;
    
    console.time(`Register ${domainCount} domains`);
    for (let i = 0; i < domainCount; i++) {
      const ontology = new Ontology(`domain${i}`, `Domain ${i}`, {
        [`concept${i}_1`]: { name: `Concept ${i}.1`, properties: ['prop1', 'prop2'] },
        [`concept${i}_2`]: { name: `Concept ${i}.2`, properties: ['prop3', 'prop4'] }
      });
      translator.registerDomainOntology(`domain${i}`, ontology);
    }
    console.timeEnd(`Register ${domainCount} domains`);
    
    // Verify all domains are registered
    for (let i = 0; i < domainCount; i++) {
      const ontology = translator.getDomainOntology(`domain${i}`);
      assert(ontology instanceof Ontology);
      assert.strictEqual(ontology.id, `domain${i}`);
    }
  }
};

// Run all test suites
console.log('🧪 Starting Cross-Domain Semantic Integration Framework Tests');

const results = {
  unifiedKnowledgeGraph: runTestSuite('UnifiedKnowledgeGraph', unifiedKnowledgeGraphTests),
  semanticTranslator: runTestSuite('SemanticTranslator', semanticTranslatorTests),
  crossDomainQueryProcessor: runTestSuite('CrossDomainQueryProcessor', crossDomainQueryProcessorTests),
  integration: runTestSuite('Integration Tests', integrationTests),
  edgeCases: runTestSuite('Edge Cases', edgeCaseTests),
  performance: runTestSuite('Performance Tests', performanceTests)
};

// Calculate overall results
const totalTests = Object.values(results).reduce((sum, result) => sum + result.total, 0);
const totalPassed = Object.values(results).reduce((sum, result) => sum + result.passed, 0);
const totalFailed = Object.values(results).reduce((sum, result) => sum + result.failed, 0);
const overallPassRate = (totalPassed / totalTests) * 100;

// Calculate overall confidence interval
const z = 2.326; // z-score for 98% confidence
const n = totalTests;
const p = totalPassed / n;
const numerator = p + (z * z) / (2 * n);
const denominator = 1 + (z * z) / n;
const marginOfError = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n) / denominator;
const lowerBound = Math.max(0, (numerator - marginOfError) / denominator) * 100;
const upperBound = Math.min(1, (numerator + marginOfError) / denominator) * 100;
const confidenceInterval = upperBound - lowerBound;

console.log('\n📊 Overall Test Results');
console.log(`   Total tests: ${totalTests}`);
console.log(`   Passed: ${totalPassed}`);
console.log(`   Failed: ${totalFailed}`);
console.log(`   Pass rate: ${overallPassRate.toFixed(2)}%`);
console.log(`   98% Confidence interval: ±${confidenceInterval.toFixed(2)}%`);
console.log(`   Range: ${lowerBound.toFixed(2)}% - ${upperBound.toFixed(2)}%`);

// Export results
module.exports = {
  results,
  overallResults: {
    totalTests,
    totalPassed,
    totalFailed,
    overallPassRate,
    confidenceInterval,
    lowerBound,
    upperBound
  }
};
