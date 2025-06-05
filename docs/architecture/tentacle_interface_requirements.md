# Tentacle Interface Requirements and Integration Patterns

## Overview

This document defines the standard interface requirements and integration patterns for all tentacles in the Aideon system. Following these guidelines is critical to ensure reliable cross-component communication, especially as Aideon scales to 60+ tentacles.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Method Preservation Across Module Boundaries](#method-preservation-across-module-boundaries)
3. [Factory Function Pattern](#factory-function-pattern)
4. [Direct Object Pattern](#direct-object-pattern)
5. [Module Boundary Adapters](#module-boundary-adapters)
6. [Event Interface Requirements](#event-interface-requirements)
7. [Capability Exposure](#capability-exposure)
8. [Dependency Declaration](#dependency-declaration)
9. [Configuration Schema](#configuration-schema)
10. [Lifecycle Hooks](#lifecycle-hooks)
11. [Error Handling](#error-handling)
12. [Testing Requirements](#testing-requirements)
13. [Documentation Requirements](#documentation-requirements)
14. [Examples](#examples)

## Core Principles

All tentacles in Aideon must adhere to these core principles:

1. **Method Preservation**: Ensure methods are preserved when objects cross module boundaries
2. **Factory-Based Creation**: Use factory functions instead of classes for component creation
3. **Direct Method Exposure**: Define methods as direct object properties, not on prototype chains
4. **Explicit Interfaces**: Clearly define and document all public interfaces
5. **Capability-Based Design**: Expose capabilities that other tentacles can discover and consume
6. **Event-Driven Communication**: Use events for loose coupling between components
7. **Defensive Integration**: Validate inputs and handle errors gracefully at integration points

## Method Preservation Across Module Boundaries

### The Problem

When objects cross module boundaries in JavaScript, methods defined on the prototype chain (as with ES6 classes) are lost. This causes duck typing checks to fail and breaks cross-component communication.

```javascript
// This will fail across module boundaries
class MyComponent {
  constructor() {
    this.data = { value: 42 };
  }
  
  getValue() {
    return this.data.value;
  }
}

const instance = new MyComponent();
// When instance crosses a module boundary, getValue method is lost
```

### The Solution

Define methods as direct properties of objects, not on prototype chains:

```javascript
// This will work across module boundaries
function createMyComponent() {
  return {
    data: { value: 42 },
    
    // Method defined as direct property
    getValue: function() {
      return this.data.value;
    }
  };
}

const instance = createMyComponent();
// When instance crosses a module boundary, getValue method can be recreated
```

## Factory Function Pattern

All tentacles must be created using factory functions, not classes:

```javascript
/**
 * Creates a new MyTentacle instance.
 * 
 * @param {Object} config - Configuration options
 * @returns {Object} MyTentacle instance
 */
function createMyTentacle(config = {}) {
  // Validate configuration
  if (!config.logger) throw new Error('Logger is required');
  
  // Private state
  const id = config.id || uuidv4();
  const name = config.name || 'MyTentacle';
  const logger = config.logger;
  const data = {};
  
  // Event handling
  const eventEmitter = new EventEmitter();
  
  /**
   * Processes input data.
   * 
   * @param {Object} input - Input data to process
   * @returns {Object} Processing result
   */
  function processData(input) {
    logger.info(`[${name}] Processing data`);
    // Implementation...
    return { result: 'processed' };
  }
  
  // Return public interface
  return {
    id,
    name,
    
    // Methods as direct properties
    processData,
    
    // Event interface
    on: (event, listener) => eventEmitter.on(event, listener),
    once: (event, listener) => eventEmitter.once(event, listener),
    off: (event, listener) => eventEmitter.off(event, listener),
    emit: (event, data) => eventEmitter.emit(event, data)
  };
}

module.exports = {
  createMyTentacle
};
```

## Direct Object Pattern

For simpler components, use the direct object pattern:

```javascript
/**
 * Creates a configuration object with methods as direct properties.
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Configuration object
 */
function createConfiguration(options = {}) {
  return {
    id: options.id || uuidv4(),
    name: options.name || 'Configuration',
    settings: options.settings || {},
    
    // Methods as direct properties
    getSetting: function(key, defaultValue) {
      return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    },
    
    setSetting: function(key, value) {
      this.settings[key] = value;
      return this;
    },
    
    hasSettings: function(keys) {
      return keys.every(key => this.settings[key] !== undefined);
    }
  };
}
```

## Module Boundary Adapters

For integrating with existing class-based components, use module boundary adapters:

```javascript
/**
 * Creates an adapter for a class-based component.
 * 
 * @param {Object} instance - Class instance to adapt
 * @returns {Object} Adapter with methods as direct properties
 */
function createComponentAdapter(instance) {
  return {
    id: instance.id,
    name: instance.name,
    
    // Methods as direct properties that delegate to instance
    processData: function(input) {
      return instance.processData(input);
    },
    
    getStatus: function() {
      return instance.getStatus();
    },
    
    // Event interface
    on: function(event, listener) {
      instance.on(event, listener);
      return this;
    },
    
    off: function(event, listener) {
      instance.off(event, listener);
      return this;
    },
    
    emit: function(event, data) {
      return instance.emit(event, data);
    }
  };
}
```

## Event Interface Requirements

All tentacles must implement a standard event interface:

```javascript
/**
 * Standard event interface methods.
 */
{
  /**
   * Registers an event listener.
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {Object} this - For method chaining
   */
  on: function(event, listener) {
    // Implementation...
    return this;
  },
  
  /**
   * Registers a one-time event listener.
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {Object} this - For method chaining
   */
  once: function(event, listener) {
    // Implementation...
    return this;
  },
  
  /**
   * Removes an event listener.
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {Object} this - For method chaining
   */
  off: function(event, listener) {
    // Implementation...
    return this;
  },
  
  /**
   * Emits an event.
   * 
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @returns {boolean} Whether the event had listeners
   */
  emit: function(event, data) {
    // Implementation...
    return true;
  }
}
```

## Capability Exposure

Tentacles must expose their capabilities for discovery:

```javascript
/**
 * Capability definition.
 */
const capabilities = [
  {
    id: 'data_processing',
    name: 'Data Processing',
    description: 'Processes input data and returns results',
    methods: ['processData'],
    events: {
      emitted: ['data-processed', 'processing-error'],
      consumed: ['data-available']
    }
  },
  {
    id: 'configuration_management',
    name: 'Configuration Management',
    description: 'Manages component configuration',
    methods: ['getConfiguration', 'setConfiguration'],
    events: {
      emitted: ['configuration-changed'],
      consumed: ['system-configuration-updated']
    }
  }
];
```

## Dependency Declaration

Tentacles must declare their dependencies:

```javascript
/**
 * Dependency declaration.
 */
const dependencies = [
  {
    id: 'logger',
    required: true,
    interface: {
      methods: ['info', 'warn', 'error', 'debug']
    }
  },
  {
    id: 'data_store',
    required: false,
    interface: {
      methods: ['get', 'set', 'delete']
    },
    fallback: {
      create: () => createInMemoryDataStore()
    }
  }
];
```

## Configuration Schema

Tentacles must provide a configuration schema:

```javascript
/**
 * Configuration schema.
 */
const configSchema = {
  properties: {
    name: {
      type: 'string',
      description: 'Human-readable name for this component',
      default: 'MyComponent'
    },
    maxItems: {
      type: 'number',
      description: 'Maximum number of items to process',
      default: 100,
      minimum: 1,
      maximum: 1000
    },
    enableFeatureX: {
      type: 'boolean',
      description: 'Whether to enable Feature X',
      default: false
    }
  },
  required: ['name']
};
```

## Lifecycle Hooks

Tentacles must implement standard lifecycle hooks:

```javascript
/**
 * Lifecycle hooks.
 */
{
  /**
   * Initializes the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  initialize: async function() {
    // Implementation...
    return Promise.resolve();
  },
  
  /**
   * Starts the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when startup is complete
   */
  start: async function() {
    // Implementation...
    return Promise.resolve();
  },
  
  /**
   * Stops the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when shutdown is complete
   */
  stop: async function() {
    // Implementation...
    return Promise.resolve();
  },
  
  /**
   * Pauses the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when pausing is complete
   */
  pause: async function() {
    // Implementation...
    return Promise.resolve();
  },
  
  /**
   * Resumes the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when resuming is complete
   */
  resume: async function() {
    // Implementation...
    return Promise.resolve();
  }
}
```

## Error Handling

Tentacles must implement standardized error handling:

```javascript
/**
 * Error handling.
 */
{
  /**
   * Handles an error.
   * 
   * @param {Error} error - Error to handle
   * @param {string} context - Context in which the error occurred
   * @returns {Object} Error handling result
   */
  handleError: function(error, context) {
    logger.error(`[${name}] Error in ${context}: ${error.message}`);
    
    // Emit error event
    this.emit('error', {
      error,
      context,
      tentacleId: id,
      timestamp: Date.now()
    });
    
    // Return error handling result
    return {
      handled: true,
      action: 'logged',
      recoverable: error.recoverable !== false
    };
  }
}
```

## Testing Requirements

All tentacles must include comprehensive tests:

1. **Unit Tests**: Test individual methods and functions
2. **Integration Tests**: Test interaction with other components
3. **Method Preservation Tests**: Verify methods are preserved across module boundaries
4. **Event Tests**: Verify event emission and handling
5. **Error Handling Tests**: Verify error handling behavior

## Documentation Requirements

All tentacles must include comprehensive documentation:

1. **JSDoc Comments**: Document all methods, parameters, and return values
2. **README.md**: Provide overview, installation, and usage instructions
3. **API Documentation**: Document all public interfaces
4. **Event Documentation**: Document all emitted and consumed events
5. **Configuration Documentation**: Document all configuration options
6. **Examples**: Provide usage examples

## Examples

### Complete Tentacle Example

```javascript
/**
 * @fileoverview Example tentacle implementation following all interface requirements.
 * @module tentacles/example
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a new ExampleTentacle instance.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Human-readable name
 * @param {Object} config.logger - Logger instance
 * @param {Object} config.metrics - Metrics collection instance
 * @param {number} [config.maxItems=100] - Maximum number of items to process
 * @param {boolean} [config.enableFeatureX=false] - Whether to enable Feature X
 * @returns {Object} ExampleTentacle instance
 */
function createExampleTentacle(config = {}) {
  // Validate required configuration
  if (!config.logger) throw new Error('Logger is required');
  if (!config.metrics) throw new Error('Metrics is required');
  
  // Initialize with defaults for optional configuration
  const id = config.id || uuidv4();
  const name = config.name || 'ExampleTentacle';
  const maxItems = config.maxItems !== undefined ? config.maxItems : 100;
  const enableFeatureX = config.enableFeatureX !== undefined ? config.enableFeatureX : false;
  
  // Private state
  const logger = config.logger;
  const metrics = config.metrics;
  const eventEmitter = new EventEmitter();
  const items = [];
  let isInitialized = false;
  let isRunning = false;
  
  /**
   * Initializes the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async function initialize() {
    if (isInitialized) {
      return Promise.resolve();
    }
    
    logger.info(`[${name}] Initializing`);
    
    try {
      // Initialization logic...
      
      isInitialized = true;
      logger.info(`[${name}] Initialized`);
      eventEmitter.emit('initialized', { id, name });
      
      return Promise.resolve();
    } catch (error) {
      logger.error(`[${name}] Initialization failed: ${error.message}`);
      eventEmitter.emit('error', {
        error,
        context: 'initialize',
        tentacleId: id,
        timestamp: Date.now()
      });
      
      return Promise.reject(error);
    }
  }
  
  /**
   * Starts the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when startup is complete
   */
  async function start() {
    if (!isInitialized) {
      await initialize();
    }
    
    if (isRunning) {
      return Promise.resolve();
    }
    
    logger.info(`[${name}] Starting`);
    
    try {
      // Startup logic...
      
      isRunning = true;
      logger.info(`[${name}] Started`);
      eventEmitter.emit('started', { id, name });
      
      return Promise.resolve();
    } catch (error) {
      logger.error(`[${name}] Startup failed: ${error.message}`);
      eventEmitter.emit('error', {
        error,
        context: 'start',
        tentacleId: id,
        timestamp: Date.now()
      });
      
      return Promise.reject(error);
    }
  }
  
  /**
   * Stops the tentacle.
   * 
   * @returns {Promise<void>} Promise that resolves when shutdown is complete
   */
  async function stop() {
    if (!isRunning) {
      return Promise.resolve();
    }
    
    logger.info(`[${name}] Stopping`);
    
    try {
      // Shutdown logic...
      
      isRunning = false;
      logger.info(`[${name}] Stopped`);
      eventEmitter.emit('stopped', { id, name });
      
      return Promise.resolve();
    } catch (error) {
      logger.error(`[${name}] Shutdown failed: ${error.message}`);
      eventEmitter.emit('error', {
        error,
        context: 'stop',
        tentacleId: id,
        timestamp: Date.now()
      });
      
      return Promise.reject(error);
    }
  }
  
  /**
   * Processes an item.
   * 
   * @param {Object} item - Item to process
   * @returns {Object} Processing result
   */
  function processItem(item) {
    if (!isRunning) {
      throw new Error('Tentacle is not running');
    }
    
    if (items.length >= maxItems) {
      throw new Error(`Maximum number of items (${maxItems}) reached`);
    }
    
    logger.info(`[${name}] Processing item: ${item.id}`);
    
    try {
      // Processing logic...
      const result = { id: item.id, processed: true };
      
      if (enableFeatureX) {
        // Feature X logic...
        result.featureXApplied = true;
      }
      
      items.push(item);
      
      metrics.recordMetric('item_processed', {
        tentacleId: id,
        itemId: item.id
      });
      
      eventEmitter.emit('item-processed', {
        item,
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      logger.error(`[${name}] Error processing item ${item.id}: ${error.message}`);
      
      metrics.recordMetric('item_processing_failed', {
        tentacleId: id,
        itemId: item.id,
        error: error.message
      });
      
      eventEmitter.emit('error', {
        error,
        context: 'processItem',
        tentacleId: id,
        itemId: item.id,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Gets the current status of the tentacle.
   * 
   * @returns {Object} Status information
   */
  function getStatus() {
    return {
      id,
      name,
      initialized: isInitialized,
      running: isRunning,
      itemCount: items.length,
      maxItems,
      enableFeatureX
    };
  }
  
  /**
   * Handles an error.
   * 
   * @param {Error} error - Error to handle
   * @param {string} context - Context in which the error occurred
   * @returns {Object} Error handling result
   */
  function handleError(error, context) {
    logger.error(`[${name}] Error in ${context}: ${error.message}`);
    
    // Emit error event
    eventEmitter.emit('error', {
      error,
      context,
      tentacleId: id,
      timestamp: Date.now()
    });
    
    // Return error handling result
    return {
      handled: true,
      action: 'logged',
      recoverable: error.recoverable !== false
    };
  }
  
  // Create and return the public interface
  return {
    id,
    name,
    
    // Lifecycle methods
    initialize,
    start,
    stop,
    
    // Business methods
    processItem,
    getStatus,
    
    // Error handling
    handleError,
    
    // Event interface
    on: (event, listener) => eventEmitter.on(event, listener),
    once: (event, listener) => eventEmitter.once(event, listener),
    off: (event, listener) => eventEmitter.off(event, listener),
    emit: (event, data) => eventEmitter.emit(event, data)
  };
}

// Expose capability information
createExampleTentacle.capabilities = [
  {
    id: 'item_processing',
    name: 'Item Processing',
    description: 'Processes items and tracks results',
    methods: ['processItem'],
    events: {
      emitted: ['item-processed', 'error'],
      consumed: []
    }
  },
  {
    id: 'status_reporting',
    name: 'Status Reporting',
    description: 'Provides status information',
    methods: ['getStatus'],
    events: {
      emitted: ['initialized', 'started', 'stopped'],
      consumed: []
    }
  }
];

// Expose dependency information
createExampleTentacle.dependencies = [
  {
    id: 'logger',
    required: true,
    interface: {
      methods: ['info', 'warn', 'error', 'debug']
    }
  },
  {
    id: 'metrics',
    required: true,
    interface: {
      methods: ['recordMetric']
    }
  }
];

// Expose configuration schema
createExampleTentacle.configSchema = {
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for this tentacle'
    },
    name: {
      type: 'string',
      description: 'Human-readable name for this tentacle',
      default: 'ExampleTentacle'
    },
    maxItems: {
      type: 'number',
      description: 'Maximum number of items to process',
      default: 100,
      minimum: 1,
      maximum: 1000
    },
    enableFeatureX: {
      type: 'boolean',
      description: 'Whether to enable Feature X',
      default: false
    }
  },
  required: ['logger', 'metrics']
};

module.exports = {
  createExampleTentacle
};
```

### Integration Example

```javascript
/**
 * @fileoverview Example of integrating multiple tentacles.
 */

const { createModularTentacleFramework } = require('../../core/framework/ModularTentacleFramework');
const { createTentacleRegistry } = require('../../core/framework/TentaclePluginSystem');
const { createDynamicTentacleLoader } = require('../../core/framework/DynamicTentacleLoader');
const { createExampleTentacle } = require('../example/ExampleTentacle');
const { createLogger } = require('../../core/utils/Logger');
const { createMetrics } = require('../../core/utils/Metrics');
const { EventEmitter } = require('events');

// Create system components
const eventEmitter = new EventEmitter();
const logger = createLogger({ name: 'IntegrationExample' });
const metrics = createMetrics({ name: 'IntegrationExample' });

// Create framework components
const tentacleFramework = createModularTentacleFramework({
  id: 'framework-1',
  name: 'TentacleFramework',
  logger,
  eventEmitter,
  metrics
});

const tentacleRegistry = createTentacleRegistry({
  id: 'registry-1',
  name: 'TentacleRegistry',
  logger,
  eventEmitter,
  metrics,
  tentacleFramework
});

const tentacleLoader = createDynamicTentacleLoader({
  id: 'loader-1',
  name: 'TentacleLoader',
  logger,
  eventEmitter,
  metrics,
  tentacleDirectory: './tentacles',
  tentacleFramework,
  tentacleRegistry,
  sandboxEnabled: true
});

// Initialize components
async function initialize() {
  await tentacleFramework.initialize();
  await tentacleRegistry.initialize();
  await tentacleLoader.initialize();
  
  // Register tentacle factory
  tentacleFramework.registerTentacleFactory('example', {
    create: createExampleTentacle,
    category: 'EXAMPLE',
    capabilities: createExampleTentacle.capabilities,
    dependencies: createExampleTentacle.dependencies
  });
  
  // Create tentacle instance
  const exampleTentacle = tentacleFramework.createTentacle('example', {
    name: 'MyExampleTentacle',
    maxItems: 200,
    enableFeatureX: true
  });
  
  // Initialize and start tentacle
  await tentacleFramework.initializeTentacle(exampleTentacle.id);
  await tentacleFramework.startTentacle(exampleTentacle.id);
  
  // Use tentacle
  const item = { id: 'item-1', data: { value: 42 } };
  const result = exampleTentacle.processItem(item);
  
  logger.info('Processing result:', result);
  
  // Get tentacle status
  const status = exampleTentacle.getStatus();
  logger.info('Tentacle status:', status);
  
  // Stop tentacle
  await tentacleFramework.stopTentacle(exampleTentacle.id);
}

// Run example
initialize().catch(error => {
  logger.error('Initialization failed:', error);
});
```

This comprehensive documentation provides all the information needed to create tentacles that integrate reliably with the Aideon system, ensuring method preservation across module boundaries and consistent behavior across all components.
