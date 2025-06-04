/**
 * @fileoverview MCP Gesture Context Provider for the Aideon AI Desktop Agent.
 * 
 * This module integrates the Gesture Recognition module with the MCP Context Manager,
 * enabling gesture detection events, sequence analysis results, and interpreted actions
 * to be shared as context across the Aideon system and with other applications via MCP.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * MCP Gesture Context Provider for the Aideon AI Desktop Agent.
 * 
 * This class provides integration between the Gesture Recognition module
 * and the MCP Context Manager, enabling unified context sharing.
 */
class MCPGestureContextProvider extends EventEmitter {
  /**
   * Creates a new MCP Gesture Context Provider.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {Object} [options.gestureRecognitionManager] - Gesture Recognition Manager instance
   * @param {Object} [options.gestureInterpretationService] - Gesture Interpretation Service instance
   * @param {Object} [options.config] - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    this.gestureRecognitionManager = options.gestureRecognitionManager;
    this.gestureInterpretationService = options.gestureInterpretationService;
    
    // Default configuration
    this.config = {
      enableGestureEvents: true,
      enableSequenceAnalysis: true,
      enableActionInterpretation: true,
      minConfidenceThreshold: 0.6,
      contextExpiry: {
        gestureEvents: 30 * 1000, // 30 seconds
        sequenceAnalysis: 5 * 60 * 1000, // 5 minutes
        actionInterpretation: 10 * 60 * 1000 // 10 minutes
      },
      privacySettings: {
        includeRawLandmarks: false,
        includeFrameData: false,
        includeUserIdentifiers: false
      },
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.eventHandlers = new Map();
    
    this.logger.info('MCP Gesture Context Provider created');
  }
  
  /**
   * Initializes the MCP Gesture Context Provider.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('MCP Gesture Context Provider already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing MCP Gesture Context Provider');
      
      // Verify dependencies
      if (!this.contextManager) {
        throw new Error('MCP Context Manager is required');
      }
      
      if (!this.gestureRecognitionManager) {
        throw new Error('Gesture Recognition Manager is required');
      }
      
      // Register event handlers
      if (this.config.enableGestureEvents) {
        this.registerGestureEventHandlers();
      }
      
      if (this.config.enableSequenceAnalysis) {
        this.registerSequenceAnalysisHandlers();
      }
      
      if (this.config.enableActionInterpretation && this.gestureInterpretationService) {
        this.registerActionInterpretationHandlers();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('MCP Gesture Context Provider initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MCP Gesture Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the MCP Gesture Context Provider.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('MCP Gesture Context Provider not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down MCP Gesture Context Provider');
      
      // Unregister all event handlers
      this.unregisterAllEventHandlers();
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('MCP Gesture Context Provider shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down MCP Gesture Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Registers event handlers for gesture events.
   * 
   * @private
   */
  registerGestureEventHandlers() {
    this.logger.debug('Registering gesture event handlers');
    
    // Handler for session started event
    const sessionStartedHandler = (sessionInfo) => {
      this.handleSessionStarted(sessionInfo);
    };
    this.gestureRecognitionManager.on('sessionStarted', sessionStartedHandler);
    this.eventHandlers.set('sessionStarted', sessionStartedHandler);
    
    // Handler for session stopped event
    const sessionStoppedHandler = (sessionInfo) => {
      this.handleSessionStopped(sessionInfo);
    };
    this.gestureRecognitionManager.on('sessionStopped', sessionStoppedHandler);
    this.eventHandlers.set('sessionStopped', sessionStoppedHandler);
    
    // Handler for hand gesture detected event
    const handGestureDetectedHandler = (gestureInfo) => {
      this.handleHandGestureDetected(gestureInfo);
    };
    this.gestureRecognitionManager.on('handGestureDetected', handGestureDetectedHandler);
    this.eventHandlers.set('handGestureDetected', handGestureDetectedHandler);
    
    // Handler for pose detected event
    const poseDetectedHandler = (poseInfo) => {
      this.handlePoseDetected(poseInfo);
    };
    this.gestureRecognitionManager.on('poseDetected', poseDetectedHandler);
    this.eventHandlers.set('poseDetected', poseDetectedHandler);
    
    // Handler for dynamic gesture detected event
    const dynamicGestureDetectedHandler = (gestureInfo) => {
      this.handleDynamicGestureDetected(gestureInfo);
    };
    this.gestureRecognitionManager.on('dynamicGestureDetected', dynamicGestureDetectedHandler);
    this.eventHandlers.set('dynamicGestureDetected', dynamicGestureDetectedHandler);
    
    // Handler for session error event
    const sessionErrorHandler = (error) => {
      this.handleSessionError(error);
    };
    this.gestureRecognitionManager.on('sessionError', sessionErrorHandler);
    this.eventHandlers.set('sessionError', sessionErrorHandler);
  }
  
  /**
   * Registers event handlers for sequence analysis.
   * 
   * @private
   */
  registerSequenceAnalysisHandlers() {
    this.logger.debug('Registering sequence analysis handlers');
    
    // Handler for gesture sequence detected event
    const gestureSequenceDetectedHandler = (sequenceInfo) => {
      this.handleGestureSequenceDetected(sequenceInfo);
    };
    this.gestureRecognitionManager.on('gestureSequenceDetected', gestureSequenceDetectedHandler);
    this.eventHandlers.set('gestureSequenceDetected', gestureSequenceDetectedHandler);
    
    // Handler for dominant gesture detected event
    const dominantGestureDetectedHandler = (gestureInfo) => {
      this.handleDominantGestureDetected(gestureInfo);
    };
    this.gestureRecognitionManager.on('dominantGestureDetected', dominantGestureDetectedHandler);
    this.eventHandlers.set('dominantGestureDetected', dominantGestureDetectedHandler);
    
    // Handler for gesture transition detected event
    const gestureTransitionDetectedHandler = (transitionInfo) => {
      this.handleGestureTransitionDetected(transitionInfo);
    };
    this.gestureRecognitionManager.on('gestureTransitionDetected', gestureTransitionDetectedHandler);
    this.eventHandlers.set('gestureTransitionDetected', gestureTransitionDetectedHandler);
  }
  
  /**
   * Registers event handlers for action interpretation.
   * 
   * @private
   */
  registerActionInterpretationHandlers() {
    this.logger.debug('Registering action interpretation handlers');
    
    // Handler for action detected event
    const actionDetectedHandler = (actionInfo) => {
      this.handleActionDetected(actionInfo);
    };
    this.gestureInterpretationService.on('actionDetected', actionDetectedHandler);
    this.eventHandlers.set('actionDetected', actionDetectedHandler);
    
    // Handler for command detected event
    const commandDetectedHandler = (commandInfo) => {
      this.handleCommandDetected(commandInfo);
    };
    this.gestureInterpretationService.on('commandDetected', commandDetectedHandler);
    this.eventHandlers.set('commandDetected', commandDetectedHandler);
    
    // Handler for navigation detected event
    const navigationDetectedHandler = (navigationInfo) => {
      this.handleNavigationDetected(navigationInfo);
    };
    this.gestureInterpretationService.on('navigationDetected', navigationDetectedHandler);
    this.eventHandlers.set('navigationDetected', navigationDetectedHandler);
  }
  
  /**
   * Unregisters all event handlers.
   * 
   * @private
   */
  unregisterAllEventHandlers() {
    this.logger.debug('Unregistering all event handlers');
    
    // Unregister gesture event handlers
    if (this.gestureRecognitionManager) {
      const gestureEvents = ['sessionStarted', 'sessionStopped', 'handGestureDetected', 'poseDetected',
                            'dynamicGestureDetected', 'sessionError', 'gestureSequenceDetected',
                            'dominantGestureDetected', 'gestureTransitionDetected'];
      
      for (const event of gestureEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.gestureRecognitionManager.off(event, handler);
        }
      }
    }
    
    // Unregister action interpretation handlers
    if (this.gestureInterpretationService) {
      const actionEvents = ['actionDetected', 'commandDetected', 'navigationDetected'];
      
      for (const event of actionEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.gestureInterpretationService.off(event, handler);
        }
      }
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
  }
  
  /**
   * Handles session started event.
   * 
   * @private
   * @param {Object} sessionInfo - Session information
   */
  async handleSessionStarted(sessionInfo) {
    try {
      this.logger.debug('Handling session started event');
      
      // Create context
      const context = {
        type: 'gesture.session.started',
        data: {
          sessionId: sessionInfo.id,
          timestamp: sessionInfo.startTime,
          source: sessionInfo.source,
          mode: sessionInfo.mode || 'default',
          reason: sessionInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['gesture', 'session', 'started'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added session started context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle session started event:', error);
    }
  }
  
  /**
   * Handles session stopped event.
   * 
   * @private
   * @param {Object} sessionInfo - Session information
   */
  async handleSessionStopped(sessionInfo) {
    try {
      this.logger.debug('Handling session stopped event');
      
      // Create context
      const context = {
        type: 'gesture.session.stopped',
        data: {
          sessionId: sessionInfo.id,
          startTime: sessionInfo.startTime,
          endTime: sessionInfo.endTime,
          duration: sessionInfo.duration,
          gestureCount: sessionInfo.gestureCount,
          reason: sessionInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['gesture', 'session', 'stopped'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added session stopped context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle session stopped event:', error);
    }
  }
  
  /**
   * Handles hand gesture detected event.
   * 
   * @private
   * @param {Object} gestureInfo - Gesture information
   */
  async handleHandGestureDetected(gestureInfo) {
    try {
      this.logger.debug('Handling hand gesture detected event');
      
      // Skip if confidence is below threshold
      if (gestureInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping hand gesture detected event due to low confidence: ${gestureInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.hand.detected',
        data: {
          sessionId: gestureInfo.sessionId,
          timestamp: gestureInfo.timestamp,
          gestureType: gestureInfo.gestureType,
          handedness: gestureInfo.handedness || 'unknown',
          position: {
            x: gestureInfo.position?.x,
            y: gestureInfo.position?.y,
            z: gestureInfo.position?.z
          }
        },
        priority: 5,
        confidence: gestureInfo.confidence,
        tags: ['gesture', 'hand', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add raw landmarks if enabled
      if (this.config.privacySettings.includeRawLandmarks && gestureInfo.landmarks) {
        context.data.landmarks = gestureInfo.landmarks;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added hand gesture detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle hand gesture detected event:', error);
    }
  }
  
  /**
   * Handles pose detected event.
   * 
   * @private
   * @param {Object} poseInfo - Pose information
   */
  async handlePoseDetected(poseInfo) {
    try {
      this.logger.debug('Handling pose detected event');
      
      // Skip if confidence is below threshold
      if (poseInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping pose detected event due to low confidence: ${poseInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.pose.detected',
        data: {
          sessionId: poseInfo.sessionId,
          timestamp: poseInfo.timestamp,
          poseType: poseInfo.poseType,
          position: {
            x: poseInfo.position?.x,
            y: poseInfo.position?.y,
            z: poseInfo.position?.z
          }
        },
        priority: 5,
        confidence: poseInfo.confidence,
        tags: ['gesture', 'pose', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add raw landmarks if enabled
      if (this.config.privacySettings.includeRawLandmarks && poseInfo.landmarks) {
        context.data.landmarks = poseInfo.landmarks;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added pose detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle pose detected event:', error);
    }
  }
  
  /**
   * Handles dynamic gesture detected event.
   * 
   * @private
   * @param {Object} gestureInfo - Gesture information
   */
  async handleDynamicGestureDetected(gestureInfo) {
    try {
      this.logger.debug('Handling dynamic gesture detected event');
      
      // Skip if confidence is below threshold
      if (gestureInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping dynamic gesture detected event due to low confidence: ${gestureInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.dynamic.detected',
        data: {
          sessionId: gestureInfo.sessionId,
          timestamp: gestureInfo.timestamp,
          gestureType: gestureInfo.gestureType,
          direction: gestureInfo.direction,
          speed: gestureInfo.speed,
          duration: gestureInfo.duration
        },
        priority: 6,
        confidence: gestureInfo.confidence,
        tags: ['gesture', 'dynamic', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add frame data if enabled
      if (this.config.privacySettings.includeFrameData && gestureInfo.frameData) {
        context.data.frameCount = gestureInfo.frameData.length;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added dynamic gesture detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle dynamic gesture detected event:', error);
    }
  }
  
  /**
   * Handles session error event.
   * 
   * @private
   * @param {Object} error - Error information
   */
  async handleSessionError(error) {
    try {
      this.logger.debug('Handling session error event');
      
      // Create context
      const context = {
        type: 'gesture.session.error',
        data: {
          sessionId: error.sessionId,
          message: error.message,
          code: error.code,
          timestamp: Date.now(),
          details: error.details || {}
        },
        priority: 8, // Higher priority for errors
        confidence: 1.0,
        tags: ['gesture', 'session', 'error'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.gestureEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added session error context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle session error event:', error);
    }
  }
  
  /**
   * Handles gesture sequence detected event.
   * 
   * @private
   * @param {Object} sequenceInfo - Sequence information
   */
  async handleGestureSequenceDetected(sequenceInfo) {
    try {
      this.logger.debug('Handling gesture sequence detected event');
      
      // Skip if confidence is below threshold
      if (sequenceInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping gesture sequence detected event due to low confidence: ${sequenceInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.sequence.detected',
        data: {
          sessionId: sequenceInfo.sessionId,
          timestamp: sequenceInfo.timestamp,
          sequenceType: sequenceInfo.sequenceType,
          duration: sequenceInfo.duration,
          gestureCount: sequenceInfo.gestures?.length || 0,
          pattern: sequenceInfo.pattern
        },
        priority: 7,
        confidence: sequenceInfo.confidence,
        tags: ['gesture', 'sequence', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.sequenceAnalysis
      };
      
      // Add gestures summary
      if (sequenceInfo.gestures && sequenceInfo.gestures.length > 0) {
        context.data.gestures = sequenceInfo.gestures.map(g => ({
          type: g.type,
          timestamp: g.timestamp,
          confidence: g.confidence
        }));
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added gesture sequence detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle gesture sequence detected event:', error);
    }
  }
  
  /**
   * Handles dominant gesture detected event.
   * 
   * @private
   * @param {Object} gestureInfo - Gesture information
   */
  async handleDominantGestureDetected(gestureInfo) {
    try {
      this.logger.debug('Handling dominant gesture detected event');
      
      // Skip if confidence is below threshold
      if (gestureInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping dominant gesture detected event due to low confidence: ${gestureInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.dominant.detected',
        data: {
          sessionId: gestureInfo.sessionId,
          timestamp: gestureInfo.timestamp,
          gestureType: gestureInfo.gestureType,
          handedness: gestureInfo.handedness || 'unknown',
          duration: gestureInfo.duration,
          frequency: gestureInfo.frequency,
          persistence: gestureInfo.persistence
        },
        priority: 7,
        confidence: gestureInfo.confidence,
        tags: ['gesture', 'dominant', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.sequenceAnalysis
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added dominant gesture detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle dominant gesture detected event:', error);
    }
  }
  
  /**
   * Handles gesture transition detected event.
   * 
   * @private
   * @param {Object} transitionInfo - Transition information
   */
  async handleGestureTransitionDetected(transitionInfo) {
    try {
      this.logger.debug('Handling gesture transition detected event');
      
      // Skip if confidence is below threshold
      if (transitionInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping gesture transition detected event due to low confidence: ${transitionInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.transition.detected',
        data: {
          sessionId: transitionInfo.sessionId,
          timestamp: transitionInfo.timestamp,
          fromGesture: transitionInfo.fromGesture,
          toGesture: transitionInfo.toGesture,
          duration: transitionInfo.duration,
          isSignificant: transitionInfo.isSignificant || false
        },
        priority: transitionInfo.isSignificant ? 7 : 5,
        confidence: transitionInfo.confidence,
        tags: ['gesture', 'transition', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.sequenceAnalysis
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added gesture transition detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle gesture transition detected event:', error);
    }
  }
  
  /**
   * Handles action detected event.
   * 
   * @private
   * @param {Object} actionInfo - Action information
   */
  async handleActionDetected(actionInfo) {
    try {
      this.logger.debug('Handling action detected event');
      
      // Skip if confidence is below threshold
      if (actionInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping action detected event due to low confidence: ${actionInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.action.detected',
        data: {
          sessionId: actionInfo.sessionId,
          timestamp: actionInfo.timestamp,
          actionType: actionInfo.actionType,
          source: actionInfo.source,
          parameters: actionInfo.parameters || {}
        },
        priority: 7,
        confidence: actionInfo.confidence,
        tags: ['gesture', 'action', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.actionInterpretation
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added action detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle action detected event:', error);
    }
  }
  
  /**
   * Handles command detected event.
   * 
   * @private
   * @param {Object} commandInfo - Command information
   */
  async handleCommandDetected(commandInfo) {
    try {
      this.logger.debug('Handling command detected event');
      
      // Skip if confidence is below threshold
      if (commandInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping command detected event due to low confidence: ${commandInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.command.detected',
        data: {
          sessionId: commandInfo.sessionId,
          timestamp: commandInfo.timestamp,
          command: commandInfo.command,
          action: commandInfo.action,
          target: commandInfo.target,
          parameters: commandInfo.parameters || {}
        },
        priority: 8, // Higher priority for commands
        confidence: commandInfo.confidence,
        tags: ['gesture', 'command', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.actionInterpretation
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added command detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle command detected event:', error);
    }
  }
  
  /**
   * Handles navigation detected event.
   * 
   * @private
   * @param {Object} navigationInfo - Navigation information
   */
  async handleNavigationDetected(navigationInfo) {
    try {
      this.logger.debug('Handling navigation detected event');
      
      // Skip if confidence is below threshold
      if (navigationInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping navigation detected event due to low confidence: ${navigationInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'gesture.navigation.detected',
        data: {
          sessionId: navigationInfo.sessionId,
          timestamp: navigationInfo.timestamp,
          navigationType: navigationInfo.navigationType,
          direction: navigationInfo.direction,
          magnitude: navigationInfo.magnitude,
          speed: navigationInfo.speed
        },
        priority: 6,
        confidence: navigationInfo.confidence,
        tags: ['gesture', 'navigation', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.actionInterpretation
      };
      
      // Add user identifiers if enabled
      if (this.config.privacySettings.includeUserIdentifiers && navigationInfo.isUserIdentifier) {
        context.data.isUserIdentifier = true;
        context.data.identifierType = navigationInfo.identifierType;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added navigation detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle navigation detected event:', error);
    }
  }
}

module.exports = { MCPGestureContextProvider };
