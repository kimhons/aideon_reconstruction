/**
 * @fileoverview User Configuration Interface for the Aideon AI Desktop Agent.
 * 
 * This module provides a comprehensive user interface for managing LLM adapters,
 * model selection, and API key management within the Reasoning Engine.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * User Configuration Interface for the Aideon AI Desktop Agent.
 */
class UserConfigurationInterface extends EventEmitter {
  /**
   * Constructor for UserConfigurationInterface.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.credentialManager Credential manager for API keys
   * @param {Object} options.modelStrategyManager Model strategy manager
   * @param {Object} options.securityManager Security manager
   * @param {Object} options.uiFramework UI framework integration
   */
  constructor(options) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for UserConfigurationInterface');
    if (!options.logger) throw new Error('Logger is required for UserConfigurationInterface');
    if (!options.configService) throw new Error('ConfigService is required for UserConfigurationInterface');
    if (!options.credentialManager) throw new Error('CredentialManager is required for UserConfigurationInterface');
    if (!options.modelStrategyManager) throw new Error('ModelStrategyManager is required for UserConfigurationInterface');
    if (!options.securityManager) throw new Error('SecurityManager is required for UserConfigurationInterface');
    if (!options.uiFramework) throw new Error('UIFramework is required for UserConfigurationInterface');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.credentialManager = options.credentialManager;
    this.modelStrategyManager = options.modelStrategyManager;
    this.securityManager = options.securityManager;
    this.uiFramework = options.uiFramework;
    
    // Initialize state
    this.initialized = false;
    this.adapters = new Map();
    this.adapterConfigs = new Map();
    this.userPreferences = null;
    this.userTier = null;
    this.userId = null;
    this.uiComponents = new Map();
    this.eventHandlers = new Map();
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.render = this.render.bind(this);
    this.getAdapterStatus = this.getAdapterStatus.bind(this);
    this.updateAdapterStatus = this.updateAdapterStatus.bind(this);
    this.getApiKeyStatus = this.getApiKeyStatus.bind(this);
    this.saveApiKey = this.saveApiKey.bind(this);
    this.removeApiKey = this.removeApiKey.bind(this);
    this.setDefaultAdapter = this.setDefaultAdapter.bind(this);
    this.setTaskSpecificAdapter = this.setTaskSpecificAdapter.bind(this);
    this.setAdapterPreferenceOrder = this.setAdapterPreferenceOrder.bind(this);
    this.getUsageMetrics = this.getUsageMetrics.bind(this);
    this.validateApiKey = this.validateApiKey.bind(this);
    this._loadUserPreferences = this._loadUserPreferences.bind(this);
    this._saveUserPreferences = this._saveUserPreferences.bind(this);
    this._loadAdapterConfigs = this._loadAdapterConfigs.bind(this);
    this._setupEventHandlers = this._setupEventHandlers.bind(this);
    this._createUiComponents = this._createUiComponents.bind(this);
    this._handleAdapterToggle = this._handleAdapterToggle.bind(this);
    this._handleApiKeySave = this._handleApiKeySave.bind(this);
    this._handleApiKeyRemove = this._handleApiKeyRemove.bind(this);
    this._handleDefaultAdapterChange = this._handleDefaultAdapterChange.bind(this);
    this._handleTaskAdapterChange = this._handleTaskAdapterChange.bind(this);
    this._handlePreferenceOrderChange = this._handlePreferenceOrderChange.bind(this);
    this._refreshUi = this._refreshUi.bind(this);
    
    this.logger.info('UserConfigurationInterface created');
  }
  
  /**
   * Initialize the user configuration interface.
   * @param {Object} options Initialization options
   * @param {string} options.userId User ID
   * @param {string} options.userTier User subscription tier
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing UserConfigurationInterface');
      
      // Set user information
      this.userId = options.userId || 'default';
      this.userTier = options.userTier || 'core';
      
      // Load adapter configurations
      await this._loadAdapterConfigs();
      
      // Load user preferences
      await this._loadUserPreferences();
      
      // Create UI components
      this._createUiComponents();
      
      // Set up event handlers
      this._setupEventHandlers();
      
      this.initialized = true;
      this.logger.info('UserConfigurationInterface initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize UserConfigurationInterface: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Render the user configuration interface.
   * @param {Object} options Render options
   * @param {string} options.containerId Container element ID
   * @returns {Promise<boolean>} True if rendering was successful
   */
  async render(options = {}) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info('Rendering UserConfigurationInterface');
      
      const containerId = options.containerId || 'user-config-container';
      
      // Get container element
      const container = this.uiFramework.getElement(containerId);
      if (!container) {
        throw new Error(`Container element not found: ${containerId}`);
      }
      
      // Clear container
      this.uiFramework.clearElement(container);
      
      // Create main layout
      const mainLayout = this.uiFramework.createElement('div', {
        className: 'user-config-layout'
      });
      
      // Add header
      const header = this.uiFramework.createElement('div', {
        className: 'user-config-header'
      });
      
      const title = this.uiFramework.createElement('h2', {
        textContent: 'Model Configuration'
      });
      
      header.appendChild(title);
      mainLayout.appendChild(header);
      
      // Add adapter section
      const adapterSection = this.uiComponents.get('adapterSection');
      mainLayout.appendChild(adapterSection);
      
      // Add global settings section
      const globalSettingsSection = this.uiComponents.get('globalSettingsSection');
      mainLayout.appendChild(globalSettingsSection);
      
      // Add usage section
      const usageSection = this.uiComponents.get('usageSection');
      mainLayout.appendChild(usageSection);
      
      // Append main layout to container
      container.appendChild(mainLayout);
      
      // Refresh UI with current data
      await this._refreshUi();
      
      this.logger.info('UserConfigurationInterface rendered successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to render UserConfigurationInterface: ${error.message}`, { error });
      
      // Emit render error event
      this.emit('error', {
        type: 'render',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Get the status of an adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<Object>} Adapter status
   */
  async getAdapterStatus(adapterId) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Getting status for adapter: ${adapterId}`);
      
      // Get adapter from ModelStrategyManager
      const adapter = await this.modelStrategyManager.getAdapter(adapterId);
      if (!adapter) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Get adapter configuration
      const adapterConfig = this.adapterConfigs.get(adapterId) || {};
      
      // Get user preferences for this adapter
      const adapterPreferences = this.userPreferences.adapters[adapterId] || {
        enabled: true
      };
      
      // Check if adapter is available
      const available = await adapter.isAvailable();
      
      // Get adapter info
      const adapterInfo = adapter.getAdapterInfo();
      
      // Determine if adapter is enabled based on user preferences
      const enabled = adapterPreferences.enabled;
      
      // Determine if adapter is accessible based on user tier
      const accessible = this._isAdapterAccessible(adapterId, this.userTier);
      
      // Get API key status if applicable
      const apiKeyStatus = adapterConfig.requiresApiKey ? await this.getApiKeyStatus(adapterId) : null;
      
      return {
        id: adapterId,
        name: adapterInfo.name,
        provider: adapterInfo.provider,
        description: adapterInfo.description,
        version: adapterInfo.version,
        supportedModels: adapterInfo.supportedModels,
        defaultModel: adapterInfo.defaultModel,
        capabilities: adapterInfo.capabilities,
        available,
        enabled,
        accessible,
        requiresApiKey: adapterConfig.requiresApiKey || false,
        apiKeyStatus,
        metrics: adapterInfo.metrics
      };
    } catch (error) {
      this.logger.error(`Error getting adapter status: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'adapterStatus',
        message: error.message,
        error,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Update the status of an adapter.
   * @param {string} adapterId Adapter ID
   * @param {Object} status New adapter status
   * @param {boolean} status.enabled Whether the adapter is enabled
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateAdapterStatus(adapterId, status) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Updating status for adapter: ${adapterId}`, { status });
      
      // Validate user permissions
      const canUpdate = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'updateAdapterStatus',
        resource: `adapter:${adapterId}`,
        subscriptionTier: this.userTier
      });
      
      if (!canUpdate) {
        throw new Error(`User does not have permission to update adapter status: ${adapterId}`);
      }
      
      // Get current user preferences
      const adapterPreferences = this.userPreferences.adapters[adapterId] || {};
      
      // Update enabled status
      adapterPreferences.enabled = status.enabled;
      
      // Update user preferences
      this.userPreferences.adapters[adapterId] = adapterPreferences;
      
      // Save user preferences
      await this._saveUserPreferences();
      
      // Update ModelStrategyManager
      if (status.enabled) {
        await this.modelStrategyManager.enableAdapter(adapterId);
      } else {
        await this.modelStrategyManager.disableAdapter(adapterId);
      }
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit update event
      this.emit('adapterStatusUpdated', {
        adapterId,
        status
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error updating adapter status: ${error.message}`, { error, adapterId, status });
      
      // Emit error event
      this.emit('error', {
        type: 'updateAdapterStatus',
        message: error.message,
        error,
        adapterId,
        status
      });
      
      throw error;
    }
  }
  
  /**
   * Get the API key status for an adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<Object>} API key status
   */
  async getApiKeyStatus(adapterId) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Getting API key status for adapter: ${adapterId}`);
      
      // Get adapter configuration
      const adapterConfig = this.adapterConfigs.get(adapterId) || {};
      
      // Check if adapter requires API key
      if (!adapterConfig.requiresApiKey) {
        return {
          required: false,
          hasPersonalKey: false,
          hasGlobalKey: false,
          usingPersonalKey: false
        };
      }
      
      // Check if user has personal API key
      const hasPersonalKey = await this.credentialManager.hasCredential({
        userId: this.userId,
        service: adapterId,
        type: 'apiKey'
      });
      
      // Check if system has global API key
      const hasGlobalKey = await this.credentialManager.hasCredential({
        service: adapterId,
        type: 'globalApiKey'
      });
      
      // Determine which key is being used
      const usingPersonalKey = hasPersonalKey;
      
      return {
        required: true,
        hasPersonalKey,
        hasGlobalKey,
        usingPersonalKey
      };
    } catch (error) {
      this.logger.error(`Error getting API key status: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'apiKeyStatus',
        message: error.message,
        error,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Save an API key for an adapter.
   * @param {string} adapterId Adapter ID
   * @param {string} apiKey API key
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveApiKey(adapterId, apiKey) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Saving API key for adapter: ${adapterId}`);
      
      // Validate user permissions
      const canSave = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'saveApiKey',
        resource: `adapter:${adapterId}`,
        subscriptionTier: this.userTier
      });
      
      if (!canSave) {
        throw new Error(`User does not have permission to save API key for adapter: ${adapterId}`);
      }
      
      // Get adapter configuration
      const adapterConfig = this.adapterConfigs.get(adapterId) || {};
      
      // Check if adapter requires API key
      if (!adapterConfig.requiresApiKey) {
        throw new Error(`Adapter does not require API key: ${adapterId}`);
      }
      
      // Validate API key
      const isValid = await this.validateApiKey(adapterId, apiKey);
      if (!isValid) {
        throw new Error(`Invalid API key for adapter: ${adapterId}`);
      }
      
      // Save API key
      await this.credentialManager.saveCredential({
        userId: this.userId,
        service: adapterId,
        type: 'apiKey',
        credential: apiKey
      });
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit save event
      this.emit('apiKeySaved', {
        adapterId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error saving API key: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'saveApiKey',
        message: error.message,
        error,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Remove an API key for an adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeApiKey(adapterId) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Removing API key for adapter: ${adapterId}`);
      
      // Validate user permissions
      const canRemove = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'removeApiKey',
        resource: `adapter:${adapterId}`,
        subscriptionTier: this.userTier
      });
      
      if (!canRemove) {
        throw new Error(`User does not have permission to remove API key for adapter: ${adapterId}`);
      }
      
      // Get adapter configuration
      const adapterConfig = this.adapterConfigs.get(adapterId) || {};
      
      // Check if adapter requires API key
      if (!adapterConfig.requiresApiKey) {
        throw new Error(`Adapter does not require API key: ${adapterId}`);
      }
      
      // Remove API key
      await this.credentialManager.removeCredential({
        userId: this.userId,
        service: adapterId,
        type: 'apiKey'
      });
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit remove event
      this.emit('apiKeyRemoved', {
        adapterId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error removing API key: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'removeApiKey',
        message: error.message,
        error,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Set the default adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<boolean>} True if update was successful
   */
  async setDefaultAdapter(adapterId) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Setting default adapter: ${adapterId}`);
      
      // Validate user permissions
      const canUpdate = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'setDefaultAdapter',
        resource: 'modelStrategy',
        subscriptionTier: this.userTier
      });
      
      if (!canUpdate) {
        throw new Error('User does not have permission to set default adapter');
      }
      
      // Check if adapter exists and is accessible
      const adapterStatus = await this.getAdapterStatus(adapterId);
      if (!adapterStatus.accessible) {
        throw new Error(`Adapter is not accessible: ${adapterId}`);
      }
      
      // Update user preferences
      this.userPreferences.defaultAdapter = adapterId;
      
      // Save user preferences
      await this._saveUserPreferences();
      
      // Update ModelStrategyManager
      await this.modelStrategyManager.setDefaultAdapter(adapterId);
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit update event
      this.emit('defaultAdapterUpdated', {
        adapterId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting default adapter: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'setDefaultAdapter',
        message: error.message,
        error,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Set a task-specific adapter.
   * @param {string} taskType Task type
   * @param {string} adapterId Adapter ID
   * @returns {Promise<boolean>} True if update was successful
   */
  async setTaskSpecificAdapter(taskType, adapterId) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Setting task-specific adapter: ${taskType} -> ${adapterId}`);
      
      // Validate user permissions
      const canUpdate = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'setTaskSpecificAdapter',
        resource: 'modelStrategy',
        subscriptionTier: this.userTier
      });
      
      if (!canUpdate) {
        throw new Error('User does not have permission to set task-specific adapter');
      }
      
      // Check if user tier supports task-specific adapters
      if (this.userTier === 'core') {
        throw new Error('Core tier does not support task-specific adapters');
      }
      
      // Check if adapter exists and is accessible
      const adapterStatus = await this.getAdapterStatus(adapterId);
      if (!adapterStatus.accessible) {
        throw new Error(`Adapter is not accessible: ${adapterId}`);
      }
      
      // Update user preferences
      if (!this.userPreferences.taskAdapters) {
        this.userPreferences.taskAdapters = {};
      }
      
      this.userPreferences.taskAdapters[taskType] = adapterId;
      
      // Save user preferences
      await this._saveUserPreferences();
      
      // Update ModelStrategyManager
      await this.modelStrategyManager.setTaskAdapter(taskType, adapterId);
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit update event
      this.emit('taskAdapterUpdated', {
        taskType,
        adapterId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting task-specific adapter: ${error.message}`, { error, taskType, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'setTaskSpecificAdapter',
        message: error.message,
        error,
        taskType,
        adapterId
      });
      
      throw error;
    }
  }
  
  /**
   * Set the adapter preference order for failover.
   * @param {string[]} adapterIds Ordered list of adapter IDs
   * @returns {Promise<boolean>} True if update was successful
   */
  async setAdapterPreferenceOrder(adapterIds) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info('Setting adapter preference order', { adapterIds });
      
      // Validate user permissions
      const canUpdate = await this.securityManager.validatePermission({
        userId: this.userId,
        action: 'setAdapterPreferenceOrder',
        resource: 'modelStrategy',
        subscriptionTier: this.userTier
      });
      
      if (!canUpdate) {
        throw new Error('User does not have permission to set adapter preference order');
      }
      
      // Check if user tier supports adapter preference order
      if (this.userTier === 'core') {
        throw new Error('Core tier does not support adapter preference order');
      }
      
      // Validate adapter IDs
      for (const adapterId of adapterIds) {
        const adapterStatus = await this.getAdapterStatus(adapterId);
        if (!adapterStatus.accessible) {
          throw new Error(`Adapter is not accessible: ${adapterId}`);
        }
      }
      
      // Update user preferences
      this.userPreferences.adapterOrder = adapterIds;
      
      // Save user preferences
      await this._saveUserPreferences();
      
      // Update ModelStrategyManager
      await this.modelStrategyManager.setAdapterPreferenceOrder(adapterIds);
      
      // Refresh UI
      await this._refreshUi();
      
      // Emit update event
      this.emit('adapterPreferenceOrderUpdated', {
        adapterIds
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting adapter preference order: ${error.message}`, { error, adapterIds });
      
      // Emit error event
      this.emit('error', {
        type: 'setAdapterPreferenceOrder',
        message: error.message,
        error,
        adapterIds
      });
      
      throw error;
    }
  }
  
  /**
   * Get usage metrics for adapters.
   * @returns {Promise<Object>} Usage metrics
   */
  async getUsageMetrics() {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info('Getting usage metrics');
      
      // Get all adapter IDs
      const adapterIds = Array.from(this.adapterConfigs.keys());
      
      // Get metrics for each adapter
      const adapterMetrics = {};
      
      for (const adapterId of adapterIds) {
        try {
          const adapterStatus = await this.getAdapterStatus(adapterId);
          adapterMetrics[adapterId] = adapterStatus.metrics || {};
        } catch (error) {
          this.logger.warn(`Error getting metrics for adapter: ${adapterId}`, { error });
          adapterMetrics[adapterId] = {};
        }
      }
      
      // Calculate totals
      const totalRequests = Object.values(adapterMetrics).reduce(
        (total, metrics) => total + (metrics.totalRequests || 0),
        0
      );
      
      const totalTokens = Object.values(adapterMetrics).reduce(
        (total, metrics) => total + (metrics.tokenUsage?.total || 0),
        0
      );
      
      const totalCost = Object.values(adapterMetrics).reduce(
        (total, metrics) => total + (metrics.costEstimate || 0),
        0
      );
      
      return {
        adapterMetrics,
        totals: {
          requests: totalRequests,
          tokens: totalTokens,
          cost: totalCost
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Error getting usage metrics: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'getUsageMetrics',
        message: error.message,
        error
      });
      
      throw error;
    }
  }
  
  /**
   * Validate an API key for an adapter.
   * @param {string} adapterId Adapter ID
   * @param {string} apiKey API key
   * @returns {Promise<boolean>} True if API key is valid
   */
  async validateApiKey(adapterId, apiKey) {
    if (!this.initialized) {
      throw new Error('UserConfigurationInterface is not initialized');
    }
    
    try {
      this.logger.info(`Validating API key for adapter: ${adapterId}`);
      
      // Get adapter configuration
      const adapterConfig = this.adapterConfigs.get(adapterId) || {};
      
      // Check if adapter requires API key
      if (!adapterConfig.requiresApiKey) {
        throw new Error(`Adapter does not require API key: ${adapterId}`);
      }
      
      // Basic validation
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return false;
      }
      
      // Check key format based on adapter
      let isValidFormat = true;
      
      switch (adapterId) {
        case 'openai':
          isValidFormat = apiKey.startsWith('sk-') && apiKey.length > 20;
          break;
        case 'anthropic':
          isValidFormat = apiKey.startsWith('sk-ant-') && apiKey.length > 20;
          break;
        case 'google':
          isValidFormat = apiKey.length > 20;
          break;
        case 'deepseek':
          isValidFormat = apiKey.length > 20;
          break;
        case 'grok':
          isValidFormat = apiKey.length > 20;
          break;
        default:
          // Default format check
          isValidFormat = apiKey.length > 10;
      }
      
      if (!isValidFormat) {
        return false;
      }
      
      // Get adapter from ModelStrategyManager
      const adapter = await this.modelStrategyManager.getAdapter(adapterId);
      if (!adapter) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Test API key with adapter if possible
      let isValidKey = true;
      
      if (adapter.testApiKey) {
        isValidKey = await adapter.testApiKey(apiKey);
      }
      
      return isValidKey;
    } catch (error) {
      this.logger.error(`Error validating API key: ${error.message}`, { error, adapterId });
      
      // Emit error event
      this.emit('error', {
        type: 'validateApiKey',
        message: error.message,
        error,
        adapterId
      });
      
      return false;
    }
  }
  
  /**
   * Load user preferences.
   * @private
   * @returns {Promise<void>}
   */
  async _loadUserPreferences() {
    try {
      this.logger.info('Loading user preferences');
      
      // Get user preferences from ConfigService
      const preferences = await this.configService.getUserPreferences({
        userId: this.userId,
        section: 'modelConfiguration'
      });
      
      // Set default preferences if none exist
      if (!preferences) {
        this.userPreferences = {
          defaultAdapter: 'llama',
          adapters: {},
          adapterOrder: [],
          taskAdapters: {}
        };
        
        // Save default preferences
        await this._saveUserPreferences();
      } else {
        this.userPreferences = preferences;
      }
      
      this.logger.info('User preferences loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load user preferences: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Save user preferences.
   * @private
   * @returns {Promise<void>}
   */
  async _saveUserPreferences() {
    try {
      this.logger.info('Saving user preferences');
      
      // Save user preferences to ConfigService
      await this.configService.saveUserPreferences({
        userId: this.userId,
        section: 'modelConfiguration',
        preferences: this.userPreferences
      });
      
      this.logger.info('User preferences saved successfully');
    } catch (error) {
      this.logger.error(`Failed to save user preferences: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Load adapter configurations.
   * @private
   * @returns {Promise<void>}
   */
  async _loadAdapterConfigs() {
    try {
      this.logger.info('Loading adapter configurations');
      
      // Get all adapters from ModelStrategyManager
      const adapters = await this.modelStrategyManager.getAdapters();
      
      // Store adapters
      for (const adapter of adapters) {
        this.adapters.set(adapter.id, adapter);
      }
      
      // Get adapter configurations
      for (const adapterId of this.adapters.keys()) {
        const config = await this.configService.getModelConfig(adapterId);
        
        this.adapterConfigs.set(adapterId, {
          requiresApiKey: this._adapterRequiresApiKey(adapterId),
          minTier: config?.minTier || 'core',
          ...config
        });
      }
      
      this.logger.info('Adapter configurations loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load adapter configurations: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up event handlers.
   * @private
   */
  _setupEventHandlers() {
    // Adapter toggle handler
    this.eventHandlers.set('adapterToggle', this._handleAdapterToggle);
    
    // API key handlers
    this.eventHandlers.set('apiKeySave', this._handleApiKeySave);
    this.eventHandlers.set('apiKeyRemove', this._handleApiKeyRemove);
    
    // Default adapter handler
    this.eventHandlers.set('defaultAdapterChange', this._handleDefaultAdapterChange);
    
    // Task adapter handler
    this.eventHandlers.set('taskAdapterChange', this._handleTaskAdapterChange);
    
    // Preference order handler
    this.eventHandlers.set('preferenceOrderChange', this._handlePreferenceOrderChange);
  }
  
  /**
   * Create UI components.
   * @private
   */
  _createUiComponents() {
    // Create adapter section
    const adapterSection = this.uiFramework.createElement('div', {
      className: 'user-config-section adapter-section'
    });
    
    const adapterSectionTitle = this.uiFramework.createElement('h3', {
      textContent: 'Available Adapters'
    });
    
    const adapterList = this.uiFramework.createElement('div', {
      className: 'adapter-list'
    });
    
    adapterSection.appendChild(adapterSectionTitle);
    adapterSection.appendChild(adapterList);
    
    this.uiComponents.set('adapterSection', adapterSection);
    this.uiComponents.set('adapterList', adapterList);
    
    // Create global settings section
    const globalSettingsSection = this.uiFramework.createElement('div', {
      className: 'user-config-section global-settings-section'
    });
    
    const globalSettingsSectionTitle = this.uiFramework.createElement('h3', {
      textContent: 'Global Settings'
    });
    
    const defaultAdapterContainer = this.uiFramework.createElement('div', {
      className: 'default-adapter-container'
    });
    
    const defaultAdapterLabel = this.uiFramework.createElement('label', {
      textContent: 'Default Adapter:',
      htmlFor: 'default-adapter-select'
    });
    
    const defaultAdapterSelect = this.uiFramework.createElement('select', {
      id: 'default-adapter-select',
      className: 'default-adapter-select'
    });
    
    defaultAdapterContainer.appendChild(defaultAdapterLabel);
    defaultAdapterContainer.appendChild(defaultAdapterSelect);
    
    // Create task-specific adapter container (Pro/Enterprise only)
    const taskAdapterContainer = this.uiFramework.createElement('div', {
      className: 'task-adapter-container'
    });
    
    const taskAdapterTitle = this.uiFramework.createElement('h4', {
      textContent: 'Task-Specific Adapters'
    });
    
    const taskAdapterList = this.uiFramework.createElement('div', {
      className: 'task-adapter-list'
    });
    
    taskAdapterContainer.appendChild(taskAdapterTitle);
    taskAdapterContainer.appendChild(taskAdapterList);
    
    // Create adapter preference order container (Pro/Enterprise only)
    const preferenceOrderContainer = this.uiFramework.createElement('div', {
      className: 'preference-order-container'
    });
    
    const preferenceOrderTitle = this.uiFramework.createElement('h4', {
      textContent: 'Adapter Preference Order'
    });
    
    const preferenceOrderList = this.uiFramework.createElement('div', {
      className: 'preference-order-list'
    });
    
    preferenceOrderContainer.appendChild(preferenceOrderTitle);
    preferenceOrderContainer.appendChild(preferenceOrderList);
    
    // Add components to global settings section
    globalSettingsSection.appendChild(globalSettingsSectionTitle);
    globalSettingsSection.appendChild(defaultAdapterContainer);
    
    // Add Pro/Enterprise components if applicable
    if (this.userTier !== 'core') {
      globalSettingsSection.appendChild(taskAdapterContainer);
      globalSettingsSection.appendChild(preferenceOrderContainer);
    }
    
    this.uiComponents.set('globalSettingsSection', globalSettingsSection);
    this.uiComponents.set('defaultAdapterSelect', defaultAdapterSelect);
    this.uiComponents.set('taskAdapterList', taskAdapterList);
    this.uiComponents.set('preferenceOrderList', preferenceOrderList);
    
    // Create usage section
    const usageSection = this.uiFramework.createElement('div', {
      className: 'user-config-section usage-section'
    });
    
    const usageSectionTitle = this.uiFramework.createElement('h3', {
      textContent: 'Usage Metrics'
    });
    
    const usageMetricsContainer = this.uiFramework.createElement('div', {
      className: 'usage-metrics-container'
    });
    
    const dashboardLink = this.uiFramework.createElement('a', {
      textContent: 'View Detailed Performance Dashboard',
      href: '#',
      className: 'dashboard-link'
    });
    
    usageSection.appendChild(usageSectionTitle);
    usageSection.appendChild(usageMetricsContainer);
    usageSection.appendChild(dashboardLink);
    
    this.uiComponents.set('usageSection', usageSection);
    this.uiComponents.set('usageMetricsContainer', usageMetricsContainer);
  }
  
  /**
   * Handle adapter toggle event.
   * @private
   * @param {Event} event Event object
   */
  async _handleAdapterToggle(event) {
    try {
      const adapterId = event.target.dataset.adapterId;
      const enabled = event.target.checked;
      
      await this.updateAdapterStatus(adapterId, { enabled });
    } catch (error) {
      this.logger.error(`Error handling adapter toggle: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to update adapter status: ${error.message}`
      });
    }
  }
  
  /**
   * Handle API key save event.
   * @private
   * @param {Event} event Event object
   */
  async _handleApiKeySave(event) {
    try {
      const adapterId = event.target.dataset.adapterId;
      const apiKeyInput = this.uiFramework.getElement(`api-key-input-${adapterId}`);
      
      if (!apiKeyInput) {
        throw new Error(`API key input not found for adapter: ${adapterId}`);
      }
      
      const apiKey = apiKeyInput.value;
      
      await this.saveApiKey(adapterId, apiKey);
      
      // Clear input
      apiKeyInput.value = '';
      
      // Show success message
      this.uiFramework.showNotification({
        type: 'success',
        message: `API key saved successfully for ${adapterId}`
      });
    } catch (error) {
      this.logger.error(`Error handling API key save: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to save API key: ${error.message}`
      });
    }
  }
  
  /**
   * Handle API key remove event.
   * @private
   * @param {Event} event Event object
   */
  async _handleApiKeyRemove(event) {
    try {
      const adapterId = event.target.dataset.adapterId;
      
      await this.removeApiKey(adapterId);
      
      // Show success message
      this.uiFramework.showNotification({
        type: 'success',
        message: `API key removed successfully for ${adapterId}`
      });
    } catch (error) {
      this.logger.error(`Error handling API key remove: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to remove API key: ${error.message}`
      });
    }
  }
  
  /**
   * Handle default adapter change event.
   * @private
   * @param {Event} event Event object
   */
  async _handleDefaultAdapterChange(event) {
    try {
      const adapterId = event.target.value;
      
      await this.setDefaultAdapter(adapterId);
      
      // Show success message
      this.uiFramework.showNotification({
        type: 'success',
        message: `Default adapter set to ${adapterId}`
      });
    } catch (error) {
      this.logger.error(`Error handling default adapter change: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to set default adapter: ${error.message}`
      });
      
      // Reset select to current default
      const defaultAdapterSelect = this.uiComponents.get('defaultAdapterSelect');
      defaultAdapterSelect.value = this.userPreferences.defaultAdapter;
    }
  }
  
  /**
   * Handle task adapter change event.
   * @private
   * @param {Event} event Event object
   */
  async _handleTaskAdapterChange(event) {
    try {
      const taskType = event.target.dataset.taskType;
      const adapterId = event.target.value;
      
      await this.setTaskSpecificAdapter(taskType, adapterId);
      
      // Show success message
      this.uiFramework.showNotification({
        type: 'success',
        message: `Task-specific adapter set for ${taskType}`
      });
    } catch (error) {
      this.logger.error(`Error handling task adapter change: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to set task-specific adapter: ${error.message}`
      });
      
      // Reset select to current task adapter
      const taskAdapterSelect = this.uiFramework.getElement(`task-adapter-select-${event.target.dataset.taskType}`);
      taskAdapterSelect.value = this.userPreferences.taskAdapters[event.target.dataset.taskType] || '';
    }
  }
  
  /**
   * Handle preference order change event.
   * @private
   * @param {Event} event Event object
   */
  async _handlePreferenceOrderChange(event) {
    try {
      // Get updated order from UI
      const preferenceOrderList = this.uiComponents.get('preferenceOrderList');
      const adapterItems = preferenceOrderList.querySelectorAll('.adapter-order-item');
      
      const adapterIds = Array.from(adapterItems).map(item => item.dataset.adapterId);
      
      await this.setAdapterPreferenceOrder(adapterIds);
      
      // Show success message
      this.uiFramework.showNotification({
        type: 'success',
        message: 'Adapter preference order updated'
      });
    } catch (error) {
      this.logger.error(`Error handling preference order change: ${error.message}`, { error });
      
      // Show error message
      this.uiFramework.showNotification({
        type: 'error',
        message: `Failed to update adapter preference order: ${error.message}`
      });
      
      // Refresh UI to reset order
      await this._refreshUi();
    }
  }
  
  /**
   * Refresh the UI with current data.
   * @private
   * @returns {Promise<void>}
   */
  async _refreshUi() {
    try {
      this.logger.info('Refreshing UI');
      
      // Get all adapter IDs
      const adapterIds = Array.from(this.adapterConfigs.keys());
      
      // Refresh adapter list
      await this._refreshAdapterList(adapterIds);
      
      // Refresh default adapter select
      await this._refreshDefaultAdapterSelect(adapterIds);
      
      // Refresh task adapter list (Pro/Enterprise only)
      if (this.userTier !== 'core') {
        await this._refreshTaskAdapterList(adapterIds);
      }
      
      // Refresh preference order list (Pro/Enterprise only)
      if (this.userTier !== 'core') {
        await this._refreshPreferenceOrderList(adapterIds);
      }
      
      // Refresh usage metrics
      await this._refreshUsageMetrics();
      
      this.logger.info('UI refreshed successfully');
    } catch (error) {
      this.logger.error(`Failed to refresh UI: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Refresh the adapter list.
   * @private
   * @param {string[]} adapterIds Adapter IDs
   * @returns {Promise<void>}
   */
  async _refreshAdapterList(adapterIds) {
    try {
      const adapterList = this.uiComponents.get('adapterList');
      
      // Clear adapter list
      this.uiFramework.clearElement(adapterList);
      
      // Add adapters to list
      for (const adapterId of adapterIds) {
        const adapterStatus = await this.getAdapterStatus(adapterId);
        
        // Create adapter item
        const adapterItem = this.uiFramework.createElement('div', {
          className: `adapter-item ${adapterStatus.accessible ? '' : 'inaccessible'}`
        });
        
        // Create adapter header
        const adapterHeader = this.uiFramework.createElement('div', {
          className: 'adapter-header'
        });
        
        // Create adapter toggle
        const adapterToggle = this.uiFramework.createElement('input', {
          type: 'checkbox',
          id: `adapter-toggle-${adapterId}`,
          className: 'adapter-toggle',
          checked: adapterStatus.enabled,
          disabled: !adapterStatus.accessible
        });
        
        adapterToggle.dataset.adapterId = adapterId;
        adapterToggle.addEventListener('change', this.eventHandlers.get('adapterToggle'));
        
        // Create adapter name
        const adapterName = this.uiFramework.createElement('label', {
          textContent: adapterStatus.name,
          htmlFor: `adapter-toggle-${adapterId}`,
          className: 'adapter-name'
        });
        
        // Create adapter status indicator
        const adapterStatusIndicator = this.uiFramework.createElement('span', {
          className: `adapter-status-indicator ${adapterStatus.available ? 'available' : 'unavailable'}`
        });
        
        // Add elements to adapter header
        adapterHeader.appendChild(adapterToggle);
        adapterHeader.appendChild(adapterName);
        adapterHeader.appendChild(adapterStatusIndicator);
        
        // Create adapter details
        const adapterDetails = this.uiFramework.createElement('div', {
          className: 'adapter-details'
        });
        
        // Create adapter description
        const adapterDescription = this.uiFramework.createElement('p', {
          textContent: adapterStatus.description,
          className: 'adapter-description'
        });
        
        // Create adapter capabilities
        const adapterCapabilities = this.uiFramework.createElement('div', {
          className: 'adapter-capabilities'
        });
        
        // Add capabilities
        if (adapterStatus.capabilities) {
          const capabilitiesList = this.uiFramework.createElement('ul');
          
          if (adapterStatus.capabilities.strengths) {
            const strengthsItem = this.uiFramework.createElement('li');
            strengthsItem.textContent = `Strengths: ${adapterStatus.capabilities.strengths.join(', ')}`;
            capabilitiesList.appendChild(strengthsItem);
          }
          
          if (adapterStatus.capabilities.supportedTasks) {
            const tasksItem = this.uiFramework.createElement('li');
            tasksItem.textContent = `Supported Tasks: ${adapterStatus.capabilities.supportedTasks.join(', ')}`;
            capabilitiesList.appendChild(tasksItem);
          }
          
          adapterCapabilities.appendChild(capabilitiesList);
        }
        
        // Add elements to adapter details
        adapterDetails.appendChild(adapterDescription);
        adapterDetails.appendChild(adapterCapabilities);
        
        // Create API key section if applicable
        if (adapterStatus.requiresApiKey) {
          const apiKeySection = this.uiFramework.createElement('div', {
            className: 'api-key-section'
          });
          
          // Create API key status
          const apiKeyStatus = this.uiFramework.createElement('div', {
            className: 'api-key-status'
          });
          
          let statusText = 'No API Key Configured';
          let statusClass = 'no-key';
          
          if (adapterStatus.apiKeyStatus.hasPersonalKey) {
            statusText = 'Using Personal API Key';
            statusClass = 'personal-key';
          } else if (adapterStatus.apiKeyStatus.hasGlobalKey) {
            statusText = 'Using Global API Key';
            statusClass = 'global-key';
          }
          
          apiKeyStatus.textContent = statusText;
          apiKeyStatus.classList.add(statusClass);
          
          // Create API key input
          const apiKeyInput = this.uiFramework.createElement('input', {
            type: 'password',
            id: `api-key-input-${adapterId}`,
            className: 'api-key-input',
            placeholder: 'Enter API Key',
            disabled: !adapterStatus.accessible
          });
          
          // Create API key buttons
          const apiKeyButtons = this.uiFramework.createElement('div', {
            className: 'api-key-buttons'
          });
          
          // Create save button
          const saveButton = this.uiFramework.createElement('button', {
            textContent: 'Save Key',
            className: 'api-key-save-button',
            disabled: !adapterStatus.accessible
          });
          
          saveButton.dataset.adapterId = adapterId;
          saveButton.addEventListener('click', this.eventHandlers.get('apiKeySave'));
          
          // Create remove button
          const removeButton = this.uiFramework.createElement('button', {
            textContent: 'Remove Key',
            className: 'api-key-remove-button',
            disabled: !adapterStatus.accessible || !adapterStatus.apiKeyStatus.hasPersonalKey
          });
          
          removeButton.dataset.adapterId = adapterId;
          removeButton.addEventListener('click', this.eventHandlers.get('apiKeyRemove'));
          
          // Add buttons to container
          apiKeyButtons.appendChild(saveButton);
          apiKeyButtons.appendChild(removeButton);
          
          // Add elements to API key section
          apiKeySection.appendChild(apiKeyStatus);
          apiKeySection.appendChild(apiKeyInput);
          apiKeySection.appendChild(apiKeyButtons);
          
          // Add API key section to adapter details
          adapterDetails.appendChild(apiKeySection);
        }
        
        // Add elements to adapter item
        adapterItem.appendChild(adapterHeader);
        adapterItem.appendChild(adapterDetails);
        
        // Add adapter item to list
        adapterList.appendChild(adapterItem);
      }
    } catch (error) {
      this.logger.error(`Failed to refresh adapter list: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Refresh the default adapter select.
   * @private
   * @param {string[]} adapterIds Adapter IDs
   * @returns {Promise<void>}
   */
  async _refreshDefaultAdapterSelect(adapterIds) {
    try {
      const defaultAdapterSelect = this.uiComponents.get('defaultAdapterSelect');
      
      // Clear select options
      this.uiFramework.clearElement(defaultAdapterSelect);
      
      // Add options for each accessible adapter
      for (const adapterId of adapterIds) {
        const adapterStatus = await this.getAdapterStatus(adapterId);
        
        if (adapterStatus.accessible) {
          const option = this.uiFramework.createElement('option', {
            value: adapterId,
            textContent: adapterStatus.name,
            selected: adapterId === this.userPreferences.defaultAdapter
          });
          
          defaultAdapterSelect.appendChild(option);
        }
      }
      
      // Add event listener
      defaultAdapterSelect.addEventListener('change', this.eventHandlers.get('defaultAdapterChange'));
    } catch (error) {
      this.logger.error(`Failed to refresh default adapter select: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Refresh the task adapter list.
   * @private
   * @param {string[]} adapterIds Adapter IDs
   * @returns {Promise<void>}
   */
  async _refreshTaskAdapterList(adapterIds) {
    try {
      const taskAdapterList = this.uiComponents.get('taskAdapterList');
      
      // Clear task adapter list
      this.uiFramework.clearElement(taskAdapterList);
      
      // Define task types
      const taskTypes = [
        { id: 'deductive', name: 'Deductive Reasoning' },
        { id: 'inductive', name: 'Inductive Reasoning' },
        { id: 'abductive', name: 'Abductive Reasoning' },
        { id: 'analogical', name: 'Analogical Reasoning' }
      ];
      
      // Create task adapter items
      for (const taskType of taskTypes) {
        const taskAdapterItem = this.uiFramework.createElement('div', {
          className: 'task-adapter-item'
        });
        
        // Create task name
        const taskName = this.uiFramework.createElement('label', {
          textContent: taskType.name,
          htmlFor: `task-adapter-select-${taskType.id}`,
          className: 'task-name'
        });
        
        // Create task adapter select
        const taskAdapterSelect = this.uiFramework.createElement('select', {
          id: `task-adapter-select-${taskType.id}`,
          className: 'task-adapter-select'
        });
        
        taskAdapterSelect.dataset.taskType = taskType.id;
        
        // Add default option
        const defaultOption = this.uiFramework.createElement('option', {
          value: '',
          textContent: 'Use Default Adapter',
          selected: !this.userPreferences.taskAdapters || !this.userPreferences.taskAdapters[taskType.id]
        });
        
        taskAdapterSelect.appendChild(defaultOption);
        
        // Add options for each accessible adapter
        for (const adapterId of adapterIds) {
          const adapterStatus = await this.getAdapterStatus(adapterId);
          
          if (adapterStatus.accessible) {
            const option = this.uiFramework.createElement('option', {
              value: adapterId,
              textContent: adapterStatus.name,
              selected: this.userPreferences.taskAdapters && this.userPreferences.taskAdapters[taskType.id] === adapterId
            });
            
            taskAdapterSelect.appendChild(option);
          }
        }
        
        // Add event listener
        taskAdapterSelect.addEventListener('change', this.eventHandlers.get('taskAdapterChange'));
        
        // Add elements to task adapter item
        taskAdapterItem.appendChild(taskName);
        taskAdapterItem.appendChild(taskAdapterSelect);
        
        // Add task adapter item to list
        taskAdapterList.appendChild(taskAdapterItem);
      }
    } catch (error) {
      this.logger.error(`Failed to refresh task adapter list: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Refresh the preference order list.
   * @private
   * @param {string[]} adapterIds Adapter IDs
   * @returns {Promise<void>}
   */
  async _refreshPreferenceOrderList(adapterIds) {
    try {
      const preferenceOrderList = this.uiComponents.get('preferenceOrderList');
      
      // Clear preference order list
      this.uiFramework.clearElement(preferenceOrderList);
      
      // Get accessible adapters
      const accessibleAdapters = [];
      
      for (const adapterId of adapterIds) {
        const adapterStatus = await this.getAdapterStatus(adapterId);
        
        if (adapterStatus.accessible) {
          accessibleAdapters.push({
            id: adapterId,
            name: adapterStatus.name
          });
        }
      }
      
      // Sort adapters based on preference order
      const sortedAdapters = [...accessibleAdapters];
      
      if (this.userPreferences.adapterOrder && this.userPreferences.adapterOrder.length > 0) {
        sortedAdapters.sort((a, b) => {
          const aIndex = this.userPreferences.adapterOrder.indexOf(a.id);
          const bIndex = this.userPreferences.adapterOrder.indexOf(b.id);
          
          if (aIndex === -1 && bIndex === -1) {
            return 0;
          } else if (aIndex === -1) {
            return 1;
          } else if (bIndex === -1) {
            return -1;
          } else {
            return aIndex - bIndex;
          }
        });
      }
      
      // Create adapter order items
      for (const adapter of sortedAdapters) {
        const adapterOrderItem = this.uiFramework.createElement('div', {
          className: 'adapter-order-item',
          draggable: true
        });
        
        adapterOrderItem.dataset.adapterId = adapter.id;
        
        // Create adapter name
        const adapterName = this.uiFramework.createElement('span', {
          textContent: adapter.name,
          className: 'adapter-name'
        });
        
        // Create drag handle
        const dragHandle = this.uiFramework.createElement('span', {
          textContent: '≡',
          className: 'drag-handle'
        });
        
        // Add elements to adapter order item
        adapterOrderItem.appendChild(dragHandle);
        adapterOrderItem.appendChild(adapterName);
        
        // Add adapter order item to list
        preferenceOrderList.appendChild(adapterOrderItem);
      }
      
      // Set up drag and drop
      this._setupDragAndDrop(preferenceOrderList);
    } catch (error) {
      this.logger.error(`Failed to refresh preference order list: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Refresh the usage metrics.
   * @private
   * @returns {Promise<void>}
   */
  async _refreshUsageMetrics() {
    try {
      const usageMetricsContainer = this.uiComponents.get('usageMetricsContainer');
      
      // Clear usage metrics container
      this.uiFramework.clearElement(usageMetricsContainer);
      
      // Get usage metrics
      const metrics = await this.getUsageMetrics();
      
      // Create metrics summary
      const metricsSummary = this.uiFramework.createElement('div', {
        className: 'metrics-summary'
      });
      
      // Create total requests
      const totalRequests = this.uiFramework.createElement('div', {
        className: 'metric-item'
      });
      
      const totalRequestsLabel = this.uiFramework.createElement('span', {
        textContent: 'Total Requests:',
        className: 'metric-label'
      });
      
      const totalRequestsValue = this.uiFramework.createElement('span', {
        textContent: metrics.totals.requests.toLocaleString(),
        className: 'metric-value'
      });
      
      totalRequests.appendChild(totalRequestsLabel);
      totalRequests.appendChild(totalRequestsValue);
      
      // Create total tokens
      const totalTokens = this.uiFramework.createElement('div', {
        className: 'metric-item'
      });
      
      const totalTokensLabel = this.uiFramework.createElement('span', {
        textContent: 'Total Tokens:',
        className: 'metric-label'
      });
      
      const totalTokensValue = this.uiFramework.createElement('span', {
        textContent: metrics.totals.tokens.toLocaleString(),
        className: 'metric-value'
      });
      
      totalTokens.appendChild(totalTokensLabel);
      totalTokens.appendChild(totalTokensValue);
      
      // Create total cost
      const totalCost = this.uiFramework.createElement('div', {
        className: 'metric-item'
      });
      
      const totalCostLabel = this.uiFramework.createElement('span', {
        textContent: 'Estimated Cost:',
        className: 'metric-label'
      });
      
      const totalCostValue = this.uiFramework.createElement('span', {
        textContent: `$${metrics.totals.cost.toFixed(4)}`,
        className: 'metric-value'
      });
      
      totalCost.appendChild(totalCostLabel);
      totalCost.appendChild(totalCostValue);
      
      // Add metrics to summary
      metricsSummary.appendChild(totalRequests);
      metricsSummary.appendChild(totalTokens);
      metricsSummary.appendChild(totalCost);
      
      // Add metrics summary to container
      usageMetricsContainer.appendChild(metricsSummary);
      
      // Create last updated timestamp
      const lastUpdated = this.uiFramework.createElement('div', {
        className: 'last-updated'
      });
      
      lastUpdated.textContent = `Last updated: ${new Date(metrics.timestamp).toLocaleString()}`;
      
      // Add last updated to container
      usageMetricsContainer.appendChild(lastUpdated);
    } catch (error) {
      this.logger.error(`Failed to refresh usage metrics: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up drag and drop for preference order list.
   * @private
   * @param {HTMLElement} container Container element
   */
  _setupDragAndDrop(container) {
    let draggedItem = null;
    
    // Add event listeners to container
    container.addEventListener('dragstart', (event) => {
      draggedItem = event.target;
      event.target.classList.add('dragging');
    });
    
    container.addEventListener('dragend', (event) => {
      event.target.classList.remove('dragging');
      draggedItem = null;
      
      // Trigger preference order change event
      const changeEvent = new Event('change');
      container.dispatchEvent(changeEvent);
    });
    
    container.addEventListener('dragover', (event) => {
      event.preventDefault();
      
      if (!draggedItem) {
        return;
      }
      
      const items = Array.from(container.querySelectorAll('.adapter-order-item'));
      const draggedIndex = items.indexOf(draggedItem);
      
      // Find closest item
      let closestItem = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      
      items.forEach((item) => {
        if (item === draggedItem) {
          return;
        }
        
        const rect = item.getBoundingClientRect();
        const itemMiddle = rect.top + rect.height / 2;
        const distance = Math.abs(event.clientY - itemMiddle);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestItem = item;
        }
      });
      
      if (closestItem) {
        const closestIndex = items.indexOf(closestItem);
        
        if (draggedIndex < closestIndex) {
          container.insertBefore(draggedItem, closestItem.nextSibling);
        } else {
          container.insertBefore(draggedItem, closestItem);
        }
      }
    });
    
    // Add change event listener
    container.addEventListener('change', this.eventHandlers.get('preferenceOrderChange'));
  }
  
  /**
   * Check if an adapter requires an API key.
   * @private
   * @param {string} adapterId Adapter ID
   * @returns {boolean} True if adapter requires API key
   */
  _adapterRequiresApiKey(adapterId) {
    // Commercial adapters that require API keys
    const commercialAdapters = ['openai', 'anthropic', 'google', 'deepseek', 'grok'];
    
    return commercialAdapters.includes(adapterId);
  }
  
  /**
   * Check if an adapter is accessible based on user tier.
   * @private
   * @param {string} adapterId Adapter ID
   * @param {string} userTier User subscription tier
   * @returns {boolean} True if adapter is accessible
   */
  _isAdapterAccessible(adapterId, userTier) {
    const adapterConfig = this.adapterConfigs.get(adapterId) || {};
    const minTier = adapterConfig.minTier || 'core';
    
    // Define tier hierarchy
    const tiers = {
      core: 0,
      pro: 1,
      enterprise: 2
    };
    
    return tiers[userTier] >= tiers[minTier];
  }
}

module.exports = UserConfigurationInterface;
