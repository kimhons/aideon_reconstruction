/**
 * @fileoverview Domain Framework Registry for the Decision Intelligence Tentacle
 * 
 * This component serves as a central registry for domain-specific decision frameworks,
 * allowing dynamic loading, validation, and management of specialized frameworks.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Domain Framework Registry for managing domain-specific decision frameworks
 */
class DomainFrameworkRegistry {
  /**
   * Creates a new instance of the Domain Framework Registry
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('DomainFrameworkRegistry');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      autoDiscovery: config.autoDiscovery !== undefined ? config.autoDiscovery : true,
      validateOnLoad: config.validateOnLoad !== undefined ? config.validateOnLoad : true,
      cacheFrameworks: config.cacheFrameworks !== undefined ? config.cacheFrameworks : true,
      ...config
    };
    
    // Registry of domain frameworks
    this.frameworks = new Map();
    
    // Framework metadata
    this.metadata = new Map();
    
    // Framework versions
    this.versions = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.registerFramework = this.registerFramework.bind(this);
    this.unregisterFramework = this.unregisterFramework.bind(this);
    this.getFramework = this.getFramework.bind(this);
    this.getAllFrameworks = this.getAllFrameworks.bind(this);
    this.getFrameworkMetadata = this.getFrameworkMetadata.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Domain Framework Registry
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Domain Framework Registry');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Register built-in frameworks
      await this._registerBuiltInFrameworks();
      
      // Discover and register additional frameworks if auto-discovery is enabled
      if (this.config.autoDiscovery) {
        await this._discoverFrameworks();
      }
      
      this.initialized = true;
      this.logger.info('Domain Framework Registry initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'domainFrameworkRegistry' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('domainFrameworks');
      
      if (config) {
        this.config.autoDiscovery = config.get('autoDiscovery') !== undefined ? config.get('autoDiscovery') : this.config.autoDiscovery;
        this.config.validateOnLoad = config.get('validateOnLoad') !== undefined ? config.get('validateOnLoad') : this.config.validateOnLoad;
        this.config.cacheFrameworks = config.get('cacheFrameworks') !== undefined ? config.get('cacheFrameworks') : this.config.cacheFrameworks;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Registers built-in domain frameworks
   * @private
   * @returns {Promise<void>} A promise that resolves when built-in frameworks are registered
   */
  async _registerBuiltInFrameworks() {
    this.logger.info('Registering built-in domain frameworks');
    
    try {
      // Import built-in frameworks
      const { FinancialDecisionFramework } = require('./frameworks/FinancialDecisionFramework');
      const { HealthcareDecisionFramework } = require('./frameworks/HealthcareDecisionFramework');
      const { ProjectManagementFramework } = require('./frameworks/ProjectManagementFramework');
      
      // Register financial framework
      await this.registerFramework('financial', new FinancialDecisionFramework(this.aideon), {
        name: 'Financial Decision Framework',
        description: 'Framework for financial decisions with risk analysis and portfolio optimization',
        version: '1.0.0',
        author: 'Aideon',
        category: 'finance',
        tags: ['finance', 'investment', 'risk', 'portfolio']
      });
      
      // Register healthcare framework
      await this.registerFramework('healthcare', new HealthcareDecisionFramework(this.aideon), {
        name: 'Healthcare Decision Framework',
        description: 'Framework for healthcare decisions with clinical evidence analysis',
        version: '1.0.0',
        author: 'Aideon',
        category: 'healthcare',
        tags: ['healthcare', 'clinical', 'medical', 'evidence-based']
      });
      
      // Register project management framework
      await this.registerFramework('project-management', new ProjectManagementFramework(this.aideon), {
        name: 'Project Management Framework',
        description: 'Framework for project management decisions with resource allocation and risk management',
        version: '1.0.0',
        author: 'Aideon',
        category: 'project-management',
        tags: ['project', 'management', 'resource', 'schedule', 'risk']
      });
      
      this.logger.info('Built-in domain frameworks registered successfully');
    } catch (error) {
      this.logger.error('Failed to register built-in frameworks', error);
      // Continue initialization even if built-in frameworks fail to register
    }
  }
  
  /**
   * Discovers and registers additional frameworks
   * @private
   * @returns {Promise<void>} A promise that resolves when frameworks are discovered and registered
   */
  async _discoverFrameworks() {
    this.logger.info('Discovering additional domain frameworks');
    
    try {
      if (!this.aideon || !this.aideon.plugins) {
        this.logger.warn('Plugin system not available, skipping framework discovery');
        return;
      }
      
      // Get domain framework plugins
      const frameworkPlugins = await this.aideon.plugins.getByType('domain-framework');
      
      if (!frameworkPlugins || frameworkPlugins.length === 0) {
        this.logger.info('No additional domain frameworks found');
        return;
      }
      
      // Register each framework plugin
      for (const plugin of frameworkPlugins) {
        try {
          // Load framework
          const framework = await plugin.load();
          
          // Register framework
          await this.registerFramework(plugin.id, framework, {
            name: plugin.name,
            description: plugin.description,
            version: plugin.version,
            author: plugin.author,
            category: plugin.category,
            tags: plugin.tags
          });
          
          this.logger.info(`Discovered and registered framework: ${plugin.id}`);
        } catch (error) {
          this.logger.error(`Failed to load framework plugin: ${plugin.id}`, error);
          // Continue with other plugins even if one fails
        }
      }
      
      this.logger.info(`Discovered and registered ${frameworkPlugins.length} additional frameworks`);
    } catch (error) {
      this.logger.error('Framework discovery failed', error);
      // Continue initialization even if discovery fails
    }
  }
  
  /**
   * Validates a domain framework
   * @private
   * @param {string} id The framework ID
   * @param {Object} framework The framework to validate
   * @returns {boolean} Whether the framework is valid
   */
  _validateFramework(id, framework) {
    this.logger.info(`Validating framework: ${id}`);
    
    try {
      // Check for required methods
      const requiredMethods = [
        'initialize',
        'shutdown',
        'evaluateOptions',
        'getStatus'
      ];
      
      for (const method of requiredMethods) {
        if (typeof framework[method] !== 'function') {
          this.logger.error(`Framework ${id} is missing required method: ${method}`);
          return false;
        }
      }
      
      // Check for required properties
      const requiredProperties = [
        'id',
        'name',
        'version'
      ];
      
      for (const property of requiredProperties) {
        if (!framework[property]) {
          this.logger.error(`Framework ${id} is missing required property: ${property}`);
          return false;
        }
      }
      
      // Validate framework ID matches
      if (framework.id !== id) {
        this.logger.error(`Framework ID mismatch: expected ${id}, got ${framework.id}`);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Framework validation failed: ${id}`, error);
      return false;
    }
  }
  
  /**
   * Shuts down the Domain Framework Registry
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Domain Framework Registry');
    
    try {
      // Shut down all registered frameworks
      for (const [id, framework] of this.frameworks.entries()) {
        try {
          await framework.shutdown();
          this.logger.info(`Framework shut down: ${id}`);
        } catch (error) {
          this.logger.error(`Failed to shut down framework: ${id}`, error);
          // Continue shutting down other frameworks even if one fails
        }
      }
      
      // Clear registry
      this.frameworks.clear();
      this.metadata.clear();
      this.versions.clear();
      
      this.initialized = false;
      this.logger.info('Domain Framework Registry shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'domainFrameworkRegistry' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Domain Framework Registry
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      frameworkCount: this.frameworks.size,
      registeredFrameworks: Array.from(this.frameworks.keys())
    };
  }
  
  /**
   * Registers a domain framework
   * @param {string} id The framework ID
   * @param {Object} framework The framework to register
   * @param {Object} metadata Framework metadata
   * @returns {Promise<boolean>} A promise that resolves with the registration result
   */
  async registerFramework(id, framework, metadata = {}) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!id) {
      throw new Error('Framework ID is required');
    }
    
    if (!framework) {
      throw new Error('Framework is required');
    }
    
    this.logger.info(`Registering framework: ${id}`);
    
    try {
      // Check if framework already exists
      if (this.frameworks.has(id)) {
        this.logger.warn(`Framework already registered: ${id}`);
        return false;
      }
      
      // Validate framework if validation is enabled
      if (this.config.validateOnLoad && !this._validateFramework(id, framework)) {
        this.logger.error(`Framework validation failed: ${id}`);
        return false;
      }
      
      // Initialize framework
      await framework.initialize();
      
      // Register framework
      this.frameworks.set(id, framework);
      
      // Store metadata
      this.metadata.set(id, {
        name: metadata.name || framework.name || id,
        description: metadata.description || framework.description || '',
        version: metadata.version || framework.version || '1.0.0',
        author: metadata.author || framework.author || 'Unknown',
        category: metadata.category || framework.category || 'general',
        tags: metadata.tags || framework.tags || [],
        registeredAt: Date.now()
      });
      
      // Store version
      this.versions.set(id, metadata.version || framework.version || '1.0.0');
      
      // Emit framework registered event
      this.events.emit('framework:registered', {
        id,
        name: this.metadata.get(id).name,
        version: this.versions.get(id),
        timestamp: Date.now()
      });
      
      this.logger.info(`Framework registered successfully: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Framework registration failed: ${id}`, error);
      return false;
    }
  }
  
  /**
   * Unregisters a domain framework
   * @param {string} id The framework ID
   * @returns {Promise<boolean>} A promise that resolves with the unregistration result
   */
  async unregisterFramework(id) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!id) {
      throw new Error('Framework ID is required');
    }
    
    this.logger.info(`Unregistering framework: ${id}`);
    
    try {
      // Check if framework exists
      if (!this.frameworks.has(id)) {
        this.logger.warn(`Framework not registered: ${id}`);
        return false;
      }
      
      // Get framework
      const framework = this.frameworks.get(id);
      
      // Shut down framework
      await framework.shutdown();
      
      // Unregister framework
      this.frameworks.delete(id);
      this.metadata.delete(id);
      this.versions.delete(id);
      
      // Emit framework unregistered event
      this.events.emit('framework:unregistered', {
        id,
        timestamp: Date.now()
      });
      
      this.logger.info(`Framework unregistered successfully: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Framework unregistration failed: ${id}`, error);
      return false;
    }
  }
  
  /**
   * Gets a domain framework by ID
   * @param {string} id The framework ID
   * @returns {Object|null} The framework or null if not found
   */
  getFramework(id) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!id) {
      throw new Error('Framework ID is required');
    }
    
    return this.frameworks.get(id) || null;
  }
  
  /**
   * Gets all registered domain frameworks
   * @returns {Array<Object>} Array of framework information
   */
  getAllFrameworks() {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    const frameworks = [];
    
    for (const [id, framework] of this.frameworks.entries()) {
      frameworks.push({
        id,
        framework,
        metadata: this.metadata.get(id),
        version: this.versions.get(id)
      });
    }
    
    return frameworks;
  }
  
  /**
   * Gets metadata for a domain framework
   * @param {string} id The framework ID
   * @returns {Object|null} The framework metadata or null if not found
   */
  getFrameworkMetadata(id) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!id) {
      throw new Error('Framework ID is required');
    }
    
    return this.metadata.get(id) || null;
  }
  
  /**
   * Gets a framework by category
   * @param {string} category The framework category
   * @returns {Array<Object>} Array of frameworks in the category
   */
  getFrameworksByCategory(category) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!category) {
      throw new Error('Category is required');
    }
    
    const frameworks = [];
    
    for (const [id, metadata] of this.metadata.entries()) {
      if (metadata.category === category) {
        frameworks.push({
          id,
          framework: this.frameworks.get(id),
          metadata,
          version: this.versions.get(id)
        });
      }
    }
    
    return frameworks;
  }
  
  /**
   * Gets frameworks by tag
   * @param {string} tag The framework tag
   * @returns {Array<Object>} Array of frameworks with the tag
   */
  getFrameworksByTag(tag) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!tag) {
      throw new Error('Tag is required');
    }
    
    const frameworks = [];
    
    for (const [id, metadata] of this.metadata.entries()) {
      if (metadata.tags && metadata.tags.includes(tag)) {
        frameworks.push({
          id,
          framework: this.frameworks.get(id),
          metadata,
          version: this.versions.get(id)
        });
      }
    }
    
    return frameworks;
  }
  
  /**
   * Finds the most appropriate framework for a decision context
   * @param {Object} context The decision context
   * @returns {Object|null} The most appropriate framework or null if none found
   */
  findFrameworkForContext(context) {
    if (!this.initialized) {
      throw new Error('Domain Framework Registry not initialized');
    }
    
    if (!context) {
      throw new Error('Context is required');
    }
    
    this.logger.info('Finding framework for context');
    
    try {
      // If context specifies a framework ID, use that
      if (context.frameworkId && this.frameworks.has(context.frameworkId)) {
        return {
          id: context.frameworkId,
          framework: this.frameworks.get(context.frameworkId),
          metadata: this.metadata.get(context.frameworkId),
          version: this.versions.get(context.frameworkId),
          confidence: 1.0
        };
      }
      
      // If context specifies a category, find frameworks in that category
      if (context.category) {
        const categoryFrameworks = this.getFrameworksByCategory(context.category);
        
        if (categoryFrameworks.length > 0) {
          // Return the first framework in the category
          return {
            ...categoryFrameworks[0],
            confidence: 0.9
          };
        }
      }
      
      // If context specifies tags, find frameworks with those tags
      if (context.tags && context.tags.length > 0) {
        const tagMatches = new Map();
        
        // Count tag matches for each framework
        for (const tag of context.tags) {
          const tagFrameworks = this.getFrameworksByTag(tag);
          
          for (const framework of tagFrameworks) {
            const count = tagMatches.get(framework.id) || 0;
            tagMatches.set(framework.id, count + 1);
          }
        }
        
        if (tagMatches.size > 0) {
          // Find framework with most tag matches
          let bestFrameworkId = null;
          let bestMatchCount = 0;
          
          for (const [id, count] of tagMatches.entries()) {
            if (count > bestMatchCount) {
              bestFrameworkId = id;
              bestMatchCount = count;
            }
          }
          
          if (bestFrameworkId) {
            // Calculate confidence based on match ratio
            const confidence = bestMatchCount / context.tags.length;
            
            return {
              id: bestFrameworkId,
              framework: this.frameworks.get(bestFrameworkId),
              metadata: this.metadata.get(bestFrameworkId),
              version: this.versions.get(bestFrameworkId),
              confidence
            };
          }
        }
      }
      
      // If no specific framework found, return the general framework if available
      if (this.frameworks.has('general')) {
        return {
          id: 'general',
          framework: this.frameworks.get('general'),
          metadata: this.metadata.get('general'),
          version: this.versions.get('general'),
          confidence: 0.5
        };
      }
      
      // No appropriate framework found
      return null;
    } catch (error) {
      this.logger.error('Error finding framework for context', error);
      return null;
    }
  }
  
  /**
   * Registers API endpoints for the Domain Framework Registry
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register frameworks endpoint
    api.register(`${namespace}/frameworks`, {
      get: async (req, res) => {
        try {
          const frameworks = this.getAllFrameworks().map(({ id, metadata, version }) => ({
            id,
            name: metadata.name,
            description: metadata.description,
            version,
            author: metadata.author,
            category: metadata.category,
            tags: metadata.tags
          }));
          
          return res.json(frameworks);
        } catch (error) {
          this.logger.error('API error in frameworks endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      post: async (req, res) => {
        try {
          const { id, framework, metadata } = req.body;
          
          if (!id) {
            return res.status(400).json({
              error: 'Framework ID is required'
            });
          }
          
          if (!framework) {
            return res.status(400).json({
              error: 'Framework is required'
            });
          }
          
          const result = await this.registerFramework(id, framework, metadata);
          
          return res.status(result ? 201 : 400).json({
            success: result,
            id
          });
        } catch (error) {
          this.logger.error('API error in framework registration endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register framework endpoint
    api.register(`${namespace}/frameworks/:id`, {
      get: async (req, res) => {
        try {
          const { id } = req.params;
          
          if (!id) {
            return res.status(400).json({
              error: 'Framework ID is required'
            });
          }
          
          const framework = this.getFramework(id);
          
          if (!framework) {
            return res.status(404).json({
              error: `Framework not found: ${id}`
            });
          }
          
          const metadata = this.getFrameworkMetadata(id);
          const version = this.versions.get(id);
          
          return res.json({
            id,
            framework,
            metadata,
            version
          });
        } catch (error) {
          this.logger.error('API error in framework endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      delete: async (req, res) => {
        try {
          const { id } = req.params;
          
          if (!id) {
            return res.status(400).json({
              error: 'Framework ID is required'
            });
          }
          
          const result = await this.unregisterFramework(id);
          
          return res.json({
            success: result,
            id
          });
        } catch (error) {
          this.logger.error('API error in framework unregistration endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register framework metadata endpoint
    api.register(`${namespace}/frameworks/:id/metadata`, {
      get: async (req, res) => {
        try {
          const { id } = req.params;
          
          if (!id) {
            return res.status(400).json({
              error: 'Framework ID is required'
            });
          }
          
          const metadata = this.getFrameworkMetadata(id);
          
          if (!metadata) {
            return res.status(404).json({
              error: `Framework not found: ${id}`
            });
          }
          
          return res.json(metadata);
        } catch (error) {
          this.logger.error('API error in framework metadata endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register framework category endpoint
    api.register(`${namespace}/frameworks/category/:category`, {
      get: async (req, res) => {
        try {
          const { category } = req.params;
          
          if (!category) {
            return res.status(400).json({
              error: 'Category is required'
            });
          }
          
          const frameworks = this.getFrameworksByCategory(category).map(({ id, metadata, version }) => ({
            id,
            name: metadata.name,
            description: metadata.description,
            version,
            author: metadata.author,
            category: metadata.category,
            tags: metadata.tags
          }));
          
          return res.json(frameworks);
        } catch (error) {
          this.logger.error('API error in framework category endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register framework tag endpoint
    api.register(`${namespace}/frameworks/tag/:tag`, {
      get: async (req, res) => {
        try {
          const { tag } = req.params;
          
          if (!tag) {
            return res.status(400).json({
              error: 'Tag is required'
            });
          }
          
          const frameworks = this.getFrameworksByTag(tag).map(({ id, metadata, version }) => ({
            id,
            name: metadata.name,
            description: metadata.description,
            version,
            author: metadata.author,
            category: metadata.category,
            tags: metadata.tags
          }));
          
          return res.json(frameworks);
        } catch (error) {
          this.logger.error('API error in framework tag endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register framework context endpoint
    api.register(`${namespace}/frameworks/context`, {
      post: async (req, res) => {
        try {
          const { context } = req.body;
          
          if (!context) {
            return res.status(400).json({
              error: 'Context is required'
            });
          }
          
          const result = this.findFrameworkForContext(context);
          
          if (!result) {
            return res.status(404).json({
              error: 'No appropriate framework found for context'
            });
          }
          
          return res.json({
            id: result.id,
            name: result.metadata.name,
            description: result.metadata.description,
            version: result.version,
            category: result.metadata.category,
            tags: result.metadata.tags,
            confidence: result.confidence
          });
        } catch (error) {
          this.logger.error('API error in framework context endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { DomainFrameworkRegistry };
