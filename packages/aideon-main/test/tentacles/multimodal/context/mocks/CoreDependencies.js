/**
 * @fileoverview Mock dependencies for MCP UI integration tests.
 * 
 * This module provides mock implementations of core dependencies used in the
 * MCP UI integration tests.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');

/**
 * Mock Logger implementation.
 */
class MockLogger {
  info() {}
  debug() {}
  warn() {}
  error() {}
}

/**
 * Mock Configuration Service implementation.
 */
class MockConfigService {
  get() { return {}; }
  set() { return true; }
}

/**
 * Mock Performance Monitor implementation.
 */
class MockPerformanceMonitor {
  startTimer() { return Date.now(); }
  endTimer() { return 0; }
  recordMetric() {}
}

/**
 * Mock Security Manager implementation.
 */
class MockSecurityManager {
  checkAccess() { return true; }
  hasPermission() { return true; }
}

/**
 * Mock MCP Context Manager implementation.
 */
class MockMCPContextManager extends EventEmitter {
  constructor() {
    super();
    this.registeredProviders = new Map();
    this.persistedContext = new Map();
  }
  
  async registerContextProvider(contextType, provider) {
    this.registeredProviders.set(contextType, provider);
    return true;
  }
  
  async persistContext(data) {
    this.persistedContext.set(data.contextType, data);
    return true;
  }
  
  async loadPersistedContext(contextType) {
    return this.persistedContext.get(contextType);
  }
  
  async respondToContextRequest(requestId, response) {
    this.emit('contextResponse', { requestId, response });
    return true;
  }
}

module.exports = {
  MockLogger,
  MockConfigService,
  MockPerformanceMonitor,
  MockSecurityManager,
  MockMCPContextManager
};
