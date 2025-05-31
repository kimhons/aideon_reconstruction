/**
 * Base class for Microsoft Office adapters in Aideon's Office Productivity Integration.
 * 
 * This class provides the foundation for all Microsoft Office application adapters,
 * including common functionality for application detection, version checking,
 * strategy selection, and integration with Aideon's Design System.
 * 
 * @class MicrosoftOfficeAdapter
 */
class MicrosoftOfficeAdapter {
  /**
   * Creates an instance of MicrosoftOfficeAdapter.
   * 
   * @param {Object} options Configuration options for the adapter
   * @param {Object} options.designSystem Reference to Aideon's Design System
   * @param {Object} options.resourceManager Reference to the ResourceManager
   * @param {Object} options.offlineCapabilityManager Reference to the OfflineCapabilityManager
   * @param {Object} options.strategyOptions Options for integration strategies
   * @param {boolean} options.preferOfflineOperation Whether to prefer offline operation when possible
   */
  constructor(options = {}) {
    this.designSystem = options.designSystem;
    this.resourceManager = options.resourceManager;
    this.offlineCapabilityManager = options.offlineCapabilityManager;
    this.strategyOptions = options.strategyOptions || {};
    this.preferOfflineOperation = options.preferOfflineOperation || false;
    
    this.strategies = {};
    this.activeStrategy = null;
    this.applicationInfo = null;
    this.isInitialized = false;
    this.subscriptionStatus = null;
    
    // Register with offline capability manager
    if (this.offlineCapabilityManager) {
      this.registerOfflineCapabilities();
    }
  }
  
  /**
   * Initializes the adapter by detecting the application, checking version,
   * and selecting the appropriate integration strategy.
   * 
   * @async
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      // Detect application and version
      this.applicationInfo = await this.detectApplication();
      
      if (!this.applicationInfo) {
        console.warn('Microsoft Office application not detected');
        return false;
      }
      
      // Check subscription status
      this.subscriptionStatus = await this.checkSubscriptionStatus();
      
      // Initialize strategies
      await this.initializeStrategies();
      
      // Select best strategy
      const selectedStrategy = await this.selectStrategy();
      if (!selectedStrategy) {
        console.warn('No suitable integration strategy found');
        return false;
      }
      
      this.activeStrategy = selectedStrategy;
      this.isInitialized = true;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Microsoft Office adapter:', error);
      return false;
    }
  }
  
  /**
   * Detects the Microsoft Office application and its version.
   * 
   * @async
   * @returns {Promise<Object|null>} Application information or null if not detected
   */
  async detectApplication() {
    // This is a base implementation that should be overridden by subclasses
    throw new Error('detectApplication must be implemented by subclasses');
  }
  
  /**
   * Checks the subscription status of Microsoft Office.
   * 
   * @async
   * @returns {Promise<Object>} Subscription status information
   */
  async checkSubscriptionStatus() {
    try {
      // Default implementation checks for Office 365 subscription
      // This should be enhanced with actual subscription detection logic
      return {
        isSubscribed: false,
        subscriptionType: 'unknown',
        expirationDate: null,
        availableFeatures: []
      };
    } catch (error) {
      console.warn('Failed to check subscription status:', error);
      return {
        isSubscribed: false,
        subscriptionType: 'unknown',
        expirationDate: null,
        availableFeatures: []
      };
    }
  }
  
  /**
   * Initializes all available integration strategies.
   * 
   * @async
   * @returns {Promise<void>}
   */
  async initializeStrategies() {
    // This is a base implementation that should be overridden by subclasses
    throw new Error('initializeStrategies must be implemented by subclasses');
  }
  
  /**
   * Selects the best integration strategy based on availability and preferences.
   * 
   * @async
   * @returns {Promise<string|null>} The name of the selected strategy or null if none available
   */
  async selectStrategy() {
    // Check if we're offline and should use file system strategy
    if (this.preferOfflineOperation || (this.offlineCapabilityManager && !this.offlineCapabilityManager.isOnline())) {
      if (this.strategies.fileSystem && await this.strategies.fileSystem.isAvailable()) {
        return 'fileSystem';
      }
    }
    
    // Try Office JS API first (modern, cross-platform)
    if (this.strategies.officeJs && await this.strategies.officeJs.isAvailable()) {
      return 'officeJs';
    }
    
    // Try COM/ActiveX next (Windows-only, powerful)
    if (this.strategies.comActiveX && await this.strategies.comActiveX.isAvailable()) {
      return 'comActiveX';
    }
    
    // Try UI Automation as fallback (less reliable but works with any version)
    if (this.strategies.uiAutomation && await this.strategies.uiAutomation.isAvailable()) {
      return 'uiAutomation';
    }
    
    // Use File System as last resort
    if (this.strategies.fileSystem && await this.strategies.fileSystem.isAvailable()) {
      return 'fileSystem';
    }
    
    return null;
  }
  
  /**
   * Registers offline capabilities with the OfflineCapabilityManager.
   * 
   * @returns {void}
   */
  registerOfflineCapabilities() {
    if (!this.offlineCapabilityManager) return;
    
    // Register basic file operations that can be performed offline
    this.offlineCapabilityManager.registerCapability(
      `${this.getApplicationName()}.open`,
      async (...args) => this.open(...args),
      { requiresNetwork: false }
    );
    
    this.offlineCapabilityManager.registerCapability(
      `${this.getApplicationName()}.save`,
      async (...args) => this.save(...args),
      { requiresNetwork: false }
    );
    
    this.offlineCapabilityManager.registerCapability(
      `${this.getApplicationName()}.close`,
      async (...args) => this.close(...args),
      { requiresNetwork: false }
    );
  }
  
  /**
   * Gets the name of the Microsoft Office application.
   * 
   * @returns {string} Application name
   */
  getApplicationName() {
    // This is a base implementation that should be overridden by subclasses
    return 'microsoftOffice';
  }
  
  /**
   * Checks if a specific feature is available based on subscription status.
   * 
   * @param {string} featureName Name of the feature to check
   * @returns {boolean} True if the feature is available
   */
  isFeatureAvailable(featureName) {
    if (!this.subscriptionStatus) return false;
    
    return this.subscriptionStatus.availableFeatures.includes(featureName);
  }
  
  /**
   * Opens a document using the active strategy.
   * 
   * @async
   * @param {string} path Path to the document
   * @param {Object} options Options for opening the document
   * @returns {Promise<Object>} Document object
   */
  async open(path, options = {}) {
    this.ensureInitialized();
    return this.strategies[this.activeStrategy].open(path, options);
  }
  
  /**
   * Saves a document using the active strategy.
   * 
   * @async
   * @param {Object} document Document object
   * @param {string} path Path to save the document
   * @param {Object} options Options for saving the document
   * @returns {Promise<boolean>} True if save was successful
   */
  async save(document, path, options = {}) {
    this.ensureInitialized();
    return this.strategies[this.activeStrategy].save(document, path, options);
  }
  
  /**
   * Closes a document using the active strategy.
   * 
   * @async
   * @param {Object} document Document object
   * @param {Object} options Options for closing the document
   * @returns {Promise<boolean>} True if close was successful
   */
  async close(document, options = {}) {
    this.ensureInitialized();
    return this.strategies[this.activeStrategy].close(document, options);
  }
  
  /**
   * Creates a new document using the active strategy.
   * 
   * @async
   * @param {Object} options Options for creating the document
   * @returns {Promise<Object>} New document object
   */
  async create(options = {}) {
    this.ensureInitialized();
    return this.strategies[this.activeStrategy].create(options);
  }
  
  /**
   * Applies a design system theme to a document.
   * 
   * @async
   * @param {Object} document Document object
   * @param {string} themeName Name of the theme to apply
   * @param {Object} options Options for applying the theme
   * @returns {Promise<boolean>} True if theme application was successful
   */
  async applyTheme(document, themeName, options = {}) {
    this.ensureInitialized();
    
    if (!this.designSystem) {
      throw new Error('Design System is not available');
    }
    
    const theme = this.designSystem.getTheme(themeName);
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }
    
    return this.strategies[this.activeStrategy].applyTheme(document, theme, options);
  }
  
  /**
   * Applies a design system component to a document.
   * 
   * @async
   * @param {Object} document Document object
   * @param {string} componentName Name of the component to apply
   * @param {Object} data Data to populate the component with
   * @param {Object} options Options for applying the component
   * @returns {Promise<boolean>} True if component application was successful
   */
  async applyComponent(document, componentName, data = {}, options = {}) {
    this.ensureInitialized();
    
    if (!this.designSystem) {
      throw new Error('Design System is not available');
    }
    
    const component = this.designSystem.getComponent(componentName);
    if (!component) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    return this.strategies[this.activeStrategy].applyComponent(document, component, data, options);
  }
  
  /**
   * Ensures that the adapter is initialized before use.
   * 
   * @throws {Error} If the adapter is not initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Microsoft Office adapter is not initialized');
    }
    
    if (!this.activeStrategy) {
      throw new Error('No active integration strategy selected');
    }
  }
  
  /**
   * Disposes of resources used by the adapter.
   * 
   * @async
   * @returns {Promise<void>}
   */
  async dispose() {
    if (this.activeStrategy && this.strategies[this.activeStrategy]) {
      await this.strategies[this.activeStrategy].dispose();
    }
    
    this.isInitialized = false;
    this.activeStrategy = null;
  }
}

module.exports = MicrosoftOfficeAdapter;
