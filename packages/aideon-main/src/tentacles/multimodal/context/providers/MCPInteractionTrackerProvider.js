/**
 * @fileoverview MCPInteractionTrackerProvider for tracking UI interactions.
 * 
 * This module provides context management for UI interactions, including
 * tracking individual interaction events and identifying interaction patterns.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const MCPUIContextProvider = require('./MCPUIContextProvider');

/**
 * Provider for tracking UI interactions.
 */
class MCPInteractionTrackerProvider extends MCPUIContextProvider {
  /**
   * Constructor for MCPInteractionTrackerProvider.
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize interaction-specific properties
    this.interactionEvents = [];
    this.interactionPatterns = [];
    this.maxEventHistory = options.maxEventHistory || 1000;
    this.patternDetectionEnabled = options.patternDetectionEnabled !== false;
    this.patternDetectionThreshold = options.patternDetectionThreshold || 0.7;
    this.patternDetectionMinEvents = options.patternDetectionMinEvents || 3;
    
    // Set privacy controls specific to interaction tracking
    this.privacyControls = {
      ...this.privacyControls,
      anonymizeInteractions: options.anonymizeInteractions !== false,
      excludeSensitiveFields: options.excludeSensitiveFields !== false,
      retentionPolicy: options.retentionPolicy || 'session'
    };
    
    this.logger.info('MCPInteractionTrackerProvider created');
  }
  
  /**
   * Register context types with MCP Context Manager.
   * @private
   * @returns {Promise<void>}
   */
  async _registerContextTypes() {
    try {
      this.logger.debug('Registering UI interaction context types with MCP Context Manager');
      
      // Register context types
      this.contextTypes.add('ui.interaction.event');
      this.contextTypes.add('ui.interaction.pattern');
      
      // Register with MCP Context Manager
      for (const contextType of this.contextTypes) {
        await this.mcpContextManager.registerContextProvider(contextType, this);
      }
      
      this.logger.debug('UI interaction context types registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register UI interaction context types: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Track UI interaction event.
   * @param {Object} eventData Interaction event data
   * @returns {Promise<boolean>} True if tracking was successful
   */
  async trackInteractionEvent(eventData) {
    try {
      this.logger.debug('Tracking UI interaction event', { eventData });
      
      // Validate event data
      if (!eventData || !eventData.eventType || !eventData.elementId) {
        throw new Error('Invalid interaction event data: eventType and elementId are required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('trackInteractionEvent', async () => {
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          eventType: eventData.eventType,
          elementId: eventData.elementId,
          elementType: eventData.elementType || 'unknown',
          viewId: eventData.viewId || 'unknown',
          value: eventData.value,
          position: eventData.position,
          metadata: eventData.metadata || {}
        };
        
        // Apply privacy controls
        const processedData = await this._applyInteractionPrivacyControls(contextData);
        
        // Add to interaction events
        this.interactionEvents.push(processedData);
        
        // Trim event history if needed
        if (this.interactionEvents.length > this.maxEventHistory) {
          this.interactionEvents = this.interactionEvents.slice(-this.maxEventHistory);
        }
        
        // Update context data
        await this._processContextUpdate('ui.interaction.event', processedData, this.constructor.name);
        
        // Detect patterns if enabled
        if (this.patternDetectionEnabled && this.interactionEvents.length >= this.patternDetectionMinEvents) {
          await this._detectInteractionPatterns();
        }
        
        // Emit interaction event
        this.emit('interactionTracked', {
          event: processedData
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to track interaction event: ${error.message}`, { error, eventData });
      
      // Emit error event
      this.emit('error', {
        type: 'interactionTracking',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Apply privacy controls specific to interaction data.
   * @private
   * @param {Object} interactionData Interaction data
   * @returns {Promise<Object>} Processed interaction data
   */
  async _applyInteractionPrivacyControls(interactionData) {
    try {
      // Skip if privacy controls are disabled
      if (!this.privacyControls.enabled) {
        return interactionData;
      }
      
      this.logger.debug('Applying interaction privacy controls');
      
      let processedData = JSON.parse(JSON.stringify(interactionData));
      
      // Anonymize interactions if enabled
      if (this.privacyControls.anonymizeInteractions) {
        // Remove user-specific identifiers
        if (processedData.metadata && processedData.metadata.userId) {
          processedData.metadata.userId = 'anonymized';
        }
        
        // Remove session identifiers
        if (processedData.metadata && processedData.metadata.sessionId) {
          processedData.metadata.sessionId = 'anonymized';
        }
      }
      
      // Exclude sensitive fields if enabled
      if (this.privacyControls.excludeSensitiveFields) {
        // Check if the element type or ID suggests it's a sensitive field
        const sensitivePatterns = ['password', 'token', 'secret', 'key', 'credential', 'auth', 'credit', 'card', 'ssn', 'social'];
        const isSensitive = sensitivePatterns.some(pattern => 
          (processedData.elementId && processedData.elementId.toLowerCase().includes(pattern)) ||
          (processedData.elementType && processedData.elementType.toLowerCase().includes(pattern))
        );
        
        if (isSensitive) {
          // Mask the value
          processedData.value = '[MASKED]';
        }
      }
      
      return processedData;
    } catch (error) {
      this.logger.error(`Failed to apply interaction privacy controls: ${error.message}`, { error });
      return interactionData; // Return original data on error
    }
  }
  
  /**
   * Detect interaction patterns from recent events.
   * @private
   * @returns {Promise<void>}
   */
  async _detectInteractionPatterns() {
    try {
      this.logger.debug('Detecting interaction patterns');
      
      // This is a simplified pattern detection implementation
      // In a production environment, this would use more sophisticated pattern recognition
      
      // Group events by view
      const eventsByView = {};
      for (const event of this.interactionEvents) {
        if (!eventsByView[event.viewId]) {
          eventsByView[event.viewId] = [];
        }
        eventsByView[event.viewId].push(event);
      }
      
      // Detect patterns in each view
      for (const [viewId, events] of Object.entries(eventsByView)) {
        // Skip if not enough events
        if (events.length < this.patternDetectionMinEvents) {
          continue;
        }
        
        // Detect form-filling pattern
        const formFillingPattern = this._detectFormFillingPattern(events, viewId);
        if (formFillingPattern) {
          await this._addInteractionPattern(formFillingPattern);
        }
        
        // Detect navigation pattern
        const navigationPattern = this._detectNavigationPattern(events, viewId);
        if (navigationPattern) {
          await this._addInteractionPattern(navigationPattern);
        }
        
        // Detect search pattern
        const searchPattern = this._detectSearchPattern(events, viewId);
        if (searchPattern) {
          await this._addInteractionPattern(searchPattern);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to detect interaction patterns: ${error.message}`, { error });
    }
  }
  
  /**
   * Detect form-filling pattern.
   * @private
   * @param {Array<Object>} events Interaction events
   * @param {string} viewId View ID
   * @returns {Object|null} Form-filling pattern or null if not detected
   */
  _detectFormFillingPattern(events, viewId) {
    // Count input events
    const inputEvents = events.filter(event => 
      event.eventType === 'input' || 
      event.eventType === 'focus' || 
      event.eventType === 'blur'
    );
    
    // Count unique input elements
    const uniqueInputElements = new Set(inputEvents.map(event => event.elementId)).size;
    
    // Check if there are multiple input events on multiple elements
    if (inputEvents.length >= this.patternDetectionMinEvents && uniqueInputElements >= 2) {
      // Check if there's a submit event after input events
      const submitEvent = events.find(event => 
        event.eventType === 'click' && 
        (event.elementType === 'button' || event.elementType === 'submit') &&
        event.timestamp > Math.max(...inputEvents.map(e => e.timestamp))
      );
      
      if (submitEvent) {
        // Form-filling pattern detected
        return {
          patternType: 'form-filling',
          confidence: Math.min(0.5 + (uniqueInputElements * 0.1), 0.95),
          events: [...inputEvents, submitEvent],
          frequency: 1,
          lastObserved: Date.now(),
          metadata: {
            viewId,
            formElements: uniqueInputElements,
            submitElementId: submitEvent.elementId
          }
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect navigation pattern.
   * @private
   * @param {Array<Object>} events Interaction events
   * @param {string} viewId View ID
   * @returns {Object|null} Navigation pattern or null if not detected
   */
  _detectNavigationPattern(events, viewId) {
    // Count navigation events (clicks on links or navigation elements)
    const navigationEvents = events.filter(event => 
      event.eventType === 'click' && 
      (event.elementType === 'link' || 
       event.elementType === 'nav' || 
       event.elementType === 'menu' ||
       (event.metadata && event.metadata.isNavigation))
    );
    
    // Check if there are multiple navigation events
    if (navigationEvents.length >= this.patternDetectionMinEvents) {
      // Navigation pattern detected
      return {
        patternType: 'navigation',
        confidence: Math.min(0.5 + (navigationEvents.length * 0.05), 0.9),
        events: navigationEvents,
        frequency: 1,
        lastObserved: Date.now(),
        metadata: {
          viewId,
          navigationCount: navigationEvents.length
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detect search pattern.
   * @private
   * @param {Array<Object>} events Interaction events
   * @param {string} viewId View ID
   * @returns {Object|null} Search pattern or null if not detected
   */
  _detectSearchPattern(events, viewId) {
    // Find search input events
    const searchInputEvents = events.filter(event => 
      event.eventType === 'input' && 
      (event.elementType === 'search' || 
       (event.elementId && event.elementId.toLowerCase().includes('search')))
    );
    
    // Check if there are search input events followed by a search action
    if (searchInputEvents.length > 0) {
      // Find search action event
      const searchActionEvent = events.find(event => 
        event.eventType === 'click' && 
        (event.elementType === 'button' || event.elementType === 'submit') &&
        (event.elementId && event.elementId.toLowerCase().includes('search')) &&
        event.timestamp > Math.max(...searchInputEvents.map(e => e.timestamp))
      );
      
      if (searchActionEvent) {
        // Search pattern detected
        return {
          patternType: 'search',
          confidence: 0.85,
          events: [...searchInputEvents, searchActionEvent],
          frequency: 1,
          lastObserved: Date.now(),
          metadata: {
            viewId,
            searchInputElementId: searchInputEvents[searchInputEvents.length - 1].elementId,
            searchActionElementId: searchActionEvent.elementId
          }
        };
      }
    }
    
    return null;
  }
  
  /**
   * Add interaction pattern.
   * @private
   * @param {Object} pattern Interaction pattern
   * @returns {Promise<void>}
   */
  async _addInteractionPattern(pattern) {
    try {
      // Check if pattern already exists
      const existingPatternIndex = this.interactionPatterns.findIndex(p => 
        p.patternType === pattern.patternType &&
        JSON.stringify(p.metadata) === JSON.stringify(pattern.metadata)
      );
      
      if (existingPatternIndex >= 0) {
        // Update existing pattern
        const existingPattern = this.interactionPatterns[existingPatternIndex];
        existingPattern.frequency += 1;
        existingPattern.lastObserved = pattern.lastObserved;
        existingPattern.confidence = Math.min(existingPattern.confidence + 0.05, 0.99);
        
        // Update context data
        await this._processContextUpdate('ui.interaction.pattern', existingPattern, this.constructor.name);
        
        // Emit pattern updated event
        this.emit('patternUpdated', {
          pattern: existingPattern
        });
      } else {
        // Add new pattern
        this.interactionPatterns.push(pattern);
        
        // Update context data
        await this._processContextUpdate('ui.interaction.pattern', pattern, this.constructor.name);
        
        // Emit pattern detected event
        this.emit('patternDetected', {
          pattern
        });
      }
    } catch (error) {
      this.logger.error(`Failed to add interaction pattern: ${error.message}`, { error, pattern });
    }
  }
  
  /**
   * Get interaction events for a specific view.
   * @param {string} viewId View ID
   * @returns {Promise<Array<Object>>} Interaction events for the view
   */
  async getInteractionEventsForView(viewId) {
    try {
      this.logger.debug(`Getting interaction events for view: ${viewId}`);
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getInteractionEventsForView', async () => {
        // Filter events by view ID
        return this.interactionEvents.filter(event => event.viewId === viewId);
      });
    } catch (error) {
      this.logger.error(`Failed to get interaction events for view: ${error.message}`, { error, viewId });
      return [];
    }
  }
  
  /**
   * Get detected interaction patterns.
   * @param {string} [patternType] Optional pattern type filter
   * @returns {Promise<Array<Object>>} Detected interaction patterns
   */
  async getInteractionPatterns(patternType) {
    try {
      this.logger.debug('Getting interaction patterns', { patternType });
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getInteractionPatterns', async () => {
        // Filter patterns by type if specified
        if (patternType) {
          return this.interactionPatterns.filter(pattern => pattern.patternType === patternType);
        }
        
        return this.interactionPatterns;
      });
    } catch (error) {
      this.logger.error(`Failed to get interaction patterns: ${error.message}`, { error, patternType });
      return [];
    }
  }
  
  /**
   * Clear interaction history.
   * @returns {Promise<boolean>} True if clearing was successful
   */
  async clearInteractionHistory() {
    try {
      this.logger.debug('Clearing interaction history');
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('clearInteractionHistory', async () => {
        // Clear interaction events
        this.interactionEvents = [];
        
        // Emit interaction history cleared event
        this.emit('interactionHistoryCleared');
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to clear interaction history: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'interactionHistoryClear',
        message: error.message,
        error
      });
      
      return false;
    }
  }
}

module.exports = MCPInteractionTrackerProvider;
