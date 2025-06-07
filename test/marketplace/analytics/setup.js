/**
 * @fileoverview Setup file for Jest tests in the analytics module
 * This file sets up the test environment for Jest tests in the analytics module
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Set up DOM environment for UI tests
if (typeof window === 'undefined') {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
}

// Mock core modules
jest.mock('../../../src/core/logging/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../../../src/core/events/EventEmitter', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }))
}));

// Global Jest setup - using global scope instead of direct hooks
global.beforeEach = () => {
  jest.clearAllMocks();
};

global.afterEach = () => {
  jest.restoreAllMocks();
};
