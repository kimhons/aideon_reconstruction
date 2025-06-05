/**
 * @fileoverview Minimal test to isolate EventBus listener registration and event emission issues.
 * This test focuses solely on the EventBus component to identify why listeners aren't being called.
 */

const assert = require('assert');
const sinon = require('sinon');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const EventBus = require('../../../src/core/error_recovery/foundation/EventBus');

describe('EventBus Minimal Test', () => {
  let eventBus;
  
  beforeEach(() => {
    // Create a fresh EventBus instance for each test
    eventBus = new EventBus();
    eventBus.setHistoryTracking(true);
    console.log('Created fresh EventBus instance');
  });
  
  afterEach(() => {
    // Clean up
    sinon.restore();
    console.log('Sinon restored');
  });
  
  it('should call listeners when events are emitted directly', () => {
    // Create a simple listener with a spy
    const listener = sinon.spy();
    
    // Register the listener directly with the EventEmitter
    eventBus.emitter.on('test-event', listener);
    
    // Verify the listener is registered
    console.log('Direct EventEmitter listeners count:', eventBus.emitter.listenerCount('test-event'));
    
    // Emit the event directly
    eventBus.emitter.emit('test-event', { data: 'test' });
    
    // Verify the listener was called
    assert(listener.calledOnce, 'Direct listener should be called once');
    assert.deepStrictEqual(listener.firstCall.args[0], { data: 'test' }, 'Listener should receive correct data');
  });
  
  it('should call listeners when events are emitted through EventBus', () => {
    // Create a simple listener with a spy
    const listener = sinon.spy();
    
    // Register the listener through EventBus
    const listenerId = eventBus.on('test-event', listener);
    
    // Verify the listener is registered
    console.log('EventBus listener ID:', listenerId);
    console.log('EventBus subscribers:', eventBus.getEventMetadata?.('test-event')?.subscribers || 0);
    console.log('EventEmitter listeners count:', eventBus.emitter.listenerCount('test-event'));
    
    // Emit the event through EventBus
    eventBus.emit('test-event', { data: 'test' });
    
    // Verify the listener was called
    assert(listener.calledOnce, 'EventBus listener should be called once');
    assert.deepStrictEqual(listener.firstCall.args[0], { data: 'test' }, 'Listener should receive correct data');
  });
  
  it('should call wildcard listeners when events are emitted', () => {
    // Create a simple wildcard listener with a spy
    const wildcardListener = sinon.spy();
    
    // Register the wildcard listener
    const listenerId = eventBus.on('*', wildcardListener);
    
    // Verify the listener is registered
    console.log('Wildcard listener ID:', listenerId);
    console.log('Wildcard handler registry has * entry:', eventBus.handlerRegistry?.has('*'));
    
    // Emit an event
    eventBus.emit('test-event', { data: 'test' });
    
    // Verify the wildcard listener was called
    assert(wildcardListener.calledOnce, 'Wildcard listener should be called once');
    assert.strictEqual(wildcardListener.firstCall.args[0], 'test-event', 'First argument should be event name');
    assert.deepStrictEqual(wildcardListener.firstCall.args[1], { data: 'test' }, 'Second argument should be event data');
  });
  
  it('should record events in history when enabled', () => {
    // Enable history tracking
    eventBus.setHistoryTracking(true);
    
    // Emit an event
    eventBus.emit('test-event', { data: 'test' });
    
    // Get event history
    const history = eventBus.getEventHistory();
    
    // Verify event was recorded
    assert.strictEqual(history.length, 1, 'Event history should have one entry');
    assert.strictEqual(history[0].event, 'test-event', 'Event name should be recorded');
    assert.deepStrictEqual(history[0].data, { data: 'test' }, 'Event data should be recorded');
  });
  
  it('should handle multiple listeners for the same event', () => {
    // Create multiple listeners
    const listener1 = sinon.spy();
    const listener2 = sinon.spy();
    
    // Register listeners
    eventBus.on('test-event', listener1);
    eventBus.on('test-event', listener2);
    
    // Verify listeners are registered
    console.log('EventBus subscribers:', eventBus.getEventMetadata?.('test-event')?.subscribers || 0);
    console.log('EventEmitter listeners count:', eventBus.emitter.listenerCount('test-event'));
    
    // Emit the event
    eventBus.emit('test-event', { data: 'test' });
    
    // Verify both listeners were called
    assert(listener1.calledOnce, 'First listener should be called once');
    assert(listener2.calledOnce, 'Second listener should be called once');
  });
  
  it('should handle listener removal correctly', () => {
    // Create a listener
    const listener = sinon.spy();
    
    // Register the listener
    const listenerId = eventBus.on('test-event', listener);
    
    // Remove the listener
    eventBus.off('test-event', listenerId);
    
    // Verify the listener is removed
    console.log('EventBus subscribers after removal:', eventBus.getEventMetadata?.('test-event')?.subscribers || 0);
    console.log('EventEmitter listeners count after removal:', eventBus.emitter.listenerCount('test-event'));
    
    // Emit the event
    eventBus.emit('test-event', { data: 'test' });
    
    // Verify the listener was not called
    assert(!listener.called, 'Removed listener should not be called');
  });
  
  it('should handle sinon spy listeners correctly', () => {
    // Create a sinon spy directly as a listener
    const listener = sinon.spy();
    
    // Register the spy as a listener
    eventBus.on('test-event', listener);
    
    // Emit the event
    eventBus.emit('test-event', { data: 'test' });
    
    // Verify the spy was called
    assert(listener.calledOnce, 'Sinon spy listener should be called once');
  });
});
