/**
 * @fileoverview Test setup for the Contextual Intelligence Tentacle.
 * Configures test environment and dependencies.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// Configure chai
chai.use(sinonChai);

// Export helper functions for tests
module.exports = {
  /**
   * Creates stubs for missing modules
   * @param {string} modulePath - Path to the module to stub
   * @param {Object} stubImplementation - Stub implementation
   * @returns {Function} - Proxyquire function
   */
  stubMissingModule: function(modulePath, stubImplementation) {
    const proxyquire = require('proxyquire');
    const stubs = {};
    stubs[modulePath] = stubImplementation;
    return proxyquire;
  }
};
