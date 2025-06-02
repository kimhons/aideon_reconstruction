/**
 * @fileoverview DashboardClient provides an interface for interacting with the admin dashboard
 * to manage API configurations, user settings, and other administrative functions.
 * 
 * @module core/ml/external/DashboardClient
 * @requires core/utils/Logger
 */

const axios = require('axios');
const { EventEmitter } = require('events');
const logger = require('../../utils/Logger').getLogger('DashboardClient');

/**
 * @class DashboardClient
 * @extends EventEmitter
 * @description Client for interacting with the admin dashboard
 */
class DashboardClient extends EventEmitter {
  /**
   * Creates an instance of DashboardClient
   * @param {Object} options - Configuration options
   * @param {string} options.dashboardUrl - URL of the admin dashboard API
   * @param {string} options.apiKey - API key for dashboard authentication
   * @param {number} options.pollInterval - Interval for polling configuration updates (in ms)
   * @param {boolean} options.autoConnect - Whether to automatically connect on initialization
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      dashboardUrl: process.env.AIDEON_DASHBOARD_URL || 'https://admin.aideon.ai/api',
      apiKey: process.env.AIDEON_DASHBOARD_API_KEY || null,
      pollInterval: 60000, // 1 minute
      autoConnect: true,
      ...options
    };
    
    this.isInitialized = false;
    this.isConnected = false;
    this.pollTimer = null;
    this.lastConfigUpdate = null;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.getUserAPIConfigs = this.getUserAPIConfigs.bind(this);
    this.getDefaultAPIConfigs = this.getDefaultAPIConfigs.bind(this);
    this.updateUserAPIConfig = this.updateUserAPIConfig.bind(this);
    this.startPolling = this.startPolling.bind(this);
    this.stopPolling = this.stopPolling.bind(this);
    this.pollForUpdates = this.pollForUpdates.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the DashboardClient
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('DashboardClient already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing DashboardClient');
      
      // Validate required options
      if (!this.options.dashboardUrl) {
        throw new Error('Dashboard URL is required');
      }
      
      // Auto-connect if enabled
      if (this.options.autoConnect) {
        await this.connect();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('DashboardClient initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize DashboardClient: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Connects to the admin dashboard
   * @async
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    if (this.isConnected) {
      logger.warn('DashboardClient already connected');
      return true;
    }
    
    try {
      logger.info('Connecting to admin dashboard');
      
      // Test connection
      await this.makeRequest('/health');
      
      this.isConnected = true;
      this.emit('connected');
      logger.info('Connected to admin dashboard successfully');
      
      // Start polling for updates
      this.startPolling();
      
      return true;
    } catch (error) {
      logger.error(`Failed to connect to admin dashboard: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Disconnects from the admin dashboard
   * @async
   * @returns {Promise<boolean>} Disconnection success status
   */
  async disconnect() {
    if (!this.isConnected) {
      logger.warn('DashboardClient not connected');
      return true;
    }
    
    try {
      logger.info('Disconnecting from admin dashboard');
      
      // Stop polling for updates
      this.stopPolling();
      
      this.isConnected = false;
      this.emit('disconnected');
      logger.info('Disconnected from admin dashboard successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from admin dashboard: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Gets user-provided API configurations
   * @async
   * @returns {Promise<Object>} User-provided API configurations
   */
  async getUserAPIConfigs() {
    if (!this.isConnected) {
      throw new Error('DashboardClient not connected');
    }
    
    try {
      logger.debug('Fetching user-provided API configurations');
      
      const response = await this.makeRequest('/api-configs/user');
      
      if (!response || !response.data) {
        throw new Error('Invalid response from admin dashboard');
      }
      
      logger.debug('User-provided API configurations fetched successfully');
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch user-provided API configurations: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets default API configurations
   * @async
   * @returns {Promise<Object>} Default API configurations
   */
  async getDefaultAPIConfigs() {
    if (!this.isConnected) {
      throw new Error('DashboardClient not connected');
    }
    
    try {
      logger.debug('Fetching default API configurations');
      
      const response = await this.makeRequest('/api-configs/default');
      
      if (!response || !response.data) {
        throw new Error('Invalid response from admin dashboard');
      }
      
      logger.debug('Default API configurations fetched successfully');
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch default API configurations: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Updates a user-provided API configuration
   * @async
   * @param {string} provider - Provider name
   * @param {Object} config - API configuration
   * @returns {Promise<boolean>} Update success status
   */
  async updateUserAPIConfig(provider, config) {
    if (!this.isConnected) {
      throw new Error('DashboardClient not connected');
    }
    
    try {
      logger.debug(`Updating user-provided API configuration for ${provider}`);
      
      const response = await this.makeRequest(`/api-configs/user/${provider}`, 'PUT', config);
      
      if (!response || !response.data || !response.data.success) {
        throw new Error(`Failed to update user-provided API configuration for ${provider}`);
      }
      
      logger.debug(`User-provided API configuration for ${provider} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to update user-provided API configuration for ${provider}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Starts polling for configuration updates
   */
  startPolling() {
    if (this.pollTimer) {
      this.stopPolling();
    }
    
    logger.debug(`Starting polling for updates (interval: ${this.options.pollInterval}ms)`);
    
    this.pollTimer = setInterval(this.pollForUpdates, this.options.pollInterval);
    
    // Poll immediately
    this.pollForUpdates();
  }
  
  /**
   * Stops polling for configuration updates
   */
  stopPolling() {
    if (this.pollTimer) {
      logger.debug('Stopping polling for updates');
      
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  
  /**
   * Polls for configuration updates
   * @async
   * @private
   */
  async pollForUpdates() {
    if (!this.isConnected) {
      return;
    }
    
    try {
      logger.debug('Polling for configuration updates');
      
      const response = await this.makeRequest('/api-configs/updates', 'GET', null, {
        'If-Modified-Since': this.lastConfigUpdate ? new Date(this.lastConfigUpdate).toUTCString() : undefined
      });
      
      if (response.status === 304) {
        // No updates
        logger.debug('No configuration updates available');
        return;
      }
      
      if (!response || !response.data) {
        throw new Error('Invalid response from admin dashboard');
      }
      
      // Update last update timestamp
      this.lastConfigUpdate = new Date();
      
      // Emit update event
      this.emit('configUpdated', response.data);
      
      logger.debug('Configuration updates received');
    } catch (error) {
      logger.error(`Failed to poll for configuration updates: ${error.message}`, error);
    }
  }
  
  /**
   * Makes an API request to the admin dashboard
   * @async
   * @private
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
    try {
      // Prepare URL
      const url = `${this.options.dashboardUrl}${endpoint}`;
      
      // Prepare headers
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };
      
      // Add API key if available
      if (this.options.apiKey) {
        requestHeaders['X-API-Key'] = this.options.apiKey;
      }
      
      // Prepare request options
      const requestOptions = {
        method,
        url,
        headers: requestHeaders,
        timeout: 10000 // 10 seconds
      };
      
      // Add data if provided
      if (data) {
        requestOptions.data = data;
      }
      
      // Make request
      const response = await axios(requestOptions);
      
      return response;
    } catch (error) {
      // Handle Axios errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error(`API error: ${error.response.status} ${error.response.statusText}`, {
          data: error.response.data
        });
        
        throw new Error(`Dashboard API error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('API request error: No response received', {
          request: error.request
        });
        
        throw new Error('Dashboard API request error: No response received');
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error(`API request setup error: ${error.message}`, error);
        
        throw error;
      }
    }
  }
  
  /**
   * Shuts down the DashboardClient
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('DashboardClient not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down DashboardClient');
      
      // Disconnect if connected
      if (this.isConnected) {
        await this.disconnect();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('DashboardClient shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during DashboardClient shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = DashboardClient;
