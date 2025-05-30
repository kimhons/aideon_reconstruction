/**
 * @fileoverview Learning Mode Trigger Detector for automatic screen recording.
 * 
 * This module detects when the user enters learning/demonstration mode
 * and triggers automatic screen recording.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const TriggerDetector = require('./TriggerDetector');

/**
 * Learning Mode Trigger Detector.
 * @extends TriggerDetector
 */
class LearningModeTriggerDetector extends TriggerDetector {
  /**
   * Creates a new LearningModeTriggerDetector instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Detector configuration
   * @param {Object} options.learningManager - Learning from Demonstration manager
   */
  constructor(options = {}) {
    super(options);
    
    this.learningManager = options.learningManager;
    this.boundHandleLearningModeStart = this.handleLearningModeStart.bind(this);
    this.boundHandleLearningModeEnd = this.handleLearningModeEnd.bind(this);
    
    // Default configuration
    this.config = {
      suggestedDuration: 300, // 5 minutes
      confidence: 1.0,
      ...this.config
    };
    
    // Active learning session
    this.activeSession = null;
  }
  
  /**
   * Initializes the trigger detector.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Learning mode trigger detector already initialized');
      return;
    }
    
    this.logger.info('Initializing learning mode trigger detector');
    
    if (!this.learningManager) {
      throw new Error('Learning from Demonstration manager is required');
    }
    
    this.initialized = true;
    this.logger.info('Learning mode trigger detector initialized successfully');
  }
  
  /**
   * Starts detection.
   * @returns {Promise<void>}
   */
  async startDetection() {
    if (!this.initialized) {
      throw new Error('Learning mode trigger detector not initialized');
    }
    
    if (this.detecting) {
      this.logger.warn('Learning mode trigger detector already detecting');
      return;
    }
    
    this.logger.info('Starting learning mode detection');
    
    // Register event listeners
    if (this.learningManager.on) {
      this.learningManager.on('learning-mode-start', this.boundHandleLearningModeStart);
      this.learningManager.on('learning-mode-end', this.boundHandleLearningModeEnd);
    } else {
      this.logger.warn('Learning manager does not support events, using polling');
      // Fallback to polling if events not supported
      this.pollingInterval = setInterval(() => this.checkLearningModeStatus(), 1000);
    }
    
    this.detecting = true;
    this.logger.info('Learning mode detection started');
  }
  
  /**
   * Stops detection.
   * @returns {Promise<void>}
   */
  async stopDetection() {
    if (!this.detecting) {
      this.logger.warn('Learning mode trigger detector not detecting');
      return;
    }
    
    this.logger.info('Stopping learning mode detection');
    
    // Remove event listeners
    if (this.learningManager.off) {
      this.learningManager.off('learning-mode-start', this.boundHandleLearningModeStart);
      this.learningManager.off('learning-mode-end', this.boundHandleLearningModeEnd);
    }
    
    // Clear polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.detecting = false;
    this.logger.info('Learning mode detection stopped');
  }
  
  /**
   * Gets detector type.
   * @returns {string} Detector type
   */
  getType() {
    return 'learning';
  }
  
  /**
   * Gets detector name.
   * @returns {string} Detector name
   */
  getName() {
    return 'Learning Mode Trigger Detector';
  }
  
  /**
   * Gets detector description.
   * @returns {string} Detector description
   */
  getDescription() {
    return 'Detects when the user enters learning/demonstration mode and triggers automatic screen recording';
  }
  
  /**
   * Handles learning mode start event.
   * @param {Object} event - Learning mode start event
   * @private
   */
  handleLearningModeStart(event) {
    this.logger.info('Learning mode started');
    
    // Store active session
    this.activeSession = {
      id: event.sessionId || `learning-${Date.now()}`,
      startTime: Date.now(),
      context: event.context || {}
    };
    
    // Emit trigger event
    this.emitTriggerEvent({
      confidence: this.config.confidence,
      context: {
        sessionId: this.activeSession.id,
        taskName: event.taskName || 'Unknown Task',
        taskDescription: event.taskDescription || '',
        ...this.activeSession.context
      },
      suggestedDuration: this.config.suggestedDuration,
      metadata: {
        learningMode: true,
        sessionId: this.activeSession.id
      }
    });
  }
  
  /**
   * Handles learning mode end event.
   * @param {Object} event - Learning mode end event
   * @private
   */
  handleLearningModeEnd(event) {
    if (!this.activeSession) {
      return;
    }
    
    this.logger.info('Learning mode ended');
    
    // Clear active session
    this.activeSession = null;
    
    // Emit deactivation event if callback supports it
    if (this.callback && typeof this.callback === 'function') {
      const deactivationEvent = this.createTriggerEvent({
        confidence: this.config.confidence,
        context: {
          sessionId: event.sessionId,
          endReason: event.reason || 'completed'
        },
        metadata: {
          deactivation: true
        }
      });
      
      deactivationEvent.deactivate = true;
      this.callback(deactivationEvent);
    }
  }
  
  /**
   * Checks learning mode status via polling.
   * @private
   */
  async checkLearningModeStatus() {
    try {
      // Skip if learning manager doesn't support status check
      if (!this.learningManager.isLearningModeActive) {
        return;
      }
      
      const isActive = await this.learningManager.isLearningModeActive();
      
      if (isActive && !this.activeSession) {
        // Learning mode started
        const sessionInfo = await this.learningManager.getCurrentSession();
        this.handleLearningModeStart(sessionInfo || {});
      } else if (!isActive && this.activeSession) {
        // Learning mode ended
        this.handleLearningModeEnd({});
      }
    } catch (error) {
      this.logger.error(`Failed to check learning mode status: ${error.message}`);
    }
  }
}

module.exports = LearningModeTriggerDetector;
