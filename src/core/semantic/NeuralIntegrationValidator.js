/**
 * @fileoverview Integration validation between the Cross-Domain Semantic Integration Framework
 * and the Neural Hyperconnectivity System. This file ensures seamless communication and
 * data flow between these two critical components of the Aideon ecosystem.
 * 
 * @module core/semantic/NeuralIntegrationValidator
 */

const assert = require('assert');
const { 
  UnifiedKnowledgeGraph, 
  KnowledgeEntity, 
  SemanticRelationship 
} = require('./UnifiedKnowledgeGraph');

const {
  SemanticTranslator,
  Ontology,
  ConceptMapping
} = require('./SemanticTranslator');

const {
  CrossDomainQueryProcessor,
  QueryEngine
} = require('./CrossDomainQueryProcessor');

// Import Neural Hyperconnectivity System components
const HyperconnectedNeuralPathway = require('../neural/HyperconnectedNeuralPathway');
const NeuralCoordinationHub = require('../neural/NeuralCoordinationHub');
const TentacleIntegrationLayer = require('../neural/adapters/TentacleIntegrationLayer');

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
  // Create mock entities for knowledge graph
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
  
  // Create mock neural pathways
  const pathway1 = {
    id: 'pathway1',
    sourceId: 'tentacle1',
    targetId: 'tentacle2',
    pathwayType: 'bidirectional',
    priority: 5,
    metadata: { createdAt: Date.now() }
  };
  
  const pathway2 = {
    id: 'pathway2',
    sourceId: 'tentacle2',
    targetId: 'tentacle3',
    pathwayType: 'unidirectional',
    priority: 3,
    metadata: { createdAt: Date.now() }
  };
  
  // Create mock tentacles
  const tentacle1 = {
    id: 'tentacle1',
    name: 'HR Tentacle',
    type: 'data',
    domainId: 'domain1',
    capabilities: ['data_access', 'query'],
    status: 'active'
  };
  
  const tentacle2 = {
    id: 'tentacle2',
    name: 'Finance Tentacle',
    type: 'data',
    domainId: 'domain2',
    capabilities: ['data_access', 'query'],
    status: 'active'
  };
  
  const tentacle3 = {
    id: 'tentacle3',
    name: 'Analytics Tentacle',
    type: 'processing',
    domainId: 'analytics',
    capabilities: ['data_processing', 'visualization'],
    status: 'active'
  };
  
  return {
    entities: [entity1, entity2, entity3],
    relationships: [relationship1, relationship2, relationship3],
    ontologies: [ontology1, ontology2],
    mappings: [mapping1, mapping2, mapping3],
    pathways: [pathway1, pathway2],
    tentacles: [tentacle1, tentacle2, tentacle3]
  };
};

// Mock implementations of Neural Hyperconnectivity System components
class MockHyperconnectedNeuralPathway extends HyperconnectedNeuralPathway {
  constructor(options = {}) {
    super(options);
    this.pathways = new Map();
    this.messages = [];
  }
  
  createPathway(sourceId, targetId, pathwayType, options = {}) {
    const pathwayId = `pathway_${sourceId}_${targetId}`;
    const pathway = {
      id: pathwayId,
      sourceId,
      targetId,
      pathwayType,
      priority: options.priority || 1,
      metadata: { createdAt: Date.now(), ...options.metadata }
    };
    this.pathways.set(pathwayId, pathway);
    return pathwayId;
  }
  
  getPathway(pathwayId) {
    if (!this.pathways.has(pathwayId)) {
      throw new Error(`Pathway with ID ${pathwayId} not found.`);
    }
    return this.pathways.get(pathwayId);
  }
  
  sendMessage(sourceId, targetId, message, options = {}) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageObj = {
      id: messageId,
      sourceId,
      targetId,
      content: message,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    };
    this.messages.push(messageObj);
    return messageId;
  }
  
  getMessages(filter = {}) {
    return this.messages.filter(msg => {
      if (filter.sourceId && msg.sourceId !== filter.sourceId) return false;
      if (filter.targetId && msg.targetId !== filter.targetId) return false;
      return true;
    });
  }
}

class MockNeuralCoordinationHub extends NeuralCoordinationHub {
  constructor(options = {}) {
    super(options);
    this.tentacles = new Map();
    this.connections = new Map();
    this.events = [];
  }
  
  registerTentacle(tentacle) {
    if (!tentacle || !tentacle.id) {
      throw new Error("Invalid tentacle provided.");
    }
    this.tentacles.set(tentacle.id, tentacle);
    this.events.push({
      type: 'tentacle_registered',
      tentacleId: tentacle.id,
      timestamp: Date.now()
    });
    return true;
  }
  
  unregisterTentacle(tentacleId) {
    if (!this.tentacles.has(tentacleId)) {
      throw new Error(`Tentacle with ID ${tentacleId} not found.`);
    }
    this.tentacles.delete(tentacleId);
    this.events.push({
      type: 'tentacle_unregistered',
      tentacleId,
      timestamp: Date.now()
    });
    return true;
  }
  
  getTentacle(tentacleId) {
    if (!this.tentacles.has(tentacleId)) {
      throw new Error(`Tentacle with ID ${tentacleId} not found.`);
    }
    return this.tentacles.get(tentacleId);
  }
  
  connectTentacles(sourceId, targetId, options = {}) {
    if (!this.tentacles.has(sourceId)) {
      throw new Error(`Source tentacle with ID ${sourceId} not found.`);
    }
    if (!this.tentacles.has(targetId)) {
      throw new Error(`Target tentacle with ID ${targetId} not found.`);
    }
    
    const connectionId = `conn_${sourceId}_${targetId}`;
    this.connections.set(connectionId, {
      id: connectionId,
      sourceId,
      targetId,
      type: options.type || 'standard',
      metadata: { createdAt: Date.now(), ...options.metadata }
    });
    
    this.events.push({
      type: 'tentacles_connected',
      sourceId,
      targetId,
      connectionId,
      timestamp: Date.now()
    });
    
    return connectionId;
  }
  
  getConnection(connectionId) {
    if (!this.connections.has(connectionId)) {
      throw new Error(`Connection with ID ${connectionId} not found.`);
    }
    return this.connections.get(connectionId);
  }
  
  broadcastEvent(eventType, eventData, options = {}) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const event = {
      id: eventId,
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    };
    this.events.push(event);
    return eventId;
  }
  
  getEvents(filter = {}) {
    return this.events.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      return true;
    });
  }
}

class MockTentacleIntegrationLayer extends TentacleIntegrationLayer {
  constructor(options = {}) {
    super(options);
    this.adapters = new Map();
    this.integrations = new Map();
    this.operations = [];
  }
  
  registerAdapter(adapterId, adapter) {
    this.adapters.set(adapterId, adapter);
    return true;
  }
  
  getAdapter(adapterId) {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`Adapter with ID ${adapterId} not found.`);
    }
    return this.adapters.get(adapterId);
  }
  
  createIntegration(sourceAdapterId, targetAdapterId, options = {}) {
    if (!this.adapters.has(sourceAdapterId)) {
      throw new Error(`Source adapter with ID ${sourceAdapterId} not found.`);
    }
    if (!this.adapters.has(targetAdapterId)) {
      throw new Error(`Target adapter with ID ${targetAdapterId} not found.`);
    }
    
    const integrationId = `integration_${sourceAdapterId}_${targetAdapterId}`;
    this.integrations.set(integrationId, {
      id: integrationId,
      sourceAdapterId,
      targetAdapterId,
      type: options.type || 'standard',
      metadata: { createdAt: Date.now(), ...options.metadata }
    });
    
    return integrationId;
  }
  
  getIntegration(integrationId) {
    if (!this.integrations.has(integrationId)) {
      throw new Error(`Integration with ID ${integrationId} not found.`);
    }
    return this.integrations.get(integrationId);
  }
  
  executeOperation(adapterId, operation, data, options = {}) {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`Adapter with ID ${adapterId} not found.`);
    }
    
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operationRecord = {
      id: operationId,
      adapterId,
      operation,
      data,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    };
    this.operations.push(operationRecord);
    
    // Mock result based on operation type
    let result;
    switch (operation) {
      case 'query':
        result = { success: true, data: [{ id: 'result1' }, { id: 'result2' }] };
        break;
      case 'transform':
        result = { success: true, transformedData: data };
        break;
      case 'validate':
        result = { success: true, valid: true };
        break;
      default:
        result = { success: true };
    }
    
    return { operationId, result };
  }
  
  getOperations(filter = {}) {
    return this.operations.filter(op => {
      if (filter.adapterId && op.adapterId !== filter.adapterId) return false;
      if (filter.operation && op.operation !== filter.operation) return false;
      return true;
    });
  }
}

// Mock adapter for semantic integration
class SemanticAdapter {
  constructor(semanticComponent, options = {}) {
    this.semanticComponent = semanticComponent;
    this.options = options;
    this.id = options.id || `semantic_adapter_${Date.now()}`;
    this.operations = [];
  }
  
  query(queryData) {
    this.operations.push({ type: 'query', data: queryData, timestamp: Date.now() });
    
    if (this.semanticComponent instanceof UnifiedKnowledgeGraph) {
      return this.semanticComponent.query('GET_ALL_ENTITIES', 'semantic');
    } else if (this.semanticComponent instanceof SemanticTranslator) {
      // Mock translation result
      return { success: true, result: { translated: true }, confidence: 0.9 };
    } else if (this.semanticComponent instanceof CrossDomainQueryProcessor) {
      // Mock query result
      return { data: [{ id: 'result1' }, { id: 'result2' }], count: 2 };
    }
    
    return { error: 'Unknown semantic component type' };
  }
  
  transform(data, targetFormat) {
    this.operations.push({ type: 'transform', data, targetFormat, timestamp: Date.now() });
    return { transformed: true, format: targetFormat, data };
  }
  
  validate(data) {
    this.operations.push({ type: 'validate', data, timestamp: Date.now() });
    return { valid: true };
  }
  
  getOperations() {
    return [...this.operations];
  }
}

// Integration test suite
const neuralSemanticIntegrationTests = {
  'should create semantic adapters for neural integration': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const kgAdapter = new SemanticAdapter(kg, { id: 'kg_adapter' });
    const translatorAdapter = new SemanticAdapter(translator, { id: 'translator_adapter' });
    const processorAdapter = new SemanticAdapter(processor, { id: 'processor_adapter' });
    
    assert(kgAdapter);
    assert(translatorAdapter);
    assert(processorAdapter);
    
    assert.strictEqual(kgAdapter.id, 'kg_adapter');
    assert.strictEqual(translatorAdapter.id, 'translator_adapter');
    assert.strictEqual(processorAdapter.id, 'processor_adapter');
  },
  
  'should register semantic adapters with tentacle integration layer': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const kgAdapter = new SemanticAdapter(kg, { id: 'kg_adapter' });
    const translatorAdapter = new SemanticAdapter(translator, { id: 'translator_adapter' });
    const processorAdapter = new SemanticAdapter(processor, { id: 'processor_adapter' });
    
    const integrationLayer = new MockTentacleIntegrationLayer();
    
    const result1 = integrationLayer.registerAdapter('kg_adapter', kgAdapter);
    const result2 = integrationLayer.registerAdapter('translator_adapter', translatorAdapter);
    const result3 = integrationLayer.registerAdapter('processor_adapter', processorAdapter);
    
    assert(result1);
    assert(result2);
    assert(result3);
    
    assert.strictEqual(integrationLayer.adapters.size, 3);
    assert.strictEqual(integrationLayer.adapters.get('kg_adapter'), kgAdapter);
    assert.strictEqual(integrationLayer.adapters.get('translator_adapter'), translatorAdapter);
    assert.strictEqual(integrationLayer.adapters.get('processor_adapter'), processorAdapter);
  },
  
  'should create integrations between semantic adapters': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const kgAdapter = new SemanticAdapter(kg, { id: 'kg_adapter' });
    const translatorAdapter = new SemanticAdapter(translator, { id: 'translator_adapter' });
    const processorAdapter = new SemanticAdapter(processor, { id: 'processor_adapter' });
    
    const integrationLayer = new MockTentacleIntegrationLayer();
    
    integrationLayer.registerAdapter('kg_adapter', kgAdapter);
    integrationLayer.registerAdapter('translator_adapter', translatorAdapter);
    integrationLayer.registerAdapter('processor_adapter', processorAdapter);
    
    const integrationId1 = integrationLayer.createIntegration('kg_adapter', 'translator_adapter');
    const integrationId2 = integrationLayer.createIntegration('translator_adapter', 'processor_adapter');
    
    assert(integrationId1);
    assert(integrationId2);
    
    assert.strictEqual(integrationLayer.integrations.size, 2);
    assert(integrationLayer.integrations.has(integrationId1));
    assert(integrationLayer.integrations.has(integrationId2));
    
    const integration1 = integrationLayer.getIntegration(integrationId1);
    const integration2 = integrationLayer.getIntegration(integrationId2);
    
    assert.strictEqual(integration1.sourceAdapterId, 'kg_adapter');
    assert.strictEqual(integration1.targetAdapterId, 'translator_adapter');
    assert.strictEqual(integration2.sourceAdapterId, 'translator_adapter');
    assert.strictEqual(integration2.targetAdapterId, 'processor_adapter');
  },
  
  'should execute operations through semantic adapters': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const kgAdapter = new SemanticAdapter(kg, { id: 'kg_adapter' });
    const translatorAdapter = new SemanticAdapter(translator, { id: 'translator_adapter' });
    const processorAdapter = new SemanticAdapter(processor, { id: 'processor_adapter' });
    
    const integrationLayer = new MockTentacleIntegrationLayer();
    
    integrationLayer.registerAdapter('kg_adapter', kgAdapter);
    integrationLayer.registerAdapter('translator_adapter', translatorAdapter);
    integrationLayer.registerAdapter('processor_adapter', processorAdapter);
    
    const queryResult = integrationLayer.executeOperation('kg_adapter', 'query', { type: 'entity', filter: { domain: 'hr' } });
    const transformResult = integrationLayer.executeOperation('translator_adapter', 'transform', { data: { name: 'John' } }, { targetFormat: 'finance' });
    const validateResult = integrationLayer.executeOperation('processor_adapter', 'validate', { query: 'SELECT * FROM employees' });
    
    assert(queryResult);
    assert(transformResult);
    assert(validateResult);
    
    assert(queryResult.operationId);
    assert(transformResult.operationId);
    assert(validateResult.operationId);
    
    assert(queryResult.result.success);
    assert(transformResult.result.success);
    assert(validateResult.result.success);
    
    assert.strictEqual(integrationLayer.operations.length, 3);
  },
  
  'should register semantic tentacles with neural coordination hub': () => {
    const mockData = createMockData();
    const neuralHub = new MockNeuralCoordinationHub();
    
    const hrTentacle = mockData.tentacles[0];
    const financeTentacle = mockData.tentacles[1];
    const analyticsTentacle = mockData.tentacles[2];
    
    const result1 = neuralHub.registerTentacle(hrTentacle);
    const result2 = neuralHub.registerTentacle(financeTentacle);
    const result3 = neuralHub.registerTentacle(analyticsTentacle);
    
    assert(result1);
    assert(result2);
    assert(result3);
    
    assert.strictEqual(neuralHub.tentacles.size, 3);
    assert.strictEqual(neuralHub.tentacles.get(hrTentacle.id), hrTentacle);
    assert.strictEqual(neuralHub.tentacles.get(financeTentacle.id), financeTentacle);
    assert.strictEqual(neuralHub.tentacles.get(analyticsTentacle.id), analyticsTentacle);
    
    const events = neuralHub.getEvents({ type: 'tentacle_registered' });
    assert.strictEqual(events.length, 3);
  },
  
  'should connect semantic tentacles through neural coordination hub': () => {
    const mockData = createMockData();
    const neuralHub = new MockNeuralCoordinationHub();
    
    const hrTentacle = mockData.tentacles[0];
    const financeTentacle = mockData.tentacles[1];
    const analyticsTentacle = mockData.tentacles[2];
    
    neuralHub.registerTentacle(hrTentacle);
    neuralHub.registerTentacle(financeTentacle);
    neuralHub.registerTentacle(analyticsTentacle);
    
    const connectionId1 = neuralHub.connectTentacles(hrTentacle.id, financeTentacle.id);
    const connectionId2 = neuralHub.connectTentacles(financeTentacle.id, analyticsTentacle.id);
    
    assert(connectionId1);
    assert(connectionId2);
    
    assert.strictEqual(neuralHub.connections.size, 2);
    assert(neuralHub.connections.has(connectionId1));
    assert(neuralHub.connections.has(connectionId2));
    
    const connection1 = neuralHub.getConnection(connectionId1);
    const connection2 = neuralHub.getConnection(connectionId2);
    
    assert.strictEqual(connection1.sourceId, hrTentacle.id);
    assert.strictEqual(connection1.targetId, financeTentacle.id);
    assert.strictEqual(connection2.sourceId, financeTentacle.id);
    assert.strictEqual(connection2.targetId, analyticsTentacle.id);
    
    const events = neuralHub.getEvents({ type: 'tentacles_connected' });
    assert.strictEqual(events.length, 2);
  },
  
  'should broadcast semantic events through neural coordination hub': () => {
    const neuralHub = new MockNeuralCoordinationHub();
    
    const eventId1 = neuralHub.broadcastEvent('semantic_entity_created', { entityId: 'entity1', type: 'Person' });
    const eventId2 = neuralHub.broadcastEvent('semantic_relationship_created', { relationshipId: 'rel1', type: 'WORKS_FOR' });
    
    assert(eventId1);
    assert(eventId2);
    
    const events = neuralHub.getEvents();
    assert.strictEqual(events.length, 2);
    
    const semanticEntityEvents = neuralHub.getEvents({ type: 'semantic_entity_created' });
    const semanticRelationshipEvents = neuralHub.getEvents({ type: 'semantic_relationship_created' });
    
    assert.strictEqual(semanticEntityEvents.length, 1);
    assert.strictEqual(semanticRelationshipEvents.length, 1);
    
    assert.strictEqual(semanticEntityEvents[0].data.entityId, 'entity1');
    assert.strictEqual(semanticRelationshipEvents[0].data.relationshipId, 'rel1');
  },
  
  'should create and use neural pathways for semantic data transfer': () => {
    const mockData = createMockData();
    const neuralPathway = new MockHyperconnectedNeuralPathway();
    
    const hrTentacle = mockData.tentacles[0];
    const financeTentacle = mockData.tentacles[1];
    
    const pathwayId = neuralPathway.createPathway(hrTentacle.id, financeTentacle.id, 'bidirectional', { priority: 5 });
    
    assert(pathwayId);
    assert(neuralPathway.pathways.has(pathwayId));
    
    const pathway = neuralPathway.getPathway(pathwayId);
    assert.strictEqual(pathway.sourceId, hrTentacle.id);
    assert.strictEqual(pathway.targetId, financeTentacle.id);
    assert.strictEqual(pathway.pathwayType, 'bidirectional');
    assert.strictEqual(pathway.priority, 5);
    
    const messageId = neuralPathway.sendMessage(hrTentacle.id, financeTentacle.id, {
      type: 'semantic_query',
      query: 'GET_EMPLOYEE_BY_ID',
      parameters: { id: '12345' }
    });
    
    assert(messageId);
    assert.strictEqual(neuralPathway.messages.length, 1);
    
    const messages = neuralPathway.getMessages({ sourceId: hrTentacle.id });
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].sourceId, hrTentacle.id);
    assert.strictEqual(messages[0].targetId, financeTentacle.id);
    assert.strictEqual(messages[0].content.type, 'semantic_query');
  },
  
  'should integrate semantic query processor with neural pathways': () => {
    const kg = new UnifiedKnowledgeGraph();
    const translator = new SemanticTranslator();
    const processor = new CrossDomainQueryProcessor(kg, translator);
    
    const mockData = createMockData();
    const neuralPathway = new MockHyperconnectedNeuralPathway();
    
    const hrTentacle = mockData.tentacles[0];
    const financeTentacle = mockData.tentacles[1];
    
    const pathwayId = neuralPathway.createPathway(hrTentacle.id, financeTentacle.id, 'bidirectional');
    
    // Create a query in HR domain
    const hrQuery = {
      type: 'semantic_query',
      domain: 'hr',
      query: 'GET_EMPLOYEE_BY_DEPARTMENT',
      parameters: { department: 'Engineering' }
    };
    
    // Send query through neural pathway
    const messageId = neuralPathway.sendMessage(hrTentacle.id, financeTentacle.id, hrQuery);
    
    // Process query in finance domain
    const messages = neuralPathway.getMessages({ targetId: financeTentacle.id });
    assert.strictEqual(messages.length, 1);
    
    const queryMessage = messages[0];
    
    // Translate query from HR to Finance domain
    const translatedQuery = translator.translateQuery(queryMessage.content, 'hr', 'finance');
    
    // Execute query in finance domain
    const queryResult = processor.executeQuery(translatedQuery);
    
    // Send result back through neural pathway
    const responseMessageId = neuralPathway.sendMessage(financeTentacle.id, hrTentacle.id, {
      type: 'semantic_query_result',
      originalMessageId: messageId,
      result: queryResult
    });
    
    assert(responseMessageId);
    
    const responseMessages = neuralPathway.getMessages({ sourceId: financeTentacle.id });
    assert.strictEqual(responseMessages.length, 1);
    assert.strictEqual(responseMessages[0].content.type, 'semantic_query_result');
    assert.strictEqual(responseMessages[0].content.originalMessageId, messageId);
  }
};

// Run the integration test suite
const runNeuralSemanticIntegrationTests = () => {
  return runTestSuite('Neural-Semantic Integration', neuralSemanticIntegrationTests);
};

// Export the test runner
module.exports = {
  runNeuralSemanticIntegrationTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runNeuralSemanticIntegrationTests();
}
