/**
 * Enhanced Orchestration Tentacle - Foundation Components
 * 
 * This file implements the core foundation components for the Enhanced Orchestration Tentacle
 * as specified in Phase 0 of the implementation plan.
 */

// Base class for all EOT components
class EOTComponent {
  constructor(id, config = {}) {
    this.id = id;
    this.config = config;
    this.initialized = false;
    this.logger = new EOTLogger(id);
  }

  async initialize() {
    this.initialized = true;
    this.logger.info(`Component ${this.id} initialized`);
    return true;
  }

  async shutdown() {
    this.initialized = false;
    this.logger.info(`Component ${this.id} shutdown`);
    return true;
  }

  isInitialized() {
    return this.initialized;
  }
}

// Event bus integration for EOT components
class EOTEventBus {
  constructor(config = {}) {
    this.subscribers = new Map();
    this.logger = new EOTLogger('EventBus');
    this.aideonEventBus = config.aideonEventBus || null;
  }

  async initialize(aideonEventBus) {
    if (aideonEventBus) {
      this.aideonEventBus = aideonEventBus;
    }
    this.logger.info('EOT Event Bus initialized');
    return true;
  }

  subscribe(eventType, callback, componentId) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push({ callback, componentId });
    this.logger.debug(`Component ${componentId} subscribed to ${eventType}`);
  }

  unsubscribe(eventType, componentId) {
    if (!this.subscribers.has(eventType)) return;
    
    const subscribers = this.subscribers.get(eventType);
    const filteredSubscribers = subscribers.filter(sub => sub.componentId !== componentId);
    this.subscribers.set(eventType, filteredSubscribers);
    this.logger.debug(`Component ${componentId} unsubscribed from ${eventType}`);
  }

  async publish(eventType, payload, source) {
    this.logger.debug(`Event published: ${eventType} from ${source}`);
    
    // Handle internal subscribers
    if (this.subscribers.has(eventType)) {
      const subscribers = this.subscribers.get(eventType);
      await Promise.all(subscribers.map(sub => {
        try {
          return sub.callback(payload);
        } catch (error) {
          this.logger.error(`Error in subscriber ${sub.componentId} for event ${eventType}:`, error);
          return Promise.resolve();
        }
      }));
    }
    
    // Forward to Aideon Event Bus if available
    if (this.aideonEventBus && eventType.startsWith('eot:')) {
      try {
        await this.aideonEventBus.publish(eventType, payload);
      } catch (error) {
        this.logger.error(`Error forwarding event ${eventType} to Aideon Event Bus:`, error);
      }
    }
  }
}

// Logging utility for EOT components
class EOTLogger {
  constructor(componentId) {
    this.componentId = componentId;
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.componentId}] ${message} ${args.length ? JSON.stringify(args) : ''}`;
  }

  debug(message, ...args) {
    console.debug(this.formatMessage('DEBUG', message, ...args));
  }

  info(message, ...args) {
    console.info(this.formatMessage('INFO', message, ...args));
  }

  warn(message, ...args) {
    console.warn(this.formatMessage('WARN', message, ...args));
  }

  error(message, ...args) {
    console.error(this.formatMessage('ERROR', message, ...args));
  }
}

// Configuration manager for EOT components
class EOTConfigManager {
  constructor() {
    this.configs = new Map();
    this.logger = new EOTLogger('ConfigManager');
  }

  async initialize(defaultConfigs = {}) {
    // Load default configurations
    for (const [key, value] of Object.entries(defaultConfigs)) {
      this.configs.set(key, value);
    }
    
    this.logger.info('Configuration manager initialized');
    return true;
  }

  getConfig(key, defaultValue = null) {
    return this.configs.has(key) ? this.configs.get(key) : defaultValue;
  }

  setConfig(key, value) {
    this.configs.set(key, value);
    this.logger.debug(`Configuration updated: ${key}`);
  }

  getAllConfigs() {
    return Object.fromEntries(this.configs);
  }
}

// Integration layer with Aideon Core
class AideonCoreIntegration extends EOTComponent {
  constructor(config = {}) {
    super('AideonCoreIntegration', config);
    this.htnPlanner = null;
    this.knowledgeFramework = null;
    this.eventBus = null;
  }

  async initialize(aideonCore) {
    if (!aideonCore) {
      this.logger.error('Aideon Core not provided');
      return false;
    }

    try {
      this.htnPlanner = aideonCore.htnPlanner;
      this.knowledgeFramework = aideonCore.knowledgeFramework;
      this.eventBus = aideonCore.eventBus;
      
      this.logger.info('Aideon Core Integration initialized');
      return await super.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize Aideon Core Integration:', error);
      return false;
    }
  }

  async getHtnPlanner() {
    if (!this.isInitialized()) {
      throw new Error('Aideon Core Integration not initialized');
    }
    return this.htnPlanner;
  }

  async getKnowledgeFramework() {
    if (!this.isInitialized()) {
      throw new Error('Aideon Core Integration not initialized');
    }
    return this.knowledgeFramework;
  }

  async getEventBus() {
    if (!this.isInitialized()) {
      throw new Error('Aideon Core Integration not initialized');
    }
    return this.eventBus;
  }
}

// Main orchestration tentacle class
class EnhancedOrchestrationTentacle extends EOTComponent {
  constructor(config = {}) {
    super('EnhancedOrchestrationTentacle', config);
    this.components = new Map();
    this.eventBus = new EOTEventBus(config);
    this.configManager = new EOTConfigManager();
    this.aideonIntegration = new AideonCoreIntegration(config);
  }

  async initialize(aideonCore) {
    try {
      // Initialize configuration
      await this.configManager.initialize(this.config);
      
      // Initialize event bus
      await this.eventBus.initialize(aideonCore?.eventBus);
      
      // Initialize Aideon integration
      await this.aideonIntegration.initialize(aideonCore);
      
      // Register core components (will be implemented in subsequent phases)
      
      this.logger.info('Enhanced Orchestration Tentacle initialized');
      return await super.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Orchestration Tentacle:', error);
      return false;
    }
  }

  async registerComponent(component) {
    if (!component || !component.id) {
      throw new Error('Invalid component');
    }
    
    this.components.set(component.id, component);
    this.logger.info(`Component registered: ${component.id}`);
  }

  async getComponent(componentId) {
    if (!this.components.has(componentId)) {
      throw new Error(`Component not found: ${componentId}`);
    }
    return this.components.get(componentId);
  }

  async shutdown() {
    // Shutdown all components in reverse initialization order
    for (const component of Array.from(this.components.values()).reverse()) {
      try {
        await component.shutdown();
      } catch (error) {
        this.logger.error(`Error shutting down component ${component.id}:`, error);
      }
    }
    
    this.logger.info('Enhanced Orchestration Tentacle shutdown complete');
    return await super.shutdown();
  }
}

// Export the foundation components
module.exports = {
  EOTComponent,
  EOTEventBus,
  EOTLogger,
  EOTConfigManager,
  AideonCoreIntegration,
  EnhancedOrchestrationTentacle
};
