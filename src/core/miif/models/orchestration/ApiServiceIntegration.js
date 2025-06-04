/**
 * @fileoverview API Service Integration for the Model Integration and Intelligence Framework (MIIF)
 * Provides integration with external API-based models through admin panel configuration
 * 
 * @module src/core/miif/models/orchestration/ApiServiceIntegration
 */

const EventEmitter = require('events');
const { ModelTier, ModelModality, ModelTaskType } = require('../ModelEnums');

/**
 * API Service Integration
 * Manages integration with external API-based models through admin panel configuration
 * @extends EventEmitter
 */
class ApiServiceIntegration extends EventEmitter {
  /**
   * Create a new API Service Integration
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      enableApiServices: true,
      preferLocalModels: false,
      apiRequestTimeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.adminPanel = dependencies.adminPanel;
    
    if (!this.adminPanel) {
      throw new Error('Admin panel dependency is required for API service integration');
    }
    
    // API service configurations
    this.apiServices = new Map();
    
    // API service usage statistics
    this.apiUsageStats = new Map();
    
    this.logger.info('[ApiServiceIntegration] API Service Integration initialized');
    
    // Load API service configurations from admin panel
    this._loadApiServiceConfigurations();
  }
  
  /**
   * Load API service configurations from admin panel
   * @private
   */
  _loadApiServiceConfigurations() {
    try {
      this.logger.info('[ApiServiceIntegration] Loading API service configurations from admin panel');
      
      // This would retrieve configurations from the admin panel
      // This is a placeholder for the actual implementation
      const apiConfigurations = this.adminPanel.getApiServiceConfigurations();
      
      if (!apiConfigurations || !Array.isArray(apiConfigurations)) {
        this.logger.warn('[ApiServiceIntegration] No API service configurations found in admin panel');
        return;
      }
      
      for (const config of apiConfigurations) {
        if (config.enabled) {
          this.registerApiService(config);
        }
      }
      
      this.logger.info(`[ApiServiceIntegration] Loaded ${this.apiServices.size} API service configurations`);
    } catch (error) {
      this.logger.error(`[ApiServiceIntegration] Failed to load API service configurations: ${error.message}`);
    }
  }
  
  /**
   * Register API service
   * @param {Object} config - API service configuration
   * @param {string} config.id - Unique identifier for the API service
   * @param {string} config.name - Display name for the API service
   * @param {string} config.provider - Provider name (e.g., 'OpenAI', 'Anthropic')
   * @param {string} config.endpoint - API endpoint URL
   * @param {string} config.authType - Authentication type ('apiKey', 'oauth', etc.)
   * @param {Object} config.credentials - Credentials (stored securely in admin panel)
   * @param {Array<string>} config.supportedTasks - Supported task types
   * @param {string} config.tier - Required tier (STANDARD, PRO, ENTERPRISE)
   * @param {boolean} config.enabled - Whether the API service is enabled
   * @returns {boolean} Success status
   */
  registerApiService(config) {
    if (!config || !config.id) {
      this.logger.error('[ApiServiceIntegration] Invalid API service configuration');
      return false;
    }
    
    if (this.apiServices.has(config.id)) {
      this.logger.warn(`[ApiServiceIntegration] API service already registered: ${config.id}`);
      return false;
    }
    
    this.apiServices.set(config.id, {
      ...config,
      registeredAt: new Date()
    });
    
    this.logger.info(`[ApiServiceIntegration] Registered API service: ${config.id} (${config.name})`);
    this.emit('apiServiceRegistered', config.id, config);
    return true;
  }
  
  /**
   * Unregister API service
   * @param {string} serviceId - API service ID
   * @returns {boolean} Success status
   */
  unregisterApiService(serviceId) {
    if (!this.apiServices.has(serviceId)) {
      this.logger.warn(`[ApiServiceIntegration] API service not registered: ${serviceId}`);
      return false;
    }
    
    this.apiServices.delete(serviceId);
    this.logger.info(`[ApiServiceIntegration] Unregistered API service: ${serviceId}`);
    this.emit('apiServiceUnregistered', serviceId);
    return true;
  }
  
  /**
   * Get API service
   * @param {string} serviceId - API service ID
   * @returns {Object|null} API service configuration or null if not found
   */
  getApiService(serviceId) {
    return this.apiServices.get(serviceId) || null;
  }
  
  /**
   * Get all API services
   * @param {Object} [filter] - Filter criteria
   * @param {string} [filter.provider] - Filter by provider
   * @param {string} [filter.tier] - Filter by tier
   * @param {string} [filter.task] - Filter by supported task
   * @returns {Array<Object>} List of API services
   */
  getAllApiServices(filter = {}) {
    let services = Array.from(this.apiServices.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
    
    if (filter.provider) {
      services = services.filter(service => service.provider === filter.provider);
    }
    
    if (filter.tier) {
      services = services.filter(service => service.tier === filter.tier);
    }
    
    if (filter.task) {
      services = services.filter(service => service.supportedTasks.includes(filter.task));
    }
    
    return services;
  }
  
  /**
   * Find best API service for task
   * @param {string} task - Task type
   * @param {Object} [constraints] - Constraints
   * @param {string} [constraints.tier] - Maximum tier
   * @param {string} [constraints.provider] - Preferred provider
   * @returns {string|null} Best API service ID or null if not found
   */
  findBestApiServiceForTask(task, constraints = {}) {
    if (!Object.values(ModelTaskType).includes(task)) {
      this.logger.error(`[ApiServiceIntegration] Invalid task type: ${task}`);
      return null;
    }
    
    // Get all API services that support the task
    let candidates = this.getAllApiServices({ task });
    
    // Filter by tier
    if (constraints.tier) {
      const tierIndex = Object.values(ModelTier).indexOf(constraints.tier);
      if (tierIndex >= 0) {
        const allowedTiers = Object.values(ModelTier).slice(0, tierIndex + 1);
        candidates = candidates.filter(service => allowedTiers.includes(service.tier));
      }
    }
    
    // Filter by provider
    if (constraints.provider) {
      candidates = candidates.filter(service => service.provider === constraints.provider);
    }
    
    // Sort by priority (if available) or registration time
    candidates.sort((a, b) => {
      if (a.priority !== undefined && b.priority !== undefined) {
        return b.priority - a.priority;
      }
      return a.registeredAt - b.registeredAt;
    });
    
    return candidates.length > 0 ? candidates[0].id : null;
  }
  
  /**
   * Execute API request
   * @param {string} serviceId - API service ID
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} API response
   */
  async executeApiRequest(serviceId, params) {
    const service = this.getApiService(serviceId);
    if (!service) {
      throw new Error(`API service not found: ${serviceId}`);
    }
    
    if (!service.enabled) {
      throw new Error(`API service is disabled: ${serviceId}`);
    }
    
    this.logger.debug(`[ApiServiceIntegration] Executing API request to ${serviceId} (${service.name})`);
    
    try {
      // Get credentials from admin panel (never stored in code)
      const credentials = await this.adminPanel.getApiServiceCredentials(serviceId);
      if (!credentials) {
        throw new Error(`API credentials not found for service: ${serviceId}`);
      }
      
      // Execute API request with retry logic
      const response = await this._executeWithRetry(async () => {
        return this._executeApiRequestInternal(service, credentials, params);
      });
      
      // Update usage statistics
      this._updateApiUsageStats(serviceId, params, response);
      
      return response;
    } catch (error) {
      this.logger.error(`[ApiServiceIntegration] API request failed for ${serviceId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute API request with retry logic
   * @param {Function} requestFn - Request function
   * @returns {Promise<Object>} API response
   * @private
   */
  async _executeWithRetry(requestFn) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this._isRetryableError(error)) {
          throw error;
        }
        
        if (attempt < this.options.maxRetries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`[ApiServiceIntegration] Retrying API request in ${delay}ms (attempt ${attempt}/${this.options.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} Whether the error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors, rate limits, and 5xx errors are retryable
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      (error.status && error.status >= 500) ||
      (error.status && error.status === 429)
    );
  }
  
  /**
   * Execute API request internal implementation
   * @param {Object} service - API service configuration
   * @param {Object} credentials - API credentials
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} API response
   * @private
   */
  async _executeApiRequestInternal(service, credentials, params) {
    // This would use the appropriate API client based on the service provider
    // This is a placeholder for the actual implementation
    
    // Example implementation for a generic REST API
    const fetch = require('node-fetch');
    
    const headers = {};
    
    // Add authentication headers based on auth type
    if (service.authType === 'apiKey') {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`;
    } else if (service.authType === 'basic') {
      const base64Credentials = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${base64Credentials}`;
    }
    
    // Add content type header
    headers['Content-Type'] = 'application/json';
    
    // Execute request
    const response = await fetch(service.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      timeout: this.options.apiRequestTimeout
    });
    
    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse response
    return await response.json();
  }
  
  /**
   * Update API usage statistics
   * @param {string} serviceId - API service ID
   * @param {Object} params - Request parameters
   * @param {Object} response - API response
   * @private
   */
  _updateApiUsageStats(serviceId, params, response) {
    const now = Date.now();
    
    if (!this.apiUsageStats.has(serviceId)) {
      this.apiUsageStats.set(serviceId, {
        requestCount: 1,
        lastUsed: now,
        firstUsed: now,
        tokenUsage: this._estimateTokenUsage(params, response)
      });
    } else {
      const stats = this.apiUsageStats.get(serviceId);
      stats.requestCount++;
      stats.lastUsed = now;
      stats.tokenUsage += this._estimateTokenUsage(params, response);
    }
  }
  
  /**
   * Estimate token usage from request and response
   * @param {Object} params - Request parameters
   * @param {Object} response - API response
   * @returns {number} Estimated token usage
   * @private
   */
  _estimateTokenUsage(params, response) {
    // This would use a more accurate token counting method based on the service provider
    // This is a placeholder for the actual implementation
    
    let tokenUsage = 0;
    
    // Estimate input tokens
    if (params.prompt) {
      tokenUsage += params.prompt.length / 4; // Rough estimate
    }
    
    // Estimate output tokens
    if (response.text || response.content || response.generated_text) {
      const outputText = response.text || response.content || response.generated_text;
      tokenUsage += outputText.length / 4; // Rough estimate
    }
    
    // Use actual token usage if provided in response
    if (response.usage && response.usage.total_tokens) {
      tokenUsage = response.usage.total_tokens;
    }
    
    return tokenUsage;
  }
  
  /**
   * Get API usage statistics
   * @returns {Object} API usage statistics
   */
  getApiUsageStatistics() {
    const stats = {};
    
    for (const [serviceId, serviceStats] of this.apiUsageStats) {
      stats[serviceId] = {
        ...serviceStats,
        service: this.getApiService(serviceId)
      };
    }
    
    return stats;
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      enableApiServices: this.options.enableApiServices,
      preferLocalModels: this.options.preferLocalModels,
      registeredServices: this.apiServices.size,
      activeServices: Array.from(this.apiServices.values()).filter(service => service.enabled).length
    };
  }
}

module.exports = ApiServiceIntegration;
