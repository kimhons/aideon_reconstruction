/**
 * @fileoverview Test utilities for Aideon AI Desktop Agent tests.
 * Provides mock implementations of common services and utilities.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const sinon = require('sinon');
const { EventEmitter } = require('events');

/**
 * Create a mock logger
 * @returns {Object} Mock logger
 */
function createMockLogger() {
  return {
    debug: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    child: sinon.stub().returns({
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    })
  };
}

/**
 * Create a mock config manager
 * @returns {Object} Mock config manager
 */
function createMockConfigManager() {
  return {
    getConfig: sinon.stub().resolves({}),
    setConfig: sinon.stub().resolves(),
    getInstance: sinon.stub().returns({
      getConfig: sinon.stub().resolves({}),
      setConfig: sinon.stub().resolves()
    })
  };
}

/**
 * Create a mock security manager
 * @returns {Object} Mock security manager
 */
function createMockSecurityManager() {
  return {
    checkPermission: sinon.stub().resolves({ granted: true }),
    checkAuthentication: sinon.stub().resolves({ 
      authenticated: true,
      isAdmin: false,
      isSystem: false
    }),
    getInstance: sinon.stub().returns({
      checkPermission: sinon.stub().resolves({ granted: true }),
      checkAuthentication: sinon.stub().resolves({ 
        authenticated: true,
        isAdmin: false,
        isSystem: false
      })
    })
  };
}

/**
 * Create a mock performance tracker
 * @returns {Object} Mock performance tracker
 */
function createMockPerformanceTracker() {
  return {
    startTracking: sinon.stub(),
    stopTracking: sinon.stub(),
    getMetrics: sinon.stub().returns({})
  };
}

/**
 * Create a mock network manager
 * @returns {Object} Mock network manager
 */
function createMockNetworkManager() {
  return {
    isOnline: sinon.stub().resolves(true),
    getNetworkInfo: sinon.stub().resolves({
      connected: true,
      type: 'wifi',
      strength: 100
    }),
    getInstance: sinon.stub().returns({
      isOnline: sinon.stub().resolves(true),
      getNetworkInfo: sinon.stub().resolves({
        connected: true,
        type: 'wifi',
        strength: 100
      })
    })
  };
}

/**
 * Create a mock platform manager
 * @returns {Object} Mock platform manager
 */
function createMockPlatformManager() {
  return {
    getPlatformInfo: sinon.stub().returns({
      os: 'linux',
      arch: 'x64',
      version: '1.0.0',
      capabilities: {
        audioCapture: true,
        videoCapture: true,
        screenCapture: true
      }
    }),
    getAudioInputDevices: sinon.stub().resolves([
      { id: 'device1', name: 'Microphone 1', isDefault: true },
      { id: 'device2', name: 'Microphone 2', isDefault: false }
    ]),
    getAudioContext: sinon.stub().returns(function() {
      return {
        sampleRate: 44100,
        state: 'running',
        createMediaStreamSource: sinon.stub().returns({
          connect: sinon.stub()
        }),
        createAnalyser: sinon.stub().returns({
          fftSize: 0,
          frequencyBinCount: 128,
          getByteFrequencyData: sinon.stub()
        }),
        close: sinon.stub().resolves()
      };
    }),
    getInstance: sinon.stub().returns({
      getPlatformInfo: sinon.stub().returns({
        os: 'linux',
        arch: 'x64',
        version: '1.0.0',
        capabilities: {
          audioCapture: true,
          videoCapture: true,
          screenCapture: true
        }
      }),
      getAudioInputDevices: sinon.stub().resolves([
        { id: 'device1', name: 'Microphone 1', isDefault: true },
        { id: 'device2', name: 'Microphone 2', isDefault: false }
      ])
    })
  };
}

/**
 * Create a mock knowledge graph
 * @returns {Object} Mock knowledge graph
 */
function createMockKnowledgeGraph() {
  return {
    queryEntity: sinon.stub().resolves({
      id: 'entity1',
      name: 'Test Entity',
      type: 'person',
      confidence: 0.9
    }),
    addEntity: sinon.stub().resolves(true),
    updateEntity: sinon.stub().resolves(true),
    deleteEntity: sinon.stub().resolves(true)
  };
}

/**
 * Create a mock language model integration
 * @returns {Object} Mock language model integration
 */
function createMockLanguageModelIntegration() {
  return {
    enhanceUnderstanding: sinon.stub().resolves({
      intent: 'enhanced_intent',
      intentConfidence: 0.95,
      entities: [
        {
          type: 'person',
          value: 'John Doe',
          confidence: 0.9
        }
      ]
    }),
    generateResponse: sinon.stub().resolves({
      text: 'Generated response',
      confidence: 0.9
    })
  };
}

/**
 * Create a mock event emitter
 * @returns {EventEmitter} Mock event emitter
 */
function createMockEventEmitter() {
  return new EventEmitter();
}

module.exports = {
  createMockLogger,
  createMockConfigManager,
  createMockSecurityManager,
  createMockPerformanceTracker,
  createMockNetworkManager,
  createMockPlatformManager,
  createMockKnowledgeGraph,
  createMockLanguageModelIntegration,
  createMockEventEmitter
};
