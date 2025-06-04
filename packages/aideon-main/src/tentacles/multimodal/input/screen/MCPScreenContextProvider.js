/**
 * @fileoverview MCP Screen Context Provider for the Aideon AI Desktop Agent.
 * 
 * This module integrates the Screen Recording and Analysis module with the MCP Context Manager,
 * enabling screen recording events, analysis results, and detected triggers to be shared
 * as context across the Aideon system and with other applications via MCP.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * MCP Screen Context Provider for the Aideon AI Desktop Agent.
 * 
 * This class provides integration between the Screen Recording and Analysis module
 * and the MCP Context Manager, enabling unified context sharing.
 */
class MCPScreenContextProvider extends EventEmitter {
  /**
   * Creates a new MCP Screen Context Provider.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {Object} [options.screenRecordingManager] - Enhanced Screen Recording Manager instance
   * @param {Object} [options.triggerManager] - Trigger Manager instance
   * @param {Object} [options.config] - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    this.screenRecordingManager = options.screenRecordingManager;
    this.triggerManager = options.triggerManager;
    
    // Default configuration
    this.config = {
      enableRecordingEvents: true,
      enableAnalysisResults: true,
      enableTriggerEvents: true,
      minConfidenceThreshold: 0.6,
      contextExpiry: {
        recordingEvents: 60 * 60 * 1000, // 1 hour
        analysisResults: 24 * 60 * 60 * 1000, // 24 hours
        triggerEvents: 30 * 60 * 1000 // 30 minutes
      },
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.eventHandlers = new Map();
    
    this.logger.info('MCP Screen Context Provider created');
  }
  
  /**
   * Initializes the MCP Screen Context Provider.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('MCP Screen Context Provider already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing MCP Screen Context Provider');
      
      // Verify dependencies
      if (!this.contextManager) {
        throw new Error('MCP Context Manager is required');
      }
      
      if (!this.screenRecordingManager) {
        throw new Error('Enhanced Screen Recording Manager is required');
      }
      
      // Register event handlers
      if (this.config.enableRecordingEvents) {
        this.registerRecordingEventHandlers();
      }
      
      if (this.config.enableAnalysisResults) {
        this.registerAnalysisResultHandlers();
      }
      
      if (this.config.enableTriggerEvents && this.triggerManager) {
        this.registerTriggerEventHandlers();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('MCP Screen Context Provider initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MCP Screen Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the MCP Screen Context Provider.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('MCP Screen Context Provider not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down MCP Screen Context Provider');
      
      // Unregister all event handlers
      this.unregisterAllEventHandlers();
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('MCP Screen Context Provider shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down MCP Screen Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Registers event handlers for recording events.
   * 
   * @private
   */
  registerRecordingEventHandlers() {
    this.logger.debug('Registering recording event handlers');
    
    // Handler for recording started event
    const recordingStartedHandler = (recordingInfo) => {
      this.handleRecordingStarted(recordingInfo);
    };
    this.screenRecordingManager.on('recordingStarted', recordingStartedHandler);
    this.eventHandlers.set('recordingStarted', recordingStartedHandler);
    
    // Handler for recording stopped event
    const recordingStoppedHandler = (recordingInfo) => {
      this.handleRecordingStopped(recordingInfo);
    };
    this.screenRecordingManager.on('recordingStopped', recordingStoppedHandler);
    this.eventHandlers.set('recordingStopped', recordingStoppedHandler);
    
    // Handler for recording error event
    const recordingErrorHandler = (error) => {
      this.handleRecordingError(error);
    };
    this.screenRecordingManager.on('recordingError', recordingErrorHandler);
    this.eventHandlers.set('recordingError', recordingErrorHandler);
  }
  
  /**
   * Registers event handlers for analysis results.
   * 
   * @private
   */
  registerAnalysisResultHandlers() {
    this.logger.debug('Registering analysis result handlers');
    
    // Handler for analysis completed event
    const analysisCompletedHandler = (analysisResult) => {
      this.handleAnalysisCompleted(analysisResult);
    };
    this.screenRecordingManager.on('analysisCompleted', analysisCompletedHandler);
    this.eventHandlers.set('analysisCompleted', analysisCompletedHandler);
    
    // Handler for text detected event
    const textDetectedHandler = (textInfo) => {
      this.handleTextDetected(textInfo);
    };
    this.screenRecordingManager.on('textDetected', textDetectedHandler);
    this.eventHandlers.set('textDetected', textDetectedHandler);
    
    // Handler for object detected event
    const objectDetectedHandler = (objectInfo) => {
      this.handleObjectDetected(objectInfo);
    };
    this.screenRecordingManager.on('objectDetected', objectDetectedHandler);
    this.eventHandlers.set('objectDetected', objectDetectedHandler);
    
    // Handler for activity detected event
    const activityDetectedHandler = (activityInfo) => {
      this.handleActivityDetected(activityInfo);
    };
    this.screenRecordingManager.on('activityDetected', activityDetectedHandler);
    this.eventHandlers.set('activityDetected', activityDetectedHandler);
  }
  
  /**
   * Registers event handlers for trigger events.
   * 
   * @private
   */
  registerTriggerEventHandlers() {
    this.logger.debug('Registering trigger event handlers');
    
    // Handler for trigger detected event
    const triggerDetectedHandler = (triggerInfo) => {
      this.handleTriggerDetected(triggerInfo);
    };
    this.triggerManager.on('triggerDetected', triggerDetectedHandler);
    this.eventHandlers.set('triggerDetected', triggerDetectedHandler);
    
    // Handler for learning mode trigger event
    const learningModeTriggerHandler = (triggerInfo) => {
      this.handleLearningModeTrigger(triggerInfo);
    };
    this.triggerManager.on('learningModeTrigger', learningModeTriggerHandler);
    this.eventHandlers.set('learningModeTrigger', learningModeTriggerHandler);
    
    // Handler for error diagnosis trigger event
    const errorDiagnosisTriggerHandler = (triggerInfo) => {
      this.handleErrorDiagnosisTrigger(triggerInfo);
    };
    this.triggerManager.on('errorDiagnosisTrigger', errorDiagnosisTriggerHandler);
    this.eventHandlers.set('errorDiagnosisTrigger', errorDiagnosisTriggerHandler);
  }
  
  /**
   * Unregisters all event handlers.
   * 
   * @private
   */
  unregisterAllEventHandlers() {
    this.logger.debug('Unregistering all event handlers');
    
    // Unregister recording event handlers
    if (this.screenRecordingManager) {
      const recordingEvents = ['recordingStarted', 'recordingStopped', 'recordingError', 
                              'analysisCompleted', 'textDetected', 'objectDetected', 'activityDetected'];
      
      for (const event of recordingEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.screenRecordingManager.off(event, handler);
        }
      }
    }
    
    // Unregister trigger event handlers
    if (this.triggerManager) {
      const triggerEvents = ['triggerDetected', 'learningModeTrigger', 'errorDiagnosisTrigger'];
      
      for (const event of triggerEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.triggerManager.off(event, handler);
        }
      }
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
  }
  
  /**
   * Handles recording started event.
   * 
   * @private
   * @param {Object} recordingInfo - Recording information
   */
  async handleRecordingStarted(recordingInfo) {
    try {
      this.logger.debug('Handling recording started event');
      
      // Create context
      const context = {
        type: 'screen.recording.started',
        data: {
          recordingId: recordingInfo.id,
          timestamp: recordingInfo.startTime,
          resolution: recordingInfo.resolution,
          fps: recordingInfo.fps,
          source: recordingInfo.source,
          reason: recordingInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['screen', 'recording', 'started'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.recordingEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added recording started context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle recording started event:', error);
    }
  }
  
  /**
   * Handles recording stopped event.
   * 
   * @private
   * @param {Object} recordingInfo - Recording information
   */
  async handleRecordingStopped(recordingInfo) {
    try {
      this.logger.debug('Handling recording stopped event');
      
      // Create context
      const context = {
        type: 'screen.recording.stopped',
        data: {
          recordingId: recordingInfo.id,
          startTime: recordingInfo.startTime,
          endTime: recordingInfo.endTime,
          duration: recordingInfo.duration,
          frames: recordingInfo.frames,
          filePath: recordingInfo.filePath,
          fileSize: recordingInfo.fileSize,
          reason: recordingInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['screen', 'recording', 'stopped'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.recordingEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added recording stopped context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle recording stopped event:', error);
    }
  }
  
  /**
   * Handles recording error event.
   * 
   * @private
   * @param {Object} error - Error information
   */
  async handleRecordingError(error) {
    try {
      this.logger.debug('Handling recording error event');
      
      // Create context
      const context = {
        type: 'screen.recording.error',
        data: {
          message: error.message,
          code: error.code,
          timestamp: Date.now(),
          details: error.details || {}
        },
        priority: 8, // Higher priority for errors
        confidence: 1.0,
        tags: ['screen', 'recording', 'error'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.recordingEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added recording error context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle recording error event:', error);
    }
  }
  
  /**
   * Handles analysis completed event.
   * 
   * @private
   * @param {Object} analysisResult - Analysis result
   */
  async handleAnalysisCompleted(analysisResult) {
    try {
      this.logger.debug('Handling analysis completed event');
      
      // Create context
      const context = {
        type: 'screen.analysis.completed',
        data: {
          recordingId: analysisResult.recordingId,
          timestamp: analysisResult.timestamp,
          duration: analysisResult.duration,
          summary: analysisResult.summary,
          detectedObjects: analysisResult.detectedObjects?.length || 0,
          detectedText: analysisResult.detectedText?.length || 0,
          detectedActivities: analysisResult.detectedActivities?.length || 0,
          confidence: analysisResult.confidence
        },
        priority: 7,
        confidence: analysisResult.confidence || 0.9,
        tags: ['screen', 'analysis', 'completed'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.analysisResults
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added analysis completed context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle analysis completed event:', error);
    }
  }
  
  /**
   * Handles text detected event.
   * 
   * @private
   * @param {Object} textInfo - Text information
   */
  async handleTextDetected(textInfo) {
    try {
      this.logger.debug('Handling text detected event');
      
      // Skip if confidence is below threshold
      if (textInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping text detected event due to low confidence: ${textInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'screen.text.detected',
        data: {
          recordingId: textInfo.recordingId,
          timestamp: textInfo.timestamp,
          text: textInfo.text,
          location: textInfo.location,
          language: textInfo.language,
          isImportant: textInfo.isImportant || false
        },
        priority: textInfo.isImportant ? 7 : 5,
        confidence: textInfo.confidence,
        tags: ['screen', 'text', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.analysisResults
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added text detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle text detected event:', error);
    }
  }
  
  /**
   * Handles object detected event.
   * 
   * @private
   * @param {Object} objectInfo - Object information
   */
  async handleObjectDetected(objectInfo) {
    try {
      this.logger.debug('Handling object detected event');
      
      // Skip if confidence is below threshold
      if (objectInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping object detected event due to low confidence: ${objectInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'screen.object.detected',
        data: {
          recordingId: objectInfo.recordingId,
          timestamp: objectInfo.timestamp,
          objectType: objectInfo.objectType,
          label: objectInfo.label,
          location: objectInfo.location,
          size: objectInfo.size,
          isImportant: objectInfo.isImportant || false
        },
        priority: objectInfo.isImportant ? 7 : 5,
        confidence: objectInfo.confidence,
        tags: ['screen', 'object', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.analysisResults
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added object detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle object detected event:', error);
    }
  }
  
  /**
   * Handles activity detected event.
   * 
   * @private
   * @param {Object} activityInfo - Activity information
   */
  async handleActivityDetected(activityInfo) {
    try {
      this.logger.debug('Handling activity detected event');
      
      // Skip if confidence is below threshold
      if (activityInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping activity detected event due to low confidence: ${activityInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'screen.activity.detected',
        data: {
          recordingId: activityInfo.recordingId,
          timestamp: activityInfo.timestamp,
          activityType: activityInfo.activityType,
          description: activityInfo.description,
          duration: activityInfo.duration,
          location: activityInfo.location,
          isImportant: activityInfo.isImportant || false
        },
        priority: activityInfo.isImportant ? 7 : 5,
        confidence: activityInfo.confidence,
        tags: ['screen', 'activity', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.analysisResults
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added activity detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle activity detected event:', error);
    }
  }
  
  /**
   * Handles trigger detected event.
   * 
   * @private
   * @param {Object} triggerInfo - Trigger information
   */
  async handleTriggerDetected(triggerInfo) {
    try {
      this.logger.debug('Handling trigger detected event');
      
      // Skip if confidence is below threshold
      if (triggerInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping trigger detected event due to low confidence: ${triggerInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'screen.trigger.detected',
        data: {
          recordingId: triggerInfo.recordingId,
          timestamp: triggerInfo.timestamp,
          triggerType: triggerInfo.triggerType,
          description: triggerInfo.description,
          source: triggerInfo.source,
          priority: triggerInfo.priority
        },
        priority: triggerInfo.priority || 6,
        confidence: triggerInfo.confidence,
        tags: ['screen', 'trigger', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.triggerEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added trigger detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle trigger detected event:', error);
    }
  }
  
  /**
   * Handles learning mode trigger event.
   * 
   * @private
   * @param {Object} triggerInfo - Trigger information
   */
  async handleLearningModeTrigger(triggerInfo) {
    try {
      this.logger.debug('Handling learning mode trigger event');
      
      // Create context
      const context = {
        type: 'screen.trigger.learningMode',
        data: {
          recordingId: triggerInfo.recordingId,
          timestamp: triggerInfo.timestamp,
          pattern: triggerInfo.pattern,
          description: triggerInfo.description,
          learningSessionId: triggerInfo.learningSessionId,
          isStartTrigger: triggerInfo.isStartTrigger || false,
          isEndTrigger: triggerInfo.isEndTrigger || false
        },
        priority: 8, // Higher priority for learning mode
        confidence: triggerInfo.confidence || 0.9,
        tags: ['screen', 'trigger', 'learningMode'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.triggerEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added learning mode trigger context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle learning mode trigger event:', error);
    }
  }
  
  /**
   * Handles error diagnosis trigger event.
   * 
   * @private
   * @param {Object} triggerInfo - Trigger information
   */
  async handleErrorDiagnosisTrigger(triggerInfo) {
    try {
      this.logger.debug('Handling error diagnosis trigger event');
      
      // Create context
      const context = {
        type: 'screen.trigger.errorDiagnosis',
        data: {
          recordingId: triggerInfo.recordingId,
          timestamp: triggerInfo.timestamp,
          errorType: triggerInfo.errorType,
          errorMessage: triggerInfo.errorMessage,
          errorCode: triggerInfo.errorCode,
          applicationName: triggerInfo.applicationName,
          screenshot: triggerInfo.screenshot
        },
        priority: 9, // High priority for errors
        confidence: triggerInfo.confidence || 0.95,
        tags: ['screen', 'trigger', 'errorDiagnosis'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.triggerEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added error diagnosis trigger context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle error diagnosis trigger event:', error);
    }
  }
}

module.exports = { MCPScreenContextProvider };
