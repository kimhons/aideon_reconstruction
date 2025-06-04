/**
 * @fileoverview MCPDemonstrationRecorderProvider implementation for integrating
 * the Demonstration Recorder component with the Model Context Protocol (MCP).
 * 
 * This provider enables the Demonstration Recorder to share context about active
 * recording sessions and demonstration data with other tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPLearningContextProvider } = require('./MCPLearningContextProvider');

/**
 * Provider for integrating Demonstration Recorder with MCP.
 */
class MCPDemonstrationRecorderProvider extends MCPLearningContextProvider {
  /**
   * Creates a new MCPDemonstrationRecorderProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.demonstrationRecorder - Demonstration Recorder instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options.demonstrationRecorder) {
      throw new Error('MCPDemonstrationRecorderProvider requires a valid demonstrationRecorder');
    }
    
    this.demonstrationRecorder = options.demonstrationRecorder;
    
    // Context type prefix specific to demonstration recorder
    this.contextTypePrefix = 'learning.demonstration';
    
    this.logger.info('MCPDemonstrationRecorderProvider created');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.recording`,
      `${this.contextTypePrefix}.session`,
      `${this.contextTypePrefix}.event`
    ];
  }
  
  /**
   * Sets up event listeners for demonstration recorder events.
   * 
   * @private
   */
  setupEventListeners() {
    // Listen for recording started events
    this.demonstrationRecorder.on('recordingStarted', async (data) => {
      try {
        await this.handleRecordingStarted(data);
      } catch (error) {
        this.logger.error('Error handling recordingStarted event:', error);
      }
    });
    
    // Listen for recording stopped events
    this.demonstrationRecorder.on('recordingStopped', async (data) => {
      try {
        await this.handleRecordingStopped(data);
      } catch (error) {
        this.logger.error('Error handling recordingStopped event:', error);
      }
    });
    
    // Listen for artifact added events
    this.demonstrationRecorder.on('artifactAdded', async (data) => {
      try {
        await this.handleArtifactAdded(data);
      } catch (error) {
        this.logger.error('Error handling artifactAdded event:', error);
      }
    });
    
    this.logger.info('Demonstration Recorder event listeners setup complete');
  }
  
  /**
   * Handles recording started events.
   * 
   * @private
   * @param {Object} data - Recording started event data
   * @returns {Promise<void>}
   */
  async handleRecordingStarted(data) {
    const contextData = {
      sessionId: data.sessionId,
      startTime: data.startTime,
      status: 'active',
      recordingType: data.options?.recordingType || 'combined',
      userContext: {
        application: data.options?.application,
        environment: data.options?.environment,
        task: data.options?.task
      },
      privacySettings: {
        maskSensitiveData: data.options?.maskSensitiveData !== false,
        retentionPeriod: data.options?.retentionPeriod,
        dataMinimization: data.options?.dataMinimization !== false
      },
      metrics: {
        eventCount: 0,
        frameCount: 0,
        duration: 0
      }
    };
    
    await this.addLearningContext(
      contextData,
      'recording',
      8, // High priority for active recordings
      0.99, // High confidence for recording status
      ['active', 'recording', data.options?.recordingType || 'combined']
    );
    
    this.logger.info(`Added recording context for session ${data.sessionId}`);
  }
  
  /**
   * Handles recording stopped events.
   * 
   * @private
   * @param {Object} data - Recording stopped event data
   * @returns {Promise<void>}
   */
  async handleRecordingStopped(data) {
    // First, update the recording context to mark it as completed
    const recordingContexts = await this.queryLearningContexts('recording', {
      tags: [data.sessionId]
    });
    
    if (recordingContexts.length > 0) {
      const recordingContext = recordingContexts[0];
      const updatedData = {
        ...recordingContext.data,
        status: 'completed',
        endTime: Date.now(),
        metrics: {
          ...recordingContext.data.metrics,
          duration: Date.now() - recordingContext.data.startTime
        }
      };
      
      await this.updateLearningContext(
        recordingContext.id,
        updatedData,
        0.99 // High confidence for recording status
      );
    }
    
    // Then, create a new session context with the complete session data
    const sessionData = {
      sessionId: data.sessionId,
      startTime: data.startTime,
      endTime: Date.now(),
      duration: Date.now() - data.startTime,
      recordingType: data.recordingType || 'combined',
      eventCount: data.eventCount || 0,
      artifacts: data.artifacts || [],
      userContext: data.userContext || {},
      analysisStatus: 'pending'
    };
    
    await this.addLearningContext(
      sessionData,
      'session',
      6, // Medium-high priority for completed sessions
      0.95, // High confidence for session data
      ['completed', 'session', data.recordingType || 'combined']
    );
    
    this.logger.info(`Added session context for completed session ${data.sessionId}`);
  }
  
  /**
   * Handles artifact added events.
   * 
   * @private
   * @param {Object} data - Artifact added event data
   * @returns {Promise<void>}
   */
  async handleArtifactAdded(data) {
    // Update the recording context with the new artifact
    const recordingContexts = await this.queryLearningContexts('recording', {
      tags: [data.sessionId]
    });
    
    if (recordingContexts.length > 0) {
      const recordingContext = recordingContexts[0];
      const updatedMetrics = { ...recordingContext.data.metrics };
      
      // Update metrics based on artifact type
      if (data.artifactType === 'event') {
        updatedMetrics.eventCount = (updatedMetrics.eventCount || 0) + 1;
      } else if (data.artifactType === 'frame') {
        updatedMetrics.frameCount = (updatedMetrics.frameCount || 0) + 1;
      }
      
      const updatedData = {
        ...recordingContext.data,
        metrics: updatedMetrics
      };
      
      await this.updateLearningContext(
        recordingContext.id,
        updatedData,
        0.9 // High confidence for metrics update
      );
      
      this.logger.debug(`Updated recording metrics for session ${data.sessionId}`);
    }
    
    // For significant artifacts, create a dedicated event context
    if (data.artifactType === 'event' && data.artifactData?.type === 'significant') {
      const eventData = {
        sessionId: data.sessionId,
        eventId: data.artifactId,
        eventType: data.artifactData.type,
        timestamp: data.timestamp || Date.now(),
        data: this.applyPrivacyControls(data.artifactData, 'event'),
        source: data.artifactData.source || 'unknown'
      };
      
      await this.addLearningContext(
        eventData,
        'event',
        5, // Medium priority for events
        0.85, // Medium-high confidence for event data
        ['event', data.artifactData.type]
      );
      
      this.logger.debug(`Added event context for significant event ${data.artifactId}`);
    }
  }
  
  /**
   * Applies privacy controls to demonstration data.
   * 
   * @private
   * @param {Object} contextData - The original context data
   * @param {string} contextType - The specific context type
   * @returns {Object} - The processed context data with privacy controls applied
   */
  applyPrivacyControls(contextData, contextType) {
    if (!this.enablePrivacyControls) {
      return contextData;
    }
    
    // Create a deep copy to avoid modifying the original data
    const processedData = JSON.parse(JSON.stringify(contextData));
    
    if (contextType === 'recording' || contextType === 'session') {
      // Mask user identifiable information
      if (processedData.userContext?.username) {
        processedData.userContext.username = '[REDACTED]';
      }
      
      if (processedData.userContext?.userId) {
        processedData.userContext.userId = '[REDACTED]';
      }
      
      // Mask sensitive file paths
      if (processedData.userContext?.environment?.paths) {
        processedData.userContext.environment.paths = processedData.userContext.environment.paths.map(
          path => path.replace(/\/Users\/[^\/]+/g, '/Users/[REDACTED]')
                      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[REDACTED]')
        );
      }
    } else if (contextType === 'event') {
      // Mask sensitive data in event payloads
      if (processedData.data?.input?.text) {
        // Mask potential passwords, emails, and other sensitive data
        processedData.data.input.text = processedData.data.input.text
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
          .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CREDIT_CARD]')
          .replace(/password\s*[=:]\s*["']?[^"']+["']?/gi, 'password=[PASSWORD]');
      }
      
      // Mask screenshots or visual data
      if (processedData.data?.screenshot) {
        processedData.data.screenshot = '[SCREENSHOT_REDACTED]';
      }
    }
    
    return processedData;
  }
}

module.exports = { MCPDemonstrationRecorderProvider };
