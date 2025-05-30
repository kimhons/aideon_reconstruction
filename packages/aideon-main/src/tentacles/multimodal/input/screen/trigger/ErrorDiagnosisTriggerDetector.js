/**
 * @fileoverview Error Diagnosis Trigger Detector for automatic screen recording.
 * 
 * This module detects application errors and system crashes,
 * triggering automatic screen recording to capture context for diagnosis.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const TriggerDetector = require('./TriggerDetector');

/**
 * Error Diagnosis Trigger Detector.
 * @extends TriggerDetector
 */
class ErrorDiagnosisTriggerDetector extends TriggerDetector {
  /**
   * Creates a new ErrorDiagnosisTriggerDetector instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Detector configuration
   * @param {Object} options.errorMonitor - Error monitoring service
   */
  constructor(options = {}) {
    super(options);
    
    this.errorMonitor = options.errorMonitor;
    this.boundHandleError = this.handleError.bind(this);
    
    // Default configuration
    this.config = {
      suggestedDuration: 120, // 2 minutes
      confidenceThreshold: 0.6,
      errorSeverityThreshold: 'medium',
      capturePreErrorBuffer: true,
      preErrorBufferDuration: 30, // 30 seconds
      errorSeverityLevels: {
        critical: 1.0,
        high: 0.9,
        medium: 0.7,
        low: 0.5
      },
      ...this.config
    };
    
    // Circular buffer for pre-error capture
    this.preErrorBuffer = null;
    
    // Active error session
    this.activeSession = null;
  }
  
  /**
   * Initializes the trigger detector.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Error diagnosis trigger detector already initialized');
      return;
    }
    
    this.logger.info('Initializing error diagnosis trigger detector');
    
    if (!this.errorMonitor) {
      throw new Error('Error monitoring service is required');
    }
    
    // Initialize pre-error buffer if enabled
    if (this.config.capturePreErrorBuffer) {
      // Note: In a real implementation, this would initialize a circular buffer
      // that continuously captures screen activity for replay when an error occurs
      this.preErrorBuffer = {
        initialized: true,
        duration: this.config.preErrorBufferDuration
      };
    }
    
    this.initialized = true;
    this.logger.info('Error diagnosis trigger detector initialized successfully');
  }
  
  /**
   * Starts detection.
   * @returns {Promise<void>}
   */
  async startDetection() {
    if (!this.initialized) {
      throw new Error('Error diagnosis trigger detector not initialized');
    }
    
    if (this.detecting) {
      this.logger.warn('Error diagnosis trigger detector already detecting');
      return;
    }
    
    this.logger.info('Starting error detection');
    
    // Register error handlers
    if (this.errorMonitor.on) {
      this.errorMonitor.on('error', this.boundHandleError);
      this.errorMonitor.on('crash', this.boundHandleError);
      this.errorMonitor.on('exception', this.boundHandleError);
    } else if (this.errorMonitor.registerErrorHandler) {
      this.errorMonitor.registerErrorHandler(this.boundHandleError);
    } else {
      throw new Error('Error monitor does not support error handling');
    }
    
    // Start pre-error buffer if enabled
    if (this.config.capturePreErrorBuffer && this.preErrorBuffer) {
      // In a real implementation, this would start the circular buffer recording
      this.logger.info(`Starting pre-error buffer (${this.config.preErrorBufferDuration}s)`);
    }
    
    this.detecting = true;
    this.logger.info('Error detection started');
  }
  
  /**
   * Stops detection.
   * @returns {Promise<void>}
   */
  async stopDetection() {
    if (!this.detecting) {
      this.logger.warn('Error diagnosis trigger detector not detecting');
      return;
    }
    
    this.logger.info('Stopping error detection');
    
    // Remove error handlers
    if (this.errorMonitor.off) {
      this.errorMonitor.off('error', this.boundHandleError);
      this.errorMonitor.off('crash', this.boundHandleError);
      this.errorMonitor.off('exception', this.boundHandleError);
    } else if (this.errorMonitor.unregisterErrorHandler) {
      this.errorMonitor.unregisterErrorHandler(this.boundHandleError);
    }
    
    // Stop pre-error buffer if enabled
    if (this.config.capturePreErrorBuffer && this.preErrorBuffer) {
      // In a real implementation, this would stop the circular buffer recording
      this.logger.info('Stopping pre-error buffer');
    }
    
    this.detecting = false;
    this.logger.info('Error detection stopped');
  }
  
  /**
   * Gets detector type.
   * @returns {string} Detector type
   */
  getType() {
    return 'error';
  }
  
  /**
   * Gets detector name.
   * @returns {string} Detector name
   */
  getName() {
    return 'Error Diagnosis Trigger Detector';
  }
  
  /**
   * Gets detector description.
   * @returns {string} Detector description
   */
  getDescription() {
    return 'Detects application errors and system crashes, triggering automatic screen recording for diagnosis';
  }
  
  /**
   * Handles error event.
   * @param {Object} error - Error event
   * @private
   */
  handleError(error) {
    try {
      this.logger.debug(`Received error event: ${JSON.stringify(error)}`);
      
      // Skip if already handling an error
      if (this.activeSession) {
        this.logger.debug('Already handling an error, skipping');
        return;
      }
      
      // Extract error details
      const errorType = error.type || 'unknown';
      const errorMessage = error.message || '';
      const errorStack = error.stack || '';
      const errorSeverity = error.severity || 'medium';
      
      // Check severity threshold
      if (!this.isSeverityAboveThreshold(errorSeverity)) {
        this.logger.debug(`Error severity ${errorSeverity} below threshold, ignoring`);
        return;
      }
      
      // Calculate confidence based on severity
      const confidence = this.getSeverityConfidence(errorSeverity);
      
      // Start error session
      this.activeSession = {
        id: `error-${Date.now()}`,
        startTime: Date.now(),
        errorType,
        errorMessage,
        errorSeverity
      };
      
      // Prepare pre-error buffer data if available
      let preErrorData = null;
      if (this.config.capturePreErrorBuffer && this.preErrorBuffer) {
        // In a real implementation, this would retrieve the buffer data
        preErrorData = {
          available: true,
          duration: this.preErrorBuffer.duration
        };
      }
      
      // Emit trigger event
      this.emitTriggerEvent({
        confidence,
        context: {
          errorType,
          errorMessage,
          errorStack,
          errorSeverity,
          applicationName: error.applicationName || 'unknown',
          applicationVersion: error.applicationVersion || 'unknown',
          sessionId: this.activeSession.id,
          preErrorData
        },
        suggestedDuration: this.config.suggestedDuration,
        metadata: {
          errorDiagnosis: true,
          originalError: error,
          sessionId: this.activeSession.id,
          hasPreErrorBuffer: !!preErrorData
        }
      });
      
      // Auto-reset after a timeout
      setTimeout(() => {
        if (this.activeSession && this.activeSession.id === this.activeSession.id) {
          this.logger.info('Auto-resetting error session after timeout');
          this.activeSession = null;
        }
      }, (this.config.suggestedDuration + 60) * 1000); // Add 1 minute buffer
    } catch (err) {
      this.logger.error(`Failed to handle error event: ${err.message}`);
    }
  }
  
  /**
   * Checks if error severity is above threshold.
   * @param {string} severity - Error severity
   * @returns {boolean} Whether severity is above threshold
   * @private
   */
  isSeverityAboveThreshold(severity) {
    const severityValue = this.config.errorSeverityLevels[severity.toLowerCase()] || 0;
    const thresholdValue = this.config.errorSeverityLevels[this.config.errorSeverityThreshold.toLowerCase()] || 0;
    
    return severityValue >= thresholdValue;
  }
  
  /**
   * Gets confidence value based on error severity.
   * @param {string} severity - Error severity
   * @returns {number} Confidence value
   * @private
   */
  getSeverityConfidence(severity) {
    return this.config.errorSeverityLevels[severity.toLowerCase()] || this.config.confidenceThreshold;
  }
}

module.exports = ErrorDiagnosisTriggerDetector;
