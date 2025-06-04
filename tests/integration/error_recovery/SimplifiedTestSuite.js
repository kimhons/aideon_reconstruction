/**
 * ErrorRecoveryTestSuite.js - Simplified Version
 * 
 * A simplified version of the test suite to debug timeout issues
 */

const assert = require('assert');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const path = require('path');

// Use absolute paths for imports
const foundationPath = path.resolve(__dirname, '../../../src/core/error_recovery/foundation');
const DependencyContainer = require(path.join(foundationPath, 'DependencyContainer'));
const EventBus = require(path.join(foundationPath, 'EventBus'));

console.log('Foundation path:', foundationPath);
console.log('DependencyContainer path:', path.join(foundationPath, 'DependencyContainer'));
console.log('EventBus path:', path.join(foundationPath, 'EventBus'));

// Test utilities
const TestUtils = {
  createMockError() {
    return new Error('Test error');
  }
};

// Unit Tests - Simplified for debugging
describe('Autonomous Error Recovery System - Basic Tests', () => {
  describe('DependencyContainer', () => {
    it('should register and resolve dependencies', async () => {
      console.log('Starting DependencyContainer test');
      const container = new DependencyContainer();
      
      container.register('testDep', () => ({ value: 'test' }));
      
      const dep = await container.resolve('testDep');
      
      assert.deepStrictEqual(dep, { value: 'test' });
      console.log('DependencyContainer test completed successfully');
    });
  });
  
  describe('EventBus', () => {
    it('should emit and receive events', () => {
      console.log('Starting EventBus test');
      const eventBus = new EventBus();
      const handler = sinon.spy();
      
      eventBus.on('test', handler);
      eventBus.emit('test', { value: 'test' });
      
      assert(handler.calledOnce);
      assert(handler.calledWith({ value: 'test' }));
      console.log('EventBus test completed successfully');
    });
  });
});
