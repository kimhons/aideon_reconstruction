/**
 * @fileoverview Test setup file for Aideon project
 * This file configures the test environment for all tests.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Configure test environment
const chai = require('chai');
// Use mock-sinon instead of sinon to avoid ESM compatibility issues
const mockSinon = {
  spy: jest.fn,
  stub: jest.fn,
  mock: jest.fn,
  fake: jest.fn,
  createSandbox: () => ({
    spy: jest.fn,
    stub: jest.fn,
    mock: jest.fn,
    fake: jest.fn,
    restore: jest.fn
  })
};

// Set up global test utilities
global.expect = chai.expect;
global.sinon = mockSinon;

// Set up DOM environment for UI tests
if (typeof document === 'undefined') {
  global.document = {
    createElement: (tag) => ({
      className: '',
      style: {},
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      innerHTML: '',
      textContent: ''
    }),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn()
  };
}

// Mock browser environment
global.window = global.window || {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  location: {
    href: 'http://localhost/'
  }
};

// Set up console mocks to prevent test noise
const originalConsole = { ...console };
global.suppressConsole = () => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
};

global.restoreConsole = () => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
