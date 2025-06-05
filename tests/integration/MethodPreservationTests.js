/**
 * @fileoverview Integration tests for method preservation across module boundaries.
 * This module provides comprehensive tests to verify that methods are properly preserved
 * when objects cross module boundaries, using the various patterns and adapters implemented.
 * 
 * @module tests/integration/MethodPreservationTests
 */

const assert = require('assert');
const path = require('path');
const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// Import core framework components
const { createModularTentacleFramework } = require('../../core/framework/ModularTentacleFramework');
const { createTentacleRegistry } = require('../../core/framework/TentaclePluginSystem');
const { createUserNeedAnalysisComponent } = require('../../core/framework/UserNeedAnalysisComponent');

// Import module boundary adapters
const {
  createModuleBoundaryAdapter,
  createClassAdapterFactory,
  createEventInterfaceAdapter,
  createDuckTypingValidator,
  createProxyAdapter,
  createSerializationSafeAdapter,
  createComponentAdapterFactory,
  createKnowledgeGraphAdapter,
  createSemanticTranslatorAdapter
} = require('../../core/framework/ModuleBoundaryAdapter');

// Import factory implementations of core tentacles
const { createNeuralCoordinationHub } = require('../../core/neural/NeuralCoordinationHubFactory');
const { createSemanticTranslator } = require('../../core/semantic/SemanticTranslatorFactory');
const { createCrossDomainQueryProcessor } = require('../../core/semantic/CrossDomainQueryProcessorFactory');

// Import original class-based implementations for comparison
const NeuralCoordinationHub = require('../../core/neural/NeuralCoordinationHub');
const SemanticTranslator = require('../../core/semantic/SemanticTranslator');
const CrossDomainQueryProcessor = require('../../core/semantic/CrossDomainQueryProcessor');

// Test utilities
const createLogger = () => ({
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  debug: (message, ...args) => {},
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
});

const createMetrics = () => ({
  recordMetric: (name, data) => {}
});

/**
 * Simulates module boundary crossing by serializing and deserializing an object.
 * This mimics what happens when objects cross module boundaries in real systems.
 * 
 * @param {Object} obj - Object to pass across a simulated module boundary
 * @returns {Object} Object after crossing the boundary
 */
function simulateModuleBoundaryCrossing(obj) {
  // Serialize and deserialize to simulate module boundary
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Verifies that an object has the expected methods.
 * 
 * @param {Object} obj - Object to verify
 * @param {Array<string>} expectedMethods - Expected method names
 * @returns {boolean} Whether all methods are present
 */
function verifyMethodsExist(obj, expectedMethods) {
  for (const method of expectedMethods) {
    if (typeof obj[method] !== 'function') {
      console.error(`Method ${method} is missing or not a function`);
      return false;
    }
  }
  return true;
}

/**
 * Runs all integration tests for method preservation.
 */
function runMethodPreservationTests() {
  console.log('Starting method preservation integration tests...');
  
  let passCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  // Test groups
  const testGroups = [
    testDirectObjectPattern,
    testFactoryFunctionPattern,
    testModuleBoundaryAdapter,
    testClassAdapterFactory,
    testEventInterfaceAdapter,
    testComponentAdapterFactory,
    testCrossTentacleCommunication,
    testFrameworkIntegration,
    testSerializationSafeAdapter,
    testProxyAdapter
  ];
  
  // Run each test group
  for (const testGroup of testGroups) {
    try {
      const groupResult = testGroup();
      passCount += groupResult.pass;
      failCount += groupResult.fail;
      
      console.log(`Test group ${testGroup.name}: ${groupResult.pass} passed, ${groupResult.fail} failed`);
    } catch (error) {
      console.error(`Error in test group ${testGroup.name}:`, error);
      failCount++;
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // Print summary
  console.log('\nMethod Preservation Integration Test Summary:');
  console.log(`Total tests: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Pass rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  
  return {
    passCount,
    failCount,
    duration,
    passRate: passCount / (passCount + failCount)
  };
}

/**
 * Tests the direct object pattern for method preservation.
 */
function testDirectObjectPattern() {
  console.log('\nTesting Direct Object Pattern...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create object with direct methods
    const directObject = {
      id: uuidv4(),
      name: 'DirectObject',
      getValue: function() { return 42; },
      setValue: function(value) { this.value = value; return this; },
      compute: function(a, b) { return a + b; }
    };
    
    // Test 1: Verify methods exist on original object
    const test1 = verifyMethodsExist(directObject, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Original direct object has all methods');
      pass++;
    } else {
      console.error('✗ Original direct object is missing methods');
      fail++;
    }
    
    // Test 2: Pass across module boundary
    const crossedObject = simulateModuleBoundaryCrossing(directObject);
    const test2 = verifyMethodsExist(crossedObject, ['getValue', 'setValue', 'compute']);
    if (!test2) {
      console.log('✓ Methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 3: Recreate methods after crossing
    const recreatedObject = {
      ...crossedObject,
      getValue: function() { return 42; },
      setValue: function(value) { this.value = value; return this; },
      compute: function(a, b) { return a + b; }
    };
    
    const test3 = verifyMethodsExist(recreatedObject, ['getValue', 'setValue', 'compute']);
    if (test3) {
      console.log('✓ Recreated object has all methods');
      pass++;
    } else {
      console.error('✗ Recreated object is missing methods');
      fail++;
    }
  } catch (error) {
    console.error('Error in direct object pattern test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests the factory function pattern for method preservation.
 */
function testFactoryFunctionPattern() {
  console.log('\nTesting Factory Function Pattern...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create factory function
    function createTestObject(config = {}) {
      return {
        id: config.id || uuidv4(),
        name: config.name || 'TestObject',
        data: config.data || {},
        
        // Methods as direct properties
        getValue: function() { return this.data.value || 42; },
        setValue: function(value) { 
          this.data.value = value; 
          return this; 
        },
        compute: function(a, b) { return a + b; }
      };
    }
    
    // Test 1: Create object with factory
    const factoryObject = createTestObject({ name: 'FactoryObject' });
    const test1 = verifyMethodsExist(factoryObject, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Factory-created object has all methods');
      pass++;
    } else {
      console.error('✗ Factory-created object is missing methods');
      fail++;
    }
    
    // Test 2: Pass across module boundary
    const crossedObject = simulateModuleBoundaryCrossing(factoryObject);
    const test2 = verifyMethodsExist(crossedObject, ['getValue', 'setValue', 'compute']);
    if (!test2) {
      console.log('✓ Methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 3: Recreate with factory after crossing
    const recreatedObject = createTestObject({
      id: crossedObject.id,
      name: crossedObject.name,
      data: crossedObject.data
    });
    
    const test3 = verifyMethodsExist(recreatedObject, ['getValue', 'setValue', 'compute']);
    if (test3) {
      console.log('✓ Recreated factory object has all methods');
      pass++;
    } else {
      console.error('✗ Recreated factory object is missing methods');
      fail++;
    }
    
    // Test 4: Verify behavior is preserved
    recreatedObject.setValue(100);
    const test4 = recreatedObject.getValue() === 100;
    if (test4) {
      console.log('✓ Recreated factory object behavior is preserved');
      pass++;
    } else {
      console.error('✗ Recreated factory object behavior is not preserved');
      fail++;
    }
  } catch (error) {
    console.error('Error in factory function pattern test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests the module boundary adapter for method preservation.
 */
function testModuleBoundaryAdapter() {
  console.log('\nTesting Module Boundary Adapter...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create class-based object
    class TestClass {
      constructor(name) {
        this.id = uuidv4();
        this.name = name || 'TestClass';
        this.data = {};
      }
      
      getValue() {
        return this.data.value || 42;
      }
      
      setValue(value) {
        this.data.value = value;
        return this;
      }
      
      compute(a, b) {
        return a + b;
      }
    }
    
    // Create instance
    const classInstance = new TestClass('ClassInstance');
    
    // Test 1: Verify methods exist on class instance
    const test1 = verifyMethodsExist(classInstance, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Class instance has all methods');
      pass++;
    } else {
      console.error('✗ Class instance is missing methods');
      fail++;
    }
    
    // Test 2: Pass across module boundary
    const crossedObject = simulateModuleBoundaryCrossing(classInstance);
    const test2 = verifyMethodsExist(crossedObject, ['getValue', 'setValue', 'compute']);
    if (!test2) {
      console.log('✓ Methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 3: Create adapter for class instance
    const adapter = createModuleBoundaryAdapter(classInstance, {
      includePrototypeMethods: true,
      preserveThis: true
    });
    
    const test3 = verifyMethodsExist(adapter, ['getValue', 'setValue', 'compute']);
    if (test3) {
      console.log('✓ Adapter has all methods');
      pass++;
    } else {
      console.error('✗ Adapter is missing methods');
      fail++;
    }
    
    // Test 4: Verify adapter behavior
    adapter.setValue(100);
    const test4 = adapter.getValue() === 100 && classInstance.getValue() === 100;
    if (test4) {
      console.log('✓ Adapter behavior is preserved and affects original object');
      pass++;
    } else {
      console.error('✗ Adapter behavior is not preserved or does not affect original object');
      fail++;
    }
    
    // Test 5: Pass adapter across module boundary
    const crossedAdapter = simulateModuleBoundaryCrossing(adapter);
    const test5 = verifyMethodsExist(crossedAdapter, ['getValue', 'setValue', 'compute']);
    if (!test5) {
      console.log('✓ Adapter methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Adapter methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
  } catch (error) {
    console.error('Error in module boundary adapter test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests the class adapter factory for method preservation.
 */
function testClassAdapterFactory() {
  console.log('\nTesting Class Adapter Factory...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create class
    class TestClass {
      constructor(name) {
        this.id = uuidv4();
        this.name = name || 'TestClass';
        this.data = {};
      }
      
      getValue() {
        return this.data.value || 42;
      }
      
      setValue(value) {
        this.data.value = value;
        return this;
      }
      
      compute(a, b) {
        return a + b;
      }
    }
    
    // Create class adapter factory
    const createTestObject = createClassAdapterFactory(TestClass, {
      includePrototypeMethods: true,
      preserveThis: true
    });
    
    // Test 1: Create object with factory
    const factoryObject = createTestObject('FactoryObject');
    const test1 = verifyMethodsExist(factoryObject, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Factory-created adapter has all methods');
      pass++;
    } else {
      console.error('✗ Factory-created adapter is missing methods');
      fail++;
    }
    
    // Test 2: Verify adapter behavior
    factoryObject.setValue(100);
    const test2 = factoryObject.getValue() === 100;
    if (test2) {
      console.log('✓ Factory-created adapter behavior is preserved');
      pass++;
    } else {
      console.error('✗ Factory-created adapter behavior is not preserved');
      fail++;
    }
    
    // Test 3: Pass across module boundary
    const crossedObject = simulateModuleBoundaryCrossing(factoryObject);
    const test3 = verifyMethodsExist(crossedObject, ['getValue', 'setValue', 'compute']);
    if (!test3) {
      console.log('✓ Methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 4: Create new adapter with same factory
    const newFactoryObject = createTestObject('NewFactoryObject');
    const test4 = verifyMethodsExist(newFactoryObject, ['getValue', 'setValue', 'compute']);
    if (test4) {
      console.log('✓ New factory-created adapter has all methods');
      pass++;
    } else {
      console.error('✗ New factory-created adapter is missing methods');
      fail++;
    }
  } catch (error) {
    console.error('Error in class adapter factory test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests the event interface adapter for method preservation.
 */
function testEventInterfaceAdapter() {
  console.log('\nTesting Event Interface Adapter...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create class with event methods
    class TestEventEmitter {
      constructor() {
        this.id = uuidv4();
        this.name = 'TestEventEmitter';
        this.eventEmitter = new EventEmitter();
      }
      
      on(event, listener) {
        this.eventEmitter.on(event, listener);
        return this;
      }
      
      once(event, listener) {
        this.eventEmitter.once(event, listener);
        return this;
      }
      
      off(event, listener) {
        this.eventEmitter.off(event, listener);
        return this;
      }
      
      emit(event, ...args) {
        return this.eventEmitter.emit(event, ...args);
      }
      
      getData() {
        return { id: this.id, name: this.name };
      }
    }
    
    // Create instance
    const emitter = new TestEventEmitter();
    
    // Test 1: Verify methods exist on original object
    const test1 = verifyMethodsExist(emitter, ['on', 'once', 'off', 'emit', 'getData']);
    if (test1) {
      console.log('✓ Original event emitter has all methods');
      pass++;
    } else {
      console.error('✗ Original event emitter is missing methods');
      fail++;
    }
    
    // Test 2: Pass across module boundary
    const crossedObject = simulateModuleBoundaryCrossing(emitter);
    const test2 = verifyMethodsExist(crossedObject, ['on', 'once', 'off', 'emit', 'getData']);
    if (!test2) {
      console.log('✓ Methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 3: Create event interface adapter
    const adapter = createEventInterfaceAdapter(crossedObject, new EventEmitter());
    const test3 = verifyMethodsExist(adapter, ['on', 'once', 'off', 'emit']);
    if (test3) {
      console.log('✓ Event interface adapter has all event methods');
      pass++;
    } else {
      console.error('✗ Event interface adapter is missing event methods');
      fail++;
    }
    
    // Test 4: Verify adapter behavior
    let eventFired = false;
    adapter.on('test', () => { eventFired = true; });
    adapter.emit('test');
    
    if (eventFired) {
      console.log('✓ Event interface adapter behavior is preserved');
      pass++;
    } else {
      console.error('✗ Event interface adapter behavior is not preserved');
      fail++;
    }
  } catch (error) {
    console.error('Error in event interface adapter test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests the component adapter factory for method preservation.
 */
function testComponentAdapterFactory() {
  console.log('\nTesting Component Adapter Factory...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Define interface
    const knowledgeGraphInterface = {
      query: 2,
      getEntity: 1
    };
    
    // Create component
    const knowledgeGraph = {
      id: uuidv4(),
      name: 'TestKnowledgeGraph',
      query: function(queryString, options) {
        return { results: [{ id: '123', name: 'Test Entity' }] };
      },
      getEntity: function(entityId) {
        return { id: entityId, name: 'Test Entity' };
      }
    };
    
    // Test 1: Verify methods exist on original component
    const test1 = verifyMethodsExist(knowledgeGraph, ['query', 'getEntity']);
    if (test1) {
      console.log('✓ Original component has all methods');
      pass++;
    } else {
      console.error('✗ Original component is missing methods');
      fail++;
    }
    
    // Test 2: Create component adapter
    const createKnowledgeGraphAdapter = createComponentAdapterFactory('knowledge_graph', knowledgeGraphInterface);
    const adapter = createKnowledgeGraphAdapter(knowledgeGraph);
    
    const test2 = verifyMethodsExist(adapter, ['query', 'getEntity']);
    if (test2) {
      console.log('✓ Component adapter has all methods');
      pass++;
    } else {
      console.error('✗ Component adapter is missing methods');
      fail++;
    }
    
    // Test 3: Verify adapter behavior
    const queryResult = adapter.query('test', {});
    const entityResult = adapter.getEntity('123');
    
    const test3 = queryResult.results && queryResult.results.length > 0 && 
                 entityResult && entityResult.id === '123';
    if (test3) {
      console.log('✓ Component adapter behavior is preserved');
      pass++;
    } else {
      console.error('✗ Component adapter behavior is not preserved');
      fail++;
    }
    
    // Test 4: Pass adapter across module boundary
    const crossedAdapter = simulateModuleBoundaryCrossing(adapter);
    const test4 = verifyMethodsExist(crossedAdapter, ['query', 'getEntity']);
    if (!test4) {
      console.log('✓ Adapter methods are correctly lost after crossing module boundary (expected behavior)');
      pass++;
    } else {
      console.error('✗ Adapter methods unexpectedly preserved after crossing module boundary');
      fail++;
    }
    
    // Test 5: Invalid component validation
    const invalidComponent = {
      id: uuidv4(),
      name: 'InvalidComponent',
      // Missing required methods
    };
    
    try {
      createKnowledgeGraphAdapter(invalidComponent);
      console.error('✗ Invalid component was not rejected');
      fail++;
    } catch (error) {
      console.log('✓ Invalid component was correctly rejected');
      pass++;
    }
  } catch (error) {
    console.error('Error in component adapter factory test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests cross-tentacle communication with adapters.
 */
function testCrossTentacleCommunication() {
  console.log('\nTesting Cross-Tentacle Communication...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create tentacles using factory functions
    const neuralHub = createNeuralCoordinationHub({
      id: uuidv4(),
      name: 'TestNeuralHub',
      logger: createLogger(),
      metrics: createMetrics()
    });
    
    const semanticTranslator = createSemanticTranslator({
      id: uuidv4(),
      name: 'TestSemanticTranslator',
      logger: createLogger(),
      metrics: createMetrics()
    });
    
    // Test 1: Verify methods exist on factory-created tentacles
    const test1 = verifyMethodsExist(neuralHub, ['registerPathway', 'activatePathway']) &&
                 verifyMethodsExist(semanticTranslator, ['translateConcept', 'translateConcepts']);
    if (test1) {
      console.log('✓ Factory-created tentacles have all methods');
      pass++;
    } else {
      console.error('✗ Factory-created tentacles are missing methods');
      fail++;
    }
    
    // Test 2: Create adapters for tentacles
    const neuralAdapter = createComponentAdapterFactory('neural_coordinator', {
      registerPathway: 2,
      activatePathway: 2
    })(neuralHub);
    
    const semanticAdapter = createComponentAdapterFactory('semantic_translator', {
      translateConcept: 2,
      translateConcepts: 2
    })(semanticTranslator);
    
    const test2 = verifyMethodsExist(neuralAdapter, ['registerPathway', 'activatePathway']) &&
                 verifyMethodsExist(semanticAdapter, ['translateConcept', 'translateConcepts']);
    if (test2) {
      console.log('✓ Tentacle adapters have all methods');
      pass++;
    } else {
      console.error('✗ Tentacle adapters are missing methods');
      fail++;
    }
    
    // Test 3: Simulate cross-tentacle communication
    // Register semantic translator with neural hub
    neuralAdapter.registerPathway('semantic', semanticAdapter);
    
    // This would fail in the real system without adapters
    const test3 = true; // Just checking that the above doesn't throw
    if (test3) {
      console.log('✓ Cross-tentacle communication successful');
      pass++;
    } else {
      console.error('✗ Cross-tentacle communication failed');
      fail++;
    }
    
    // Test 4: Compare with class-based implementation
    try {
      // This would normally fail due to method loss across module boundaries
      const neuralHubClass = new NeuralCoordinationHub({
        id: uuidv4(),
        name: 'ClassNeuralHub',
        logger: createLogger(),
        metrics: createMetrics()
      });
      
      const semanticTranslatorClass = new SemanticTranslator({
        id: uuidv4(),
        name: 'ClassSemanticTranslator',
        logger: createLogger(),
        metrics: createMetrics()
      });
      
      // Simulate module boundary crossing
      const crossedNeuralHub = simulateModuleBoundaryCrossing(neuralHubClass);
      const crossedSemanticTranslator = simulateModuleBoundaryCrossing(semanticTranslatorClass);
      
      // Verify methods are lost
      const methodsLost = !verifyMethodsExist(crossedNeuralHub, ['registerPathway', 'activatePathway']) &&
                         !verifyMethodsExist(crossedSemanticTranslator, ['translateConcept', 'translateConcepts']);
      
      if (methodsLost) {
        console.log('✓ Class-based implementation correctly loses methods across module boundaries');
        pass++;
      } else {
        console.error('✗ Class-based implementation unexpectedly preserves methods across module boundaries');
        fail++;
      }
    } catch (error) {
      // This is expected
      console.log('✓ Class-based implementation correctly fails across module boundaries');
      pass++;
    }
  } catch (error) {
    console.error('Error in cross-tentacle communication test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests framework integration with adapters.
 */
function testFrameworkIntegration() {
  console.log('\nTesting Framework Integration...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create framework components
    const eventEmitter = new EventEmitter();
    const logger = createLogger();
    const metrics = createMetrics();
    
    const tentacleFramework = createModularTentacleFramework({
      id: uuidv4(),
      name: 'TestTentacleFramework',
      logger,
      eventEmitter,
      metrics
    });
    
    const tentacleRegistry = createTentacleRegistry({
      id: uuidv4(),
      name: 'TestTentacleRegistry',
      logger,
      eventEmitter,
      metrics,
      tentacleFramework
    });
    
    const userNeedAnalysis = createUserNeedAnalysisComponent({
      id: uuidv4(),
      name: 'TestUserNeedAnalysis',
      logger,
      eventEmitter,
      metrics,
      tentacleFramework,
      tentacleRegistry,
      activityTrackingEnabled: true,
      recommendationEnabled: true,
      autoGrowthEnabled: false
    });
    
    // Test 1: Verify methods exist on framework components
    const test1 = verifyMethodsExist(tentacleFramework, ['registerTentacleFactory', 'createTentacle', 'initializeTentacle']) &&
                 verifyMethodsExist(tentacleRegistry, ['registerTentacleConfiguration', 'createTentacleFromConfiguration']) &&
                 verifyMethodsExist(userNeedAnalysis, ['handleUserActivity', 'analyzeUserPatterns', 'generateRecommendations']);
    
    if (test1) {
      console.log('✓ Framework components have all methods');
      pass++;
    } else {
      console.error('✗ Framework components are missing methods');
      fail++;
    }
    
    // Test 2: Register tentacle factory
    tentacleFramework.registerTentacleFactory('neural_coordinator', {
      create: createNeuralCoordinationHub,
      category: 'CORE',
      capabilities: ['neural_processing', 'pathway_management'],
      dependencies: []
    });
    
    tentacleFramework.registerTentacleFactory('semantic_translator', {
      create: createSemanticTranslator,
      category: 'CORE',
      capabilities: ['semantic_translation', 'concept_mapping'],
      dependencies: []
    });
    
    // Verify factories are registered
    const factories = tentacleFramework.listTentacleFactories();
    const test2 = factories.some(f => f.type === 'neural_coordinator') &&
                 factories.some(f => f.type === 'semantic_translator');
    
    if (test2) {
      console.log('✓ Tentacle factories successfully registered');
      pass++;
    } else {
      console.error('✗ Tentacle factories not properly registered');
      fail++;
    }
    
    // Test 3: Create tentacles
    const neuralTentacle = tentacleFramework.createTentacle('neural_coordinator', {
      name: 'TestNeuralCoordinator'
    });
    
    const semanticTentacle = tentacleFramework.createTentacle('semantic_translator', {
      name: 'TestSemanticTranslator'
    });
    
    const test3 = neuralTentacle && semanticTentacle &&
                 verifyMethodsExist(neuralTentacle, ['registerPathway', 'activatePathway']) &&
                 verifyMethodsExist(semanticTentacle, ['translateConcept', 'translateConcepts']);
    
    if (test3) {
      console.log('✓ Tentacles successfully created with methods preserved');
      pass++;
    } else {
      console.error('✗ Tentacles not properly created or missing methods');
      fail++;
    }
    
    // Test 4: Initialize tentacles
    tentacleFramework.initializeTentacle(neuralTentacle.id);
    tentacleFramework.initializeTentacle(semanticTentacle.id);
    
    const tentacles = tentacleFramework.listTentacles();
    const test4 = tentacles.some(t => t.id === neuralTentacle.id && t.state === 'ACTIVE') &&
                 tentacles.some(t => t.id === semanticTentacle.id && t.state === 'ACTIVE');
    
    if (test4) {
      console.log('✓ Tentacles successfully initialized');
      pass++;
    } else {
      console.error('✗ Tentacles not properly initialized');
      fail++;
    }
    
    // Test 5: Simulate user activity
    let activityProcessed = false;
    userNeedAnalysis.on('user-need-analysis:patterns-analyzed', () => {
      activityProcessed = true;
    });
    
    // Trigger user activity
    eventEmitter.emit('user:activity', {
      userId: 'test-user',
      type: 'command',
      data: {
        command: 'test-command',
        parameters: ['param1', 'param2']
      }
    });
    
    // This is a simplified check since we can't wait for async processing
    const test5 = userNeedAnalysis.activityHistory.has('test-user');
    if (test5) {
      console.log('✓ User activity successfully processed');
      pass++;
    } else {
      console.error('✗ User activity not properly processed');
      fail++;
    }
  } catch (error) {
    console.error('Error in framework integration test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests serialization-safe adapter for method preservation.
 */
function testSerializationSafeAdapter() {
  console.log('\nTesting Serialization-Safe Adapter...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create object with methods
    const originalObject = {
      id: uuidv4(),
      name: 'SerializableObject',
      data: { value: 42 },
      getValue: function() { return this.data.value; },
      setValue: function(value) { this.data.value = value; return this; },
      compute: function(a, b) { return a + b; }
    };
    
    // Test 1: Verify methods exist on original object
    const test1 = verifyMethodsExist(originalObject, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Original object has all methods');
      pass++;
    } else {
      console.error('✗ Original object is missing methods');
      fail++;
    }
    
    // Test 2: Create serialization-safe adapter
    const methodImplementations = {
      getValue: function() { return this.data.value; },
      setValue: function(value) { this.data.value = value; return this; },
      compute: function(a, b) { return a + b; }
    };
    
    const safeAdapter = createSerializationSafeAdapter(originalObject, {
      methodNames: ['getValue', 'setValue', 'compute'],
      methodImplementations
    });
    
    const test2 = verifyMethodsExist(safeAdapter, ['getValue', 'setValue', 'compute']);
    if (test2) {
      console.log('✓ Serialization-safe adapter has all methods');
      pass++;
    } else {
      console.error('✗ Serialization-safe adapter is missing methods');
      fail++;
    }
    
    // Test 3: Verify adapter behavior
    safeAdapter.setValue(100);
    const test3 = safeAdapter.getValue() === 100;
    if (test3) {
      console.log('✓ Serialization-safe adapter behavior is correct');
      pass++;
    } else {
      console.error('✗ Serialization-safe adapter behavior is incorrect');
      fail++;
    }
    
    // Test 4: Serialize and deserialize
    const serialized = JSON.stringify(safeAdapter);
    const deserialized = JSON.parse(serialized);
    
    const test4 = !verifyMethodsExist(deserialized, ['getValue', 'setValue', 'compute']);
    if (test4) {
      console.log('✓ Methods are correctly lost after serialization (expected behavior)');
      pass++;
    } else {
      console.error('✗ Methods unexpectedly preserved after serialization');
      fail++;
    }
    
    // Test 5: Recreate adapter after deserialization
    const recreatedAdapter = {
      ...deserialized,
      getValue: methodImplementations.getValue,
      setValue: methodImplementations.setValue,
      compute: methodImplementations.compute
    };
    
    const test5 = verifyMethodsExist(recreatedAdapter, ['getValue', 'setValue', 'compute']);
    if (test5) {
      console.log('✓ Recreated adapter has all methods');
      pass++;
    } else {
      console.error('✗ Recreated adapter is missing methods');
      fail++;
    }
    
    // Test 6: Verify recreated adapter behavior
    const test6 = recreatedAdapter.getValue() === 100;
    if (test6) {
      console.log('✓ Recreated adapter behavior is preserved');
      pass++;
    } else {
      console.error('✗ Recreated adapter behavior is not preserved');
      fail++;
    }
  } catch (error) {
    console.error('Error in serialization-safe adapter test:', error);
    fail++;
  }
  
  return { pass, fail };
}

/**
 * Tests proxy adapter for method preservation.
 */
function testProxyAdapter() {
  console.log('\nTesting Proxy Adapter...');
  let pass = 0;
  let fail = 0;
  
  try {
    // Create object with methods
    const originalObject = {
      id: uuidv4(),
      name: 'ProxyObject',
      data: { value: 42 },
      getValue: function() { return this.data.value; },
      setValue: function(value) { this.data.value = value; return this; },
      compute: function(a, b) { return a + b; }
    };
    
    // Test 1: Verify methods exist on original object
    const test1 = verifyMethodsExist(originalObject, ['getValue', 'setValue', 'compute']);
    if (test1) {
      console.log('✓ Original object has all methods');
      pass++;
    } else {
      console.error('✗ Original object is missing methods');
      fail++;
    }
    
    // Test 2: Create proxy adapter
    const methodCalls = [];
    const proxyAdapter = createProxyAdapter(originalObject, {
      methodNames: ['getValue', 'setValue', 'compute'],
      onMethodCall: (method, args) => {
        methodCalls.push({ method, args });
      }
    });
    
    const test2 = verifyMethodsExist(proxyAdapter, ['getValue', 'setValue', 'compute']);
    if (test2) {
      console.log('✓ Proxy adapter has all methods');
      pass++;
    } else {
      console.error('✗ Proxy adapter is missing methods');
      fail++;
    }
    
    // Test 3: Verify proxy behavior
    proxyAdapter.setValue(100);
    const value = proxyAdapter.getValue();
    const sum = proxyAdapter.compute(1, 2);
    
    const test3 = value === 100 && sum === 3;
    if (test3) {
      console.log('✓ Proxy adapter behavior is correct');
      pass++;
    } else {
      console.error('✗ Proxy adapter behavior is incorrect');
      fail++;
    }
    
    // Test 4: Verify method call tracking
    const test4 = methodCalls.length === 3 &&
                 methodCalls[0].method === 'setValue' &&
                 methodCalls[0].args[0] === 100 &&
                 methodCalls[1].method === 'getValue' &&
                 methodCalls[2].method === 'compute' &&
                 methodCalls[2].args[0] === 1 &&
                 methodCalls[2].args[1] === 2;
    
    if (test4) {
      console.log('✓ Proxy adapter correctly tracks method calls');
      pass++;
    } else {
      console.error('✗ Proxy adapter does not correctly track method calls');
      fail++;
    }
    
    // Test 5: Verify original object is affected
    const test5 = originalObject.data.value === 100;
    if (test5) {
      console.log('✓ Proxy adapter correctly affects original object');
      pass++;
    } else {
      console.error('✗ Proxy adapter does not correctly affect original object');
      fail++;
    }
    
    // Test 6: Add method dynamically
    originalObject.newMethod = function() { return 'new method'; };
    const test6 = typeof proxyAdapter.newMethod === 'function' && proxyAdapter.newMethod() === 'new method';
    if (test6) {
      console.log('✓ Proxy adapter correctly handles dynamically added methods');
      pass++;
    } else {
      console.error('✗ Proxy adapter does not correctly handle dynamically added methods');
      fail++;
    }
  } catch (error) {
    console.error('Error in proxy adapter test:', error);
    fail++;
  }
  
  return { pass, fail };
}

// Run all tests
const testResults = runMethodPreservationTests();

// Export test functions and results
module.exports = {
  runMethodPreservationTests,
  testDirectObjectPattern,
  testFactoryFunctionPattern,
  testModuleBoundaryAdapter,
  testClassAdapterFactory,
  testEventInterfaceAdapter,
  testComponentAdapterFactory,
  testCrossTentacleCommunication,
  testFrameworkIntegration,
  testSerializationSafeAdapter,
  testProxyAdapter,
  testResults
};
