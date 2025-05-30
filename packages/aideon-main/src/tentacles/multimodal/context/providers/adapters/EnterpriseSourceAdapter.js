/**
 * @fileoverview Base adapter for enterprise data sources.
 * 
 * This module provides a base adapter class for connecting to enterprise data sources.
 * Specific adapters for different enterprise systems will extend this base class.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base adapter for enterprise data sources.
 * @abstract
 */
class EnterpriseSourceAdapter {
  /**
   * Constructor for EnterpriseSourceAdapter.
   * @param {Object} config Adapter configuration
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.contextSecurityManager Context Security Manager instance
   */
  constructor(config, dependencies) {
    if (new.target === EnterpriseSourceAdapter) {
      throw new Error('EnterpriseSourceAdapter is an abstract class and cannot be instantiated directly');
    }
    
    // Validate config
    if (!config) {
      throw new Error('Configuration is required');
    }
    
    // Validate dependencies
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    
    const { logger, performanceMonitor, contextSecurityManager } = dependencies;
    
    if (!logger) {
      throw new Error('Logger is required');
    }
    
    if (!performanceMonitor) {
      throw new Error('Performance Monitor is required');
    }
    
    if (!contextSecurityManager) {
      throw new Error('Context Security Manager is required');
    }
    
    // Store config and dependencies
    this.config = config;
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.contextSecurityManager = contextSecurityManager;
    
    // Initialize state
    this.connected = false;
    this.authenticated = false;
    this.connectionInfo = null;
    this.lastError = null;
    this.capabilities = {
      search: false,
      taxonomyAccess: false,
      realTimeUpdates: false,
      batchOperations: false,
      userManagement: false
    };
  }
  
  /**
   * Connect to the enterprise data source.
   * @abstract
   * @param {Object} options Connection options
   * @returns {Promise<boolean>} True if connection was successful
   */
  async connect(options = {}) {
    throw new Error('Method not implemented: connect');
  }
  
  /**
   * Disconnect from the enterprise data source.
   * @abstract
   * @returns {Promise<boolean>} True if disconnection was successful
   */
  async disconnect() {
    throw new Error('Method not implemented: disconnect');
  }
  
  /**
   * Authenticate with the enterprise data source.
   * @abstract
   * @param {Object} credentials Authentication credentials
   * @returns {Promise<boolean>} True if authentication was successful
   */
  async authenticate(credentials) {
    throw new Error('Method not implemented: authenticate');
  }
  
  /**
   * Execute a query against the enterprise data source.
   * @abstract
   * @param {Object} query Query parameters
   * @param {Object} options Query options
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(query, options = {}) {
    throw new Error('Method not implemented: executeQuery');
  }
  
  /**
   * Get taxonomy/ontology information from the enterprise data source.
   * @abstract
   * @param {Object} options Taxonomy options
   * @returns {Promise<Object>} Taxonomy data
   */
  async getTaxonomy(options = {}) {
    throw new Error('Method not implemented: getTaxonomy');
  }
  
  /**
   * Get capabilities of this enterprise data source.
   * @returns {Object} Capabilities object
   */
  getCapabilities() {
    return { ...this.capabilities };
  }
  
  /**
   * Check if connected to the enterprise data source.
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connected;
  }
  
  /**
   * Check if authenticated with the enterprise data source.
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.authenticated;
  }
  
  /**
   * Get the last error that occurred.
   * @returns {Error|null} Last error or null if no error
   */
  getLastError() {
    return this.lastError;
  }
  
  /**
   * Get connection information.
   * @returns {Object|null} Connection information or null if not connected
   */
  getConnectionInfo() {
    return this.connectionInfo;
  }
  
  /**
   * Set the last error.
   * @protected
   * @param {Error} error Error to set
   */
  _setLastError(error) {
    this.lastError = error;
    this.logger.error(`Enterprise source adapter error: ${error.message}`, { error });
  }
  
  /**
   * Set connection state.
   * @protected
   * @param {boolean} connected Whether connected
   * @param {Object} connectionInfo Connection information
   */
  _setConnected(connected, connectionInfo = null) {
    this.connected = connected;
    this.connectionInfo = connectionInfo;
    
    if (connected) {
      this.logger.info('Connected to enterprise data source', { connectionInfo });
    } else {
      this.logger.info('Disconnected from enterprise data source');
      this.authenticated = false;
    }
  }
  
  /**
   * Set authentication state.
   * @protected
   * @param {boolean} authenticated Whether authenticated
   */
  _setAuthenticated(authenticated) {
    this.authenticated = authenticated;
    
    if (authenticated) {
      this.logger.info('Authenticated with enterprise data source');
    } else {
      this.logger.info('Authentication with enterprise data source ended');
    }
  }
  
  /**
   * Set adapter capabilities.
   * @protected
   * @param {Object} capabilities Capabilities object
   */
  _setCapabilities(capabilities) {
    this.capabilities = { ...this.capabilities, ...capabilities };
    this.logger.debug('Enterprise source adapter capabilities updated', { capabilities: this.capabilities });
  }
}

module.exports = EnterpriseSourceAdapter;
