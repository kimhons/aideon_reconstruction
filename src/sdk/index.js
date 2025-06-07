/**
 * @fileoverview Main entry point for the Aideon SDK.
 * Provides access to all SDK components and utilities.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Core components
const AideonCore = require('./core/AideonCore');
const Tentacle = require('./core/Tentacle');

// Systems
const ApiSystem = require('./systems/ApiSystem');
const ConfigSystem = require('./systems/ConfigSystem');
const EventSystem = require('./systems/EventSystem');
const LoggingSystem = require('./systems/LoggingSystem');
const MetricsSystem = require('./systems/MetricsSystem');
const SecuritySystem = require('./systems/SecuritySystem');

// Utilities
const errorHandling = require('./utils/errorHandling');
const network = require('./utils/network');
const object = require('./utils/object');
const validation = require('./utils/validation');

// Constants and enums
const constants = require('./constants');
const enums = require('./enums');

/**
 * Creates a new Aideon SDK instance.
 * @param {Object} [options={}] - SDK options
 * @returns {Object} The SDK instance
 */
function createSDK(options = {}) {
  // Create systems
  const configSystem = new ConfigSystem(options.config);
  const loggingSystem = new LoggingSystem(options.logging);
  const eventSystem = new EventSystem(options.events);
  const securitySystem = new SecuritySystem(options.security);
  const metricsSystem = new MetricsSystem(options.metrics);
  const apiSystem = new ApiSystem(options.api);
  
  // Create core
  const core = new AideonCore({
    configSystem,
    loggingSystem,
    eventSystem,
    securitySystem,
    metricsSystem,
    apiSystem,
    ...options.core
  });
  
  // Create SDK instance
  const sdk = {
    // Core
    core,
    
    // Systems
    config: configSystem,
    logging: loggingSystem,
    events: eventSystem,
    security: securitySystem,
    metrics: metricsSystem,
    api: apiSystem,
    
    // Utilities
    utils: {
      error: errorHandling,
      network,
      object,
      validation
    },
    
    // Constants and enums
    constants,
    enums,
    
    // Tentacle creation
    createTentacle: (options = {}) => {
      return new Tentacle({
        core,
        ...options
      });
    },
    
    // SDK initialization
    async initialize() {
      try {
        // Initialize systems
        await configSystem.initialize();
        await loggingSystem.initialize();
        await eventSystem.initialize();
        await securitySystem.initialize();
        await metricsSystem.initialize();
        await apiSystem.initialize();
        
        // Initialize core
        await core.initialize();
        
        return true;
      } catch (error) {
        console.error('Failed to initialize SDK:', error);
        throw error;
      }
    },
    
    // SDK shutdown
    async shutdown() {
      try {
        // Shutdown core
        await core.shutdown();
        
        // Shutdown systems
        await apiSystem.shutdown();
        await metricsSystem.shutdown();
        await securitySystem.shutdown();
        await eventSystem.shutdown();
        await loggingSystem.shutdown();
        await configSystem.shutdown();
        
        return true;
      } catch (error) {
        console.error('Failed to shut down SDK:', error);
        throw error;
      }
    }
  };
  
  return sdk;
}

// Export SDK factory and components
module.exports = {
  createSDK,
  AideonCore,
  Tentacle,
  ApiSystem,
  ConfigSystem,
  EventSystem,
  LoggingSystem,
  MetricsSystem,
  SecuritySystem,
  errorHandling,
  network,
  object,
  validation,
  constants,
  enums
};
