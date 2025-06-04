/**
 * @fileoverview Context Tracker for Learning from Demonstration.
 * Maintains contextual information during demonstrations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Tracks and maintains context during user demonstrations.
 */
class ContextTracker {
  /**
   * Constructor for ContextTracker.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for ContextTracker");
    if (!options.logger) throw new Error("Logger is required for ContextTracker");
    if (!options.configService) throw new Error("ConfigService is required for ContextTracker");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for ContextTracker");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    
    // Initialize context state
    this.activeContexts = new Map();
    
    this.logger.info("ContextTracker created");
  }
  
  /**
   * Initialize a new context for a demonstration.
   * @param {string} demonstrationId ID of the demonstration
   * @param {Object} initialContext Initial context data
   * @returns {Promise<Object>} The initialized context
   */
  async initializeContext(demonstrationId, initialContext = {}) {
    if (!demonstrationId) {
      throw new Error("Demonstration ID is required to initialize context");
    }
    
    this.logger.info(`Initializing context for demonstration: ${demonstrationId}`);
    
    try {
      // Create base context structure
      const context = {
        id: `context_${demonstrationId}`,
        demonstrationId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        applications: {},
        environment: {},
        user: {},
        data: {},
        state: "active",
        ...initialContext
      };
      
      // Enrich with environment information
      await this._enrichWithEnvironmentInfo(context);
      
      // Store in active contexts
      this.activeContexts.set(demonstrationId, context);
      
      this.logger.info(`Context initialized for demonstration: ${demonstrationId}`);
      return context;
    } catch (error) {
      this.logger.error(`Failed to initialize context: ${error.message}`, { error, demonstrationId });
      throw error;
    }
  }
  
  /**
   * Update context based on a new event.
   * @param {string} demonstrationId ID of the demonstration
   * @param {Object} event The event to process
   * @returns {Promise<Object>} The updated context
   */
  async updateContext(demonstrationId, event) {
    if (!demonstrationId) {
      throw new Error("Demonstration ID is required to update context");
    }
    
    if (!event || typeof event !== "object") {
      throw new Error("Valid event object is required to update context");
    }
    
    const context = this.activeContexts.get(demonstrationId);
    if (!context) {
      throw new Error(`No active context found for demonstration: ${demonstrationId}`);
    }
    
    try {
      // Update timestamp
      context.updatedAt = Date.now();
      
      // Process event based on type
      switch (event.type) {
        case "context.applicationChange":
          await this._handleApplicationChangeEvent(context, event);
          break;
        case "action.click":
        case "action.input":
        case "action.keypress":
          await this._handleUserActionEvent(context, event);
          break;
        case "action.fileOpen":
        case "action.fileSave":
          await this._handleFileEvent(context, event);
          break;
        case "action.copy":
        case "action.paste":
          await this._handleClipboardEvent(context, event);
          break;
        default:
          // For unknown event types, store minimal info
          if (!context.events) {
            context.events = [];
          }
          context.events.push({
            id: event.id,
            type: event.type,
            timestamp: event.timestamp
          });
      }
      
      // Update in active contexts map
      this.activeContexts.set(demonstrationId, context);
      
      return context;
    } catch (error) {
      this.logger.error(`Error updating context: ${error.message}`, { error, demonstrationId, eventType: event.type });
      // Don't throw, return current context
      return context;
    }
  }
  
  /**
   * Finalize context when demonstration is complete.
   * @param {string} demonstrationId ID of the demonstration
   * @returns {Promise<Object>} The finalized context
   */
  async finalizeContext(demonstrationId) {
    if (!demonstrationId) {
      throw new Error("Demonstration ID is required to finalize context");
    }
    
    const context = this.activeContexts.get(demonstrationId);
    if (!context) {
      throw new Error(`No active context found for demonstration: ${demonstrationId}`);
    }
    
    try {
      this.logger.info(`Finalizing context for demonstration: ${demonstrationId}`);
      
      // Update state and timestamp
      context.state = "finalized";
      context.updatedAt = Date.now();
      context.finalizedAt = Date.now();
      
      // Perform final analysis
      await this._performFinalAnalysis(context);
      
      // Remove from active contexts
      this.activeContexts.delete(demonstrationId);
      
      this.logger.info(`Context finalized for demonstration: ${demonstrationId}`);
      return context;
    } catch (error) {
      this.logger.error(`Failed to finalize context: ${error.message}`, { error, demonstrationId });
      // Update state to error but still return
      context.state = "error";
      context.error = error.message;
      this.activeContexts.delete(demonstrationId);
      return context;
    }
  }
  
  /**
   * Get the current context for a demonstration.
   * @param {string} demonstrationId ID of the demonstration
   * @returns {Object|null} The current context or null if not found
   */
  getContext(demonstrationId) {
    if (!demonstrationId) {
      throw new Error("Demonstration ID is required to get context");
    }
    
    return this.activeContexts.get(demonstrationId) || null;
  }
  
  /**
   * Handle application change events.
   * @private
   * @param {Object} context The current context
   * @param {Object} event The application change event
   * @returns {Promise<void>}
   */
  async _handleApplicationChangeEvent(context, event) {
    // Update current application
    context.currentApplication = {
      id: event.application.id,
      name: event.application.name,
      window: event.application.window,
      title: event.application.title,
      focusedAt: event.timestamp
    };
    
    // Add to applications map if not exists
    if (!context.applications[event.application.id]) {
      context.applications[event.application.id] = {
        id: event.application.id,
        name: event.application.name,
        windows: {},
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        focusCount: 0
      };
    }
    
    // Update application data
    const app = context.applications[event.application.id];
    app.lastSeen = event.timestamp;
    app.focusCount++;
    
    // Update window data
    if (event.application.window) {
      if (!app.windows[event.application.window]) {
        app.windows[event.application.window] = {
          id: event.application.window,
          title: event.application.title,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          focusCount: 0
        };
      }
      
      const window = app.windows[event.application.window];
      window.lastSeen = event.timestamp;
      window.focusCount++;
      window.title = event.application.title || window.title;
    }
    
    // Add to events timeline
    if (!context.events) {
      context.events = [];
    }
    context.events.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      applicationId: event.application.id,
      applicationName: event.application.name,
      windowId: event.application.window,
      windowTitle: event.application.title
    });
  }
  
  /**
   * Handle user action events (click, input, keypress).
   * @private
   * @param {Object} context The current context
   * @param {Object} event The user action event
   * @returns {Promise<void>}
   */
  async _handleUserActionEvent(context, event) {
    // Ensure actions array exists
    if (!context.actions) {
      context.actions = [];
    }
    
    // Add action to the list
    context.actions.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      applicationId: event.application?.id,
      applicationName: event.application?.name,
      targetType: event.target?.type,
      targetId: event.target?.id,
      targetSelector: event.target?.selector,
      value: event.value || null
    });
    
    // Update application last interaction time
    if (event.application?.id && context.applications[event.application.id]) {
      context.applications[event.application.id].lastInteraction = event.timestamp;
    }
    
    // Add to events timeline
    if (!context.events) {
      context.events = [];
    }
    context.events.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      applicationId: event.application?.id,
      targetType: event.target?.type
    });
  }
  
  /**
   * Handle file events (open, save).
   * @private
   * @param {Object} context The current context
   * @param {Object} event The file event
   * @returns {Promise<void>}
   */
  async _handleFileEvent(context, event) {
    // Ensure files array exists
    if (!context.files) {
      context.files = [];
    }
    
    // Add file to the list
    context.files.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      path: event.file?.path,
      name: event.file?.name,
      fileType: event.file?.type,
      size: event.file?.size,
      applicationId: event.application?.id,
      applicationName: event.application?.name
    });
    
    // Add to events timeline
    if (!context.events) {
      context.events = [];
    }
    context.events.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      filePath: event.file?.path,
      fileName: event.file?.name,
      applicationId: event.application?.id
    });
  }
  
  /**
   * Handle clipboard events (copy, paste).
   * @private
   * @param {Object} context The current context
   * @param {Object} event The clipboard event
   * @returns {Promise<void>}
   */
  async _handleClipboardEvent(context, event) {
    // Ensure clipboard array exists
    if (!context.clipboard) {
      context.clipboard = [];
    }
    
    // Add clipboard operation to the list
    context.clipboard.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      hasText: !!event.content?.text,
      hasHtml: !!event.content?.html,
      hasImage: event.content?.hasImage || false,
      hasFiles: event.content?.hasFiles || false,
      applicationId: event.application?.id,
      applicationName: event.application?.name
    });
    
    // Add to events timeline
    if (!context.events) {
      context.events = [];
    }
    context.events.push({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      applicationId: event.application?.id
    });
  }
  
  /**
   * Enrich context with environment information.
   * @private
   * @param {Object} context The context to enrich
   * @returns {Promise<void>}
   */
  async _enrichWithEnvironmentInfo(context) {
    try {
      // Get system information from config service
      const systemInfo = await this.configService.get("system.info", {});
      
      // Add to environment
      context.environment = {
        os: systemInfo.os || "unknown",
        platform: systemInfo.platform || "unknown",
        version: systemInfo.version || "unknown",
        hostname: systemInfo.hostname || "unknown",
        username: systemInfo.username || "unknown",
        language: systemInfo.language || "en-US",
        timezone: systemInfo.timezone || "UTC",
        timestamp: Date.now()
      };
      
      // Add user information if available
      const userInfo = await this.configService.get("user.info", {});
      context.user = {
        id: userInfo.id || "unknown",
        name: userInfo.name || "unknown",
        preferences: userInfo.preferences || {}
      };
    } catch (error) {
      this.logger.error(`Error enriching context with environment info: ${error.message}`, { error });
      // Set minimal environment info
      context.environment = {
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Perform final analysis on the context.
   * @private
   * @param {Object} context The context to analyze
   * @returns {Promise<void>}
   */
  async _performFinalAnalysis(context) {
    try {
      // Calculate statistics
      const stats = {
        duration: (context.finalizedAt - context.createdAt) / 1000, // in seconds
        applicationCount: Object.keys(context.applications || {}).length,
        eventCount: (context.events || []).length,
        actionCount: (context.actions || []).length,
        fileCount: (context.files || []).length
      };
      
      // Add most used application
      if (stats.applicationCount > 0) {
        let mostUsedApp = null;
        let maxFocusCount = 0;
        
        for (const appId in context.applications) {
          const app = context.applications[appId];
          if (app.focusCount > maxFocusCount) {
            maxFocusCount = app.focusCount;
            mostUsedApp = app;
          }
        }
        
        if (mostUsedApp) {
          stats.mostUsedApplication = {
            id: mostUsedApp.id,
            name: mostUsedApp.name,
            focusCount: mostUsedApp.focusCount
          };
        }
      }
      
      // Add statistics to context
      context.statistics = stats;
      
      // Add to knowledge graph if configured
      const shouldAddToKnowledgeGraph = this.configService.get("lfd.addContextToKnowledgeGraph", true);
      if (shouldAddToKnowledgeGraph) {
        await this._addToKnowledgeGraph(context);
      }
    } catch (error) {
      this.logger.error(`Error performing final context analysis: ${error.message}`, { error });
      // Add error to context but don't throw
      context.analysisError = error.message;
    }
  }
  
  /**
   * Add context information to the knowledge graph.
   * @private
   * @param {Object} context The context to add
   * @returns {Promise<void>}
   */
  async _addToKnowledgeGraph(context) {
    try {
      // Create demonstration node
      const demoNode = {
        type: "Demonstration",
        id: context.demonstrationId,
        properties: {
          createdAt: context.createdAt,
          finalizedAt: context.finalizedAt,
          duration: context.statistics.duration,
          eventCount: context.statistics.eventCount,
          actionCount: context.statistics.actionCount,
          state: context.state
        }
      };
      
      await this.knowledgeGraphManager.addNode(demoNode);
      
      // Add application nodes and relationships
      for (const appId in context.applications) {
        const app = context.applications[appId];
        
        const appNode = {
          type: "Application",
          id: app.id,
          properties: {
            name: app.name,
            firstSeen: app.firstSeen,
            lastSeen: app.lastSeen
          }
        };
        
        await this.knowledgeGraphManager.addNode(appNode);
        
        // Add relationship between demonstration and application
        await this.knowledgeGraphManager.addEdge({
          type: "USED",
          from: demoNode.id,
          to: appNode.id,
          properties: {
            focusCount: app.focusCount,
            timestamp: context.createdAt
          }
        });
      }
      
      this.logger.info(`Added demonstration context to knowledge graph: ${context.demonstrationId}`);
    } catch (error) {
      this.logger.error(`Error adding context to knowledge graph: ${error.message}`, { error });
      // Don't throw, just log
    }
  }
}

module.exports = ContextTracker;
