/**
 * @fileoverview Event Normalizer for Learning from Demonstration.
 * Standardizes events from different sources into a consistent format.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Normalizes events from various sources into a standardized format.
 */
class EventNormalizer {
  /**
   * Constructor for EventNormalizer.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for EventNormalizer");
    if (!options.logger) throw new Error("Logger is required for EventNormalizer");
    if (!options.configService) throw new Error("ConfigService is required for EventNormalizer");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    
    // Load normalization rules
    this.normalizationRules = this._loadNormalizationRules();
    
    this.logger.info("EventNormalizer created");
  }
  
  /**
   * Normalize a sequence of events.
   * @param {Array<Object>} events Array of events to normalize
   * @returns {Array<Object>} Normalized events
   */
  normalizeEvents(events) {
    if (!Array.isArray(events)) {
      throw new Error("Events must be an array");
    }
    
    this.logger.info(`Normalizing ${events.length} events`);
    
    try {
      // Process events in sequence
      const normalizedEvents = events.map(event => this.normalizeEvent(event));
      
      // Filter out null events (those that couldn't be normalized)
      const filteredEvents = normalizedEvents.filter(event => event !== null);
      
      this.logger.info(`Normalized ${filteredEvents.length} events (${events.length - filteredEvents.length} filtered out)`);
      
      return filteredEvents;
    } catch (error) {
      this.logger.error(`Error normalizing events: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Normalize a single event.
   * @param {Object} event Event to normalize
   * @returns {Object|null} Normalized event or null if event should be filtered out
   */
  normalizeEvent(event) {
    if (!event || typeof event !== "object") {
      this.logger.warn("Invalid event provided for normalization", { event });
      return null;
    }
    
    try {
      // Basic validation
      if (!event.type || !event.data) {
        this.logger.warn("Event missing required fields", { event });
        return null;
      }
      
      // Find appropriate normalization rule
      const rule = this._findNormalizationRule(event.type);
      if (!rule) {
        this.logger.debug(`No normalization rule found for event type: ${event.type}`);
        // Return a basic normalized version
        return this._createBasicNormalizedEvent(event);
      }
      
      // Apply normalization rule
      const normalizedEvent = rule.normalize(event);
      
      // Validate normalized event
      if (!this._validateNormalizedEvent(normalizedEvent)) {
        this.logger.warn("Normalized event failed validation", { originalEvent: event, normalizedEvent });
        return null;
      }
      
      return normalizedEvent;
    } catch (error) {
      this.logger.error(`Error normalizing event: ${error.message}`, { error, event });
      // Return null to filter out this event
      return null;
    }
  }
  
  /**
   * Load normalization rules from configuration.
   * @private
   * @returns {Array<Object>} Array of normalization rules
   */
  _loadNormalizationRules() {
    const rules = [];
    
    // UI Click events
    rules.push({
      eventTypes: ["ui.click"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: "action.click",
          target: {
            type: event.data.elementType || "unknown",
            id: event.data.elementId || null,
            selector: event.data.selector || null,
            text: event.data.elementText || null,
            attributes: event.data.elementAttributes || {}
          },
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null
          },
          position: {
            x: event.data.x || 0,
            y: event.data.y || 0,
            relative: event.data.relativePosition || null
          },
          modifiers: {
            ctrl: event.data.ctrlKey || false,
            alt: event.data.altKey || false,
            shift: event.data.shiftKey || false,
            meta: event.data.metaKey || false
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    // UI Input events
    rules.push({
      eventTypes: ["ui.input"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: "action.input",
          target: {
            type: event.data.elementType || "unknown",
            id: event.data.elementId || null,
            selector: event.data.selector || null,
            attributes: event.data.elementAttributes || {}
          },
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null
          },
          value: {
            text: event.data.text || "",
            isPassword: event.data.isPassword || false,
            isMultiline: event.data.isMultiline || false
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    // UI Keypress events
    rules.push({
      eventTypes: ["ui.keypress"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: "action.keypress",
          key: {
            code: event.data.keyCode || null,
            name: event.data.key || null,
            isSpecial: event.data.isSpecialKey || false
          },
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null
          },
          target: {
            type: event.data.elementType || "unknown",
            id: event.data.elementId || null,
            selector: event.data.selector || null
          },
          modifiers: {
            ctrl: event.data.ctrlKey || false,
            alt: event.data.altKey || false,
            shift: event.data.shiftKey || false,
            meta: event.data.metaKey || false
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    // Application focus change events
    rules.push({
      eventTypes: ["app.focusChanged"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: "context.applicationChange",
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null,
            title: event.data.windowTitle || null
          },
          previous: {
            id: event.data.previousApplicationId || null,
            name: event.data.previousApplicationName || null,
            window: event.data.previousWindowId || null
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    // File events
    rules.push({
      eventTypes: ["file.opened", "file.saved"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: event.type === "file.opened" ? "action.fileOpen" : "action.fileSave",
          file: {
            path: event.data.filePath || null,
            name: event.data.fileName || null,
            type: event.data.fileType || null,
            size: event.data.fileSize || null
          },
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    // Clipboard events
    rules.push({
      eventTypes: ["clipboard.copied", "clipboard.pasted"],
      normalize: (event) => {
        return {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          timestamp: event.timestamp,
          type: event.type === "clipboard.copied" ? "action.copy" : "action.paste",
          content: {
            text: event.data.text || null,
            html: event.data.html || null,
            hasImage: event.data.hasImage || false,
            hasFiles: event.data.hasFiles || false
          },
          application: {
            id: event.data.applicationId || null,
            name: event.data.applicationName || null,
            window: event.data.windowId || null
          },
          target: {
            type: event.data.elementType || "unknown",
            id: event.data.elementId || null,
            selector: event.data.selector || null
          },
          metadata: {
            originalType: event.type,
            originalTimestamp: event.timestamp
          }
        };
      }
    });
    
    return rules;
  }
  
  /**
   * Find the appropriate normalization rule for an event type.
   * @private
   * @param {string} eventType Event type to find rule for
   * @returns {Object|null} Normalization rule or null if not found
   */
  _findNormalizationRule(eventType) {
    return this.normalizationRules.find(rule => rule.eventTypes.includes(eventType)) || null;
  }
  
  /**
   * Create a basic normalized event when no specific rule is found.
   * @private
   * @param {Object} event Original event
   * @returns {Object} Basic normalized event
   */
  _createBasicNormalizedEvent(event) {
    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: event.timestamp,
      type: `generic.${event.type}`,
      data: { ...event.data },
      metadata: {
        originalType: event.type,
        originalTimestamp: event.timestamp,
        normalized: false
      }
    };
  }
  
  /**
   * Validate a normalized event.
   * @private
   * @param {Object} event Normalized event to validate
   * @returns {boolean} True if valid, false otherwise
   */
  _validateNormalizedEvent(event) {
    // Basic validation
    if (!event || typeof event !== "object") {
      return false;
    }
    
    // Required fields
    if (!event.id || !event.timestamp || !event.type) {
      return false;
    }
    
    // Type-specific validation could be added here
    
    return true;
  }
}

module.exports = EventNormalizer;
