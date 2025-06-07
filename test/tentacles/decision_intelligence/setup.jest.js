/**
 * @fileoverview Test setup file for Decision Intelligence Tentacle tests
 * 
 * This file contains setup code for running Decision Intelligence Tentacle tests,
 * including mocks, stubs, and test environment configuration.
 */

// Mock core modules to avoid dependency issues
const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  log: jest.fn()
};

const mockEventEmitter = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  emit: jest.fn().mockReturnValue(true),
  removeAllListeners: jest.fn().mockReturnThis()
};

// Mock core modules
jest.mock('../../../src/core/logging/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger)
}), { virtual: true });

jest.mock('../../../src/core/events/EventEmitter', () => ({
  EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter)
}), { virtual: true });

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
