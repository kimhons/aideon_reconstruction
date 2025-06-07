/**
 * @fileoverview Setup file for Decision Intelligence Tentacle tests
 * 
 * This file contains setup code for running Decision Intelligence Tentacle tests,
 * including mocks, stubs, and test environment configuration.
 */

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// Configure chai
chai.use(sinonChai);

// Global test environment setup
before(() => {
  // Set up global test environment
  global.expect = chai.expect;
  global.sinon = sinon;
});

// Global test environment teardown
after(() => {
  // Clean up global test environment
});

// Reset sinon before each test
beforeEach(() => {
  sinon.restore();
});

// Mock core modules to avoid dependency issues
const mockLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
};

const mockEventEmitter = {
  on: () => {},
  once: () => {},
  off: () => {},
  emit: () => {},
  removeAllListeners: () => {}
};

// Mock core modules
jest.mock('../../../src/core/logging/Logger', () => ({
  Logger: function() {
    return mockLogger;
  }
}));

jest.mock('../../../src/core/events/EventEmitter', () => ({
  EventEmitter: function() {
    return mockEventEmitter;
  }
}));
