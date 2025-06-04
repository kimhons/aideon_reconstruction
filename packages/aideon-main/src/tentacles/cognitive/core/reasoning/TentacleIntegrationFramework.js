/**
 * @fileoverview TentacleIntegrationFramework for the Reasoning Engine.
 * 
 * The TentacleIntegrationFramework provides standardized interfaces for Aideon's 60+ tentacles
 * to submit reasoning requests and receive results, managing request queuing, prioritization,
 * and context sharing. It serves as the primary integration point between the Reasoning Engine
 * and the broader Aideon ecosystem.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI
 * @license Proprietary
 */

const Logger = require('../../../../common/logging/Logger');
const ConfigurationService = require('../../../../common/config/ConfigurationService');
const PerformanceMonitor = require('../../../../common/performance/PerformanceMonitor');
const SecurityManager = require('../../../../common/security/SecurityManager');
const GlobalContextManager = require('../../../../common/context/GlobalContextManager');
const ReasoningEngine = require('./ReasoningEngine');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} TentacleCapabilities
 * @property {string} id - Tentacle identifier
 * @property {string} name - Human-readable name
 * @property {string[]} requestTypes - Types of reasoning requests this tentacle can make
 * @property {string} version - Tentacle version
 * @property {string} apiVersion - API version the tentacle is compatible with
 * @property {number} priority - Default priority level (1-10, higher is more important)
 */

/**
 * @typedef {Object} ReasoningRequest
 * @property {string} type - Type of reasoning request (e.g., 'deductive', 'inductive')
 * @property {Object} data - Request-specific data
 * @property {Object} [context] - Context information
 * @property {string[]} [requiredKnowledge] - Knowledge domains required for reasoning
 * @property {Object} [parameters] - Additional parameters for reasoning
 * @property {number} [priority] - Priority level (1-10, higher is more important)
 * @property {boolean} [urgent] - Whether the request is urgent
 * @property {string} [callbackId] - ID for callback when result is ready
 * @property {string[]} [relatedRequestIds] - IDs of related requests for context sharing
 */

/**
 * @typedef {Object} RequestStatus
 * @property {string} id - Request ID
 * @property {string} status - Current status ('pending', 'processing', 'completed', 'failed', 'cancelled')
 * @property {number} progress - Progress percentage (0-100)
 * @property {Date} createdAt - When the request was created
 * @property {Date} [startedAt] - When processing started
 * @property {Date} [completedAt] - When processing completed
 * @property {string} [error] - Error message if failed
 * @property {string} tentacleId - ID of the tentacle that submitted the request
 * @property {string} requestType - Type of reasoning request
 * @property {number} priority - Priority level
 * @property {boolean} urgent - Whether the request is urgent
 */

/**
 * @typedef {Object} ReasoningResult
 * @property {string} id - Request ID
 * @property {Object} result - Result data
 * @property {Object} metadata - Result metadata
 * @property {number} metadata.confidence - Confidence score (0-1)
 * @property {string[]} metadata.reasoningTrace - Trace of reasoning steps
 * @property {string} metadata.strategy - Strategy used for reasoning
 * @property {number} metadata.processingTime - Processing time in milliseconds
 * @property {Object} [explanation] - Human-readable explanation
 */

/**
 * @typedef {Object} SharedContext
 * @property {string} id - Context ID
 * @property {Object} data - Context data
 * @property {string[]} sourceRequestIds - IDs of requests that contributed to this context
 * @property {Date} createdAt - When the context was created
 * @property {Date} updatedAt - When the context was last updated
 * @property {Date} expiresAt - When the context expires
 */

/**
 * TentacleIntegrationFramework class for managing integration between tentacles and the Reasoning Engine.
 */
class TentacleIntegrationFramework {
  /**
   * Creates a new TentacleIntegrationFramework instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Logger instance
   * @param {ConfigurationService} options.configService - Configuration service
   * @param {PerformanceMonitor} options.performanceMonitor - Performance monitor
   * @param {SecurityManager} options.securityManager - Security manager
   * @param {GlobalContextManager} options.contextManager - Global context manager
   * @param {ReasoningEngine} options.reasoningEngine - Reasoning engine
   * @param {Object} [options.queueOptions] - Queue configuration options
   * @param {number} [options.queueOptions.maxQueueSize=1000] - Maximum queue size
   * @param {number} [options.queueOptions.processingInterval=100] - Processing interval in milliseconds
   * @param {number} [options.queueOptions.maxConcurrentRequests=10] - Maximum concurrent requests
   */
  constructor(options) {
    if (!options) {
      throw new Error('TentacleIntegrationFramework requires options parameter');
    }
    
    if (!options.logger) {
      throw new Error('TentacleIntegrationFramework requires logger instance');
    }
    
    if (!options.configService) {
      throw new Error('TentacleIntegrationFramework requires configService instance');
    }
    
    if (!options.performanceMonitor) {
      throw new Error('TentacleIntegrationFramework requires performanceMonitor instance');
    }
    
    if (!options.securityManager) {
      throw new Error('TentacleIntegrationFramework requires securityManager instance');
    }
    
    if (!options.contextManager) {
      throw new Error('TentacleIntegrationFramework requires contextManager instance');
    }
    
    if (!options.reasoningEngine) {
      throw new Error('TentacleIntegrationFramework requires reasoningEngine instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.contextManager = options.contextManager;
    this.reasoningEngine = options.reasoningEngine;
    
    // Initialize queue options
    const queueOptions = options.queueOptions || {};
    this.maxQueueSize = queueOptions.maxQueueSize || 1000;
    this.processingInterval = queueOptions.processingInterval || 100;
    this.maxConcurrentRequests = queueOptions.maxConcurrentRequests || 10;
    
    // Initialize data structures
    this.requestQueue = [];
    this.requestMap = new Map();
    this.tentacleRegistry = new Map();
    this.activeRequests = new Set();
    this.sharedContexts = new Map();
    
    // API version management
    this.currentApiVersion = '1.0.0';
    this.supportedApiVersions = ['1.0.0'];
    
    // Processing state
    this.isProcessing = false;
    this.processingTimer = null;
    this.isInitialized = false;
    
    this.logger.info('TentacleIntegrationFramework created');
  }
  
  /**
   * Initializes the TentacleIntegrationFramework.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    try {
      this.logger.info('Initializing TentacleIntegrationFramework');
      
      // Load configuration
      const config = await this.configService.getTentacleIntegrationConfig();
      
      // Update configuration
      if (config.maxQueueSize !== undefined) {
        this.maxQueueSize = config.maxQueueSize;
      }
      
      if (config.processingInterval !== undefined) {
        this.processingInterval = config.processingInterval;
      }
      
      if (config.maxConcurrentRequests !== undefined) {
        this.maxConcurrentRequests = config.maxConcurrentRequests;
      }
      
      // Load registered tentacles from configuration
      const registeredTentacles = await this.configService.getRegisteredTentacles();
      
      // Register tentacles
      for (const tentacle of registeredTentacles) {
        await this.registerTentacle(tentacle.id, tentacle);
      }
      
      // Start request processing
      this.startProcessing();
      
      this.isInitialized = true;
      this.logger.info('TentacleIntegrationFramework initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TentacleIntegrationFramework', error);
      throw new Error(`TentacleIntegrationFramework initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Starts the request processing loop.
   * 
   * @private
   */
  startProcessing() {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.processingTimer = setInterval(() => this.processNextRequests(), this.processingInterval);
    this.logger.debug('Request processing started');
  }
  
  /**
   * Stops the request processing loop.
   * 
   * @private
   */
  stopProcessing() {
    if (!this.isProcessing) {
      return;
    }
    
    clearInterval(this.processingTimer);
    this.processingTimer = null;
    this.isProcessing = false;
    this.logger.debug('Request processing stopped');
  }
  
  /**
   * Processes the next batch of requests from the queue.
   * 
   * @async
   * @private
   */
  async processNextRequests() {
    // Skip if no requests or at capacity
    if (this.requestQueue.length === 0 || this.activeRequests.size >= this.maxConcurrentRequests) {
      return;
    }
    
    // Calculate how many requests we can process
    const availableSlots = this.maxConcurrentRequests - this.activeRequests.size;
    const requestsToProcess = Math.min(availableSlots, this.requestQueue.length);
    
    // Process requests
    for (let i = 0; i < requestsToProcess; i++) {
      const requestId = this.requestQueue.shift();
      
      if (!requestId || !this.requestMap.has(requestId)) {
        continue;
      }
      
      const requestInfo = this.requestMap.get(requestId);
      
      // Skip if already processing or completed
      if (['processing', 'completed', 'failed', 'cancelled'].includes(requestInfo.status)) {
        continue;
      }
      
      // Mark as processing
      this.activeRequests.add(requestId);
      requestInfo.status = 'processing';
      requestInfo.startedAt = new Date();
      this.requestMap.set(requestId, requestInfo);
      
      // Process request asynchronously
      this.processRequest(requestId).catch(error => {
        this.logger.error(`Error processing request ${requestId}`, error);
      });
    }
  }
  
  /**
   * Processes a single request.
   * 
   * @async
   * @param {string} requestId - Request ID
   * @private
   */
  async processRequest(requestId) {
    try {
      const requestInfo = this.requestMap.get(requestId);
      
      if (!requestInfo) {
        throw new Error(`Request ${requestId} not found`);
      }
      
      this.logger.debug(`Processing request ${requestId}`, { requestInfo });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer(`request.${requestId}`);
      
      // Get tentacle information
      const tentacle = this.tentacleRegistry.get(requestInfo.tentacleId);
      
      if (!tentacle) {
        throw new Error(`Tentacle ${requestInfo.tentacleId} not registered`);
      }
      
      // Prepare reasoning request
      const reasoningRequest = {
        id: requestId,
        type: requestInfo.request.type,
        data: requestInfo.request.data,
        context: requestInfo.request.context || {},
        requiredKnowledge: requestInfo.request.requiredKnowledge || [],
        parameters: requestInfo.request.parameters || {},
        tentacleId: requestInfo.tentacleId,
        tentacleName: tentacle.name,
        priority: requestInfo.request.priority || tentacle.priority || 5
      };
      
      // Load shared context if specified
      if (requestInfo.request.relatedRequestIds && requestInfo.request.relatedRequestIds.length > 0) {
        const sharedContext = await this.getSharedContextForRequests(requestInfo.request.relatedRequestIds);
        
        if (sharedContext) {
          reasoningRequest.context = {
            ...reasoningRequest.context,
            shared: sharedContext.data
          };
        }
      }
      
      // Submit to reasoning engine
      const result = await this.reasoningEngine.processRequest(reasoningRequest);
      
      // Update request status
      requestInfo.status = 'completed';
      requestInfo.progress = 100;
      requestInfo.completedAt = new Date();
      requestInfo.result = result;
      this.requestMap.set(requestId, requestInfo);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      // Handle callback if specified
      if (requestInfo.request.callbackId) {
        this.handleCallback(requestInfo.tentacleId, requestInfo.request.callbackId, result);
      }
      
      this.logger.debug(`Request ${requestId} completed successfully`);
    } catch (error) {
      // Handle error
      const requestInfo = this.requestMap.get(requestId);
      
      if (requestInfo) {
        requestInfo.status = 'failed';
        requestInfo.error = error.message;
        requestInfo.completedAt = new Date();
        this.requestMap.set(requestId, requestInfo);
        
        // Handle callback with error if specified
        if (requestInfo.request.callbackId) {
          this.handleCallbackError(requestInfo.tentacleId, requestInfo.request.callbackId, error);
        }
      }
      
      this.logger.error(`Request ${requestId} failed`, error);
    } finally {
      // Remove from active requests
      this.activeRequests.delete(requestId);
    }
  }
  
  /**
   * Handles a callback to a tentacle with a result.
   * 
   * @async
   * @param {string} tentacleId - Tentacle ID
   * @param {string} callbackId - Callback ID
   * @param {Object} result - Result to send
   * @private
   */
  async handleCallback(tentacleId, callbackId, result) {
    try {
      // This would typically involve sending the result to the tentacle
      // through a callback mechanism, which would be implementation-specific.
      // For now, we'll just log it.
      this.logger.debug(`Callback to tentacle ${tentacleId} with ID ${callbackId}`, { result });
      
      // In a real implementation, this might involve:
      // 1. Looking up the tentacle's callback endpoint
      // 2. Formatting the result according to the tentacle's expectations
      // 3. Sending the result to the tentacle
      // 4. Handling any acknowledgement or error
    } catch (error) {
      this.logger.error(`Failed to handle callback to tentacle ${tentacleId}`, error);
    }
  }
  
  /**
   * Handles a callback to a tentacle with an error.
   * 
   * @async
   * @param {string} tentacleId - Tentacle ID
   * @param {string} callbackId - Callback ID
   * @param {Error} error - Error to send
   * @private
   */
  async handleCallbackError(tentacleId, callbackId, error) {
    try {
      // Similar to handleCallback, but for errors
      this.logger.debug(`Error callback to tentacle ${tentacleId} with ID ${callbackId}`, { error: error.message });
    } catch (callbackError) {
      this.logger.error(`Failed to handle error callback to tentacle ${tentacleId}`, callbackError);
    }
  }
  
  /**
   * Submits a reasoning request from a tentacle.
   * 
   * @async
   * @param {string} tentacleId - ID of the tentacle submitting the request
   * @param {ReasoningRequest} request - Reasoning request
   * @returns {Promise<string>} Request ID
   * @throws {Error} If submission fails
   */
  async submitRequest(tentacleId, request) {
    this.ensureInitialized();
    
    if (!tentacleId) {
      throw new Error('TentacleIntegrationFramework.submitRequest requires tentacleId');
    }
    
    if (!request) {
      throw new Error('TentacleIntegrationFramework.submitRequest requires request');
    }
    
    try {
      this.logger.debug(`Tentacle ${tentacleId} submitting request`, { request });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer('submitRequest');
      
      // Check if tentacle is registered
      if (!this.tentacleRegistry.has(tentacleId)) {
        throw new Error(`Tentacle ${tentacleId} is not registered`);
      }
      
      // Get tentacle information
      const tentacle = this.tentacleRegistry.get(tentacleId);
      
      // Validate request
      this.validateRequest(tentacle, request);
      
      // Apply security policies
      await this.securityManager.enforceTentacleRequestPolicy(tentacleId, request);
      
      // Generate request ID
      const requestId = uuidv4();
      
      // Create request info
      const requestInfo = {
        id: requestId,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
        tentacleId,
        requestType: request.type,
        priority: request.priority || tentacle.priority || 5,
        urgent: request.urgent || false,
        request
      };
      
      // Check queue capacity
      if (this.requestQueue.length >= this.maxQueueSize) {
        throw new Error('Request queue is full');
      }
      
      // Add to request map
      this.requestMap.set(requestId, requestInfo);
      
      // Add to queue with priority
      this.addToQueueWithPriority(requestId, requestInfo.priority, requestInfo.urgent);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      this.logger.debug(`Request ${requestId} submitted successfully`);
      return requestId;
    } catch (error) {
      this.logger.error(`Failed to submit request from tentacle ${tentacleId}`, error, { request });
      throw new Error(`Request submission failed: ${error.message}`);
    }
  }
  
  /**
   * Validates a reasoning request.
   * 
   * @param {TentacleCapabilities} tentacle - Tentacle capabilities
   * @param {ReasoningRequest} request - Reasoning request
   * @throws {Error} If request is invalid
   * @private
   */
  validateRequest(tentacle, request) {
    // Check required fields
    if (!request.type) {
      throw new Error('Request must have a type');
    }
    
    if (!request.data) {
      throw new Error('Request must have data');
    }
    
    // Check if tentacle can make this type of request
    if (!tentacle.requestTypes.includes(request.type) && !tentacle.requestTypes.includes('*')) {
      throw new Error(`Tentacle ${tentacle.id} is not authorized to make ${request.type} requests`);
    }
    
    // Validate priority if specified
    if (request.priority !== undefined) {
      if (typeof request.priority !== 'number' || request.priority < 1 || request.priority > 10) {
        throw new Error('Priority must be a number between 1 and 10');
      }
    }
    
    // Validate related request IDs if specified
    if (request.relatedRequestIds) {
      if (!Array.isArray(request.relatedRequestIds)) {
        throw new Error('relatedRequestIds must be an array');
      }
      
      for (const relatedId of request.relatedRequestIds) {
        if (!this.requestMap.has(relatedId)) {
          throw new Error(`Related request ${relatedId} not found`);
        }
      }
    }
  }
  
  /**
   * Adds a request to the queue with priority.
   * 
   * @param {string} requestId - Request ID
   * @param {number} priority - Priority level (1-10, higher is more important)
   * @param {boolean} urgent - Whether the request is urgent
   * @private
   */
  addToQueueWithPriority(requestId, priority, urgent) {
    // Find insertion index based on priority and urgency
    let insertIndex = this.requestQueue.length;
    
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedRequestId = this.requestQueue[i];
      const queuedRequest = this.requestMap.get(queuedRequestId);
      
      if (!queuedRequest) {
        continue;
      }
      
      // Urgent requests come before non-urgent
      if (urgent && !queuedRequest.urgent) {
        insertIndex = i;
        break;
      }
      
      // Within same urgency category, higher priority comes first
      if (urgent === queuedRequest.urgent && priority > queuedRequest.priority) {
        insertIndex = i;
        break;
      }
    }
    
    // Insert at the determined position
    this.requestQueue.splice(insertIndex, 0, requestId);
  }
  
  /**
   * Gets the status of a submitted request.
   * 
   * @async
   * @param {string} requestId - Request ID
   * @returns {Promise<RequestStatus>} Request status
   * @throws {Error} If request is not found or if manager is not initialized
   */
  async getRequestStatus(requestId) {
    this.ensureInitialized();
    
    if (!requestId) {
      throw new Error('TentacleIntegrationFramework.getRequestStatus requires requestId');
    }
    
    const requestInfo = this.requestMap.get(requestId);
    
    if (!requestInfo) {
      throw new Error(`Request ${requestId} not found`);
    }
    
    // Return status information (without the full request and result)
    return {
      id: requestInfo.id,
      status: requestInfo.status,
      progress: requestInfo.progress,
      createdAt: requestInfo.createdAt,
      startedAt: requestInfo.startedAt,
      completedAt: requestInfo.completedAt,
      error: requestInfo.error,
      tentacleId: requestInfo.tentacleId,
      requestType: requestInfo.requestType,
      priority: requestInfo.priority,
      urgent: requestInfo.urgent
    };
  }
  
  /**
   * Gets the result of a completed request.
   * 
   * @async
   * @param {string} requestId - Request ID
   * @returns {Promise<ReasoningResult>} Request result
   * @throws {Error} If request is not found, not completed, or if manager is not initialized
   */
  async getRequestResult(requestId) {
    this.ensureInitialized();
    
    if (!requestId) {
      throw new Error('TentacleIntegrationFramework.getRequestResult requires requestId');
    }
    
    const requestInfo = this.requestMap.get(requestId);
    
    if (!requestInfo) {
      throw new Error(`Request ${requestId} not found`);
    }
    
    if (requestInfo.status !== 'completed') {
      throw new Error(`Request ${requestId} is not completed (status: ${requestInfo.status})`);
    }
    
    if (!requestInfo.result) {
      throw new Error(`Request ${requestId} has no result`);
    }
    
    // Apply security policies to result
    const secureResult = await this.securityManager.enforceTentacleResponsePolicy(
      requestInfo.tentacleId,
      requestInfo.result
    );
    
    return secureResult;
  }
  
  /**
   * Cancels a pending request.
   * 
   * @async
   * @param {string} requestId - Request ID
   * @returns {Promise<boolean>} True if cancelled, false if already processing/completed
   * @throws {Error} If request is not found or if manager is not initialized
   */
  async cancelRequest(requestId) {
    this.ensureInitialized();
    
    if (!requestId) {
      throw new Error('TentacleIntegrationFramework.cancelRequest requires requestId');
    }
    
    const requestInfo = this.requestMap.get(requestId);
    
    if (!requestInfo) {
      throw new Error(`Request ${requestId} not found`);
    }
    
    // Can only cancel pending requests
    if (requestInfo.status !== 'pending') {
      return false;
    }
    
    // Remove from queue
    const queueIndex = this.requestQueue.indexOf(requestId);
    if (queueIndex !== -1) {
      this.requestQueue.splice(queueIndex, 1);
    }
    
    // Update status
    requestInfo.status = 'cancelled';
    requestInfo.completedAt = new Date();
    this.requestMap.set(requestId, requestInfo);
    
    this.logger.debug(`Request ${requestId} cancelled`);
    return true;
  }
  
  /**
   * Shares context between related requests.
   * 
   * @async
   * @param {string[]} requestIds - Request IDs to share context between
   * @param {Object} [contextData] - Additional context data to include
   * @returns {Promise<string>} Context ID
   * @throws {Error} If any request is not found or if manager is not initialized
   */
  async shareContext(requestIds, contextData = {}) {
    this.ensureInitialized();
    
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      throw new Error('TentacleIntegrationFramework.shareContext requires non-empty requestIds array');
    }
    
    try {
      this.logger.debug(`Sharing context between requests`, { requestIds, contextData });
      
      // Validate requests
      for (const requestId of requestIds) {
        if (!this.requestMap.has(requestId)) {
          throw new Error(`Request ${requestId} not found`);
        }
      }
      
      // Generate context ID
      const contextId = uuidv4();
      
      // Collect context data from requests
      const mergedContext = { ...contextData };
      
      for (const requestId of requestIds) {
        const requestInfo = this.requestMap.get(requestId);
        
        // Skip if no context or result
        if (!requestInfo.request.context && !requestInfo.result) {
          continue;
        }
        
        // Add request context if available
        if (requestInfo.request.context) {
          mergedContext[`request_${requestId}`] = requestInfo.request.context;
        }
        
        // Add result context if available
        if (requestInfo.result && requestInfo.result.metadata) {
          mergedContext[`result_${requestId}`] = {
            confidence: requestInfo.result.metadata.confidence,
            strategy: requestInfo.result.metadata.strategy,
            summary: requestInfo.result.metadata.summary
          };
        }
      }
      
      // Create shared context
      const sharedContext = {
        id: contextId,
        data: mergedContext,
        sourceRequestIds: [...requestIds],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiration
      };
      
      // Store shared context
      this.sharedContexts.set(contextId, sharedContext);
      
      // Register with global context manager
      await this.contextManager.registerContext(contextId, 'reasoning', sharedContext);
      
      this.logger.debug(`Created shared context ${contextId}`, { requestIds });
      return contextId;
    } catch (error) {
      this.logger.error('Failed to share context', error, { requestIds });
      throw new Error(`Context sharing failed: ${error.message}`);
    }
  }
  
  /**
   * Gets shared context for a set of requests.
   * 
   * @async
   * @param {string[]} requestIds - Request IDs
   * @returns {Promise<SharedContext|null>} Shared context or null if not found
   * @private
   */
  async getSharedContextForRequests(requestIds) {
    // Find existing shared context that includes all request IDs
    for (const [contextId, context] of this.sharedContexts.entries()) {
      const containsAll = requestIds.every(requestId => 
        context.sourceRequestIds.includes(requestId)
      );
      
      if (containsAll) {
        return context;
      }
    }
    
    // No existing context found
    return null;
  }
  
  /**
   * Gets a shared context by ID.
   * 
   * @async
   * @param {string} contextId - Context ID
   * @returns {Promise<SharedContext>} Shared context
   * @throws {Error} If context is not found or if manager is not initialized
   */
  async getSharedContext(contextId) {
    this.ensureInitialized();
    
    if (!contextId) {
      throw new Error('TentacleIntegrationFramework.getSharedContext requires contextId');
    }
    
    const context = this.sharedContexts.get(contextId);
    
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Check expiration
    if (context.expiresAt < new Date()) {
      this.sharedContexts.delete(contextId);
      throw new Error(`Context ${contextId} has expired`);
    }
    
    return context;
  }
  
  /**
   * Updates a shared context with new data.
   * 
   * @async
   * @param {string} contextId - Context ID
   * @param {Object} newData - New data to merge into context
   * @returns {Promise<SharedContext>} Updated shared context
   * @throws {Error} If context is not found or if manager is not initialized
   */
  async updateSharedContext(contextId, newData) {
    this.ensureInitialized();
    
    if (!contextId) {
      throw new Error('TentacleIntegrationFramework.updateSharedContext requires contextId');
    }
    
    if (!newData || typeof newData !== 'object') {
      throw new Error('TentacleIntegrationFramework.updateSharedContext requires newData object');
    }
    
    const context = this.sharedContexts.get(contextId);
    
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Check expiration
    if (context.expiresAt < new Date()) {
      this.sharedContexts.delete(contextId);
      throw new Error(`Context ${contextId} has expired`);
    }
    
    // Update context
    context.data = {
      ...context.data,
      ...newData
    };
    context.updatedAt = new Date();
    
    // Update in storage
    this.sharedContexts.set(contextId, context);
    
    // Update in global context manager
    await this.contextManager.updateContext(contextId, 'reasoning', context);
    
    return context;
  }
  
  /**
   * Registers a tentacle with the framework.
   * 
   * @async
   * @param {string} tentacleId - Tentacle ID
   * @param {TentacleCapabilities} capabilities - Tentacle capabilities
   * @returns {Promise<void>}
   * @throws {Error} If registration fails or if manager is not initialized
   */
  async registerTentacle(tentacleId, capabilities) {
    this.ensureInitialized();
    
    if (!tentacleId) {
      throw new Error('TentacleIntegrationFramework.registerTentacle requires tentacleId');
    }
    
    if (!capabilities) {
      throw new Error('TentacleIntegrationFramework.registerTentacle requires capabilities');
    }
    
    try {
      this.logger.debug(`Registering tentacle ${tentacleId}`, { capabilities });
      
      // Validate capabilities
      this.validateTentacleCapabilities(capabilities);
      
      // Check API version compatibility
      if (!this.isApiVersionCompatible(capabilities.apiVersion)) {
        throw new Error(`API version ${capabilities.apiVersion} is not compatible with current version ${this.currentApiVersion}`);
      }
      
      // Store tentacle information
      this.tentacleRegistry.set(tentacleId, {
        ...capabilities,
        id: tentacleId,
        registeredAt: new Date()
      });
      
      this.logger.info(`Tentacle ${tentacleId} registered successfully`);
    } catch (error) {
      this.logger.error(`Failed to register tentacle ${tentacleId}`, error, { capabilities });
      throw new Error(`Tentacle registration failed: ${error.message}`);
    }
  }
  
  /**
   * Validates tentacle capabilities.
   * 
   * @param {TentacleCapabilities} capabilities - Tentacle capabilities
   * @throws {Error} If capabilities are invalid
   * @private
   */
  validateTentacleCapabilities(capabilities) {
    // Required fields
    const requiredFields = ['id', 'name', 'requestTypes', 'version', 'apiVersion'];
    for (const field of requiredFields) {
      if (capabilities[field] === undefined) {
        throw new Error(`Missing required field in tentacle capabilities: ${field}`);
      }
    }
    
    // Validate request types
    if (!Array.isArray(capabilities.requestTypes)) {
      throw new Error('requestTypes must be an array');
    }
    
    // Validate priority if specified
    if (capabilities.priority !== undefined) {
      if (typeof capabilities.priority !== 'number' || capabilities.priority < 1 || capabilities.priority > 10) {
        throw new Error('Priority must be a number between 1 and 10');
      }
    }
  }
  
  /**
   * Checks if an API version is compatible with the current version.
   * 
   * @param {string} apiVersion - API version to check
   * @returns {boolean} True if compatible
   * @private
   */
  isApiVersionCompatible(apiVersion) {
    return this.supportedApiVersions.includes(apiVersion);
  }
  
  /**
   * Unregisters a tentacle from the framework.
   * 
   * @async
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} True if unregistered, false if not found
   * @throws {Error} If manager is not initialized
   */
  async unregisterTentacle(tentacleId) {
    this.ensureInitialized();
    
    if (!tentacleId) {
      throw new Error('TentacleIntegrationFramework.unregisterTentacle requires tentacleId');
    }
    
    if (!this.tentacleRegistry.has(tentacleId)) {
      return false;
    }
    
    // Remove from registry
    this.tentacleRegistry.delete(tentacleId);
    
    this.logger.info(`Tentacle ${tentacleId} unregistered`);
    return true;
  }
  
  /**
   * Gets information about a registered tentacle.
   * 
   * @async
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<TentacleCapabilities>} Tentacle capabilities
   * @throws {Error} If tentacle is not found or if manager is not initialized
   */
  async getTentacleInfo(tentacleId) {
    this.ensureInitialized();
    
    if (!tentacleId) {
      throw new Error('TentacleIntegrationFramework.getTentacleInfo requires tentacleId');
    }
    
    const tentacle = this.tentacleRegistry.get(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found`);
    }
    
    return { ...tentacle }; // Return a copy to prevent modification
  }
  
  /**
   * Gets a list of all registered tentacles.
   * 
   * @async
   * @returns {Promise<string[]>} Array of tentacle IDs
   * @throws {Error} If manager is not initialized
   */
  async getRegisteredTentacles() {
    this.ensureInitialized();
    return Array.from(this.tentacleRegistry.keys());
  }
  
  /**
   * Gets statistics about the framework's current state.
   * 
   * @async
   * @returns {Promise<Object>} Statistics object
   * @throws {Error} If manager is not initialized
   */
  async getStatistics() {
    this.ensureInitialized();
    
    // Count requests by status
    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };
    
    for (const requestInfo of this.requestMap.values()) {
      if (statusCounts[requestInfo.status] !== undefined) {
        statusCounts[requestInfo.status]++;
      }
    }
    
    return {
      registeredTentacles: this.tentacleRegistry.size,
      queuedRequests: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      totalRequests: this.requestMap.size,
      requestsByStatus: statusCounts,
      sharedContexts: this.sharedContexts.size,
      apiVersion: this.currentApiVersion
    };
  }
  
  /**
   * Ensures that the framework is initialized.
   * 
   * @throws {Error} If framework is not initialized
   * @private
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('TentacleIntegrationFramework is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Cleans up expired contexts and completed requests.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If manager is not initialized
   */
  async cleanup() {
    this.ensureInitialized();
    
    try {
      this.logger.debug('Starting cleanup');
      
      // Clean up expired contexts
      const now = new Date();
      for (const [contextId, context] of this.sharedContexts.entries()) {
        if (context.expiresAt < now) {
          this.sharedContexts.delete(contextId);
          this.logger.debug(`Deleted expired context ${contextId}`);
        }
      }
      
      // Clean up old completed requests (older than 24 hours)
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      for (const [requestId, requestInfo] of this.requestMap.entries()) {
        if (['completed', 'failed', 'cancelled'].includes(requestInfo.status) && 
            requestInfo.completedAt && requestInfo.completedAt < cutoff) {
          this.requestMap.delete(requestId);
          this.logger.debug(`Deleted old request ${requestId}`);
        }
      }
      
      this.logger.debug('Cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }
}

module.exports = TentacleIntegrationFramework;
