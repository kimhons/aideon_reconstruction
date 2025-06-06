/**
 * @fileoverview Setup file for Jest tests for Marketplace UI components
 * This file configures the test environment and sets up global mocks
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock core modules
jest.mock('../../../src/core/logging/Logger', () => {
  return {
    Logger: class MockLogger {
      constructor(name) {
        this.name = name;
      }
      
      info(message) {
        // console.log(`[INFO] ${this.name}: ${message}`);
      }
      
      warn(message) {
        // console.log(`[WARN] ${this.name}: ${message}`);
      }
      
      error(message, error) {
        // console.log(`[ERROR] ${this.name}: ${message}`, error);
      }
      
      debug(message) {
        // console.log(`[DEBUG] ${this.name}: ${message}`);
      }
    }
  };
});

jest.mock('../../../src/core/events/EventEmitter', () => {
  return {
    EventEmitter: class MockEventEmitter {
      constructor() {
        this.listeners = {};
      }
      
      on(event, callback) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
      }
      
      off(event, callback) {
        if (!this.listeners[event]) {
          return this;
        }
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        return this;
      }
      
      emit(event, data) {
        if (!this.listeners[event]) {
          return;
        }
        this.listeners[event].forEach(callback => {
          callback(data);
        });
      }
    }
  };
});

jest.mock('../../../src/core/tentacles/TentacleRegistry', () => {
  return {
    TentacleRegistry: class MockTentacleRegistry {
      constructor() {
        this.tentacles = new Map();
        this.events = {
          on: jest.fn(),
          emit: jest.fn()
        };
        this.initialized = false;
      }
      
      async initialize() {
        this.initialized = true;
        return true;
      }
      
      async registerTentacle(tentacle) {
        this.tentacles.set(tentacle.id, tentacle);
        return true;
      }
      
      async unregisterTentacle(tentacleId) {
        this.tentacles.delete(tentacleId);
        return true;
      }
      
      getTentacle(tentacleId) {
        return this.tentacles.get(tentacleId);
      }
      
      getAllTentacles() {
        return Array.from(this.tentacles.values());
      }
      
      async shutdown() {
        this.initialized = false;
        return true;
      }
    }
  };
});

// Mock marketplace core modules
jest.mock('../../../src/marketplace/MarketplaceCore', () => {
  return {
    MarketplaceCore: class MockMarketplaceCore {
      constructor() {
        this.events = {
          on: jest.fn(),
          emit: jest.fn()
        };
        this.initialized = false;
      }
      
      async initialize() {
        this.initialized = true;
        return true;
      }
      
      async shutdown() {
        this.initialized = false;
        return true;
      }
    }
  };
});

jest.mock('../../../src/marketplace/monetization/core/MonetizationCore', () => {
  return {
    MonetizationCore: class MockMonetizationCore {
      constructor() {
        this.events = {
          on: jest.fn(),
          emit: jest.fn()
        };
        this.initialized = false;
      }
      
      async initialize() {
        this.initialized = true;
        return true;
      }
      
      async shutdown() {
        this.initialized = false;
        return true;
      }
    }
  };
});

// Mock DOM for UI components
global.mockContainer = {
  appendChild: jest.fn(),
  querySelector: jest.fn().mockReturnValue({}),
  querySelectorAll: jest.fn().mockReturnValue([]),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn()
  }
};

// Global test setup
beforeAll(() => {
  // Any global setup needed before all tests
  console.log('Setting up Marketplace UI integration tests');
});

afterAll(() => {
  // Any global cleanup needed after all tests
  console.log('Cleaning up after Marketplace UI integration tests');
});
