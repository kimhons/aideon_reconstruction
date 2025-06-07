/**
 * @fileoverview Jest configuration for Aideon AI Desktop Agent
 * 
 * This file contains Jest configuration for running tests for the Aideon AI Desktop Agent,
 * including test environment, coverage settings, and module mocking.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Test setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/tentacles/decision_intelligence/setup.jest.js'
  ],
  
  // Module name mapper for core modules
  moduleNameMapper: {
    '^../../../../core/logging/Logger$': '<rootDir>/src/core/logging/Logger.js',
    '^../../../../core/events/EventEmitter$': '<rootDir>/src/core/events/EventEmitter.js',
    '^../../../core/logging/Logger$': '<rootDir>/src/core/logging/Logger.js',
    '^../../../core/events/EventEmitter$': '<rootDir>/src/core/events/EventEmitter.js',
    '^../../core/logging/Logger$': '<rootDir>/src/core/logging/Logger.js',
    '^../../core/events/EventEmitter$': '<rootDir>/src/core/events/EventEmitter.js'
  },
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/vendor/**',
    '!**/node_modules/**'
  ],
  
  // Timeout settings
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Disable automatic mocks
  automock: false,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true
};
