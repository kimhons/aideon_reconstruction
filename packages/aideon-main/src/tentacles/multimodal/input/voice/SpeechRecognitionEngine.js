/**
 * @fileoverview SpeechRecognitionEngine converts audio to text with high accuracy
 * for the Aideon AI Desktop Agent. It supports multiple recognition services
 * and provides offline capabilities.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { LogManager } = require('../../../core/logging/LogManager');
const { ConfigManager } = require('../../../core/config/ConfigManager');
const { NetworkManager } = require('../../../core/network/NetworkManager');
const { PerformanceTracker } = require('../../../core/performance/PerformanceTracker');
const { AudioEncoding } = require('./AudioCaptureService');

/**
 * Recognition service types
 * @enum {string}
 */
const RecognitionServiceType = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  HYBRID: 'hybrid'
};

/**
 * Recognition model types
 * @enum {string}
 */
const RecognitionModelType = {
  COMMAND_AND_SEARCH: 'command_and_search',
  PHONE_CALL: 'phone_call',
  VIDEO: 'video',
  DEFAULT: 'default',
  MEDICAL: 'medical',
  SHORT_FORM: 'short_form',
  LONG_FORM: 'long_form'
};

/**
 * SpeechRecognitionEngine class
 * Converts audio to text with high accuracy
 */
class SpeechRecognitionEngine extends EventEmitter {
  /**
   * Create a new SpeechRecognitionEngine
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Optional custom logger
   * @param {Object} [options.configManager] - Optional custom config manager
   * @param {Object} [options.networkManager] - Optional custom network manager
   * @param {Object} [options.performanceTracker] - Optional custom performance tracker
   */
  constructor(options = {}) {
    super();
    
    // Initialize system services
    this.logger = options.logger || LogManager.getLogger('SpeechRecognitionEngine');
    this.configManager = options.configManager || ConfigManager.getInstance();
    this.networkManager = options.networkManager || NetworkManager.getInstance();
    this.performanceTracker = options.performanceTracker || new PerformanceTracker('SpeechRecognitionEngine');
    
    // Initialize state
    this.config = {};
    this.initialized = false;
    this.recognitionServices = new Map();
    this.activeService = null;
    this.languageDetector = null;
    this.processingQueue = [];
    this.activeRecognitionTask = null;
    this.recognitionHistory = [];
    this.cachedModels = new Set();
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.recognize = this.recognize.bind(this);
    this.updateConfiguration = this.updateConfiguration.bind(this);
    this.getAvailableLanguages = this.getAvailableLanguages.bind(this);
    this.downloadOfflineModel = this.downloadOfflineModel.bind(this);
    this.removeOfflineModel = this.removeOfflineModel.bind(this);
    this._loadConfiguration = this._loadConfiguration.bind(this);
    this._initializeServices = this._initializeServices.bind(this);
    this._selectService = this._selectService.bind(this);
    this._processQueue = this._processQueue.bind(this);
    this._handleRecognitionResult = this._handleRecognitionResult.bind(this);
    
    this.logger.info('SpeechRecognitionEngine created');
  }
  
  /**
   * Initialize the speech recognition engine
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization successful
   * @throws {Error} If initialization fails
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing speech recognition engine');
      this.performanceTracker.startTracking('initialize');
      
      // Load configuration
      await this._loadConfiguration(options);
      
      // Initialize recognition services
      await this._initializeServices();
      
      // Select initial service
      await this._selectService();
      
      // Initialize language detector if needed
      if (this.config.autoDetectLanguage) {
        await this._initializeLanguageDetector();
      }
      
      // Mark as initialized
      this.initialized = true;
      
      this.performanceTracker.stopTracking('initialize');
      this.logger.info('Speech recognition engine initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceTracker.stopTracking('initialize');
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} [options] - Recognition options
   * @param {string} [options.language] - Language code to use for recognition
   * @param {string} [options.model] - Model type to use for recognition
   * @param {boolean} [options.interimResults] - Whether to return interim results
   * @returns {Promise<Object>} - Recognition result
   * @throws {Error} If recognition fails
   */
  async recognize(audioData, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('SpeechRecognitionEngine not initialized');
      }
      
      this.logger.debug('Starting speech recognition');
      this.performanceTracker.startTracking('recognize');
      
      // Create recognition task
      const recognitionId = uuidv4();
      const task = {
        id: recognitionId,
        audioData,
        options: {
          language: options.language || this.config.language,
          model: options.model || this.config.model,
          interimResults: options.interimResults || false
        },
        timestamp: Date.now()
      };
      
      // Add to processing queue
      this.processingQueue.push(task);
      
      // Process queue
      const result = await this._processQueue();
      
      this.performanceTracker.stopTracking('recognize');
      
      return result;
    } catch (error) {
      this.performanceTracker.stopTracking('recognize');
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   * @returns {Promise<Object>} - Updated configuration
   */
  async updateConfiguration(newConfig) {
    try {
      this.logger.info('Updating speech recognition configuration');
      
      // Merge new config with existing
      Object.assign(this.config, newConfig);
      
      // Save to config manager
      await this.configManager.setConfig('speechRecognition', this.config);
      
      // Reinitialize services if needed
      if (this.initialized && 
          (newConfig.services || newConfig.offlineModelPath || 
           newConfig.serviceApiKeys || newConfig.serviceEndpoints)) {
        await this._initializeServices();
      }
      
      // Select service based on new config
      if (this.initialized) {
        await this._selectService();
      }
      
      // Reinitialize language detector if needed
      if (this.initialized && 
          (newConfig.autoDetectLanguage !== undefined || 
           newConfig.languageDetectionThreshold !== undefined)) {
        await this._initializeLanguageDetector();
      }
      
      this.logger.info('Speech recognition configuration updated');
      return this.config;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    try {
      if (!this.initialized) {
        throw new Error('SpeechRecognitionEngine not initialized');
      }
      
      this.logger.debug('Getting available languages');
      
      // Get languages from active service
      if (!this.activeService) {
        return [];
      }
      
      const languages = await this.activeService.getAvailableLanguages();
      
      this.logger.debug(`Found ${languages.length} available languages`);
      return languages;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Download offline recognition model
   * @param {Object} options - Download options
   * @param {string} options.language - Language code to download
   * @param {string} [options.model] - Model type to download
   * @returns {Promise<Object>} - Download result
   */
  async downloadOfflineModel(options) {
    try {
      if (!this.initialized) {
        throw new Error('SpeechRecognitionEngine not initialized');
      }
      
      if (!options.language) {
        throw new Error('Language is required');
      }
      
      this.logger.info(`Downloading offline model for language: ${options.language}`);
      
      // Find offline service
      const offlineService = Array.from(this.recognitionServices.values())
        .find(service => service.type === RecognitionServiceType.OFFLINE);
      
      if (!offlineService) {
        throw new Error('No offline recognition service available');
      }
      
      // Download model
      const result = await offlineService.downloadModel({
        language: options.language,
        model: options.model || RecognitionModelType.DEFAULT,
        path: this.config.offlineModelPath
      });
      
      // Add to cached models
      const modelKey = `${options.language}_${options.model || RecognitionModelType.DEFAULT}`;
      this.cachedModels.add(modelKey);
      
      this.logger.info(`Offline model downloaded for language: ${options.language}`);
      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Remove offline recognition model
   * @param {Object} options - Remove options
   * @param {string} options.language - Language code to remove
   * @param {string} [options.model] - Model type to remove
   * @returns {Promise<boolean>} - True if removal successful
   */
  async removeOfflineModel(options) {
    try {
      if (!this.initialized) {
        throw new Error('SpeechRecognitionEngine not initialized');
      }
      
      if (!options.language) {
        throw new Error('Language is required');
      }
      
      this.logger.info(`Removing offline model for language: ${options.language}`);
      
      // Find offline service
      const offlineService = Array.from(this.recognitionServices.values())
        .find(service => service.type === RecognitionServiceType.OFFLINE);
      
      if (!offlineService) {
        throw new Error('No offline recognition service available');
      }
      
      // Remove model
      const result = await offlineService.removeModel({
        language: options.language,
        model: options.model || RecognitionModelType.DEFAULT,
        path: this.config.offlineModelPath
      });
      
      // Remove from cached models
      const modelKey = `${options.language}_${options.model || RecognitionModelType.DEFAULT}`;
      this.cachedModels.delete(modelKey);
      
      this.logger.info(`Offline model removed for language: ${options.language}`);
      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Get recognition history
   * @param {number} [limit] - Maximum number of history items to return
   * @returns {Array} - Recognition history
   */
  getRecognitionHistory(limit) {
    if (limit && limit > 0) {
      return this.recognitionHistory.slice(0, limit);
    }
    return [...this.recognitionHistory];
  }
  
  /**
   * Clear recognition history
   */
  clearRecognitionHistory() {
    this.recognitionHistory = [];
  }
  
  /**
   * Load configuration from config manager
   * @param {Object} options - Override options
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfiguration(options = {}) {
    // Get configuration from config manager
    const savedConfig = await this.configManager.getConfig('speechRecognition') || {};
    
    // Default configuration
    const defaultConfig = {
      // Recognition settings
      language: 'en-US',
      model: RecognitionModelType.DEFAULT,
      useOfflineRecognition: true,
      fallbackToOffline: true,
      minimumConfidence: 0.6,
      
      // Service settings
      services: ['google', 'azure', 'offline'],
      servicePreference: 'auto', // 'auto', 'online', 'offline'
      serviceApiKeys: {},
      serviceEndpoints: {},
      
      // Language settings
      autoDetectLanguage: false,
      languageDetectionThreshold: 0.8,
      
      // Offline settings
      offlineModelPath: './models/speech',
      preloadLanguages: ['en-US'],
      
      // Advanced settings
      maxAlternatives: 3,
      enableProfanityFilter: true,
      enableAutomaticPunctuation: true,
      enableWordTimestamps: false,
      enableSpeakerDiarization: false,
      maxSpeakers: 2
    };
    
    // Merge default with saved config and override options
    this.config = { ...defaultConfig, ...savedConfig, ...options };
    
    this.logger.debug('Configuration loaded', this.config);
  }
  
  /**
   * Initialize recognition services
   * @private
   * @returns {Promise<void>}
   */
  async _initializeServices() {
    try {
      this.logger.debug('Initializing recognition services');
      
      // Clear existing services
      this.recognitionServices.clear();
      
      // Initialize services based on configuration
      for (const serviceName of this.config.services) {
        try {
          let service;
          
          switch (serviceName.toLowerCase()) {
            case 'google':
              service = new GoogleSpeechRecognitionService({
                apiKey: this.config.serviceApiKeys.google,
                endpoint: this.config.serviceEndpoints.google,
                logger: this.logger.child({ service: 'google' })
              });
              break;
              
            case 'azure':
              service = new AzureSpeechRecognitionService({
                apiKey: this.config.serviceApiKeys.azure,
                endpoint: this.config.serviceEndpoints.azure,
                region: this.config.serviceRegions?.azure,
                logger: this.logger.child({ service: 'azure' })
              });
              break;
              
            case 'offline':
              service = new OfflineSpeechRecognitionService({
                modelPath: this.config.offlineModelPath,
                logger: this.logger.child({ service: 'offline' })
              });
              break;
              
            case 'whisper':
              service = new WhisperSpeechRecognitionService({
                apiKey: this.config.serviceApiKeys.whisper,
                endpoint: this.config.serviceEndpoints.whisper,
                logger: this.logger.child({ service: 'whisper' })
              });
              break;
              
            default:
              this.logger.warn(`Unknown recognition service: ${serviceName}`);
              continue;
          }
          
          // Initialize service
          await service.initialize();
          
          // Add to services map
          this.recognitionServices.set(serviceName.toLowerCase(), service);
          
          this.logger.debug(`Initialized recognition service: ${serviceName}`);
        } catch (error) {
          this.logger.error(`Failed to initialize recognition service: ${serviceName}`, error);
        }
      }
      
      if (this.recognitionServices.size === 0) {
        throw new Error('No recognition services could be initialized');
      }
      
      // Preload offline models if needed
      if (this.config.useOfflineRecognition && this.config.preloadLanguages?.length > 0) {
        await this._preloadOfflineModels();
      }
      
      this.logger.debug(`Initialized ${this.recognitionServices.size} recognition services`);
    } catch (error) {
      this.logger.error('Error initializing recognition services', error);
      throw error;
    }
  }
  
  /**
   * Preload offline models
   * @private
   * @returns {Promise<void>}
   */
  async _preloadOfflineModels() {
    try {
      const offlineService = Array.from(this.recognitionServices.values())
        .find(service => service.type === RecognitionServiceType.OFFLINE);
      
      if (!offlineService) {
        this.logger.warn('No offline service available for preloading models');
        return;
      }
      
      this.logger.debug(`Preloading offline models for ${this.config.preloadLanguages.length} languages`);
      
      for (const language of this.config.preloadLanguages) {
        try {
          await offlineService.downloadModel({
            language,
            model: RecognitionModelType.DEFAULT,
            path: this.config.offlineModelPath
          });
          
          // Add to cached models
          const modelKey = `${language}_${RecognitionModelType.DEFAULT}`;
          this.cachedModels.add(modelKey);
          
          this.logger.debug(`Preloaded offline model for language: ${language}`);
        } catch (error) {
          this.logger.warn(`Failed to preload offline model for language: ${language}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error preloading offline models', error);
    }
  }
  
  /**
   * Initialize language detector
   * @private
   * @returns {Promise<void>}
   */
  async _initializeLanguageDetector() {
    try {
      if (!this.config.autoDetectLanguage) {
        this.languageDetector = null;
        return;
      }
      
      this.logger.debug('Initializing language detector');
      
      // Create language detector
      this.languageDetector = new LanguageDetector({
        threshold: this.config.languageDetectionThreshold,
        logger: this.logger.child({ component: 'languageDetector' })
      });
      
      await this.languageDetector.initialize();
      
      this.logger.debug('Language detector initialized');
    } catch (error) {
      this.logger.error('Error initializing language detector', error);
      this.languageDetector = null;
    }
  }
  
  /**
   * Select recognition service based on configuration and network status
   * @private
   * @returns {Promise<void>}
   */
  async _selectService() {
    try {
      this.logger.debug('Selecting recognition service');
      
      if (this.recognitionServices.size === 0) {
        throw new Error('No recognition services available');
      }
      
      let selectedService = null;
      
      // Check network status
      const isOnline = await this.networkManager.isOnline();
      
      // Select service based on preference and network status
      if (this.config.servicePreference === 'online') {
        // Prefer online service
        if (isOnline) {
          // Try to find Google or Azure service
          selectedService = this.recognitionServices.get('google') || 
                           this.recognitionServices.get('azure') ||
                           this.recognitionServices.get('whisper');
        }
        
        // Fall back to offline if needed
        if (!selectedService && this.config.fallbackToOffline) {
          selectedService = this.recognitionServices.get('offline');
        }
      } else if (this.config.servicePreference === 'offline') {
        // Prefer offline service
        selectedService = this.recognitionServices.get('offline');
        
        // Fall back to online if needed
        if (!selectedService && isOnline) {
          selectedService = this.recognitionServices.get('google') || 
                           this.recognitionServices.get('azure') ||
                           this.recognitionServices.get('whisper');
        }
      } else {
        // Auto select based on network status
        if (isOnline) {
          selectedService = this.recognitionServices.get('google') || 
                           this.recognitionServices.get('azure') ||
                           this.recognitionServices.get('whisper');
        }
        
        if (!selectedService) {
          selectedService = this.recognitionServices.get('offline');
        }
      }
      
      if (!selectedService) {
        throw new Error('No suitable recognition service available');
      }
      
      this.activeService = selectedService;
      
      this.logger.debug(`Selected recognition service: ${this.activeService.name}`);
    } catch (error) {
      this.logger.error('Error selecting recognition service', error);
      throw error;
    }
  }
  
  /**
   * Process the recognition queue
   * @private
   * @returns {Promise<Object>} - Recognition result
   */
  async _processQueue() {
    // If already processing, wait for current task to complete
    if (this.activeRecognitionTask) {
      return new Promise((resolve, reject) => {
        const checkTask = () => {
          if (!this.activeRecognitionTask) {
            // Process next item
            this._processQueue().then(resolve).catch(reject);
          } else {
            setTimeout(checkTask, 100);
          }
        };
        
        checkTask();
      });
    }
    
    // If queue is empty, return null
    if (this.processingQueue.length === 0) {
      return null;
    }
    
    // Get next item from queue
    const task = this.processingQueue.shift();
    
    // Process recognition task
    this.activeRecognitionTask = this._processRecognitionTask(task)
      .then(result => {
        this.activeRecognitionTask = null;
        
        // Process next item if available
        if (this.processingQueue.length > 0) {
          this._processQueue();
        }
        
        return result;
      })
      .catch(error => {
        this.activeRecognitionTask = null;
        
        // Process next item if available
        if (this.processingQueue.length > 0) {
          this._processQueue();
        }
        
        throw error;
      });
    
    return this.activeRecognitionTask;
  }
  
  /**
   * Process recognition task
   * @param {Object} task - Recognition task
   * @private
   * @returns {Promise<Object>} - Recognition result
   */
  async _processRecognitionTask(task) {
    try {
      this.logger.debug(`Processing recognition task: ${task.id}`);
      
      // Check if service needs to be reselected
      await this._selectService();
      
      if (!this.activeService) {
        throw new Error('No active recognition service available');
      }
      
      // Detect language if needed
      let language = task.options.language;
      
      if (this.config.autoDetectLanguage && this.languageDetector) {
        try {
          const detectedLanguage = await this.languageDetector.detectLanguage(task.audioData);
          
          if (detectedLanguage && detectedLanguage.confidence >= this.config.languageDetectionThreshold) {
            language = detectedLanguage.language;
            this.logger.debug(`Detected language: ${language} (confidence: ${detectedLanguage.confidence})`);
          }
        } catch (error) {
          this.logger.warn('Language detection failed', error);
        }
      }
      
      // Prepare recognition options
      const recognitionOptions = {
        language,
        model: task.options.model,
        maxAlternatives: this.config.maxAlternatives,
        enableProfanityFilter: this.config.enableProfanityFilter,
        enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
        enableWordTimestamps: this.config.enableWordTimestamps,
        enableSpeakerDiarization: this.config.enableSpeakerDiarization,
        maxSpeakers: this.config.maxSpeakers,
        interimResults: task.options.interimResults
      };
      
      // Perform recognition
      const result = await this.activeService.recognize(task.audioData, recognitionOptions);
      
      // Handle result
      return this._handleRecognitionResult(task, result);
    } catch (error) {
      this.logger.error(`Recognition task failed: ${task.id}`, error);
      
      // Try fallback if available
      if (this.config.fallbackToOffline && 
          this.activeService.type !== RecognitionServiceType.OFFLINE) {
        try {
          this.logger.debug('Attempting fallback to offline recognition');
          
          const offlineService = this.recognitionServices.get('offline');
          
          if (offlineService) {
            // Check if model is available
            const modelKey = `${task.options.language}_${task.options.model}`;
            
            if (!this.cachedModels.has(modelKey)) {
              // Try to download model
              await this.downloadOfflineModel({
                language: task.options.language,
                model: task.options.model
              });
            }
            
            // Prepare recognition options
            const recognitionOptions = {
              language: task.options.language,
              model: task.options.model,
              maxAlternatives: this.config.maxAlternatives,
              enableProfanityFilter: this.config.enableProfanityFilter,
              enableAutomaticPunctuation: this.config.enableAutomaticPunctuation
            };
            
            // Perform offline recognition
            const result = await offlineService.recognize(task.audioData, recognitionOptions);
            
            // Handle result
            return this._handleRecognitionResult(task, result);
          }
        } catch (fallbackError) {
          this.logger.error('Fallback to offline recognition failed', fallbackError);
        }
      }
      
      // Return error result
      return {
        text: '',
        confidence: 0,
        alternatives: [],
        error: {
          message: error.message,
          code: error.code || 'RECOGNITION_FAILED'
        },
        metadata: {
          taskId: task.id,
          timestamp: Date.now(),
          duration: Date.now() - task.timestamp,
          service: this.activeService ? this.activeService.name : 'unknown'
        }
      };
    }
  }
  
  /**
   * Handle recognition result
   * @param {Object} task - Recognition task
   * @param {Object} result - Recognition result
   * @private
   * @returns {Object} - Processed result
   */
  _handleRecognitionResult(task, result) {
    // Add task metadata
    const processedResult = {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        taskId: task.id,
        timestamp: Date.now(),
        duration: Date.now() - task.timestamp,
        service: this.activeService ? this.activeService.name : 'unknown'
      }
    };
    
    // Add to history
    this.recognitionHistory.unshift({
      id: task.id,
      text: processedResult.text,
      confidence: processedResult.confidence,
      language: task.options.language,
      timestamp: Date.now(),
      duration: Date.now() - task.timestamp,
      service: this.activeService ? this.activeService.name : 'unknown'
    });
    
    // Limit history size
    if (this.recognitionHistory.length > 100) {
      this.recognitionHistory = this.recognitionHistory.slice(0, 100);
    }
    
    // Emit recognition result event
    this.emit('recognitionResult', processedResult);
    
    return processedResult;
  }
}

/**
 * Base class for speech recognition services
 */
class BaseSpeechRecognitionService {
  /**
   * Create a new BaseSpeechRecognitionService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.name = 'base';
    this.type = RecognitionServiceType.ONLINE;
    this.logger = options.logger || LogManager.getLogger('BaseSpeechRecognitionService');
    this.initialized = false;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} options - Recognition options
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(audioData, options) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    throw new Error('Method not implemented');
  }
}

/**
 * Google Speech Recognition Service
 */
class GoogleSpeechRecognitionService extends BaseSpeechRecognitionService {
  /**
   * Create a new GoogleSpeechRecognitionService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);
    this.name = 'google';
    this.type = RecognitionServiceType.ONLINE;
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint || 'https://speech.googleapis.com/v1/speech:recognize';
    this.client = null;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Google Speech Recognition Service');
      
      // Check if API key is available
      if (!this.apiKey) {
        this.logger.warn('Google Speech API key not provided');
      }
      
      // Create HTTP client
      this.client = {
        post: async (url, data) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
          }
          
          return await response.json();
        }
      };
      
      this.initialized = true;
      this.logger.debug('Google Speech Recognition Service initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Google Speech Recognition Service', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} options - Recognition options
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(audioData, options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Recognizing speech with Google Speech Recognition');
      
      // Convert audio data to base64
      const audioBase64 = this._arrayBufferToBase64(audioData.buffer);
      
      // Prepare request
      const request = {
        config: {
          encoding: this._mapEncoding(audioData.format),
          sampleRateHertz: audioData.sampleRate,
          languageCode: options.language || 'en-US',
          model: this._mapModel(options.model),
          maxAlternatives: options.maxAlternatives || 1,
          profanityFilter: options.enableProfanityFilter,
          enableAutomaticPunctuation: options.enableAutomaticPunctuation,
          enableWordTimeOffsets: options.enableWordTimestamps,
          diarizationConfig: options.enableSpeakerDiarization ? {
            enableSpeakerDiarization: true,
            maxSpeakerCount: options.maxSpeakers || 2
          } : undefined
        },
        audio: {
          content: audioBase64
        }
      };
      
      // Send request
      const response = await this.client.post(this.endpoint, request);
      
      // Process response
      return this._processResponse(response);
    } catch (error) {
      this.logger.error('Google Speech Recognition failed', error);
      throw error;
    }
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Getting available languages from Google Speech Recognition');
      
      // Google Speech supports many languages, but we'll return a subset of common ones
      return [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'es-MX', name: 'Spanish (Mexico)' },
        { code: 'fr-FR', name: 'French' },
        { code: 'de-DE', name: 'German' },
        { code: 'it-IT', name: 'Italian' },
        { code: 'ja-JP', name: 'Japanese' },
        { code: 'ko-KR', name: 'Korean' },
        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'zh-TW', name: 'Chinese (Traditional)' },
        { code: 'ru-RU', name: 'Russian' },
        { code: 'ar-SA', name: 'Arabic' },
        { code: 'hi-IN', name: 'Hindi' }
      ];
    } catch (error) {
      this.logger.error('Failed to get available languages', error);
      throw error;
    }
  }
  
  /**
   * Process recognition response
   * @param {Object} response - Recognition response
   * @private
   * @returns {Object} - Processed result
   */
  _processResponse(response) {
    // Check if response contains results
    if (!response.results || response.results.length === 0) {
      return {
        text: '',
        confidence: 0,
        alternatives: [],
        metadata: {
          service: this.name
        }
      };
    }
    
    // Get first result
    const result = response.results[0];
    
    // Get alternatives
    const alternatives = result.alternatives.map(alt => ({
      text: alt.transcript,
      confidence: alt.confidence || 0
    }));
    
    // Get best alternative
    const bestAlternative = alternatives[0];
    
    return {
      text: bestAlternative.text,
      confidence: bestAlternative.confidence,
      alternatives: alternatives.slice(1),
      metadata: {
        service: this.name,
        wordTimestamps: result.alternatives[0].words || [],
        isFinal: true
      }
    };
  }
  
  /**
   * Map encoding to Google Speech format
   * @param {string} encoding - Audio encoding
   * @private
   * @returns {string} - Google Speech encoding
   */
  _mapEncoding(encoding) {
    switch (encoding) {
      case AudioEncoding.LINEAR16:
        return 'LINEAR16';
      case AudioEncoding.FLAC:
        return 'FLAC';
      case AudioEncoding.MP3:
        return 'MP3';
      case AudioEncoding.OGG_OPUS:
        return 'OGG_OPUS';
      case AudioEncoding.MULAW:
        return 'MULAW';
      case AudioEncoding.ALAW:
        return 'ALAW';
      default:
        return 'LINEAR16';
    }
  }
  
  /**
   * Map model type to Google Speech model
   * @param {string} model - Model type
   * @private
   * @returns {string} - Google Speech model
   */
  _mapModel(model) {
    switch (model) {
      case RecognitionModelType.COMMAND_AND_SEARCH:
        return 'command_and_search';
      case RecognitionModelType.PHONE_CALL:
        return 'phone_call';
      case RecognitionModelType.VIDEO:
        return 'video';
      case RecognitionModelType.DEFAULT:
      default:
        return 'default';
    }
  }
  
  /**
   * Convert array buffer to base64
   * @param {ArrayBuffer} buffer - Array buffer
   * @private
   * @returns {string} - Base64 string
   */
  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
}

/**
 * Azure Speech Recognition Service
 */
class AzureSpeechRecognitionService extends BaseSpeechRecognitionService {
  /**
   * Create a new AzureSpeechRecognitionService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);
    this.name = 'azure';
    this.type = RecognitionServiceType.ONLINE;
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint || 'https://api.cognitive.microsoft.com/sts/v1.0/issuetoken';
    this.region = options.region || 'westus';
    this.client = null;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Azure Speech Recognition Service');
      
      // Check if API key is available
      if (!this.apiKey) {
        this.logger.warn('Azure Speech API key not provided');
      }
      
      // Create HTTP client
      this.client = {
        post: async (url, data, headers = {}) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Ocp-Apim-Subscription-Key': this.apiKey,
              ...headers
            },
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
          }
          
          return await response.json();
        }
      };
      
      this.initialized = true;
      this.logger.debug('Azure Speech Recognition Service initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Azure Speech Recognition Service', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} options - Recognition options
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(audioData, options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Recognizing speech with Azure Speech Recognition');
      
      // Convert audio data to base64
      const audioBase64 = this._arrayBufferToBase64(audioData.buffer);
      
      // Prepare request
      const request = {
        audio: {
          content: audioBase64
        },
        config: {
          encoding: this._mapEncoding(audioData.format),
          sampleRateHertz: audioData.sampleRate,
          languageCode: options.language || 'en-US',
          model: this._mapModel(options.model),
          profanityFilter: options.enableProfanityFilter,
          enablePunctuation: options.enableAutomaticPunctuation,
          enableWordLevelTimestamps: options.enableWordTimestamps,
          enableSpeakerDiarization: options.enableSpeakerDiarization,
          maxSpeakerCount: options.maxSpeakers || 2,
          maxAlternatives: options.maxAlternatives || 1
        }
      };
      
      // Construct URL
      const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
      
      // Send request
      const response = await this.client.post(url, request);
      
      // Process response
      return this._processResponse(response);
    } catch (error) {
      this.logger.error('Azure Speech Recognition failed', error);
      throw error;
    }
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Getting available languages from Azure Speech Recognition');
      
      // Azure Speech supports many languages, but we'll return a subset of common ones
      return [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'es-MX', name: 'Spanish (Mexico)' },
        { code: 'fr-FR', name: 'French' },
        { code: 'de-DE', name: 'German' },
        { code: 'it-IT', name: 'Italian' },
        { code: 'ja-JP', name: 'Japanese' },
        { code: 'ko-KR', name: 'Korean' },
        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'zh-TW', name: 'Chinese (Traditional)' },
        { code: 'ru-RU', name: 'Russian' },
        { code: 'ar-SA', name: 'Arabic' },
        { code: 'hi-IN', name: 'Hindi' }
      ];
    } catch (error) {
      this.logger.error('Failed to get available languages', error);
      throw error;
    }
  }
  
  /**
   * Process recognition response
   * @param {Object} response - Recognition response
   * @private
   * @returns {Object} - Processed result
   */
  _processResponse(response) {
    // Check if response contains results
    if (!response.results || response.results.length === 0) {
      return {
        text: '',
        confidence: 0,
        alternatives: [],
        metadata: {
          service: this.name
        }
      };
    }
    
    // Get first result
    const result = response.results[0];
    
    // Get alternatives
    const alternatives = result.alternatives.map(alt => ({
      text: alt.text,
      confidence: alt.confidence || 0
    }));
    
    // Get best alternative
    const bestAlternative = alternatives[0];
    
    return {
      text: bestAlternative.text,
      confidence: bestAlternative.confidence,
      alternatives: alternatives.slice(1),
      metadata: {
        service: this.name,
        wordTimestamps: result.wordTimestamps || [],
        isFinal: true
      }
    };
  }
  
  /**
   * Map encoding to Azure Speech format
   * @param {string} encoding - Audio encoding
   * @private
   * @returns {string} - Azure Speech encoding
   */
  _mapEncoding(encoding) {
    switch (encoding) {
      case AudioEncoding.LINEAR16:
        return 'PCM';
      case AudioEncoding.FLAC:
        return 'FLAC';
      case AudioEncoding.MP3:
        return 'MP3';
      case AudioEncoding.OGG_OPUS:
        return 'OPUS';
      default:
        return 'PCM';
    }
  }
  
  /**
   * Map model type to Azure Speech model
   * @param {string} model - Model type
   * @private
   * @returns {string} - Azure Speech model
   */
  _mapModel(model) {
    switch (model) {
      case RecognitionModelType.COMMAND_AND_SEARCH:
        return 'interactive';
      case RecognitionModelType.PHONE_CALL:
        return 'telephony';
      case RecognitionModelType.LONG_FORM:
        return 'conversation';
      case RecognitionModelType.DEFAULT:
      default:
        return 'default';
    }
  }
  
  /**
   * Convert array buffer to base64
   * @param {ArrayBuffer} buffer - Array buffer
   * @private
   * @returns {string} - Base64 string
   */
  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
}

/**
 * Offline Speech Recognition Service
 */
class OfflineSpeechRecognitionService extends BaseSpeechRecognitionService {
  /**
   * Create a new OfflineSpeechRecognitionService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);
    this.name = 'offline';
    this.type = RecognitionServiceType.OFFLINE;
    this.modelPath = options.modelPath || './models/speech';
    this.models = new Map();
    this.recognizer = null;
    this.fs = null;
    this.path = null;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Offline Speech Recognition Service');
      
      // Import required modules
      try {
        // Use dynamic import for browser compatibility
        const fs = await import('fs');
        const path = await import('path');
        const vosk = await import('vosk');
        
        this.fs = fs;
        this.path = path;
        this.vosk = vosk;
      } catch (error) {
        this.logger.warn('Failed to import offline recognition modules', error);
        throw new Error('Offline recognition not supported in this environment');
      }
      
      // Create model directory if it doesn't exist
      if (!this.fs.existsSync(this.modelPath)) {
        this.fs.mkdirSync(this.modelPath, { recursive: true });
      }
      
      // Scan for available models
      await this._scanModels();
      
      this.initialized = true;
      this.logger.debug('Offline Speech Recognition Service initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Offline Speech Recognition Service', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} options - Recognition options
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(audioData, options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Recognizing speech with Offline Speech Recognition');
      
      // Get language and model
      const language = options.language || 'en-US';
      const modelType = options.model || RecognitionModelType.DEFAULT;
      
      // Check if model is available
      const modelKey = `${language}_${modelType}`;
      
      if (!this.models.has(modelKey)) {
        throw new Error(`Offline model not available for language: ${language}`);
      }
      
      const modelInfo = this.models.get(modelKey);
      
      // Create recognizer
      const recognizer = new this.vosk.Recognizer({
        model: new this.vosk.Model(modelInfo.path),
        sampleRate: audioData.sampleRate
      });
      
      // Set options
      recognizer.setMaxAlternatives(options.maxAlternatives || 1);
      recognizer.setWords(options.enableWordTimestamps || false);
      
      // Process audio data
      const audioBuffer = Buffer.from(audioData.buffer);
      recognizer.acceptWaveform(audioBuffer);
      
      // Get result
      const result = recognizer.finalResult();
      
      // Free resources
      recognizer.free();
      
      // Process result
      return this._processResult(result);
    } catch (error) {
      this.logger.error('Offline Speech Recognition failed', error);
      throw error;
    }
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Getting available languages from Offline Speech Recognition');
      
      // Get unique languages from models
      const languages = new Map();
      
      for (const [key, model] of this.models.entries()) {
        const [language] = key.split('_');
        
        if (!languages.has(language)) {
          languages.set(language, {
            code: language,
            name: this._getLanguageName(language)
          });
        }
      }
      
      return Array.from(languages.values());
    } catch (error) {
      this.logger.error('Failed to get available languages', error);
      throw error;
    }
  }
  
  /**
   * Download model
   * @param {Object} options - Download options
   * @returns {Promise<Object>} - Download result
   */
  async downloadModel(options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      const language = options.language;
      const model = options.model || RecognitionModelType.DEFAULT;
      const path = options.path || this.modelPath;
      
      this.logger.debug(`Downloading offline model for language: ${language}`);
      
      // Create model directory
      const modelDir = this.path.join(path, `${language}_${model}`);
      
      if (!this.fs.existsSync(modelDir)) {
        this.fs.mkdirSync(modelDir, { recursive: true });
      }
      
      // Download model
      // In a real implementation, this would download from a model repository
      // For this example, we'll simulate a download
      
      // Create a dummy model file
      const modelFile = this.path.join(modelDir, 'model.bin');
      this.fs.writeFileSync(modelFile, 'DUMMY MODEL FILE');
      
      // Add to models map
      const modelKey = `${language}_${model}`;
      this.models.set(modelKey, {
        language,
        model,
        path: modelDir
      });
      
      this.logger.debug(`Offline model downloaded for language: ${language}`);
      
      return {
        language,
        model,
        path: modelDir
      };
    } catch (error) {
      this.logger.error(`Failed to download offline model for language: ${options.language}`, error);
      throw error;
    }
  }
  
  /**
   * Remove model
   * @param {Object} options - Remove options
   * @returns {Promise<boolean>} - True if removal successful
   */
  async removeModel(options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      const language = options.language;
      const model = options.model || RecognitionModelType.DEFAULT;
      const path = options.path || this.modelPath;
      
      this.logger.debug(`Removing offline model for language: ${language}`);
      
      // Check if model exists
      const modelKey = `${language}_${model}`;
      
      if (!this.models.has(modelKey)) {
        this.logger.warn(`Model not found for language: ${language}`);
        return false;
      }
      
      const modelInfo = this.models.get(modelKey);
      
      // Remove model directory
      if (this.fs.existsSync(modelInfo.path)) {
        this.fs.rmdirSync(modelInfo.path, { recursive: true });
      }
      
      // Remove from models map
      this.models.delete(modelKey);
      
      this.logger.debug(`Offline model removed for language: ${language}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove offline model for language: ${options.language}`, error);
      throw error;
    }
  }
  
  /**
   * Scan for available models
   * @private
   * @returns {Promise<void>}
   */
  async _scanModels() {
    try {
      this.logger.debug('Scanning for available offline models');
      
      // Clear models map
      this.models.clear();
      
      // Check if model directory exists
      if (!this.fs.existsSync(this.modelPath)) {
        this.logger.debug('Model directory does not exist');
        return;
      }
      
      // Scan directory for model folders
      const entries = this.fs.readdirSync(this.modelPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          
          // Check if directory name matches language_model pattern
          const match = dirName.match(/^([a-z]{2}-[A-Z]{2})_(.+)$/);
          
          if (match) {
            const language = match[1];
            const model = match[2];
            const modelKey = `${language}_${model}`;
            const modelPath = this.path.join(this.modelPath, dirName);
            
            // Check if model file exists
            const modelFile = this.path.join(modelPath, 'model.bin');
            
            if (this.fs.existsSync(modelFile)) {
              // Add to models map
              this.models.set(modelKey, {
                language,
                model,
                path: modelPath
              });
              
              this.logger.debug(`Found offline model: ${modelKey}`);
            }
          }
        }
      }
      
      this.logger.debug(`Found ${this.models.size} offline models`);
    } catch (error) {
      this.logger.error('Failed to scan for offline models', error);
      throw error;
    }
  }
  
  /**
   * Process recognition result
   * @param {Object} result - Recognition result
   * @private
   * @returns {Object} - Processed result
   */
  _processResult(result) {
    // Check if result contains text
    if (!result || !result.text) {
      return {
        text: '',
        confidence: 0,
        alternatives: [],
        metadata: {
          service: this.name
        }
      };
    }
    
    // Get alternatives
    const alternatives = result.alternatives ? result.alternatives.map(alt => ({
      text: alt.text,
      confidence: alt.confidence || 0
    })) : [];
    
    return {
      text: result.text,
      confidence: result.confidence || 0.8, // Offline models often don't provide confidence
      alternatives,
      metadata: {
        service: this.name,
        wordTimestamps: result.result || [],
        isFinal: true
      }
    };
  }
  
  /**
   * Get language name from code
   * @param {string} code - Language code
   * @private
   * @returns {string} - Language name
   */
  _getLanguageName(code) {
    const languageNames = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'fr-FR': 'French',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'pt-BR': 'Portuguese (Brazil)',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ru-RU': 'Russian',
      'ar-SA': 'Arabic',
      'hi-IN': 'Hindi'
    };
    
    return languageNames[code] || code;
  }
}

/**
 * Whisper Speech Recognition Service
 */
class WhisperSpeechRecognitionService extends BaseSpeechRecognitionService {
  /**
   * Create a new WhisperSpeechRecognitionService
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);
    this.name = 'whisper';
    this.type = RecognitionServiceType.ONLINE;
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint || 'https://api.openai.com/v1/audio/transcriptions';
    this.client = null;
  }
  
  /**
   * Initialize the service
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Whisper Speech Recognition Service');
      
      // Check if API key is available
      if (!this.apiKey) {
        this.logger.warn('Whisper API key not provided');
      }
      
      // Create HTTP client
      this.client = {
        post: async (url, formData) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
          }
          
          return await response.json();
        }
      };
      
      this.initialized = true;
      this.logger.debug('Whisper Speech Recognition Service initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Whisper Speech Recognition Service', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech from audio data
   * @param {Object} audioData - Audio data to recognize
   * @param {Object} options - Recognition options
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(audioData, options) {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Recognizing speech with Whisper');
      
      // Create form data
      const formData = new FormData();
      
      // Convert audio data to blob
      const audioBlob = new Blob([audioData.buffer], { type: this._getMimeType(audioData.format) });
      
      // Add audio file
      formData.append('file', audioBlob, 'audio.wav');
      
      // Add model
      formData.append('model', 'whisper-1');
      
      // Add language
      if (options.language) {
        formData.append('language', options.language.split('-')[0]);
      }
      
      // Add options
      if (options.enableAutomaticPunctuation !== false) {
        formData.append('response_format', 'verbose_json');
      }
      
      if (options.maxAlternatives && options.maxAlternatives > 1) {
        formData.append('n', options.maxAlternatives);
      }
      
      // Send request
      const response = await this.client.post(this.endpoint, formData);
      
      // Process response
      return this._processResponse(response);
    } catch (error) {
      this.logger.error('Whisper Speech Recognition failed', error);
      throw error;
    }
  }
  
  /**
   * Get available languages
   * @returns {Promise<Array>} - List of available languages
   */
  async getAvailableLanguages() {
    try {
      if (!this.initialized) {
        throw new Error('Service not initialized');
      }
      
      this.logger.debug('Getting available languages from Whisper');
      
      // Whisper supports many languages, but we'll return a subset of common ones
      return [
        { code: 'en-US', name: 'English' },
        { code: 'es-ES', name: 'Spanish' },
        { code: 'fr-FR', name: 'French' },
        { code: 'de-DE', name: 'German' },
        { code: 'it-IT', name: 'Italian' },
        { code: 'ja-JP', name: 'Japanese' },
        { code: 'ko-KR', name: 'Korean' },
        { code: 'pt-BR', name: 'Portuguese' },
        { code: 'zh-CN', name: 'Chinese' },
        { code: 'ru-RU', name: 'Russian' },
        { code: 'ar-SA', name: 'Arabic' },
        { code: 'hi-IN', name: 'Hindi' }
      ];
    } catch (error) {
      this.logger.error('Failed to get available languages', error);
      throw error;
    }
  }
  
  /**
   * Process recognition response
   * @param {Object} response - Recognition response
   * @private
   * @returns {Object} - Processed result
   */
  _processResponse(response) {
    // Check if response contains text
    if (!response || !response.text) {
      return {
        text: '',
        confidence: 0,
        alternatives: [],
        metadata: {
          service: this.name
        }
      };
    }
    
    // Get alternatives
    const alternatives = response.alternatives ? response.alternatives.map(alt => ({
      text: alt.text,
      confidence: alt.confidence || 0
    })) : [];
    
    return {
      text: response.text,
      confidence: 0.9, // Whisper doesn't provide confidence scores
      alternatives,
      metadata: {
        service: this.name,
        segments: response.segments || [],
        isFinal: true
      }
    };
  }
  
  /**
   * Get MIME type based on encoding
   * @param {string} encoding - Audio encoding
   * @private
   * @returns {string} - MIME type
   */
  _getMimeType(encoding) {
    switch (encoding) {
      case AudioEncoding.LINEAR16:
        return 'audio/wav';
      case AudioEncoding.FLAC:
        return 'audio/flac';
      case AudioEncoding.MP3:
        return 'audio/mp3';
      case AudioEncoding.OGG_OPUS:
        return 'audio/ogg';
      default:
        return 'audio/wav';
    }
  }
}

/**
 * Language Detector
 */
class LanguageDetector {
  /**
   * Create a new LanguageDetector
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.threshold = options.threshold || 0.8;
    this.logger = options.logger || LogManager.getLogger('LanguageDetector');
    this.initialized = false;
    this.detector = null;
  }
  
  /**
   * Initialize the language detector
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Language Detector');
      
      // In a real implementation, this would initialize a language detection model
      // For this example, we'll use a simple mock implementation
      
      this.detector = {
        detectLanguage: async (audioData) => {
          // Mock implementation that always returns English with high confidence
          return {
            language: 'en-US',
            confidence: 0.95
          };
        }
      };
      
      this.initialized = true;
      this.logger.debug('Language Detector initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Language Detector', error);
      throw error;
    }
  }
  
  /**
   * Detect language from audio data
   * @param {Object} audioData - Audio data to detect language from
   * @returns {Promise<Object>} - Detection result
   */
  async detectLanguage(audioData) {
    try {
      if (!this.initialized) {
        throw new Error('Language Detector not initialized');
      }
      
      this.logger.debug('Detecting language from audio');
      
      // Detect language
      const result = await this.detector.detectLanguage(audioData);
      
      // Check confidence threshold
      if (result.confidence < this.threshold) {
        this.logger.debug(`Language detection confidence below threshold: ${result.confidence}`);
        return null;
      }
      
      this.logger.debug(`Detected language: ${result.language} (confidence: ${result.confidence})`);
      
      return result;
    } catch (error) {
      this.logger.error('Language detection failed', error);
      throw error;
    }
  }
}

// Export constants and classes
module.exports = {
  SpeechRecognitionEngine,
  RecognitionServiceType,
  RecognitionModelType,
  BaseSpeechRecognitionService,
  GoogleSpeechRecognitionService,
  AzureSpeechRecognitionService,
  OfflineSpeechRecognitionService,
  WhisperSpeechRecognitionService,
  LanguageDetector
};
