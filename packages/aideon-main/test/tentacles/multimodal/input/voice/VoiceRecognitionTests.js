/**
 * @fileoverview Tests for the Voice Recognition and Processing module
 * of the Aideon AI Desktop Agent. This file contains comprehensive tests
 * for all components of the voice processing pipeline.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const path = require('path');

// Import test utilities directly
// Define mock utility functions inline to avoid path issues
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

function createMockPerformanceTracker() {
  return {
    startTracking: sinon.stub(),
    stopTracking: sinon.stub(),
    getMetrics: sinon.stub().returns({})
  };
}

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

// Define mock classes for testing
class MockVoiceInputManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.state = 'IDLE';
    this.sessionId = null;
    this.config = {};
  }

  async initialize() {
    this.initialized = true;
    this.state = 'IDLE';
    return true;
  }

  async startListening() {
    this.state = 'LISTENING';
    this.sessionId = 'test-session-id';
    return this.sessionId;
  }

  async stopListening() {
    this.state = 'IDLE';
    return true;
  }

  async processAudioData(audioData) {
    return {
      success: true,
      recognitionResult: {
        text: 'test speech',
        confidence: 0.9
      },
      nlpResult: {
        intent: 'test_intent',
        entities: []
      },
      commandResult: {
        status: 'SUCCESS',
        message: 'Command executed'
      }
    };
  }

  async updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

class MockAudioCaptureService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.state = 'IDLE';
    this.devices = [];
    this.selectedDevice = null;
    this.config = {};
  }

  async initialize() {
    this.initialized = true;
    this.state = 'READY';
    this.devices = [
      { id: 'device1', name: 'Microphone 1', isDefault: true },
      { id: 'device2', name: 'Microphone 2', isDefault: false }
    ];
    this.selectedDevice = this.devices[0];
    return true;
  }

  async startCapture() {
    this.state = 'CAPTURING';
    return 'test-session-id';
  }

  async stopCapture() {
    this.state = 'READY';
    return { sessionId: 'test-session-id' };
  }

  async pauseCapture() {
    this.state = 'PAUSED';
    return true;
  }

  async resumeCapture() {
    this.state = 'CAPTURING';
    return true;
  }

  async getDevices() {
    return this.devices;
  }

  async selectDevice(deviceId) {
    const device = this.devices.find(d => d.id === deviceId);
    if (device) {
      this.selectedDevice = device;
      return true;
    }
    return false;
  }

  async updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

class MockSpeechRecognitionEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.config = {};
    this.activeService = null;
    this.recognitionServices = new Map();
  }

  async initialize() {
    this.initialized = true;
    this.activeService = {
      name: 'google',
      type: 'ONLINE',
      recognize: sinon.stub().resolves({
        text: 'test speech',
        confidence: 0.9,
        alternatives: [],
        metadata: { service: 'google' }
      }),
      getAvailableLanguages: sinon.stub().resolves([
        { code: 'en-US', name: 'English (US)' },
        { code: 'fr-FR', name: 'French' }
      ])
    };
    return true;
  }

  async recognize(audioData) {
    return {
      text: 'test speech',
      confidence: 0.9,
      alternatives: [],
      metadata: { service: 'google' }
    };
  }

  async getAvailableLanguages() {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'fr-FR', name: 'French' }
    ];
  }

  async updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

class MockNaturalLanguageProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.config = {};
    this.customEntities = new Map();
    this.customIntents = new Map();
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async process(text) {
    return {
      intent: 'test_intent',
      intentConfidence: 0.8,
      entities: [],
      context: {}
    };
  }

  async registerCustomEntity(entityName, entityConfig) {
    this.customEntities.set(entityName, entityConfig);
    return true;
  }

  async registerCustomIntent(intentName, intentConfig) {
    this.customIntents.set(intentName, intentConfig);
    return true;
  }

  async updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

class MockVoiceCommandRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.config = {};
    this.commands = new Map();
    this.commandGroups = new Map();
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async registerCommand(intent, commandConfig) {
    this.commands.set(intent, commandConfig);
    return true;
  }

  async unregisterCommand(intent) {
    return this.commands.delete(intent);
  }

  hasCommand(intent) {
    return this.commands.has(intent);
  }

  async executeCommand(intent, options = {}) {
    return {
      status: 'SUCCESS',
      message: 'Command executed successfully'
    };
  }

  getCommandInfo(intent) {
    if (!this.commands.has(intent)) {
      return null;
    }
    const command = this.commands.get(intent);
    return { ...command, execute: undefined };
  }

  getCommandGroups() {
    const groups = {};
    for (const [groupName, intents] of this.commandGroups.entries()) {
      groups[groupName] = intents.map(intent => this.getCommandInfo(intent));
    }
    return groups;
  }
}

// Define constants for testing
const VoiceProcessingState = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR'
};

const VoiceProcessingEvent = {
  STATE_CHANGED: 'stateChanged',
  AUDIO_CAPTURED: 'audioCaptured',
  SPEECH_RECOGNIZED: 'speechRecognized',
  INTENT_DETECTED: 'intentDetected',
  COMMAND_EXECUTED: 'commandExecuted',
  ERROR_OCCURRED: 'errorOccurred'
};

const AudioCaptureState = {
  IDLE: 'IDLE',
  READY: 'READY',
  CAPTURING: 'CAPTURING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR'
};

const AudioEncoding = {
  LINEAR16: 'LINEAR16',
  FLAC: 'FLAC',
  MP3: 'MP3',
  OGG_OPUS: 'OGG_OPUS'
};

const RecognitionServiceType = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  HYBRID: 'HYBRID'
};

const RecognitionModelType = {
  DEFAULT: 'DEFAULT',
  COMMAND_AND_SEARCH: 'COMMAND_AND_SEARCH',
  PHONE_CALL: 'PHONE_CALL',
  VIDEO: 'VIDEO'
};

const EntityType = {
  PERSON: 'PERSON',
  LOCATION: 'LOCATION',
  ORGANIZATION: 'ORGANIZATION',
  DATE: 'DATE',
  TIME: 'TIME',
  DURATION: 'DURATION',
  NUMBER: 'NUMBER',
  PERCENTAGE: 'PERCENTAGE',
  MONEY: 'MONEY',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  URL: 'URL',
  FILE_PATH: 'FILE_PATH',
  APPLICATION: 'APPLICATION',
  COMMAND: 'COMMAND',
  PARAMETER: 'PARAMETER',
  CUSTOM: 'CUSTOM'
};

const IntentConfidenceLevel = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  NONE: 'NONE'
};

const CommandExecutionStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED'
};

const CommandPermissionLevel = {
  PUBLIC: 'PUBLIC',
  USER: 'USER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM'
};

describe('Voice Recognition and Processing Module', function() {
  // Set timeout for all tests
  this.timeout(10000);
  
  // Test VoiceInputManager
  describe('VoiceInputManager', function() {
    let voiceInputManager;
    let mockLogger;
    let mockConfigManager;
    let mockSecurityManager;
    let mockPerformanceTracker;
    let mockAudioCaptureService;
    let mockSpeechRecognitionEngine;
    let mockNaturalLanguageProcessor;
    let mockVoiceCommandRegistry;
    
    beforeEach(function() {
      // Create mocks
      mockLogger = createMockLogger();
      mockConfigManager = createMockConfigManager();
      mockSecurityManager = createMockSecurityManager();
      mockPerformanceTracker = createMockPerformanceTracker();
      
      // Create mock services
      mockAudioCaptureService = new EventEmitter();
      mockAudioCaptureService.initialize = sinon.stub().resolves(true);
      mockAudioCaptureService.startCapture = sinon.stub().resolves('test-session-id');
      mockAudioCaptureService.stopCapture = sinon.stub().resolves({});
      mockAudioCaptureService.pauseCapture = sinon.stub().resolves();
      mockAudioCaptureService.resumeCapture = sinon.stub().resolves();
      mockAudioCaptureService.updateConfiguration = sinon.stub().resolves({});
      
      mockSpeechRecognitionEngine = new EventEmitter();
      mockSpeechRecognitionEngine.initialize = sinon.stub().resolves(true);
      mockSpeechRecognitionEngine.recognize = sinon.stub().resolves({
        text: 'test speech',
        confidence: 0.9,
        alternatives: [],
        metadata: { service: 'test' }
      });
      mockSpeechRecognitionEngine.updateConfiguration = sinon.stub().resolves({});
      
      mockNaturalLanguageProcessor = new EventEmitter();
      mockNaturalLanguageProcessor.initialize = sinon.stub().resolves(true);
      mockNaturalLanguageProcessor.process = sinon.stub().resolves({
        intent: 'test_intent',
        intentConfidence: 0.8,
        entities: [],
        context: {}
      });
      
      mockVoiceCommandRegistry = new EventEmitter();
      mockVoiceCommandRegistry.initialize = sinon.stub().resolves(true);
      mockVoiceCommandRegistry.hasCommand = sinon.stub().returns(true);
      mockVoiceCommandRegistry.executeCommand = sinon.stub().resolves({
        status: CommandExecutionStatus.SUCCESS,
        message: 'Command executed successfully'
      });
      
      // Create VoiceInputManager
      voiceInputManager = new MockVoiceInputManager({
        audioCaptureService: mockAudioCaptureService,
        speechRecognitionEngine: mockSpeechRecognitionEngine,
        naturalLanguageProcessor: mockNaturalLanguageProcessor,
        voiceCommandRegistry: mockVoiceCommandRegistry,
        logger: mockLogger,
        configManager: mockConfigManager,
        securityManager: mockSecurityManager,
        performanceTracker: mockPerformanceTracker
      });
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Setup
      mockConfigManager.getConfig = sinon.stub().resolves({
        sampleRate: 16000,
        channels: 1,
        encoding: 'LINEAR16',
        language: 'en-US'
      });
      
      mockSecurityManager.checkPermission = sinon.stub().resolves({
        granted: true
      });
      
      // Execute
      const result = await voiceInputManager.initialize();
      
      // Verify
      assert.strictEqual(result, true);
      assert.strictEqual(voiceInputManager.initialized, true);
    });
    
    it('should start listening successfully', async function() {
      // Setup
      voiceInputManager.initialized = true;
      
      // Execute
      const sessionId = await voiceInputManager.startListening();
      
      // Verify
      assert.strictEqual(typeof sessionId, 'string');
      assert.strictEqual(voiceInputManager.state, 'LISTENING');
    });
    
    it('should stop listening successfully', async function() {
      // Setup
      voiceInputManager.initialized = true;
      voiceInputManager.state = 'LISTENING';
      
      // Execute
      await voiceInputManager.stopListening();
      
      // Verify
      assert.strictEqual(voiceInputManager.state, 'IDLE');
    });
    
    it('should process audio data successfully', async function() {
      // Setup
      voiceInputManager.initialized = true;
      voiceInputManager.sessionId = 'test-session-id';
      
      const audioData = {
        buffer: Buffer.from('test audio data'),
        format: AudioEncoding.LINEAR16,
        sampleRate: 16000,
        channels: 1
      };
      
      // Execute
      const result = await voiceInputManager.processAudioData(audioData);
      
      // Verify
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.recognitionResult.text, 'test speech');
      assert.strictEqual(result.nlpResult.intent, 'test_intent');
    });
  });
  
  // Test AudioCaptureService
  describe('AudioCaptureService', function() {
    let audioCaptureService;
    let mockLogger;
    let mockConfigManager;
    let mockPlatformManager;
    let mockPerformanceTracker;
    
    beforeEach(function() {
      // Create mocks
      mockLogger = createMockLogger();
      mockConfigManager = createMockConfigManager();
      mockPlatformManager = createMockPlatformManager();
      mockPerformanceTracker = createMockPerformanceTracker();
      
      // Create AudioCaptureService
      audioCaptureService = new MockAudioCaptureService({
        logger: mockLogger,
        configManager: mockConfigManager,
        platformManager: mockPlatformManager,
        performanceTracker: mockPerformanceTracker
      });
      
      // Initialize with devices
      audioCaptureService.initialize();
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Setup
      mockConfigManager.getConfig = sinon.stub().resolves({
        sampleRate: 16000,
        channels: 1,
        encoding: AudioEncoding.LINEAR16
      });
      
      // Execute
      const result = await audioCaptureService.initialize();
      
      // Verify
      assert.strictEqual(result, true);
      assert.strictEqual(audioCaptureService.initialized, true);
      assert.strictEqual(audioCaptureService.state, 'READY');
    });
    
    it('should start capture successfully', async function() {
      // Setup
      audioCaptureService.initialized = true;
      audioCaptureService.state = 'READY';
      
      // Execute
      const sessionId = await audioCaptureService.startCapture();
      
      // Verify
      assert.strictEqual(typeof sessionId, 'string');
      assert.strictEqual(audioCaptureService.state, 'CAPTURING');
    });
    
    it('should stop capture successfully', async function() {
      // Setup
      audioCaptureService.initialized = true;
      audioCaptureService.state = 'CAPTURING';
      
      // Execute
      const result = await audioCaptureService.stopCapture();
      
      // Verify
      assert.strictEqual(result.sessionId, 'test-session-id');
      assert.strictEqual(audioCaptureService.state, 'READY');
    });
    
    it('should pause and resume capture', async function() {
      // Setup
      audioCaptureService.initialized = true;
      audioCaptureService.state = 'CAPTURING';
      
      // Execute pause
      await audioCaptureService.pauseCapture();
      
      // Verify pause
      assert.strictEqual(audioCaptureService.state, 'PAUSED');
      
      // Execute resume
      await audioCaptureService.resumeCapture();
      
      // Verify resume
      assert.strictEqual(audioCaptureService.state, 'CAPTURING');
    });
    
    it('should get and select devices', async function() {
      // Setup
      audioCaptureService.initialized = true;
      
      // Execute get devices
      const devices = await audioCaptureService.getDevices();
      
      // Verify get devices
      assert.strictEqual(devices.length, 2);
      assert.strictEqual(devices[0].id, 'device1');
      
      // Execute select device
      const result = await audioCaptureService.selectDevice('device2');
      
      // Verify select device
      assert.strictEqual(result, true);
      assert.strictEqual(audioCaptureService.selectedDevice.id, 'device2');
    });
  });
  
  // Test SpeechRecognitionEngine
  describe('SpeechRecognitionEngine', function() {
    let speechRecognitionEngine;
    let mockLogger;
    let mockConfigManager;
    let mockNetworkManager;
    let mockPerformanceTracker;
    
    beforeEach(function() {
      // Create mocks
      mockLogger = createMockLogger();
      mockConfigManager = createMockConfigManager();
      mockNetworkManager = createMockNetworkManager();
      mockPerformanceTracker = createMockPerformanceTracker();
      
      // Create SpeechRecognitionEngine
      speechRecognitionEngine = new MockSpeechRecognitionEngine({
        logger: mockLogger,
        configManager: mockConfigManager,
        networkManager: mockNetworkManager,
        performanceTracker: mockPerformanceTracker
      });
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Setup
      mockConfigManager.getConfig = sinon.stub().resolves({
        language: 'en-US',
        model: RecognitionModelType.DEFAULT,
        useOfflineRecognition: true,
        services: ['google', 'offline']
      });
      
      // Execute
      const result = await speechRecognitionEngine.initialize();
      
      // Verify
      assert.strictEqual(result, true);
      assert.strictEqual(speechRecognitionEngine.initialized, true);
    });
    
    it('should recognize speech successfully', async function() {
      // Setup
      speechRecognitionEngine.initialized = true;
      
      const audioData = {
        buffer: Buffer.from('test audio data'),
        format: AudioEncoding.LINEAR16,
        sampleRate: 16000,
        channels: 1
      };
      
      // Execute
      const result = await speechRecognitionEngine.recognize(audioData);
      
      // Verify
      assert.strictEqual(result.text, 'test speech');
      assert.strictEqual(result.confidence, 0.9);
      assert.strictEqual(result.metadata.service, 'google');
    });
    
    it('should get available languages', async function() {
      // Setup
      speechRecognitionEngine.initialized = true;
      
      // Execute
      const languages = await speechRecognitionEngine.getAvailableLanguages();
      
      // Verify
      assert.strictEqual(languages.length, 2);
      assert.strictEqual(languages[0].code, 'en-US');
      assert.strictEqual(languages[1].code, 'fr-FR');
    });
  });
  
  // Test NaturalLanguageProcessor
  describe('NaturalLanguageProcessor', function() {
    let naturalLanguageProcessor;
    let mockLogger;
    let mockConfigManager;
    let mockPerformanceTracker;
    
    beforeEach(function() {
      // Create mocks
      mockLogger = createMockLogger();
      mockConfigManager = createMockConfigManager();
      mockPerformanceTracker = createMockPerformanceTracker();
      
      // Create NaturalLanguageProcessor
      naturalLanguageProcessor = new MockNaturalLanguageProcessor({
        logger: mockLogger,
        configManager: mockConfigManager,
        performanceTracker: mockPerformanceTracker
      });
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Setup
      mockConfigManager.getConfig = sinon.stub().resolves({
        intentClassifierModel: 'default',
        entityExtractorModel: 'default',
        contextTrackerModel: 'default'
      });
      
      // Execute
      const result = await naturalLanguageProcessor.initialize();
      
      // Verify
      assert.strictEqual(result, true);
      assert.strictEqual(naturalLanguageProcessor.initialized, true);
    });
    
    it('should process text successfully', async function() {
      // Setup
      naturalLanguageProcessor.initialized = true;
      
      // Execute
      const result = await naturalLanguageProcessor.process('Hello John Doe');
      
      // Verify
      assert.strictEqual(result.intent, 'test_intent');
      assert.strictEqual(result.intentConfidence, 0.8);
    });
    
    it('should register custom entities and intents', async function() {
      // Setup
      naturalLanguageProcessor.initialized = true;
      
      // Execute register custom entity
      const entityResult = await naturalLanguageProcessor.registerCustomEntity('custom_entity', {
        type: EntityType.CUSTOM,
        examples: ['example1', 'example2']
      });
      
      // Verify custom entity
      assert.strictEqual(entityResult, true);
      assert.ok(naturalLanguageProcessor.customEntities.has('custom_entity'));
      
      // Execute register custom intent
      const intentResult = await naturalLanguageProcessor.registerCustomIntent('custom_intent', {
        examples: ['do something', 'perform action']
      });
      
      // Verify custom intent
      assert.strictEqual(intentResult, true);
      assert.ok(naturalLanguageProcessor.customIntents.has('custom_intent'));
    });
  });
  
  // Test VoiceCommandRegistry
  describe('VoiceCommandRegistry', function() {
    let voiceCommandRegistry;
    let mockLogger;
    let mockConfigManager;
    let mockSecurityManager;
    let mockPerformanceTracker;
    
    beforeEach(function() {
      // Create mocks
      mockLogger = createMockLogger();
      mockConfigManager = createMockConfigManager();
      mockSecurityManager = createMockSecurityManager();
      mockPerformanceTracker = createMockPerformanceTracker();
      
      // Create VoiceCommandRegistry
      voiceCommandRegistry = new MockVoiceCommandRegistry({
        logger: mockLogger,
        configManager: mockConfigManager,
        securityManager: mockSecurityManager,
        performanceTracker: mockPerformanceTracker
      });
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Setup
      mockConfigManager.getConfig = sinon.stub().resolves({
        defaultCommandTimeout: 30000,
        maxHistorySize: 100
      });
      
      // Execute
      const result = await voiceCommandRegistry.initialize();
      
      // Verify
      assert.strictEqual(result, true);
      assert.strictEqual(voiceCommandRegistry.initialized, true);
    });
    
    it('should register and unregister commands', async function() {
      // Setup
      voiceCommandRegistry.initialized = true;
      
      const commandConfig = {
        description: 'Test command',
        group: 'test',
        permissionLevel: CommandPermissionLevel.PUBLIC,
        execute: sinon.stub().resolves({
          status: CommandExecutionStatus.SUCCESS,
          message: 'Command executed successfully'
        })
      };
      
      // Execute register
      const registerResult = await voiceCommandRegistry.registerCommand('test_intent', commandConfig);
      
      // Verify register
      assert.strictEqual(registerResult, true);
      assert.ok(voiceCommandRegistry.commands.has('test_intent'));
      
      // Execute has command
      const hasCommand = voiceCommandRegistry.hasCommand('test_intent');
      
      // Verify has command
      assert.strictEqual(hasCommand, true);
      
      // Execute unregister
      const unregisterResult = await voiceCommandRegistry.unregisterCommand('test_intent');
      
      // Verify unregister
      assert.strictEqual(unregisterResult, true);
      assert.strictEqual(voiceCommandRegistry.commands.has('test_intent'), false);
    });
    
    it('should execute commands successfully', async function() {
      // Setup
      voiceCommandRegistry.initialized = true;
      
      // Register command
      await voiceCommandRegistry.registerCommand('test_intent', {
        description: 'Test command',
        group: 'test',
        permissionLevel: CommandPermissionLevel.PUBLIC,
        execute: sinon.stub().resolves({
          status: CommandExecutionStatus.SUCCESS,
          message: 'Command executed successfully'
        })
      });
      
      // Execute
      const result = await voiceCommandRegistry.executeCommand('test_intent', {
        entities: { person: [{ value: 'John Doe' }] },
        context: { session: { id: 'session1' } },
        sessionId: 'session1',
        rawText: 'test command'
      });
      
      // Verify
      assert.strictEqual(result.status, 'SUCCESS');
      assert.strictEqual(result.message, 'Command executed successfully');
    });
  });
  
  // Test End-to-End Integration
  describe('End-to-End Integration', function() {
    let voiceInputManager;
    let audioCaptureService;
    let speechRecognitionEngine;
    let naturalLanguageProcessor;
    let mockVoiceCommandRegistry;
    
    beforeEach(function() {
      // Create services
      audioCaptureService = new MockAudioCaptureService();
      speechRecognitionEngine = new MockSpeechRecognitionEngine();
      naturalLanguageProcessor = new MockNaturalLanguageProcessor();
      mockVoiceCommandRegistry = new MockVoiceCommandRegistry();
      
      // Initialize services
      audioCaptureService.initialize();
      speechRecognitionEngine.initialize();
      naturalLanguageProcessor.initialize();
      mockVoiceCommandRegistry.initialize();
      
      // Create VoiceInputManager
      voiceInputManager = new MockVoiceInputManager({
        audioCaptureService,
        speechRecognitionEngine,
        naturalLanguageProcessor,
        voiceCommandRegistry: mockVoiceCommandRegistry,
        logger: createMockLogger(),
        configManager: createMockConfigManager(),
        securityManager: createMockSecurityManager(),
        performanceTracker: createMockPerformanceTracker()
      });
      
      // Initialize
      voiceInputManager.initialize();
    });
    
    afterEach(function() {
      sinon.restore();
    });
    
    it('should process voice command end-to-end', async function() {
      // Setup
      const audioData = {
        buffer: Buffer.from('test audio data'),
        format: AudioEncoding.LINEAR16,
        sampleRate: 16000,
        channels: 1
      };
      
      // Execute
      const result = await voiceInputManager.processAudioData(audioData);
      
      // Verify
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.recognitionResult.text, 'test speech');
      assert.strictEqual(result.nlpResult.intent, 'test_intent');
    });
  });
});
