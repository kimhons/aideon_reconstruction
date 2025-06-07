/**
 * @fileoverview Setup file for DevMaster Tentacle tests
 * 
 * This file contains setup code for the DevMaster Tentacle test suite,
 * including mocks and environment configuration.
 */

// Set up test environment
process.env.NODE_ENV = 'test';

// Import required modules
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// Configure chai
chai.use(sinonChai);
chai.config.includeStack = true;

// Mock global objects that might be needed
global.TextEncoder = class TextEncoder {
  encode(text) {
    return Buffer.from(text);
  }
};

global.TextDecoder = class TextDecoder {
  decode(buffer) {
    return buffer.toString();
  }
};

// Suppress console output during tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Export root hooks for Mocha
exports.mochaHooks = {
  beforeEach() {
    this.sandbox = sinon.createSandbox();
    
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.info = () => {};
  },
  
  afterEach() {
    this.sandbox.restore();
    
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  }
};
