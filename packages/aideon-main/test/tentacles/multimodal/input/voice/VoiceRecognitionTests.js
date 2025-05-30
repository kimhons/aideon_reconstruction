/**
 * @fileoverview Unit tests for the Voice Recognition and Processing module.
 * Tests the core functionality of VoiceInputManager and provider integration.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');

// Import modules
const { VoiceInputManager } = require('../../../src/tentacles/multimodal/input/voice/VoiceInputManager');
const { AudioCaptureService } = require('../../../src/tentacles/multimodal/input/voice/AudioCaptureService');
const { IntentRecognitionService } = require('../../../src/tentacles/multimodal/input/voice/IntentRecognitionService');

// Import providers
const { WhisperProvider } = require('../../../src/tentacles/multimodal/input/voice/providers/WhisperProvider');
const { GoogleSpeechProvider } = require('../../../src/tentacles/multimodal/input/voice/providers/GoogleSpeechProvider');
const { NemoProvider } = require('../../../src/tentacles/multimodal/input/voice/providers/NemoProvider');
const { VoskProvider } = require('../../../src/tentacles/multimodal/input/voice/providers/VoskProvider');

describe('Voice Recognition and Processing Module', function() {
  // Increase timeout for model loading
  this.timeout(10000);
  
  // Test fixtures
  let mockLogger;
  let mockResourceManager;
  let mockFs;
  let mockAudioInput;
  let mockConfig;
  
  // Components under test
  let voiceInputManager;
  let audioCaptureService;
  let intentRecognitionService;
  
  // Provider instances
  let whisperProvider;
  let googleSpeechProvider;
  let nemoProvider;
  let voskProvider;
  
  beforeEach(function() {
    // Set up mocks
    mockLogger = {
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
      debug: sinon.spy()
    };
    
    mockResourceManager = {
      checkResources: sinon.stub().resolves(true),
      allocateResources: sinon.stub().resolves(true),
      releaseResources: sinon.stub().resolves(true)
    };
    
    mockFs = {
      promises: {
        access: sinon.stub().resolves(),
        readFile: sinon.stub().resolves(Buffer.from('{"intents": []}')),
        writeFile: sinon.stub().resolves()
      }
    };
    
    mockAudioInput = {
      initialize: sinon.stub().resolves(),
      shutdown: sinon.stub().resolves(),
      startCapture: sinon.stub().resolves(),
      stopCapture: sinon.stub().resolves(),
      on: sinon.stub()
    };
    
    mockConfig = {
      providers: {
        whisper: {
          enabled: true,
          modelSize: 'small'
        },
        google: {
          enabled: true,
          apiKey: 'test-api-key'
        },
        nemo: {
          enabled: false
        },
        vosk: {
          enabled: true
        }
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        enhanceAudio: false
      },
      intent: {
        useCloudModel: false,
        customIntentsPath: path.join(__dirname, 'fixtures', 'custom-intents.json')
      }
    };
    
    // Create component instances
    audioCaptureService = new AudioCaptureService({
      sampleRate: mockConfig.audio.sampleRate,
      channels: mockConfig.audio.channels,
      bitDepth: mockConfig.audio.bitDepth,
      enhanceAudio: mockConfig.audio.enhanceAudio,
      logger: mockLogger,
      resourceManager: mockResourceManager
    });
    
    // Stub audioCaptureService methods
    sinon.stub(audioCaptureService, 'initialize').resolves(true);
    sinon.stub(audioCaptureService, 'shutdown').resolves(true);
    sinon.stub(audioCaptureService, 'startCapture').resolves(true);
    sinon.stub(audioCaptureService, 'stopCapture').resolves(true);
    
    intentRecognitionService = new IntentRecognitionService({
      logger: mockLogger,
      config: mockConfig.intent
    });
    
    // Stub intentRecognitionService methods
    sinon.stub(intentRecognitionService, 'initialize').resolves(true);
    sinon.stub(intentRecognitionService, 'shutdown').resolves(true);
    sinon.stub(intentRecognitionService, 'extractIntent').resolves({
      name: 'test_intent',
      confidence: 0.9,
      entities: []
    });
    
    // Create provider instances with stubs
    whisperProvider = new WhisperProvider({
      modelSize: mockConfig.providers.whisper.modelSize,
      logger: mockLogger,
      resourceManager: mockResourceManager
    });
    
    // Stub whisperProvider methods
    sinon.stub(whisperProvider, 'initialize').resolves(true);
    sinon.stub(whisperProvider, 'shutdown').resolves(true);
    sinon.stub(whisperProvider, 'recognize').resolves({
      text: 'This is a test',
      language: 'en-US',
      confidence: 0.95,
      segments: []
    });
    sinon.stub(whisperProvider, 'processStreamingChunk').resolves({
      text: 'This is a test',
      isFinal: true,
      confidence: 0.95
    });
    
    googleSpeechProvider = new GoogleSpeechProvider({
      apiKey: mockConfig.providers.google.apiKey,
      logger: mockLogger
    });
    
    // Stub googleSpeechProvider methods
    sinon.stub(googleSpeechProvider, 'initialize').resolves(true);
    sinon.stub(googleSpeechProvider, 'shutdown').resolves(true);
    sinon.stub(googleSpeechProvider, 'recognize').resolves({
      text: 'This is a Google test',
      language: 'en-US',
      confidence: 0.92,
      segments: []
    });
    sinon.stub(googleSpeechProvider, 'processStreamingChunk').resolves({
      text: 'This is a Google test',
      isFinal: true,
      confidence: 0.92
    });
    
    nemoProvider = new NemoProvider({
      logger: mockLogger,
      resourceManager: mockResourceManager
    });
    
    // Stub nemoProvider methods
    sinon.stub(nemoProvider, 'initialize').resolves(true);
    sinon.stub(nemoProvider, 'shutdown').resolves(true);
    sinon.stub(nemoProvider, 'recognize').resolves({
      text: 'This is a NeMo test',
      language: 'en-US',
      confidence: 0.98,
      segments: []
    });
    
    voskProvider = new VoskProvider({
      logger: mockLogger
    });
    
    // Stub voskProvider methods
    sinon.stub(voskProvider, 'initialize').resolves(true);
    sinon.stub(voskProvider, 'shutdown').resolves(true);
    sinon.stub(voskProvider, 'recognize').resolves({
      text: 'This is a Vosk test',
      language: 'en-US',
      confidence: 0.85,
      segments: []
    });
    sinon.stub(voskProvider, 'processStreamingChunk').resolves({
      text: 'This is a Vosk test',
      isFinal: true,
      confidence: 0.85
    });
    
    // Create VoiceInputManager with mocked dependencies
    voiceInputManager = new VoiceInputManager({
      config: mockConfig,
      logger: mockLogger,
      resourceManager: mockResourceManager,
      audioCaptureService: audioCaptureService,
      intentRecognitionService: intentRecognitionService,
      providers: {
        whisper: whisperProvider,
        google: googleSpeechProvider,
        nemo: nemoProvider,
        vosk: voskProvider
      }
    });
  });
  
  afterEach(function() {
    sinon.restore();
  });
  
  describe('Initialization and Shutdown', function() {
    it('should initialize successfully', async function() {
      const result = await voiceInputManager.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(mockLogger.info.calledWith('VoiceInputManager initialized successfully'), true);
      assert.strictEqual(audioCaptureService.initialize.calledOnce, true);
      assert.strictEqual(intentRecognitionService.initialize.calledOnce, true);
      assert.strictEqual(whisperProvider.initialize.calledOnce, true);
      assert.strictEqual(googleSpeechProvider.initialize.calledOnce, true);
      assert.strictEqual(voskProvider.initialize.calledOnce, true);
      // NeMo is disabled in config
      assert.strictEqual(nemoProvider.initialize.called, false);
    });
    
    it('should shut down successfully', async function() {
      await voiceInputManager.initialize();
      const result = await voiceInputManager.shutdown();
      assert.strictEqual(result, true);
      assert.strictEqual(mockLogger.info.calledWith('VoiceInputManager shut down successfully'), true);
      assert.strictEqual(audioCaptureService.shutdown.calledOnce, true);
      assert.strictEqual(intentRecognitionService.shutdown.calledOnce, true);
      assert.strictEqual(whisperProvider.shutdown.calledOnce, true);
      assert.strictEqual(googleSpeechProvider.shutdown.calledOnce, true);
      assert.strictEqual(voskProvider.shutdown.calledOnce, true);
    });
  });
  
  describe('Voice Recognition', function() {
    beforeEach(async function() {
      await voiceInputManager.initialize();
    });
    
    it('should start listening successfully', async function() {
      const result = await voiceInputManager.startListening();
      assert.strictEqual(result, true);
      assert.strictEqual(audioCaptureService.startCapture.calledOnce, true);
    });
    
    it('should stop listening successfully', async function() {
      await voiceInputManager.startListening();
      const result = await voiceInputManager.stopListening();
      assert.strictEqual(result, true);
      assert.strictEqual(audioCaptureService.stopCapture.calledOnce, true);
    });
    
    it('should recognize speech using the primary provider', async function() {
      const audioData = Buffer.from('test audio data');
      const result = await voiceInputManager.recognizeSpeech({
        audio: audioData,
        language: 'en-US',
        sampleRate: 16000,
        encoding: 'LINEAR16'
      });
      
      assert.strictEqual(result.text, 'This is a test');
      assert.strictEqual(result.confidence, 0.95);
      assert.strictEqual(whisperProvider.recognize.calledOnce, true);
      assert.strictEqual(googleSpeechProvider.recognize.called, false);
      assert.strictEqual(voskProvider.recognize.called, false);
    });
    
    it('should fall back to secondary provider if primary fails', async function() {
      whisperProvider.recognize.rejects(new Error('Recognition failed'));
      
      const audioData = Buffer.from('test audio data');
      const result = await voiceInputManager.recognizeSpeech({
        audio: audioData,
        language: 'en-US',
        sampleRate: 16000,
        encoding: 'LINEAR16'
      });
      
      assert.strictEqual(result.text, 'This is a Google test');
      assert.strictEqual(result.confidence, 0.92);
      assert.strictEqual(whisperProvider.recognize.calledOnce, true);
      assert.strictEqual(googleSpeechProvider.recognize.calledOnce, true);
      assert.strictEqual(voskProvider.recognize.called, false);
    });
    
    it('should extract intent from recognized text', async function() {
      const result = await voiceInputManager.processVoiceCommand('Turn on the lights');
      
      assert.strictEqual(result.intent.name, 'test_intent');
      assert.strictEqual(result.intent.confidence, 0.9);
      assert.strictEqual(intentRecognitionService.extractIntent.calledOnce, true);
      assert.strictEqual(intentRecognitionService.extractIntent.calledWith('Turn on the lights'), true);
    });
  });
  
  describe('Streaming Recognition', function() {
    beforeEach(async function() {
      await voiceInputManager.initialize();
    });
    
    it('should process streaming audio chunks', async function() {
      const sessionId = 'test-session';
      const audioChunk = Buffer.from('test audio chunk');
      
      // Start streaming session
      await voiceInputManager.startStreamingRecognition(sessionId, 'en-US');
      
      // Process chunk
      const result = await voiceInputManager.processStreamingChunk({
        sessionId,
        chunk: audioChunk
      });
      
      assert.strictEqual(result.text, 'This is a test');
      assert.strictEqual(result.isFinal, true);
      assert.strictEqual(whisperProvider.processStreamingChunk.calledOnce, true);
    });
    
    it('should stop streaming recognition', async function() {
      const sessionId = 'test-session';
      
      // Start streaming session
      await voiceInputManager.startStreamingRecognition(sessionId, 'en-US');
      
      // Stop streaming session
      const result = await voiceInputManager.stopStreamingRecognition(sessionId);
      assert.strictEqual(result, true);
    });
  });
  
  describe('Provider Selection', function() {
    beforeEach(async function() {
      await voiceInputManager.initialize();
    });
    
    it('should select provider based on tier', async function() {
      // Test Core tier
      voiceInputManager.setTier('core');
      let provider = await voiceInputManager.selectProvider();
      assert.strictEqual(provider, voskProvider);
      
      // Test Pro tier
      voiceInputManager.setTier('pro');
      provider = await voiceInputManager.selectProvider();
      assert.strictEqual(provider, whisperProvider);
      
      // Test Enterprise tier
      voiceInputManager.setTier('enterprise');
      provider = await voiceInputManager.selectProvider();
      assert.strictEqual(provider, googleSpeechProvider);
    });
    
    it('should select provider based on available resources', async function() {
      // Make Whisper unavailable due to resources
      mockResourceManager.checkResources.withArgs('whisper').resolves(false);
      
      // Should fall back to Google
      const provider = await voiceInputManager.selectProvider();
      assert.strictEqual(provider, googleSpeechProvider);
    });
  });
});
