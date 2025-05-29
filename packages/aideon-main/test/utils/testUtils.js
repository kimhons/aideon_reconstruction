/**
 * @fileoverview Test utilities for Aideon AI tests.
 * Provides mock objects and helper functions for testing.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Create a mock logger for testing.
 * @returns {Object} Mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn()
  };
}

/**
 * Create a mock configuration service for testing.
 * @param {Object} configOverrides Optional configuration overrides
 * @returns {Object} Mock configuration service
 */
function createMockConfigService(configOverrides = {}) {
  const defaultConfig = {
    "lfd.recording.maxDuration": 3600000,
    "lfd.patternExtraction.minConfidence": 0.6,
    "lfd.workflowSynthesis.optimizationEnabled": true,
    "lfd.performanceMonitoring.metricsIntervalMs": 1000,
    "lfd.selfImprovement.refinementConfidenceThreshold": 0.7,
    "lfd.continuousLearning.autoExtractPatterns": true,
    "lfd.continuousLearning.autoRefineWorkflows": true
  };
  
  const config = { ...defaultConfig, ...configOverrides };
  
  return {
    get: jest.fn((key, defaultValue) => {
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
    set: jest.fn()
  };
}

/**
 * Create a mock event bus for testing.
 * @returns {Object} Mock event bus
 */
function createMockEventBus() {
  const listeners = new Map();
  
  return {
    on: jest.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    }),
    
    off: jest.fn((event, handler) => {
      if (!listeners.has(event)) {
        return;
      }
      
      const eventListeners = listeners.get(event);
      const index = eventListeners.indexOf(handler);
      
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }),
    
    emit: jest.fn((event, data) => {
      if (!listeners.has(event)) {
        return;
      }
      
      for (const handler of listeners.get(event)) {
        handler(data);
      }
    })
  };
}

/**
 * Create a mock storage adapter for testing.
 * @returns {Object} Mock storage adapter
 */
function createMockStorageAdapter() {
  const storage = new Map();
  
  return {
    get: jest.fn(async (key) => {
      return storage.get(key);
    }),
    
    set: jest.fn(async (key, value) => {
      storage.set(key, value);
    }),
    
    delete: jest.fn(async (key) => {
      storage.delete(key);
    }),
    
    clear: jest.fn(async () => {
      storage.clear();
    }),
    
    getAll: jest.fn(async () => {
      return Array.from(storage.entries()).map(([key, value]) => ({ key, value }));
    })
  };
}

/**
 * Create a mock HTTP client for testing.
 * @param {Object} responseOverrides Optional response overrides
 * @returns {Object} Mock HTTP client
 */
function createMockHttpClient(responseOverrides = {}) {
  return {
    get: jest.fn(async () => {
      return { data: responseOverrides.get || {} };
    }),
    
    post: jest.fn(async () => {
      return { data: responseOverrides.post || {} };
    }),
    
    put: jest.fn(async () => {
      return { data: responseOverrides.put || {} };
    }),
    
    delete: jest.fn(async () => {
      return { data: responseOverrides.delete || {} };
    })
  };
}

module.exports = {
  createMockLogger,
  createMockConfigService,
  createMockEventBus,
  createMockStorageAdapter,
  createMockHttpClient
};
