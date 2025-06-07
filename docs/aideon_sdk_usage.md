# Aideon SDK Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Core Concepts](#core-concepts)
5. [Creating a Tentacle](#creating-a-tentacle)
6. [Systems](#systems)
7. [Utilities](#utilities)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Examples](#examples)
11. [API Reference](#api-reference)

## Introduction

The Aideon SDK provides developers with a comprehensive toolkit for creating and integrating tentacles into the Aideon AI Desktop Agent. This SDK enables you to leverage Aideon's powerful capabilities while maintaining a consistent development experience.

### Key Features

- **Modular Architecture**: Build tentacles that seamlessly integrate with Aideon's core systems
- **Standardized Interfaces**: Consistent APIs for all tentacle interactions
- **Robust Error Handling**: Comprehensive error handling and validation
- **Event-Driven Communication**: Subscribe to and publish events across the Aideon ecosystem
- **Configuration Management**: Access and update configuration values
- **Security Integration**: Built-in security features and validation
- **Metrics Collection**: Contribute to Aideon's GAIA Score and performance metrics

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher

### Install via npm

```bash
npm install aideon-sdk
```

### Install via yarn

```bash
yarn add aideon-sdk
```

## Getting Started

### Basic Usage

```javascript
const { createSDK } = require('aideon-sdk');

// Create SDK instance
const aideon = createSDK({
  // SDK options
  config: {
    // Configuration options
  }
});

// Initialize SDK
await aideon.initialize();

// Create a tentacle
const myTentacle = aideon.createTentacle({
  id: 'my-tentacle',
  name: 'My Tentacle',
  version: '1.0.0',
  description: 'A sample tentacle'
});

// Register tentacle
await aideon.core.registerTentacle(myTentacle);

// Use tentacle
// ...

// Shutdown SDK
await aideon.shutdown();
```

### SDK Options

The `createSDK` function accepts the following options:

```javascript
const aideon = createSDK({
  // Core options
  core: {
    // Core-specific options
  },
  
  // System options
  config: {
    // Configuration system options
  },
  logging: {
    // Logging system options
  },
  events: {
    // Event system options
  },
  security: {
    // Security system options
  },
  metrics: {
    // Metrics system options
  },
  api: {
    // API system options
  }
});
```

## Core Concepts

### Aideon Architecture

Aideon is built on a modular architecture centered around tentacles. Each tentacle provides specific functionality and can interact with other tentacles through well-defined interfaces.

The SDK provides access to Aideon's core systems:

- **API System**: Manages API endpoints and requests
- **Config System**: Handles configuration values
- **Event System**: Facilitates event-driven communication
- **Logging System**: Provides logging capabilities
- **Metrics System**: Collects performance metrics
- **Security System**: Manages authentication and authorization

### Tentacles

Tentacles are the primary extension mechanism in Aideon. Each tentacle:

- Has a unique ID and version
- Provides specific functionality
- Can interact with other tentacles
- Can access Aideon's core systems
- Can be enabled or disabled
- Can be configured by users

## Creating a Tentacle

### Basic Tentacle

```javascript
const { createSDK } = require('aideon-sdk');

// Create SDK instance
const aideon = createSDK();
await aideon.initialize();

// Create a tentacle
const myTentacle = aideon.createTentacle({
  id: 'my-tentacle',
  name: 'My Tentacle',
  version: '1.0.0',
  description: 'A sample tentacle',
  
  // Tentacle initialization
  async initialize() {
    // Initialize tentacle
    this.logger.info('Initializing tentacle');
    
    // Register API endpoints
    this.registerEndpoints();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    return true;
  },
  
  // Tentacle shutdown
  async shutdown() {
    // Clean up resources
    this.logger.info('Shutting down tentacle');
    
    return true;
  },
  
  // Register API endpoints
  registerEndpoints() {
    this.api.registerEndpoint('my-tentacle/hello', async (req, res) => {
      return { message: 'Hello, world!' };
    });
  },
  
  // Subscribe to events
  subscribeToEvents() {
    this.events.subscribe('system:ready', this.onSystemReady.bind(this));
  },
  
  // Event handler
  onSystemReady(event) {
    this.logger.info('System is ready');
  }
});

// Register tentacle
await aideon.core.registerTentacle(myTentacle);
```

### Tentacle Lifecycle

Tentacles have the following lifecycle methods:

- **initialize**: Called when the tentacle is initialized
- **shutdown**: Called when the tentacle is shut down
- **enable**: Called when the tentacle is enabled
- **disable**: Called when the tentacle is disabled
- **configure**: Called when the tentacle's configuration is updated

### Tentacle Configuration

Tentacles can define their configuration schema and access configuration values:

```javascript
const myTentacle = aideon.createTentacle({
  id: 'my-tentacle',
  name: 'My Tentacle',
  version: '1.0.0',
  
  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 5000
      }
    },
    required: ['apiKey']
  },
  
  // Access configuration values
  async initialize() {
    const apiKey = this.config.get('apiKey');
    const timeout = this.config.get('timeout', 5000); // With default value
    
    this.logger.info(`Using API key: ${apiKey}`);
    this.logger.info(`Timeout: ${timeout}ms`);
    
    return true;
  }
});
```

## Systems

### API System

The API System provides a way to register and access API endpoints:

```javascript
// Register an endpoint
aideon.api.registerEndpoint('my-tentacle/hello', async (req, res) => {
  return { message: 'Hello, world!' };
});

// Call an endpoint
const response = await aideon.api.callEndpoint('my-tentacle/hello', {
  // Request parameters
});
```

### Config System

The Config System manages configuration values:

```javascript
// Get a configuration value
const value = aideon.config.get('my-tentacle.apiKey');

// Set a configuration value
aideon.config.set('my-tentacle.timeout', 10000);

// Watch for configuration changes
aideon.config.watch('my-tentacle.apiKey', (newValue, oldValue) => {
  console.log(`API key changed from ${oldValue} to ${newValue}`);
});
```

### Event System

The Event System facilitates event-driven communication:

```javascript
// Subscribe to an event
const subscription = aideon.events.subscribe('my-tentacle:event', (event) => {
  console.log('Event received:', event);
});

// Publish an event
aideon.events.publish('my-tentacle:event', {
  // Event data
  timestamp: Date.now(),
  message: 'Something happened'
});

// Unsubscribe from an event
subscription.unsubscribe();
```

### Logging System

The Logging System provides logging capabilities:

```javascript
// Log messages
aideon.logging.debug('Debug message');
aideon.logging.info('Info message');
aideon.logging.warn('Warning message');
aideon.logging.error('Error message');

// Create a logger for a specific context
const logger = aideon.logging.createLogger('my-tentacle');
logger.info('Info message from my-tentacle');
```

### Metrics System

The Metrics System collects performance metrics:

```javascript
// Record a metric
aideon.metrics.record('my-tentacle.requests', 1);

// Record a timing metric
aideon.metrics.timing('my-tentacle.request_time', () => {
  // Code to measure
  return result;
});

// Record a timing metric manually
const start = Date.now();
// ... code to measure
const end = Date.now();
aideon.metrics.recordTiming('my-tentacle.request_time', end - start);
```

### Security System

The Security System manages authentication and authorization:

```javascript
// Check if user is authenticated
const isAuthenticated = aideon.security.isAuthenticated();

// Check if user has permission
const hasPermission = aideon.security.hasPermission('my-tentacle:read');

// Get current user
const user = aideon.security.getCurrentUser();
```

## Utilities

### Error Handling

The SDK provides error handling utilities:

```javascript
const { AideonError, ApiError, handleError } = aideon.utils.error;

// Create an error
const error = new ApiError('API request failed', 'API_ERROR');

// Handle an error
handleError(error, {
  log: true,
  rethrow: false
});

// Create an error handler
const errorHandler = aideon.utils.error.createErrorHandler({
  log: true,
  rethrow: false
});

// Use the error handler
try {
  // Code that might throw
} catch (error) {
  errorHandler(error);
}
```

### Validation

The SDK provides validation utilities:

```javascript
const { validateSchema, validateOrThrow } = aideon.utils.validation;

// Define a schema
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name']
};

// Validate data
const result = validateSchema(data, schema);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Validate data and throw if invalid
try {
  validateOrThrow(data, schema);
} catch (error) {
  console.error('Validation failed:', error.errors);
}
```

### Object Utilities

The SDK provides object manipulation utilities:

```javascript
const { deepClone, deepMerge, getPath, setPath } = aideon.utils.object;

// Clone an object
const clone = deepClone(obj);

// Merge objects
const merged = deepMerge(target, source1, source2);

// Get a value by path
const value = getPath(obj, 'user.profile.name');

// Set a value by path
setPath(obj, 'user.profile.name', 'John');
```

### Network Utilities

The SDK provides network utilities:

```javascript
const { request, get, post } = aideon.utils.network;

// Make a request
const response = await request({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer token'
  },
  json: true
});

// Make a GET request
const data = await get('https://api.example.com/data', {
  json: true
});

// Make a POST request
const result = await post('https://api.example.com/data', {
  // Request body
  name: 'John',
  age: 30
}, {
  json: true
});
```

## Error Handling

### Error Classes

The SDK provides the following error classes:

- **AideonError**: Base error class
- **ApiError**: API-related errors
- **ConfigError**: Configuration-related errors
- **EventError**: Event-related errors
- **LoggingError**: Logging-related errors
- **MetricsError**: Metrics-related errors
- **SecurityError**: Security-related errors
- **TentacleError**: Tentacle-related errors
- **ValidationError**: Validation-related errors

### Error Handling Best Practices

1. **Use specific error classes**: Use the most specific error class for your error
2. **Include error codes**: Always include an error code for easier identification
3. **Provide detailed messages**: Error messages should be clear and descriptive
4. **Handle errors at appropriate levels**: Handle errors at the level where you can take appropriate action
5. **Log errors**: Always log errors for debugging purposes
6. **Graceful degradation**: Implement fallback behavior when possible

## Best Practices

### Tentacle Development

1. **Follow the single responsibility principle**: Each tentacle should have a clear, focused purpose
2. **Use standardized interfaces**: Follow Aideon's interface conventions
3. **Implement proper error handling**: Use the SDK's error handling utilities
4. **Validate inputs**: Always validate inputs using the SDK's validation utilities
5. **Document your tentacle**: Provide clear documentation for your tentacle
6. **Write tests**: Test your tentacle thoroughly
7. **Consider performance**: Optimize for performance where appropriate
8. **Handle configuration changes**: Respond to configuration changes gracefully
9. **Clean up resources**: Properly clean up resources in the shutdown method
10. **Follow security best practices**: Implement proper authentication and authorization

### Event-Driven Architecture

1. **Use meaningful event names**: Event names should be clear and descriptive
2. **Include relevant data**: Events should include all relevant data
3. **Handle event failures**: Implement proper error handling for event processing
4. **Avoid tight coupling**: Events should not create tight coupling between tentacles
5. **Document events**: Document the events your tentacle publishes and subscribes to

### Configuration Management

1. **Define a configuration schema**: Always define a schema for your tentacle's configuration
2. **Provide sensible defaults**: Include default values for optional configuration
3. **Validate configuration**: Validate configuration values against your schema
4. **Handle configuration changes**: Respond to configuration changes gracefully
5. **Document configuration options**: Document all configuration options

## Examples

### Basic Tentacle

```javascript
const { createSDK } = require('aideon-sdk');

// Create SDK instance
const aideon = createSDK();
await aideon.initialize();

// Create a tentacle
const myTentacle = aideon.createTentacle({
  id: 'my-tentacle',
  name: 'My Tentacle',
  version: '1.0.0',
  description: 'A sample tentacle',
  
  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 5000
      }
    },
    required: ['apiKey']
  },
  
  // Tentacle initialization
  async initialize() {
    this.logger.info('Initializing tentacle');
    
    // Get configuration values
    this.apiKey = this.config.get('apiKey');
    this.timeout = this.config.get('timeout', 5000);
    
    // Create API client
    this.apiClient = this.utils.network.createClient({
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: this.timeout,
      json: true
    });
    
    // Register API endpoints
    this.registerEndpoints();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    return true;
  },
  
  // Tentacle shutdown
  async shutdown() {
    this.logger.info('Shutting down tentacle');
    
    // Clean up resources
    this.apiClient = null;
    
    return true;
  },
  
  // Register API endpoints
  registerEndpoints() {
    this.api.registerEndpoint('my-tentacle/getData', this.getData.bind(this));
  },
  
  // Subscribe to events
  subscribeToEvents() {
    this.events.subscribe('system:ready', this.onSystemReady.bind(this));
    this.events.subscribe('config:changed', this.onConfigChanged.bind(this));
  },
  
  // API endpoint handler
  async getData(req, res) {
    try {
      // Validate request
      this.utils.validation.validateOrThrow(req.params, {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      });
      
      // Get data from external API
      const response = await this.apiClient.get(`https://api.example.com/data/${req.params.id}`);
      
      // Record metric
      this.metrics.record('my-tentacle.requests', 1);
      
      return response.body;
    } catch (error) {
      // Handle error
      this.logger.error('Failed to get data:', error);
      
      // Record error metric
      this.metrics.record('my-tentacle.errors', 1);
      
      // Throw appropriate error
      throw new this.utils.error.ApiError('Failed to get data', 'DATA_ERROR', error);
    }
  },
  
  // Event handler for system ready
  onSystemReady(event) {
    this.logger.info('System is ready');
  },
  
  // Event handler for configuration changes
  onConfigChanged(event) {
    if (event.key === 'my-tentacle.apiKey') {
      this.apiKey = event.newValue;
      this.logger.info('API key updated');
      
      // Update API client
      this.apiClient = this.utils.network.createClient({
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: this.timeout,
        json: true
      });
    } else if (event.key === 'my-tentacle.timeout') {
      this.timeout = event.newValue;
      this.logger.info(`Timeout updated to ${this.timeout}ms`);
      
      // Update API client
      this.apiClient = this.utils.network.createClient({
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: this.timeout,
        json: true
      });
    }
  }
});

// Register tentacle
await aideon.core.registerTentacle(myTentacle);
```

### Integration with External Service

```javascript
const { createSDK } = require('aideon-sdk');

// Create SDK instance
const aideon = createSDK();
await aideon.initialize();

// Create a tentacle for external service integration
const externalServiceTentacle = aideon.createTentacle({
  id: 'external-service',
  name: 'External Service Integration',
  version: '1.0.0',
  description: 'Integrates with an external service',
  
  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'API key for external service'
      },
      baseUrl: {
        type: 'string',
        description: 'Base URL for external service API',
        default: 'https://api.example.com'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 5000
      }
    },
    required: ['apiKey']
  },
  
  // Tentacle initialization
  async initialize() {
    this.logger.info('Initializing external service integration');
    
    // Get configuration values
    this.apiKey = this.config.get('apiKey');
    this.baseUrl = this.config.get('baseUrl', 'https://api.example.com');
    this.timeout = this.config.get('timeout', 5000);
    
    // Create API client
    this.apiClient = this.utils.network.createClient({
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: this.timeout,
      json: true
    });
    
    // Register API endpoints
    this.registerEndpoints();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    // Verify connection to external service
    try {
      await this.verifyConnection();
      this.logger.info('Successfully connected to external service');
    } catch (error) {
      this.logger.error('Failed to connect to external service:', error);
      // Continue initialization despite connection failure
    }
    
    return true;
  },
  
  // Verify connection to external service
  async verifyConnection() {
    const response = await this.apiClient.get(`${this.baseUrl}/status`);
    
    if (response.statusCode !== 200) {
      throw new this.utils.error.ApiError(
        `External service returned status ${response.statusCode}`,
        'CONNECTION_ERROR'
      );
    }
    
    return response.body;
  },
  
  // Register API endpoints
  registerEndpoints() {
    this.api.registerEndpoint('external-service/getData', this.getData.bind(this));
    this.api.registerEndpoint('external-service/createData', this.createData.bind(this));
    this.api.registerEndpoint('external-service/updateData', this.updateData.bind(this));
    this.api.registerEndpoint('external-service/deleteData', this.deleteData.bind(this));
  },
  
  // Subscribe to events
  subscribeToEvents() {
    this.events.subscribe('system:ready', this.onSystemReady.bind(this));
    this.events.subscribe('config:changed', this.onConfigChanged.bind(this));
    this.events.subscribe('data:created', this.onDataCreated.bind(this));
  },
  
  // API endpoint handler for getting data
  async getData(req, res) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate request
      this.utils.validation.validateOrThrow(req.params, {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      });
      
      // Get data from external API
      const response = await this.apiClient.get(`${this.baseUrl}/data/${req.params.id}`);
      
      // Record metrics
      this.metrics.record('external-service.requests', 1);
      this.metrics.recordTiming('external-service.request_time', Date.now() - startTime);
      
      return response.body;
    } catch (error) {
      // Handle error
      this.logger.error('Failed to get data:', error);
      
      // Record error metric
      this.metrics.record('external-service.errors', 1);
      
      // Throw appropriate error
      throw new this.utils.error.ApiError('Failed to get data', 'DATA_ERROR', error);
    }
  },
  
  // API endpoint handler for creating data
  async createData(req, res) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate request
      this.utils.validation.validateOrThrow(req.body, {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['name', 'value']
      });
      
      // Create data in external API
      const response = await this.apiClient.post(`${this.baseUrl}/data`, req.body);
      
      // Record metrics
      this.metrics.record('external-service.requests', 1);
      this.metrics.recordTiming('external-service.request_time', Date.now() - startTime);
      
      // Publish event
      this.events.publish('external-service:data-created', {
        id: response.body.id,
        name: req.body.name,
        value: req.body.value,
        timestamp: Date.now()
      });
      
      return response.body;
    } catch (error) {
      // Handle error
      this.logger.error('Failed to create data:', error);
      
      // Record error metric
      this.metrics.record('external-service.errors', 1);
      
      // Throw appropriate error
      throw new this.utils.error.ApiError('Failed to create data', 'DATA_ERROR', error);
    }
  },
  
  // API endpoint handler for updating data
  async updateData(req, res) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate request
      this.utils.validation.validateOrThrow(req.body, {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['id']
      });
      
      // Update data in external API
      const response = await this.apiClient.put(
        `${this.baseUrl}/data/${req.body.id}`,
        req.body
      );
      
      // Record metrics
      this.metrics.record('external-service.requests', 1);
      this.metrics.recordTiming('external-service.request_time', Date.now() - startTime);
      
      // Publish event
      this.events.publish('external-service:data-updated', {
        id: req.body.id,
        name: req.body.name,
        value: req.body.value,
        timestamp: Date.now()
      });
      
      return response.body;
    } catch (error) {
      // Handle error
      this.logger.error('Failed to update data:', error);
      
      // Record error metric
      this.metrics.record('external-service.errors', 1);
      
      // Throw appropriate error
      throw new this.utils.error.ApiError('Failed to update data', 'DATA_ERROR', error);
    }
  },
  
  // API endpoint handler for deleting data
  async deleteData(req, res) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate request
      this.utils.validation.validateOrThrow(req.params, {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      });
      
      // Delete data in external API
      const response = await this.apiClient.delete(`${this.baseUrl}/data/${req.params.id}`);
      
      // Record metrics
      this.metrics.record('external-service.requests', 1);
      this.metrics.recordTiming('external-service.request_time', Date.now() - startTime);
      
      // Publish event
      this.events.publish('external-service:data-deleted', {
        id: req.params.id,
        timestamp: Date.now()
      });
      
      return response.body;
    } catch (error) {
      // Handle error
      this.logger.error('Failed to delete data:', error);
      
      // Record error metric
      this.metrics.record('external-service.errors', 1);
      
      // Throw appropriate error
      throw new this.utils.error.ApiError('Failed to delete data', 'DATA_ERROR', error);
    }
  },
  
  // Event handler for system ready
  onSystemReady(event) {
    this.logger.info('System is ready');
  },
  
  // Event handler for configuration changes
  onConfigChanged(event) {
    if (event.key === 'external-service.apiKey') {
      this.apiKey = event.newValue;
      this.logger.info('API key updated');
      this.updateApiClient();
    } else if (event.key === 'external-service.baseUrl') {
      this.baseUrl = event.newValue;
      this.logger.info(`Base URL updated to ${this.baseUrl}`);
      this.updateApiClient();
    } else if (event.key === 'external-service.timeout') {
      this.timeout = event.newValue;
      this.logger.info(`Timeout updated to ${this.timeout}ms`);
      this.updateApiClient();
    }
  },
  
  // Event handler for data created
  onDataCreated(event) {
    this.logger.info(`Data created: ${event.id}`);
  },
  
  // Update API client
  updateApiClient() {
    this.apiClient = this.utils.network.createClient({
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: this.timeout,
      json: true
    });
  }
});

// Register tentacle
await aideon.core.registerTentacle(externalServiceTentacle);
```

## API Reference

For detailed API reference, please see the [API Reference](./api-reference.md) document.
