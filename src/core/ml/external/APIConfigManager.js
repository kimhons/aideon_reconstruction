/**
 * @fileoverview APIConfigManager handles the configuration and management of API keys
 * for external model providers, supporting both user-provided and default Aideon APIs.
 * 
 * @module core/ml/external/APIConfigManager
 * @requires core/utils/Logger
 */

const { EventEmitter } = require('events');
const logger = require('../../utils/Logger').getLogger('APIConfigManager');

/**
 * @class APIConfigManager
 * @extends EventEmitter
 * @description Manages API configurations for external model providers
 */
class APIConfigManager extends EventEmitter {
  /**
   * Creates an instance of APIConfigManager
   * @param {Object} options - Configuration options
   * @param {Object} options.dashboardClient - Client for interacting with the admin dashboard
   * @param {Object} options.defaultConfig - Default API configurations
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      dashboardClient: null,
      defaultConfig: {},
      ...options
    };
    
    this.isInitialized = false;
    this.providerConfigs = new Map();
    this.userProvidedConfigs = new Map();
    this.activeConfigs = new Map();
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getAPIConfig = this.getAPIConfig.bind(this);
    this.updateUserProvidedConfig = this.updateUserProvidedConfig.bind(this);
    this.useDefaultAPI = this.useDefaultAPI.bind(this);
    this.useUserProvidedAPI = this.useUserProvidedAPI.bind(this);
    this.refreshConfigs = this.refreshConfigs.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the APIConfigManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('APIConfigManager already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing APIConfigManager');
      
      // Initialize default configurations
      this.initializeDefaultConfigs();
      
      // Fetch user-provided configurations from dashboard if available
      if (this.options.dashboardClient) {
        await this.fetchUserProvidedConfigs();
      }
      
      // Set up event listeners for dashboard updates if available
      if (this.options.dashboardClient && this.options.dashboardClient.on) {
        this.options.dashboardClient.on('configUpdated', this.refreshConfigs);
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('APIConfigManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize APIConfigManager: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Initializes default API configurations
   * @private
   */
  initializeDefaultConfigs() {
    logger.debug('Initializing default API configurations');
    
    // Set up default configurations from options
    const defaultConfig = this.options.defaultConfig || {};
    
    // Initialize provider configs with defaults
    const providers = ['openai', 'anthropic', 'google', 'cohere', 'mistral'];
    
    for (const provider of providers) {
      const config = defaultConfig[provider] || {
        enabled: false,
        apiKey: null,
        baseUrl: null,
        organization: null
      };
      
      this.providerConfigs.set(provider, {
        ...config,
        provider,
        isDefault: true
      });
      
      // Set as active config by default
      this.activeConfigs.set(provider, {
        ...config,
        provider,
        isDefault: true,
        isUserProvided: false
      });
    }
    
    logger.debug(`Initialized default configurations for ${providers.length} providers`);
  }
  
  /**
   * Fetches user-provided API configurations from the dashboard
   * @async
   * @private
   * @returns {Promise<boolean>} Fetch success status
   */
  async fetchUserProvidedConfigs() {
    if (!this.options.dashboardClient) {
      logger.warn('No dashboard client provided, skipping user config fetch');
      return false;
    }
    
    try {
      logger.debug('Fetching user-provided API configurations from dashboard');
      
      const userConfigs = await this.options.dashboardClient.getUserAPIConfigs();
      
      if (!userConfigs) {
        logger.warn('No user-provided API configurations found');
        return false;
      }
      
      // Process user configurations
      for (const [provider, config] of Object.entries(userConfigs)) {
        if (config && config.enabled && config.apiKey) {
          this.userProvidedConfigs.set(provider, {
            ...config,
            provider,
            isDefault: false,
            isUserProvided: true
          });
          
          // If user has provided a config and it's enabled, use it as active
          this.activeConfigs.set(provider, {
            ...config,
            provider,
            isDefault: false,
            isUserProvided: true
          });
          
          logger.debug(`Using user-provided configuration for ${provider}`);
        }
      }
      
      logger.debug(`Fetched user-provided configurations for ${this.userProvidedConfigs.size} providers`);
      return true;
    } catch (error) {
      logger.error(`Failed to fetch user-provided configurations: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Gets the active API configuration for a provider
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   * @returns {Object|null} API configuration or null if not available
   */
  getAPIConfig(provider) {
    if (!this.isInitialized) {
      throw new Error('APIConfigManager not initialized');
    }
    
    const normalizedProvider = provider.toLowerCase();
    const config = this.activeConfigs.get(normalizedProvider);
    
    if (!config) {
      logger.warn(`No configuration found for provider: ${provider}`);
      return null;
    }
    
    if (!config.enabled) {
      logger.warn(`Provider ${provider} is disabled`);
      return null;
    }
    
    if (!config.apiKey) {
      logger.warn(`No API key available for provider: ${provider}`);
      return null;
    }
    
    return { ...config };
  }
  
  /**
   * Updates a user-provided API configuration
   * @async
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   * @param {Object} config - API configuration
   * @param {boolean} setAsActive - Whether to set this as the active configuration
   * @returns {Promise<boolean>} Update success status
   */
  async updateUserProvidedConfig(provider, config, setAsActive = true) {
    if (!this.isInitialized) {
      throw new Error('APIConfigManager not initialized');
    }
    
    try {
      const normalizedProvider = provider.toLowerCase();
      
      logger.debug(`Updating user-provided configuration for ${provider}`);
      
      // Update in dashboard if available
      if (this.options.dashboardClient && this.options.dashboardClient.updateUserAPIConfig) {
        await this.options.dashboardClient.updateUserAPIConfig(normalizedProvider, config);
      }
      
      // Update local cache
      this.userProvidedConfigs.set(normalizedProvider, {
        ...config,
        provider: normalizedProvider,
        isDefault: false,
        isUserProvided: true
      });
      
      // Set as active if requested
      if (setAsActive) {
        this.activeConfigs.set(normalizedProvider, {
          ...config,
          provider: normalizedProvider,
          isDefault: false,
          isUserProvided: true
        });
      }
      
      this.emit('configUpdated', {
        provider: normalizedProvider,
        isUserProvided: true,
        isActive: setAsActive
      });
      
      logger.debug(`User-provided configuration for ${provider} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to update user-provided configuration for ${provider}: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Sets the default API as active for a provider
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   * @returns {boolean} Success status
   */
  useDefaultAPI(provider) {
    if (!this.isInitialized) {
      throw new Error('APIConfigManager not initialized');
    }
    
    try {
      const normalizedProvider = provider.toLowerCase();
      
      logger.debug(`Setting default API as active for ${provider}`);
      
      const defaultConfig = this.providerConfigs.get(normalizedProvider);
      
      if (!defaultConfig) {
        logger.warn(`No default configuration found for provider: ${provider}`);
        return false;
      }
      
      // Set as active
      this.activeConfigs.set(normalizedProvider, {
        ...defaultConfig,
        isDefault: true,
        isUserProvided: false
      });
      
      this.emit('configUpdated', {
        provider: normalizedProvider,
        isUserProvided: false,
        isActive: true
      });
      
      logger.debug(`Default API set as active for ${provider}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set default API as active for ${provider}: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Sets the user-provided API as active for a provider
   * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
   * @returns {boolean} Success status
   */
  useUserProvidedAPI(provider) {
    if (!this.isInitialized) {
      throw new Error('APIConfigManager not initialized');
    }
    
    try {
      const normalizedProvider = provider.toLowerCase();
      
      logger.debug(`Setting user-provided API as active for ${provider}`);
      
      const userConfig = this.userProvidedConfigs.get(normalizedProvider);
      
      if (!userConfig) {
        logger.warn(`No user-provided configuration found for provider: ${provider}`);
        return false;
      }
      
      // Set as active
      this.activeConfigs.set(normalizedProvider, {
        ...userConfig,
        isDefault: false,
        isUserProvided: true
      });
      
      this.emit('configUpdated', {
        provider: normalizedProvider,
        isUserProvided: true,
        isActive: true
      });
      
      logger.debug(`User-provided API set as active for ${provider}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set user-provided API as active for ${provider}: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Refreshes API configurations from the dashboard
   * @async
   * @returns {Promise<boolean>} Refresh success status
   */
  async refreshConfigs() {
    if (!this.isInitialized) {
      throw new Error('APIConfigManager not initialized');
    }
    
    try {
      logger.debug('Refreshing API configurations');
      
      // Store current active selections
      const activeSelections = new Map();
      for (const [provider, config] of this.activeConfigs.entries()) {
        activeSelections.set(provider, config.isUserProvided);
      }
      
      // Re-initialize default configurations
      this.initializeDefaultConfigs();
      
      // Fetch user-provided configurations
      if (this.options.dashboardClient) {
        await this.fetchUserProvidedConfigs();
      }
      
      // Restore active selections
      for (const [provider, isUserProvided] of activeSelections.entries()) {
        if (isUserProvided) {
          // If user-provided was active, try to set it active again
          if (this.userProvidedConfigs.has(provider)) {
            this.useUserProvidedAPI(provider);
          } else {
            // Fall back to default if user-provided no longer exists
            this.useDefaultAPI(provider);
          }
        } else {
          // If default was active, set it active again
          this.useDefaultAPI(provider);
        }
      }
      
      this.emit('configsRefreshed');
      logger.debug('API configurations refreshed successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to refresh API configurations: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Shuts down the APIConfigManager
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('APIConfigManager not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down APIConfigManager');
      
      // Remove event listeners
      if (this.options.dashboardClient && this.options.dashboardClient.off) {
        this.options.dashboardClient.off('configUpdated', this.refreshConfigs);
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('APIConfigManager shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during APIConfigManager shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = APIConfigManager;
