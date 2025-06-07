/**
 * @fileoverview AideonCore class that provides access to all core Aideon systems.
 * This is the main interface for tentacles to interact with the Aideon platform.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const ApiSystem = require('../systems/ApiSystem');
const EventSystem = require('../systems/EventSystem');
const ConfigSystem = require('../systems/ConfigSystem');
const LoggingSystem = require('../systems/LoggingSystem');
const MetricsSystem = require('../systems/MetricsSystem');
const SecuritySystem = require('../systems/SecuritySystem');
const TentacleRegistry = require('../integration/TentacleRegistry');
const ExternalServices = require('../integration/ExternalServices');
const { SystemError } = require('../utils/errorHandling');

/**
 * Main interface for tentacles to interact with the Aideon platform.
 * Provides access to all core Aideon systems.
 */
class AideonCore {
  /**
   * Creates a new AideonCore instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.version = options.version || '1.0.0';
    
    // Initialize core systems
    this.api = options.api || new ApiSystem();
    this.events = options.events || new EventSystem();
    this.config = options.config || new ConfigSystem();
    this.logging = options.logging || new LoggingSystem();
    this.metrics = options.metrics || new MetricsSystem();
    this.security = options.security || new SecuritySystem();
    
    // Initialize integration components
    this.tentacles = options.tentacles || new TentacleRegistry();
    this.externalServices = options.externalServices || new ExternalServices();
    
    // System state
    this._startTime = Date.now();
    this._status = 'initializing';
    this._health = {
      status: 'starting',
      checks: {}
    };
    
    // Initialize logger
    this._logger = this.logging.getLogger('aideon:core');
  }
  
  /**
   * Initializes the Aideon core.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    try {
      this._logger.info('Initializing Aideon core');
      
      // Initialize all systems
      await Promise.all([
        this.api.initialize(),
        this.events.initialize(),
        this.config.initialize(),
        this.logging.initialize(),
        this.metrics.initialize(),
        this.security.initialize(),
        this.tentacles.initialize(),
        this.externalServices.initialize()
      ]);
      
      this._status = 'ready';
      this._health.status = 'healthy';
      
      this._logger.info('Aideon core initialized');
      this.events.emit('system:initialized', { timestamp: Date.now() });
      
      return true;
    } catch (error) {
      this._status = 'error';
      this._health.status = 'unhealthy';
      this._health.checks.initialization = {
        status: 'failed',
        error: error.message
      };
      
      this._logger.error('Failed to initialize Aideon core', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SystemError('Failed to initialize Aideon core', 'INITIALIZATION_ERROR', error);
    }
  }
  
  /**
   * Shuts down the Aideon core.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    try {
      this._logger.info('Shutting down Aideon core');
      
      // Shut down all tentacles first
      await this.tentacles.shutdownAll();
      
      // Then shut down all systems
      await Promise.all([
        this.api.shutdown(),
        this.events.shutdown(),
        this.config.shutdown(),
        this.logging.shutdown(),
        this.metrics.shutdown(),
        this.security.shutdown(),
        this.externalServices.shutdown()
      ]);
      
      this._status = 'shutdown';
      
      this._logger.info('Aideon core shut down');
      
      return true;
    } catch (error) {
      this._status = 'error';
      this._health.status = 'unhealthy';
      this._health.checks.shutdown = {
        status: 'failed',
        error: error.message
      };
      
      this._logger.error('Failed to shut down Aideon core', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SystemError('Failed to shut down Aideon core', 'SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Gets the current status of the Aideon core.
   * @returns {Object} The system status
   */
  getStatus() {
    return {
      version: this.version,
      status: this._status,
      uptime: Date.now() - this._startTime,
      startTime: this._startTime,
      tentacleCount: this.tentacles.getAll().length,
      apiEndpointCount: this.api.getEndpoints().length
    };
  }
  
  /**
   * Gets the current health of the Aideon core.
   * @returns {Object} The health status
   */
  getHealth() {
    // Update health checks
    this._health.checks.api = {
      status: this.api.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.events = {
      status: this.events.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.config = {
      status: this.config.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.logging = {
      status: this.logging.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.metrics = {
      status: this.metrics.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.security = {
      status: this.security.isHealthy() ? 'healthy' : 'unhealthy'
    };
    
    this._health.checks.tentacles = {
      status: this.tentacles.isHealthy() ? 'healthy' : 'unhealthy',
      details: {
        total: this.tentacles.getAll().length,
        healthy: this.tentacles.getHealthy().length,
        unhealthy: this.tentacles.getUnhealthy().length
      }
    };
    
    // Update overall health status
    const unhealthyChecks = Object.values(this._health.checks)
      .filter(check => check.status === 'unhealthy');
    
    if (unhealthyChecks.length > 0) {
      this._health.status = 'unhealthy';
    } else {
      this._health.status = 'healthy';
    }
    
    return {
      status: this._health.status,
      checks: this._health.checks,
      timestamp: Date.now()
    };
  }
  
  /**
   * Gets the current resource usage of the Aideon core.
   * @returns {Object} The resource usage
   */
  getResources() {
    // This is a simplified implementation
    // In a real implementation, this would gather actual resource usage metrics
    return {
      cpu: {
        usage: Math.random() * 100,
        cores: 4
      },
      memory: {
        total: 8 * 1024 * 1024 * 1024, // 8 GB
        used: Math.random() * 8 * 1024 * 1024 * 1024,
        free: (1 - Math.random()) * 8 * 1024 * 1024 * 1024
      },
      disk: {
        total: 100 * 1024 * 1024 * 1024, // 100 GB
        used: Math.random() * 100 * 1024 * 1024 * 1024,
        free: (1 - Math.random()) * 100 * 1024 * 1024 * 1024
      },
      network: {
        bytesIn: Math.random() * 1024 * 1024,
        bytesOut: Math.random() * 1024 * 1024
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Gets the system configuration.
   * @returns {Object} The system configuration
   */
  getSystemConfig() {
    return this.config.getSystemConfig();
  }
  
  /**
   * Gets system events.
   * @param {Object} [query] - Query parameters
   * @returns {Array<Object>} The system events
   */
  getSystemEvents(query = {}) {
    return this.events.getEvents(query);
  }
  
  /**
   * Gets the GAIA score.
   * @returns {Object} The GAIA score
   */
  getGAIAScore() {
    return this.metrics.getGAIAScore();
  }
}

module.exports = AideonCore;
