/**
 * @fileoverview API System for managing API endpoints and requests.
 * Provides registration, routing, authentication, and documentation for APIs.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../utils/errorHandling');
const { validateSchema } = require('../utils/validation');
const Logger = require('./LoggingSystem').Logger;

/**
 * Manages API endpoints and requests.
 */
class ApiSystem {
  /**
   * Creates a new ApiSystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._endpoints = new Map();
    this._middlewares = [];
    this._initialized = false;
    this._logger = new Logger('aideon:api');
    this._options = {
      basePath: options.basePath || '/api',
      enableRateLimiting: options.enableRateLimiting !== false,
      enableAuthentication: options.enableAuthentication !== false,
      enableDocumentation: options.enableDocumentation !== false,
      ...options
    };
  }
  
  /**
   * Initializes the API system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Initializing API system');
      
      // Set up default middlewares
      if (this._options.enableAuthentication) {
        this._middlewares.push(this._authMiddleware.bind(this));
      }
      
      if (this._options.enableRateLimiting) {
        this._middlewares.push(this._rateLimitMiddleware.bind(this));
      }
      
      this._initialized = true;
      this._logger.info('API system initialized');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to initialize API system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ApiError('Failed to initialize API system', 'API_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the API system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Shutting down API system');
      
      // Clear all endpoints and middlewares
      this._endpoints.clear();
      this._middlewares = [];
      
      this._initialized = false;
      this._logger.info('API system shut down');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to shut down API system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ApiError('Failed to shut down API system', 'API_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Registers an API endpoint.
   * @param {Object} endpoint - The endpoint definition
   * @param {string} endpoint.path - The API path
   * @param {string} endpoint.method - The HTTP method
   * @param {Function} endpoint.handler - The handler function
   * @param {string} [endpoint.tentacleId] - The ID of the tentacle that owns this endpoint
   * @param {boolean} [endpoint.auth=true] - Whether authentication is required
   * @param {Array<string>} [endpoint.permissions=[]] - Required permissions
   * @param {Object} [endpoint.schema] - Schema for validation
   * @param {Object} [endpoint.schema.body] - Schema for request body
   * @param {Object} [endpoint.schema.query] - Schema for query parameters
   * @param {Object} [endpoint.schema.params] - Schema for path parameters
   * @param {Object} [endpoint.schema.response] - Schema for response
   * @param {string} [endpoint.description] - Description of the endpoint
   * @param {Array<string>} [endpoint.tags=[]] - Tags for categorization
   * @returns {string} The registered endpoint ID
   */
  register(endpoint) {
    if (!this._initialized) {
      throw new ApiError('API system not initialized', 'API_NOT_INITIALIZED');
    }
    
    if (!endpoint || typeof endpoint !== 'object') {
      throw new ApiError('Invalid endpoint definition', 'API_REGISTRATION_ERROR');
    }
    
    if (!endpoint.path || typeof endpoint.path !== 'string') {
      throw new ApiError('Invalid API path', 'API_REGISTRATION_ERROR');
    }
    
    if (!endpoint.method || typeof endpoint.method !== 'string') {
      throw new ApiError('Invalid HTTP method', 'API_REGISTRATION_ERROR');
    }
    
    if (typeof endpoint.handler !== 'function') {
      throw new ApiError('Invalid handler function', 'API_REGISTRATION_ERROR');
    }
    
    const method = endpoint.method.toUpperCase();
    const path = this._normalizePath(endpoint.path);
    const key = `${method}:${path}`;
    
    // Check if endpoint already exists
    if (this._endpoints.has(key)) {
      throw new ApiError(`API endpoint already registered: ${key}`, 'API_REGISTRATION_ERROR');
    }
    
    // Generate endpoint ID
    const id = uuidv4();
    
    // Store endpoint
    this._endpoints.set(key, {
      id,
      path,
      method,
      handler: endpoint.handler,
      tentacleId: endpoint.tentacleId,
      auth: endpoint.auth !== false,
      permissions: endpoint.permissions || [],
      schema: endpoint.schema || {},
      description: endpoint.description || '',
      tags: endpoint.tags || [],
      createdAt: Date.now()
    });
    
    this._logger.debug(`API endpoint registered: ${key}`, {
      id,
      tentacleId: endpoint.tentacleId
    });
    
    return id;
  }
  
  /**
   * Unregisters an API endpoint.
   * @param {string} path - The API path
   * @param {string} method - The HTTP method
   * @returns {boolean} True if unregistration was successful
   */
  unregister(path, method) {
    if (!this._initialized) {
      throw new ApiError('API system not initialized', 'API_NOT_INITIALIZED');
    }
    
    if (!path || typeof path !== 'string') {
      throw new ApiError('Invalid API path', 'API_UNREGISTRATION_ERROR');
    }
    
    if (!method || typeof method !== 'string') {
      throw new ApiError('Invalid HTTP method', 'API_UNREGISTRATION_ERROR');
    }
    
    const normalizedPath = this._normalizePath(path);
    const key = `${method.toUpperCase()}:${normalizedPath}`;
    
    // Check if endpoint exists
    if (!this._endpoints.has(key)) {
      this._logger.warn(`API endpoint not found: ${key}`);
      return false;
    }
    
    // Remove endpoint
    this._endpoints.delete(key);
    
    this._logger.debug(`API endpoint unregistered: ${key}`);
    
    return true;
  }
  
  /**
   * Gets all registered API endpoints.
   * @returns {Array<Object>} The registered endpoints
   */
  getEndpoints() {
    return Array.from(this._endpoints.values());
  }
  
  /**
   * Gets an API endpoint by path and method.
   * @param {string} path - The API path
   * @param {string} method - The HTTP method
   * @returns {Object|null} The endpoint or null if not found
   */
  getEndpoint(path, method) {
    const normalizedPath = this._normalizePath(path);
    const key = `${method.toUpperCase()}:${normalizedPath}`;
    
    return this._endpoints.get(key) || null;
  }
  
  /**
   * Handles an API request.
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @returns {Promise<void>} Promise that resolves when the request is handled
   */
  async handleRequest(request, response) {
    if (!this._initialized) {
      throw new ApiError('API system not initialized', 'API_NOT_INITIALIZED');
    }
    
    try {
      const path = this._normalizePath(request.path);
      const method = request.method.toUpperCase();
      const key = `${method}:${path}`;
      
      // Check if endpoint exists
      if (!this._endpoints.has(key)) {
        throw new ApiError(`API endpoint not found: ${key}`, 'API_ENDPOINT_NOT_FOUND', null, 404);
      }
      
      const endpoint = this._endpoints.get(key);
      
      // Apply middlewares
      for (const middleware of this._middlewares) {
        await middleware(request, response, endpoint);
      }
      
      // Validate request
      if (endpoint.schema) {
        this._validateRequest(request, endpoint.schema);
      }
      
      // Handle request
      const result = await endpoint.handler(request, response);
      
      // Validate response
      if (endpoint.schema && endpoint.schema.response) {
        this._validateResponse(result, endpoint.schema.response);
      }
      
      return result;
    } catch (error) {
      this._logger.error(`Error handling API request: ${request.method} ${request.path}`, {
        error: error.message,
        stack: error.stack
      });
      
      // Convert to ApiError if not already
      if (!(error instanceof ApiError)) {
        error = new ApiError(error.message, 'API_REQUEST_ERROR', error, 500);
      }
      
      // Set response status and error
      response.status = error.statusCode || 500;
      response.error = {
        message: error.message,
        code: error.code,
        details: error.details
      };
      
      throw error;
    }
  }
  
  /**
   * Adds a middleware function.
   * @param {Function} middleware - The middleware function
   * @returns {boolean} True if middleware was added successfully
   */
  addMiddleware(middleware) {
    if (typeof middleware !== 'function') {
      throw new ApiError('Invalid middleware function', 'API_MIDDLEWARE_ERROR');
    }
    
    this._middlewares.push(middleware);
    
    return true;
  }
  
  /**
   * Removes a middleware function.
   * @param {Function} middleware - The middleware function to remove
   * @returns {boolean} True if middleware was removed successfully
   */
  removeMiddleware(middleware) {
    const index = this._middlewares.indexOf(middleware);
    
    if (index === -1) {
      return false;
    }
    
    this._middlewares.splice(index, 1);
    
    return true;
  }
  
  /**
   * Generates API documentation.
   * @returns {Object} The API documentation
   */
  generateDocs() {
    if (!this._initialized) {
      throw new ApiError('API system not initialized', 'API_NOT_INITIALIZED');
    }
    
    if (!this._options.enableDocumentation) {
      throw new ApiError('API documentation is disabled', 'API_DOCS_DISABLED');
    }
    
    const docs = {
      openapi: '3.0.0',
      info: {
        title: 'Aideon API',
        version: '1.0.0',
        description: 'API for the Aideon AI Desktop Agent'
      },
      servers: [
        {
          url: this._options.basePath,
          description: 'Aideon API Server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
    
    // Generate paths
    for (const endpoint of this._endpoints.values()) {
      if (!docs.paths[endpoint.path]) {
        docs.paths[endpoint.path] = {};
      }
      
      const method = endpoint.method.toLowerCase();
      
      docs.paths[endpoint.path][method] = {
        summary: endpoint.description,
        tags: endpoint.tags,
        security: endpoint.auth ? [{ bearerAuth: [] }] : [],
        parameters: this._generateParameters(endpoint),
        requestBody: this._generateRequestBody(endpoint),
        responses: this._generateResponses(endpoint)
      };
      
      // Add schemas
      if (endpoint.schema) {
        if (endpoint.schema.body) {
          docs.components.schemas[`${endpoint.id}_request_body`] = endpoint.schema.body;
        }
        
        if (endpoint.schema.response) {
          docs.components.schemas[`${endpoint.id}_response`] = endpoint.schema.response;
        }
      }
    }
    
    return docs;
  }
  
  /**
   * Checks if the API system is healthy.
   * @returns {boolean} True if the API system is healthy
   */
  isHealthy() {
    return this._initialized;
  }
  
  /**
   * Normalizes an API path.
   * @param {string} path - The API path
   * @returns {string} The normalized path
   * @private
   */
  _normalizePath(path) {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Remove trailing slash
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // Add base path if not already included
    if (this._options.basePath && !path.startsWith(this._options.basePath)) {
      path = this._options.basePath + path;
    }
    
    return path;
  }
  
  /**
   * Validates a request against a schema.
   * @param {Object} request - The request object
   * @param {Object} schema - The schema object
   * @throws {ApiError} If validation fails
   * @private
   */
  _validateRequest(request, schema) {
    // Validate body
    if (schema.body && request.body) {
      const bodyValidation = validateSchema(request.body, schema.body);
      
      if (!bodyValidation.valid) {
        throw new ApiError('Invalid request body', 'API_VALIDATION_ERROR', bodyValidation.errors, 400);
      }
    }
    
    // Validate query parameters
    if (schema.query && request.query) {
      const queryValidation = validateSchema(request.query, schema.query);
      
      if (!queryValidation.valid) {
        throw new ApiError('Invalid query parameters', 'API_VALIDATION_ERROR', queryValidation.errors, 400);
      }
    }
    
    // Validate path parameters
    if (schema.params && request.params) {
      const paramsValidation = validateSchema(request.params, schema.params);
      
      if (!paramsValidation.valid) {
        throw new ApiError('Invalid path parameters', 'API_VALIDATION_ERROR', paramsValidation.errors, 400);
      }
    }
  }
  
  /**
   * Validates a response against a schema.
   * @param {*} response - The response data
   * @param {Object} schema - The schema object
   * @throws {ApiError} If validation fails
   * @private
   */
  _validateResponse(response, schema) {
    const validation = validateSchema(response, schema);
    
    if (!validation.valid) {
      throw new ApiError('Invalid response data', 'API_VALIDATION_ERROR', validation.errors, 500);
    }
  }
  
  /**
   * Authentication middleware.
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @param {Object} endpoint - The endpoint object
   * @returns {Promise<void>} Promise that resolves when authentication is complete
   * @private
   */
  async _authMiddleware(request, response, endpoint) {
    // Skip authentication if not required
    if (!endpoint.auth) {
      return;
    }
    
    // Check for authentication token
    const token = this._extractToken(request);
    
    if (!token) {
      throw new ApiError('Authentication required', 'API_AUTH_REQUIRED', null, 401);
    }
    
    // Validate token (simplified implementation)
    // In a real implementation, this would validate the token with the security system
    const user = { id: 'user-123', permissions: ['read', 'write'] };
    
    // Check permissions
    if (endpoint.permissions && endpoint.permissions.length > 0) {
      const hasPermission = endpoint.permissions.every(permission => 
        user.permissions.includes(permission)
      );
      
      if (!hasPermission) {
        throw new ApiError('Insufficient permissions', 'API_PERMISSION_DENIED', null, 403);
      }
    }
    
    // Set user in request
    request.user = user;
  }
  
  /**
   * Rate limiting middleware.
   * @param {Object} request - The request object
   * @param {Object} response - The response object
   * @param {Object} endpoint - The endpoint object
   * @returns {Promise<void>} Promise that resolves when rate limiting is complete
   * @private
   */
  async _rateLimitMiddleware(request, response, endpoint) {
    // Simplified implementation
    // In a real implementation, this would track request rates and enforce limits
    
    // For now, just add rate limit headers
    response.headers = {
      ...response.headers,
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
    };
  }
  
  /**
   * Extracts the authentication token from a request.
   * @param {Object} request - The request object
   * @returns {string|null} The token or null if not found
   * @private
   */
  _extractToken(request) {
    // Check Authorization header
    const authHeader = request.headers && request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter
    if (request.query && request.query.token) {
      return request.query.token;
    }
    
    return null;
  }
  
  /**
   * Generates OpenAPI parameters for an endpoint.
   * @param {Object} endpoint - The endpoint object
   * @returns {Array<Object>} The parameters
   * @private
   */
  _generateParameters(endpoint) {
    const parameters = [];
    
    // Path parameters
    if (endpoint.schema && endpoint.schema.params) {
      for (const [name, schema] of Object.entries(endpoint.schema.params.properties || {})) {
        parameters.push({
          name,
          in: 'path',
          required: true,
          schema
        });
      }
    }
    
    // Query parameters
    if (endpoint.schema && endpoint.schema.query) {
      for (const [name, schema] of Object.entries(endpoint.schema.query.properties || {})) {
        parameters.push({
          name,
          in: 'query',
          required: (endpoint.schema.query.required || []).includes(name),
          schema
        });
      }
    }
    
    return parameters;
  }
  
  /**
   * Generates OpenAPI request body for an endpoint.
   * @param {Object} endpoint - The endpoint object
   * @returns {Object|undefined} The request body or undefined if none
   * @private
   */
  _generateRequestBody(endpoint) {
    if (!endpoint.schema || !endpoint.schema.body) {
      return undefined;
    }
    
    return {
      required: true,
      content: {
        'application/json': {
          schema: {
            $ref: `#/components/schemas/${endpoint.id}_request_body`
          }
        }
      }
    };
  }
  
  /**
   * Generates OpenAPI responses for an endpoint.
   * @param {Object} endpoint - The endpoint object
   * @returns {Object} The responses
   * @private
   */
  _generateResponses(endpoint) {
    const responses = {
      '200': {
        description: 'Successful operation'
      },
      '400': {
        description: 'Bad request'
      },
      '401': {
        description: 'Unauthorized'
      },
      '403': {
        description: 'Forbidden'
      },
      '404': {
        description: 'Not found'
      },
      '500': {
        description: 'Internal server error'
      }
    };
    
    // Add response schema if available
    if (endpoint.schema && endpoint.schema.response) {
      responses['200'].content = {
        'application/json': {
          schema: {
            $ref: `#/components/schemas/${endpoint.id}_response`
          }
        }
      };
    }
    
    return responses;
  }
}

module.exports = ApiSystem;
