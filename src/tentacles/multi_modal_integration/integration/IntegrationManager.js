/**
 * @fileoverview Integration Manager for the Multi-Modal Integration Tentacle.
 * Provides integration points with other tentacles and systems.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Integration Manager
 * Manages integration with other tentacles and systems.
 */
class IntegrationManager {
  /**
   * Creates a new IntegrationManager instance.
   * @param {Object} options - Manager options
   * @param {Object} options.tentacle - Parent tentacle
   * @param {Object} options.config - Configuration system
   * @param {Object} options.logging - Logging system
   * @param {Object} options.events - Event system
   * @param {Object} options.api - API system
   * @param {Object} options.metrics - Metrics system
   * @param {Object} options.security - Security system
   */
  constructor(options = {}) {
    this.tentacle = options.tentacle;
    this.config = options.config;
    this.logging = options.logging;
    this.events = options.events;
    this.api = options.api;
    this.metrics = options.metrics;
    this.security = options.security;
    
    // Create logger
    this.logger = this.logging ? this.logging.createLogger('multi-modal-integration:integration') : console;
    
    // Initialize integration points
    this.integrationPoints = new Map();
    
    // Initialize tentacle connections
    this.tentacleConnections = new Map();
    
    // Bind methods
    this.registerIntegrationPoint = this.registerIntegrationPoint.bind(this);
    this.unregisterIntegrationPoint = this.unregisterIntegrationPoint.bind(this);
    this.connectToTentacle = this.connectToTentacle.bind(this);
    this.disconnectFromTentacle = this.disconnectFromTentacle.bind(this);
    this.getIntegrationPoint = this.getIntegrationPoint.bind(this);
    this.listIntegrationPoints = this.listIntegrationPoints.bind(this);
    this.getTentacleConnection = this.getTentacleConnection.bind(this);
    this.notifyTentacles = this.notifyTentacles.bind(this);
  }
  
  /**
   * Initializes the integration manager.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Integration Manager');
      
      // Register default integration points
      this.registerDefaultIntegrationPoints();
      
      // Connect to known tentacles
      await this.connectToKnownTentacles();
      
      // Subscribe to tentacle events
      this.subscribeToTentacleEvents();
      
      this.logger.info('Integration Manager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Integration Manager:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the integration manager.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Integration Manager');
      
      // Disconnect from all tentacles
      for (const [tentacleId, connection] of this.tentacleConnections.entries()) {
        await this.disconnectFromTentacle(tentacleId);
      }
      
      // Clear integration points
      this.integrationPoints.clear();
      
      this.logger.info('Integration Manager shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Integration Manager:', error);
      throw error;
    }
  }
  
  /**
   * Registers default integration points.
   * @private
   */
  registerDefaultIntegrationPoints() {
    // Register input processing integration point if tentacle exists
    if (this.tentacle && typeof this.tentacle.processMultiModalInput === 'function') {
      this.registerIntegrationPoint('process', {
        name: 'Multi-Modal Processing',
        description: 'Process multi-modal inputs',
        handler: this.tentacle.processMultiModalInput.bind(this.tentacle)
      });
    }
    
    // Register output generation integration point if tentacle exists
    if (this.tentacle && typeof this.tentacle.generateMultiModalOutput === 'function') {
      this.registerIntegrationPoint('generate', {
        name: 'Multi-Modal Generation',
        description: 'Generate multi-modal outputs',
        handler: this.tentacle.generateMultiModalOutput.bind(this.tentacle)
      });
    }
    
    // Register cross-modal reasoning integration point if tentacle exists
    if (this.tentacle && typeof this.tentacle.performCrossModalReasoning === 'function') {
      this.registerIntegrationPoint('reason', {
        name: 'Cross-Modal Reasoning',
        description: 'Perform cross-modal reasoning',
        handler: this.tentacle.performCrossModalReasoning.bind(this.tentacle)
      });
    }
    
    // Register modality-specific integration points if handlers exist
    if (this.tentacle && this.tentacle.modalityHandlers) {
      for (const [modality, handler] of Object.entries(this.tentacle.modalityHandlers)) {
        if (handler && typeof handler.processInput === 'function') {
          this.registerIntegrationPoint(`${modality}:process`, {
            name: `${this.capitalizeFirstLetter(modality)} Processing`,
            description: `Process ${modality} inputs`,
            handler: handler.processInput.bind(handler)
          });
        }
        
        if (handler && typeof handler.generateOutput === 'function') {
          this.registerIntegrationPoint(`${modality}:generate`, {
            name: `${this.capitalizeFirstLetter(modality)} Generation`,
            description: `Generate ${modality} outputs`,
            handler: handler.generateOutput.bind(handler)
          });
        }
      }
    }
  }
  
  /**
   * Connects to known tentacles.
   * @private
   * @returns {Promise<void>}
   */
  async connectToKnownTentacles() {
    if (!this.config) {
      this.logger.warn('Configuration system not available, skipping tentacle connections');
      return;
    }
    
    try {
      // Get known tentacles from configuration
      const knownTentacles = this.config.get('multi-modal.integration.knownTentacles', []);
      
      // Connect to each known tentacle
      for (const tentacleId of knownTentacles) {
        await this.connectToTentacle(tentacleId);
      }
    } catch (error) {
      this.logger.error('Failed to connect to known tentacles:', error);
      throw error;
    }
  }
  
  /**
   * Subscribes to tentacle events.
   * @private
   */
  subscribeToTentacleEvents() {
    if (!this.events) {
      this.logger.warn('Event system not available, skipping event subscription');
      return;
    }
    
    // Check if subscribe method exists
    if (typeof this.events.subscribe !== 'function') {
      this.logger.warn('Event system does not support subscribe method, skipping event subscription');
      return;
    }
    
    // Subscribe to tentacle registration events
    this.events.subscribe('tentacle:registered', this.onTentacleRegistered.bind(this));
    this.events.subscribe('tentacle:unregistered', this.onTentacleUnregistered.bind(this));
    
    // Subscribe to multi-modal events
    this.events.subscribe('multi-modal:input:received', this.onMultiModalInputReceived.bind(this));
    this.events.subscribe('multi-modal:output:generated', this.onMultiModalOutputGenerated.bind(this));
  }
  
  /**
   * Registers an integration point.
   * @param {string} id - Integration point ID
   * @param {Object} integrationPoint - Integration point definition
   * @param {string} integrationPoint.name - Integration point name
   * @param {string} integrationPoint.description - Integration point description
   * @param {Function} integrationPoint.handler - Integration point handler
   * @returns {boolean} - Whether registration was successful
   */
  registerIntegrationPoint(id, integrationPoint) {
    try {
      // Validate ID
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid integration point ID');
      }
      
      // Validate integration point
      if (!integrationPoint || typeof integrationPoint !== 'object') {
        throw new Error('Invalid integration point');
      }
      
      if (!integrationPoint.name || typeof integrationPoint.name !== 'string') {
        throw new Error('Integration point must have a name');
      }
      
      if (!integrationPoint.description || typeof integrationPoint.description !== 'string') {
        throw new Error('Integration point must have a description');
      }
      
      if (!integrationPoint.handler || typeof integrationPoint.handler !== 'function') {
        throw new Error('Integration point must have a handler function');
      }
      
      // Check if integration point already exists
      if (this.integrationPoints.has(id)) {
        this.logger.warn(`Integration point '${id}' already exists, overwriting`);
      }
      
      // Register integration point
      this.integrationPoints.set(id, {
        id,
        name: integrationPoint.name,
        description: integrationPoint.description,
        handler: integrationPoint.handler,
        metadata: integrationPoint.metadata || {}
      });
      
      this.logger.info(`Registered integration point: ${id}`);
      
      // Emit event
      if (this.events && typeof this.events.emit === 'function') {
        this.events.emit('multi-modal:integration:registered', {
          id,
          name: integrationPoint.name,
          description: integrationPoint.description,
          metadata: integrationPoint.metadata || {}
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register integration point '${id}':`, error);
      return false;
    }
  }
  
  /**
   * Unregisters an integration point.
   * @param {string} id - Integration point ID
   * @returns {boolean} - Whether unregistration was successful
   */
  unregisterIntegrationPoint(id) {
    try {
      // Validate ID
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid integration point ID');
      }
      
      // Check if integration point exists
      if (!this.integrationPoints.has(id)) {
        this.logger.warn(`Integration point '${id}' does not exist`);
        return false;
      }
      
      // Get integration point
      const integrationPoint = this.integrationPoints.get(id);
      
      // Unregister integration point
      this.integrationPoints.delete(id);
      
      this.logger.info(`Unregistered integration point: ${id}`);
      
      // Emit event
      if (this.events && typeof this.events.emit === 'function') {
        this.events.emit('multi-modal:integration:unregistered', {
          id,
          name: integrationPoint.name,
          description: integrationPoint.description,
          metadata: integrationPoint.metadata || {}
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister integration point '${id}':`, error);
      return false;
    }
  }
  
  /**
   * Lists all registered integration points.
   * @returns {Array<Object>} - Array of integration points
   */
  listIntegrationPoints() {
    try {
      // Convert Map to Array
      const integrationPoints = Array.from(this.integrationPoints.values()).map(point => ({
        id: point.id,
        name: point.name,
        description: point.description,
        metadata: point.metadata || {}
      }));
      
      return integrationPoints;
    } catch (error) {
      this.logger.error('Failed to list integration points:', error);
      return [];
    }
  }
  
  /**
   * Connects to a tentacle.
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async connectToTentacle(tentacleId) {
    try {
      // Validate tentacle ID
      if (!tentacleId || typeof tentacleId !== 'string') {
        throw new Error('Invalid tentacle ID');
      }
      
      // Check if already connected
      if (this.tentacleConnections.has(tentacleId)) {
        this.logger.warn(`Already connected to tentacle: ${tentacleId}`);
        return true;
      }
      
      // Get tentacle from core
      const tentacle = this.tentacle && this.tentacle.core && typeof this.tentacle.core.getTentacle === 'function' 
        ? this.tentacle.core.getTentacle(tentacleId) 
        : null;
      
      if (!tentacle) {
        throw new Error(`Tentacle not found: ${tentacleId}`);
      }
      
      // Create connection
      const connection = {
        id: tentacleId,
        tentacle,
        integrationPoints: new Map(),
        connected: true,
        connectedAt: Date.now()
      };
      
      // Discover integration points
      if (typeof tentacle.getIntegrationPoints === 'function') {
        const integrationPoints = await tentacle.getIntegrationPoints();
        
        for (const [id, integrationPoint] of Object.entries(integrationPoints)) {
          connection.integrationPoints.set(id, integrationPoint);
        }
      }
      
      // Store connection
      this.tentacleConnections.set(tentacleId, connection);
      
      this.logger.info(`Connected to tentacle: ${tentacleId}`);
      
      // Emit event
      if (this.events && typeof this.events.emit === 'function') {
        this.events.emit('multi-modal:tentacle:connected', {
          id: tentacleId,
          integrationPoints: Array.from(connection.integrationPoints.keys())
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to tentacle '${tentacleId}':`, error);
      return false;
    }
  }
  
  /**
   * Disconnects from a tentacle.
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Whether disconnection was successful
   */
  async disconnectFromTentacle(tentacleId) {
    try {
      // Validate tentacle ID
      if (!tentacleId || typeof tentacleId !== 'string') {
        throw new Error('Invalid tentacle ID');
      }
      
      // Check if connected
      if (!this.tentacleConnections.has(tentacleId)) {
        this.logger.warn(`Not connected to tentacle: ${tentacleId}`);
        return false;
      }
      
      // Get connection
      const connection = this.tentacleConnections.get(tentacleId);
      
      // Update connection
      connection.connected = false;
      connection.disconnectedAt = Date.now();
      
      // Remove connection
      this.tentacleConnections.delete(tentacleId);
      
      this.logger.info(`Disconnected from tentacle: ${tentacleId}`);
      
      // Emit event
      if (this.events && typeof this.events.emit === 'function') {
        this.events.emit('multi-modal:tentacle:disconnected', {
          id: tentacleId
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to disconnect from tentacle '${tentacleId}':`, error);
      return false;
    }
  }
  
  /**
   * Gets an integration point.
   * @param {string} id - Integration point ID
   * @returns {Object|null} - Integration point or null if not found
   */
  getIntegrationPoint(id) {
    // Validate ID
    if (!id || typeof id !== 'string') {
      this.logger.error('Invalid integration point ID');
      return null;
    }
    
    // Check if integration point exists
    if (!this.integrationPoints.has(id)) {
      this.logger.warn(`Integration point not found: ${id}`);
      return null;
    }
    
    // Return integration point
    return this.integrationPoints.get(id);
  }
  
  /**
   * Gets a tentacle connection.
   * @param {string} tentacleId - Tentacle ID
   * @returns {Object|null} - Tentacle connection or null if not found
   */
  getTentacleConnection(tentacleId) {
    // Validate tentacle ID
    if (!tentacleId || typeof tentacleId !== 'string') {
      this.logger.error('Invalid tentacle ID');
      return null;
    }
    
    // Check if connected
    if (!this.tentacleConnections.has(tentacleId)) {
      this.logger.warn(`Not connected to tentacle: ${tentacleId}`);
      return null;
    }
    
    // Return connection
    return this.tentacleConnections.get(tentacleId);
  }
  
  /**
   * Notifies connected tentacles of an event.
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @returns {Promise<Array>} - Array of notification results
   */
  async notifyTentacles(event, data) {
    const results = [];
    
    // Validate event
    if (!event || typeof event !== 'string') {
      throw new Error('Invalid event name');
    }
    
    // Notify each connected tentacle
    for (const [tentacleId, connection] of this.tentacleConnections.entries()) {
      if (!connection.connected) {
        continue;
      }
      
      try {
        // Check if tentacle has notification handler
        if (typeof connection.tentacle.onMultiModalNotification === 'function') {
          const result = await connection.tentacle.onMultiModalNotification(event, data);
          results.push({ tentacleId, success: true, result });
        }
      } catch (error) {
        this.logger.error(`Failed to notify tentacle '${tentacleId}':`, error);
        results.push({ tentacleId, success: false, error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Handles tentacle registered event.
   * @param {Object} event - Event data
   * @private
   */
  async onTentacleRegistered(event) {
    if (!event || !event.id) {
      return;
    }
    
    this.logger.info(`Tentacle registered: ${event.id}`);
    
    // Connect to tentacle if not already connected
    if (!this.tentacleConnections.has(event.id)) {
      await this.connectToTentacle(event.id);
    }
  }
  
  /**
   * Handles tentacle unregistered event.
   * @param {Object} event - Event data
   * @private
   */
  async onTentacleUnregistered(event) {
    if (!event || !event.id) {
      return;
    }
    
    this.logger.info(`Tentacle unregistered: ${event.id}`);
    
    // Disconnect from tentacle if connected
    if (this.tentacleConnections.has(event.id)) {
      await this.disconnectFromTentacle(event.id);
    }
  }
  
  /**
   * Handles multi-modal input received event.
   * @param {Object} event - Event data
   * @private
   */
  async onMultiModalInputReceived(event) {
    if (!event || !event.input) {
      return;
    }
    
    this.logger.info('Multi-modal input received');
    
    // Notify tentacles
    await this.notifyTentacles('multi-modal:input:received', event);
  }
  
  /**
   * Handles multi-modal output generated event.
   * @param {Object} event - Event data
   * @private
   */
  async onMultiModalOutputGenerated(event) {
    if (!event || !event.output) {
      return;
    }
    
    this.logger.info('Multi-modal output generated');
    
    // Notify tentacles
    await this.notifyTentacles('multi-modal:output:generated', event);
  }
  
  /**
   * Capitalizes the first letter of a string.
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   * @private
   */
  capitalizeFirstLetter(str) {
    if (!str || typeof str !== 'string' || str.length === 0) {
      return str;
    }
    
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = IntegrationManager;
