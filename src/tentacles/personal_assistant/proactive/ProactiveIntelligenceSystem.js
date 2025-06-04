/**
 * @fileoverview Proactive Intelligence System for the Personal Assistant Tentacle.
 * Provides anticipatory assistance, predictive insights, and proactive recommendations
 * by analyzing user patterns, contextual information, and environmental data.
 * 
 * @module src/tentacles/personal_assistant/proactive/ProactiveIntelligenceSystem
 */

const EventEmitter = require("events");

/**
 * Proactive Intelligence System
 * @extends EventEmitter
 */
class ProactiveIntelligenceSystem extends EventEmitter {
  /**
   * Create a new Proactive Intelligence System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.securityFramework - Security and Governance Framework
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager
   * @param {Object} [dependencies.taskManagementSystem] - Task Management System
   * @param {Object} [dependencies.calendarEngine] - Calendar and Scheduling Engine
   * @param {Object} [dependencies.contactManagementSystem] - Contact Management System
   * @param {Object} [dependencies.informationSystem] - Information Organization System
   * @param {Object} [dependencies.webTentacle] - Web Tentacle for external data
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      predictionConfidenceThreshold: 0.75,
      proactiveNotificationFrequency: "moderate", // low, moderate, high
      contextAwarenessLevel: "high", // low, medium, high
      privacySensitivity: "high", // low, medium, high
      offlineCapabilityLevel: "full", // limited, standard, full
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Data structures
    this.userPatterns = new Map();
    this.predictiveModels = new Map();
    this.contextualAwareness = new Map();
    this.proactiveRecommendations = new Map();
    this.environmentalData = new Map();
    this.notificationQueue = new Map();
    
    this.logger.info("[ProactiveIntelligenceSystem] Proactive Intelligence System initialized");
    
    // Initialize model integrations
    this.models = {};
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegrations();
    }
    
    // Initialize context listeners
    this._initializeContextListeners();
  }
  
  /**
   * Initialize model integrations for proactive intelligence tasks
   * @private
   */
  async _initializeModelIntegrations() {
    const modelTypes = [
      "pattern_recognition",
      "predictive_analysis",
      "context_understanding",
      "recommendation_engine",
      "anomaly_detection",
      "priority_assessment",
      "intent_prediction"
    ];
    
    for (const type of modelTypes) {
      try {
        this.models[type] = await this.dependencies.modelIntegrationManager.getModelIntegration(type);
        this.logger.info(`[ProactiveIntelligenceSystem] Model integration initialized for ${type}`);
      } catch (error) {
        this.logger.warn(`[ProactiveIntelligenceSystem] Failed to initialize model integration for ${type}`, { error: error.message });
      }
    }
  }
  
  /**
   * Initialize context listeners for various tentacle events
   * @private
   */
  _initializeContextListeners() {
    // Listen to task management events
    if (this.dependencies.taskManagementSystem) {
      this.dependencies.taskManagementSystem.on('taskCreated', this._handleTaskEvent.bind(this));
      this.dependencies.taskManagementSystem.on('taskCompleted', this._handleTaskEvent.bind(this));
      this.dependencies.taskManagementSystem.on('taskOverdue', this._handleTaskEvent.bind(this));
    }
    
    // Listen to calendar events
    if (this.dependencies.calendarEngine) {
      this.dependencies.calendarEngine.on('eventCreated', this._handleCalendarEvent.bind(this));
      this.dependencies.calendarEngine.on('eventReminder', this._handleCalendarEvent.bind(this));
      this.dependencies.calendarEngine.on('scheduleConflict', this._handleCalendarEvent.bind(this));
    }
    
    // Listen to contact events
    if (this.dependencies.contactManagementSystem) {
      this.dependencies.contactManagementSystem.on('contactInteraction', this._handleContactEvent.bind(this));
      this.dependencies.contactManagementSystem.on('contactAdded', this._handleContactEvent.bind(this));
    }
    
    // Set up periodic pattern analysis
    this._schedulePatternAnalysis();
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      userPatternCount: this.userPatterns.size,
      predictiveModelCount: this.predictiveModels.size,
      contextAwarenessCount: this.contextualAwareness.size,
      proactiveRecommendationCount: this.proactiveRecommendations.size,
      environmentalDataCount: this.environmentalData.size,
      notificationQueueCount: this.notificationQueue.size,
      modelIntegrations: Object.keys(this.models),
      offlineCapability: this.options.offlineCapabilityLevel
    };
  }
  
  // --- Pattern Recognition and Learning ---
  
  /**
   * Schedule periodic pattern analysis
   * @private
   */
  _schedulePatternAnalysis() {
    // Run initial analysis after system has collected some data
    setTimeout(() => {
      this._analyzeUserPatterns();
      
      // Then schedule regular analysis
      setInterval(() => {
        this._analyzeUserPatterns();
      }, 6 * 60 * 60 * 1000); // Every 6 hours
    }, 30 * 60 * 1000); // Initial delay of 30 minutes
  }
  
  /**
   * Analyze user patterns across various data sources
   * @private
   */
  async _analyzeUserPatterns() {
    this.logger.debug("[ProactiveIntelligenceSystem] Analyzing user patterns");
    
    if (!this.models.pattern_recognition) {
      this.logger.warn("[ProactiveIntelligenceSystem] Pattern recognition model not available");
      return;
    }
    
    try {
      // Gather data from various sources
      const patternData = await this._gatherPatternData();
      
      if (!patternData || Object.keys(patternData).length === 0) {
        this.logger.debug("[ProactiveIntelligenceSystem] Insufficient data for pattern analysis");
        return;
      }
      
      const analysisResult = await this.models.pattern_recognition.analyze({
        userData: patternData,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (analysisResult && analysisResult.patterns) {
        this.logger.info("[ProactiveIntelligenceSystem] User pattern analysis complete", { patternCount: analysisResult.patterns.length });
        
        // Store patterns
        for (const pattern of analysisResult.patterns) {
          const patternId = `pattern_${pattern.type}_${Date.now()}`;
          
          this.userPatterns.set(patternId, {
            id: patternId,
            ...pattern,
            discovered: new Date(),
            lastObserved: new Date(),
            confidence: pattern.confidence || 0.5,
            occurrences: pattern.occurrences || 1
          });
          
          // Store in memory tentacle
          if (this.dependencies.memoryTentacle) {
            await this.dependencies.memoryTentacle.storeEntity({ 
              type: "userPattern", 
              id: patternId, 
              data: this.userPatterns.get(patternId)
            });
          }
        }
        
        // Generate predictive models based on patterns
        this._generatePredictiveModels();
      }
    } catch (error) {
      this.logger.error("[ProactiveIntelligenceSystem] User pattern analysis failed", { error: error.message });
    }
  }
  
  /**
   * Gather data for pattern analysis from various sources
   * @returns {Promise<Object>} Collected pattern data
   * @private
   */
  async _gatherPatternData() {
    const patternData = {
      tasks: [],
      calendar: [],
      contacts: [],
      information: [],
      environmental: []
    };
    
    // Gather task data
    if (this.dependencies.taskManagementSystem) {
      try {
        const tasks = await this.dependencies.taskManagementSystem.getAllTasks();
        patternData.tasks = tasks;
      } catch (error) {
        this.logger.warn("[ProactiveIntelligenceSystem] Failed to gather task data", { error: error.message });
      }
    }
    
    // Gather calendar data
    if (this.dependencies.calendarEngine) {
      try {
        const events = await this.dependencies.calendarEngine.getEvents({ 
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        });
        patternData.calendar = events;
      } catch (error) {
        this.logger.warn("[ProactiveIntelligenceSystem] Failed to gather calendar data", { error: error.message });
      }
    }
    
    // Gather contact data
    if (this.dependencies.contactManagementSystem) {
      try {
        const contacts = await this.dependencies.contactManagementSystem.getAllContacts();
        patternData.contacts = contacts;
        
        const interactions = await this.dependencies.contactManagementSystem.getRecentInteractions();
        patternData.contactInteractions = interactions;
      } catch (error) {
        this.logger.warn("[ProactiveIntelligenceSystem] Failed to gather contact data", { error: error.message });
      }
    }
    
    // Gather information data
    if (this.dependencies.informationSystem) {
      try {
        const recentInfo = await this.dependencies.informationSystem.getRecentInformation();
        patternData.information = recentInfo;
      } catch (error) {
        this.logger.warn("[ProactiveIntelligenceSystem] Failed to gather information data", { error: error.message });
      }
    }
    
    // Gather environmental data
    patternData.environmental = Array.from(this.environmentalData.values());
    
    return patternData;
  }
  
  /**
   * Generate predictive models based on user patterns
   * @private
   */
  async _generatePredictiveModels() {
    if (!this.models.predictive_analysis || this.userPatterns.size === 0) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Generating predictive models");
    
    try {
      const patterns = Array.from(this.userPatterns.values());
      
      const modelResult = await this.models.predictive_analysis.generateModels({
        patterns,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (modelResult && modelResult.models) {
        this.logger.info("[ProactiveIntelligenceSystem] Predictive models generated", { modelCount: modelResult.models.length });
        
        // Store models
        for (const model of modelResult.models) {
          const modelId = `model_${model.type}_${Date.now()}`;
          
          this.predictiveModels.set(modelId, {
            id: modelId,
            ...model,
            generated: new Date(),
            lastUpdated: new Date(),
            accuracy: model.accuracy || 0.5,
            predictions: []
          });
          
          // Store in memory tentacle
          if (this.dependencies.memoryTentacle) {
            await this.dependencies.memoryTentacle.storeEntity({ 
              type: "predictiveModel", 
              id: modelId, 
              data: this.predictiveModels.get(modelId)
            });
          }
        }
        
        // Generate initial predictions
        this._generatePredictions();
      }
    } catch (error) {
      this.logger.error("[ProactiveIntelligenceSystem] Predictive model generation failed", { error: error.message });
    }
  }
  
  // --- Contextual Awareness ---
  
  /**
   * Handle task events
   * @param {Object} eventData - Task event data
   * @private
   */
  async _handleTaskEvent(eventData) {
    this.logger.debug("[ProactiveIntelligenceSystem] Handling task event", { eventType: eventData.type });
    
    // Update contextual awareness
    const contextId = `context_task_${eventData.taskId}`;
    
    this.contextualAwareness.set(contextId, {
      id: contextId,
      type: 'task',
      eventType: eventData.type,
      data: eventData,
      timestamp: new Date()
    });
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "contextAwareness", 
        id: contextId, 
        data: this.contextualAwareness.get(contextId)
      });
    }
    
    // Process context for proactive actions
    this._processContextForProactiveActions(contextId);
  }
  
  /**
   * Handle calendar events
   * @param {Object} eventData - Calendar event data
   * @private
   */
  async _handleCalendarEvent(eventData) {
    this.logger.debug("[ProactiveIntelligenceSystem] Handling calendar event", { eventType: eventData.type });
    
    // Update contextual awareness
    const contextId = `context_calendar_${eventData.eventId}`;
    
    this.contextualAwareness.set(contextId, {
      id: contextId,
      type: 'calendar',
      eventType: eventData.type,
      data: eventData,
      timestamp: new Date()
    });
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "contextAwareness", 
        id: contextId, 
        data: this.contextualAwareness.get(contextId)
      });
    }
    
    // Process context for proactive actions
    this._processContextForProactiveActions(contextId);
  }
  
  /**
   * Handle contact events
   * @param {Object} eventData - Contact event data
   * @private
   */
  async _handleContactEvent(eventData) {
    this.logger.debug("[ProactiveIntelligenceSystem] Handling contact event", { eventType: eventData.type });
    
    // Update contextual awareness
    const contextId = `context_contact_${eventData.contactId}`;
    
    this.contextualAwareness.set(contextId, {
      id: contextId,
      type: 'contact',
      eventType: eventData.type,
      data: eventData,
      timestamp: new Date()
    });
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "contextAwareness", 
        id: contextId, 
        data: this.contextualAwareness.get(contextId)
      });
    }
    
    // Process context for proactive actions
    this._processContextForProactiveActions(contextId);
  }
  
  /**
   * Update environmental data
   * @param {Object} environmentalData - Environmental data
   * @returns {Promise<Object>} Updated environmental data
   */
  async updateEnvironmentalData(environmentalData) {
    this.logger.debug("[ProactiveIntelligenceSystem] Updating environmental data", { type: environmentalData.type });
    
    const dataId = `env_${environmentalData.type}_${Date.now()}`;
    
    const data = {
      id: dataId,
      ...environmentalData,
      timestamp: new Date()
    };
    
    // Store environmental data
    this.environmentalData.set(dataId, data);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "environmentalData", 
        id: dataId, 
        data
      });
    }
    
    // Update contextual awareness
    const contextId = `context_env_${environmentalData.type}`;
    
    this.contextualAwareness.set(contextId, {
      id: contextId,
      type: 'environmental',
      dataType: environmentalData.type,
      data: environmentalData,
      timestamp: new Date()
    });
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "contextAwareness", 
        id: contextId, 
        data: this.contextualAwareness.get(contextId)
      });
    }
    
    // Process context for proactive actions
    this._processContextForProactiveActions(contextId);
    
    return data;
  }
  
  /**
   * Process context for potential proactive actions
   * @param {string} contextId - Context ID
   * @private
   */
  async _processContextForProactiveActions(contextId) {
    const context = this.contextualAwareness.get(contextId);
    if (!context || !this.models.context_understanding) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Processing context for proactive actions", { contextId });
    
    try {
      // Get recent contexts for more comprehensive understanding
      const recentContexts = this._getRecentContexts();
      
      const understandingResult = await this.models.context_understanding.understand({
        currentContext: context,
        recentContexts,
        userPatterns: Array.from(this.userPatterns.values()),
        predictiveModels: Array.from(this.predictiveModels.values()),
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (understandingResult && understandingResult.insights) {
        this.logger.info("[ProactiveIntelligenceSystem] Context understanding complete", { contextId });
        
        // Generate recommendations based on context understanding
        if (this.models.recommendation_engine) {
          this._generateRecommendationsFromContext(context, understandingResult.insights);
        }
        
        // Check for anomalies
        if (this.models.anomaly_detection) {
          this._detectAnomalies(context, understandingResult.insights);
        }
        
        // Update predictions based on new context
        this._updatePredictionsWithContext(context, understandingResult.insights);
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Context processing failed", { contextId, error: error.message });
    }
  }
  
  /**
   * Get recent contexts for comprehensive understanding
   * @returns {Array<Object>} Recent contexts
   * @private
   */
  _getRecentContexts() {
    const contexts = Array.from(this.contextualAwareness.values());
    
    // Sort by timestamp (newest first)
    contexts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Return most recent contexts (limit to 20)
    return contexts.slice(0, 20);
  }
  
  // --- Predictive Intelligence ---
  
  /**
   * Generate predictions based on models and current context
   * @private
   */
  async _generatePredictions() {
    if (!this.models.predictive_analysis || this.predictiveModels.size === 0) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Generating predictions");
    
    try {
      const models = Array.from(this.predictiveModels.values());
      const contexts = this._getRecentContexts();
      
      const predictionResult = await this.models.predictive_analysis.generatePredictions({
        models,
        currentContexts: contexts,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (predictionResult && predictionResult.predictions) {
        this.logger.info("[ProactiveIntelligenceSystem] Predictions generated", { predictionCount: predictionResult.predictions.length });
        
        // Process each prediction
        for (const prediction of predictionResult.predictions) {
          // Find the model this prediction belongs to
          const modelId = prediction.modelId;
          const model = this.predictiveModels.get(modelId);
          
          if (model) {
            // Update model with new prediction
            const updatedModel = { 
              ...model, 
              lastUpdated: new Date(),
              predictions: [...model.predictions, {
                ...prediction,
                generated: new Date(),
                status: 'active'
              }]
            };
            
            // Keep only the 10 most recent predictions
            if (updatedModel.predictions.length > 10) {
              updatedModel.predictions = updatedModel.predictions.slice(-10);
            }
            
            // Store updated model
            this.predictiveModels.set(modelId, updatedModel);
            
            // Store in memory tentacle
            if (this.dependencies.memoryTentacle) {
              await this.dependencies.memoryTentacle.updateEntity({ 
                type: "predictiveModel", 
                id: modelId, 
                data: updatedModel
              });
            }
            
            // Generate recommendations based on high-confidence predictions
            if (prediction.confidence >= this.options.predictionConfidenceThreshold && this.models.recommendation_engine) {
              this._generateRecommendationsFromPrediction(prediction);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error("[ProactiveIntelligenceSystem] Prediction generation failed", { error: error.message });
    }
  }
  
  /**
   * Update predictions with new context
   * @param {Object} context - New context
   * @param {Object} insights - Context insights
   * @private
   */
  async _updatePredictionsWithContext(context, insights) {
    if (!this.models.predictive_analysis || this.predictiveModels.size === 0) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Updating predictions with new context");
    
    try {
      const models = Array.from(this.predictiveModels.values());
      
      const updateResult = await this.models.predictive_analysis.updatePredictions({
        models,
        newContext: context,
        contextInsights: insights,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (updateResult && updateResult.updatedPredictions) {
        this.logger.info("[ProactiveIntelligenceSystem] Predictions updated", { updateCount: updateResult.updatedPredictions.length });
        
        // Process each updated prediction
        for (const updatedPrediction of updateResult.updatedPredictions) {
          const modelId = updatedPrediction.modelId;
          const model = this.predictiveModels.get(modelId);
          
          if (model) {
            // Find and update the specific prediction
            const updatedPredictions = model.predictions.map(p => 
              p.id === updatedPrediction.id ? { ...p, ...updatedPrediction, updated: new Date() } : p
            );
            
            // Update model
            const updatedModel = { 
              ...model, 
              lastUpdated: new Date(),
              predictions: updatedPredictions
            };
            
            // Store updated model
            this.predictiveModels.set(modelId, updatedModel);
            
            // Store in memory tentacle
            if (this.dependencies.memoryTentacle) {
              await this.dependencies.memoryTentacle.updateEntity({ 
                type: "predictiveModel", 
                id: modelId, 
                data: updatedModel
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Prediction update failed", { error: error.message });
    }
  }
  
  // --- Proactive Recommendations ---
  
  /**
   * Generate recommendations based on context
   * @param {Object} context - Context data
   * @param {Object} insights - Context insights
   * @private
   */
  async _generateRecommendationsFromContext(context, insights) {
    if (!this.models.recommendation_engine) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Generating recommendations from context", { contextType: context.type });
    
    try {
      const recommendationResult = await this.models.recommendation_engine.generateFromContext({
        context,
        insights,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (recommendationResult && recommendationResult.recommendations) {
        this.logger.info("[ProactiveIntelligenceSystem] Context-based recommendations generated", { 
          count: recommendationResult.recommendations.length 
        });
        
        // Process recommendations
        for (const recommendation of recommendationResult.recommendations) {
          await this._processRecommendation(recommendation);
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Context-based recommendation generation failed", { error: error.message });
    }
  }
  
  /**
   * Generate recommendations based on prediction
   * @param {Object} prediction - Prediction data
   * @private
   */
  async _generateRecommendationsFromPrediction(prediction) {
    if (!this.models.recommendation_engine) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Generating recommendations from prediction", { predictionType: prediction.type });
    
    try {
      const recommendationResult = await this.models.recommendation_engine.generateFromPrediction({
        prediction,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (recommendationResult && recommendationResult.recommendations) {
        this.logger.info("[ProactiveIntelligenceSystem] Prediction-based recommendations generated", { 
          count: recommendationResult.recommendations.length 
        });
        
        // Process recommendations
        for (const recommendation of recommendationResult.recommendations) {
          await this._processRecommendation(recommendation);
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Prediction-based recommendation generation failed", { error: error.message });
    }
  }
  
  /**
   * Process a recommendation
   * @param {Object} recommendation - Recommendation data
   * @private
   */
  async _processRecommendation(recommendation) {
    const recommendationId = `rec_${Date.now()}_${this._generateRandomId()}`;
    
    const processedRecommendation = {
      id: recommendationId,
      ...recommendation,
      generated: new Date(),
      status: 'new',
      presented: false,
      userResponse: null
    };
    
    // Store recommendation
    this.proactiveRecommendations.set(recommendationId, processedRecommendation);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ 
        type: "proactiveRecommendation", 
        id: recommendationId, 
        data: processedRecommendation
      });
    }
    
    // Assess priority
    if (this.models.priority_assessment) {
      await this._assessRecommendationPriority(recommendationId);
    } else {
      // Default priority if model not available
      const updatedRecommendation = { 
        ...processedRecommendation, 
        priority: recommendation.priority || 'medium' 
      };
      
      this.proactiveRecommendations.set(recommendationId, updatedRecommendation);
      
      // Store in memory tentacle
      if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.updateEntity({ 
          type: "proactiveRecommendation", 
          id: recommendationId, 
          data: updatedRecommendation
        });
      }
    }
    
    // Queue for notification based on priority and notification frequency
    this._queueRecommendationNotification(recommendationId);
  }
  
  /**
   * Assess recommendation priority
   * @param {string} recommendationId - Recommendation ID
   * @private
   */
  async _assessRecommendationPriority(recommendationId) {
    const recommendation = this.proactiveRecommendations.get(recommendationId);
    if (!recommendation || !this.models.priority_assessment) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Assessing recommendation priority", { recommendationId });
    
    try {
      const priorityResult = await this.models.priority_assessment.assess({
        recommendation,
        recentContexts: this._getRecentContexts(),
        notificationFrequency: this.options.proactiveNotificationFrequency
      });
      
      if (priorityResult && priorityResult.priority) {
        this.logger.debug("[ProactiveIntelligenceSystem] Priority assessment complete", { 
          recommendationId, 
          priority: priorityResult.priority 
        });
        
        // Update recommendation with assessed priority
        const updatedRecommendation = { 
          ...recommendation, 
          priority: priorityResult.priority,
          urgency: priorityResult.urgency || 'normal',
          relevance: priorityResult.relevance || 0.5
        };
        
        this.proactiveRecommendations.set(recommendationId, updatedRecommendation);
        
        // Store in memory tentacle
        if (this.dependencies.memoryTentacle) {
          await this.dependencies.memoryTentacle.updateEntity({ 
            type: "proactiveRecommendation", 
            id: recommendationId, 
            data: updatedRecommendation
          });
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Priority assessment failed", { recommendationId, error: error.message });
    }
  }
  
  /**
   * Queue recommendation for notification
   * @param {string} recommendationId - Recommendation ID
   * @private
   */
  _queueRecommendationNotification(recommendationId) {
    const recommendation = this.proactiveRecommendations.get(recommendationId);
    if (!recommendation) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Queueing recommendation for notification", { 
      recommendationId, 
      priority: recommendation.priority 
    });
    
    // Determine delay based on priority and notification frequency
    let delayMs = 0;
    
    switch (recommendation.priority) {
      case 'high':
        delayMs = 1000; // Almost immediate for high priority
        break;
      case 'medium':
        // Adjust based on notification frequency
        switch (this.options.proactiveNotificationFrequency) {
          case 'high':
            delayMs = 5 * 60 * 1000; // 5 minutes
            break;
          case 'moderate':
            delayMs = 15 * 60 * 1000; // 15 minutes
            break;
          case 'low':
            delayMs = 60 * 60 * 1000; // 1 hour
            break;
          default:
            delayMs = 15 * 60 * 1000; // Default to 15 minutes
        }
        break;
      case 'low':
        // Adjust based on notification frequency
        switch (this.options.proactiveNotificationFrequency) {
          case 'high':
            delayMs = 30 * 60 * 1000; // 30 minutes
            break;
          case 'moderate':
            delayMs = 2 * 60 * 60 * 1000; // 2 hours
            break;
          case 'low':
            delayMs = 6 * 60 * 60 * 1000; // 6 hours
            break;
          default:
            delayMs = 2 * 60 * 60 * 1000; // Default to 2 hours
        }
        break;
      default:
        delayMs = 30 * 60 * 1000; // Default to 30 minutes
    }
    
    // Add to notification queue
    this.notificationQueue.set(recommendationId, {
      recommendationId,
      scheduledTime: new Date(Date.now() + delayMs),
      priority: recommendation.priority,
      status: 'queued'
    });
    
    // Schedule notification
    setTimeout(() => {
      this._notifyRecommendation(recommendationId);
    }, delayMs);
  }
  
  /**
   * Notify user of recommendation
   * @param {string} recommendationId - Recommendation ID
   * @private
   */
  async _notifyRecommendation(recommendationId) {
    const recommendation = this.proactiveRecommendations.get(recommendationId);
    const queueItem = this.notificationQueue.get(recommendationId);
    
    if (!recommendation || !queueItem) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Notifying recommendation", { recommendationId });
    
    // Update queue item status
    this.notificationQueue.set(recommendationId, {
      ...queueItem,
      status: 'notifying'
    });
    
    // Update recommendation as presented
    const updatedRecommendation = {
      ...recommendation,
      presented: true,
      presentedTime: new Date(),
      status: 'presented'
    };
    
    this.proactiveRecommendations.set(recommendationId, updatedRecommendation);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ 
        type: "proactiveRecommendation", 
        id: recommendationId, 
        data: updatedRecommendation
      });
    }
    
    // Emit notification event
    this.emit('proactiveRecommendation', updatedRecommendation);
    
    // Remove from notification queue
    this.notificationQueue.delete(recommendationId);
  }
  
  // --- Anomaly Detection ---
  
  /**
   * Detect anomalies in context
   * @param {Object} context - Context data
   * @param {Object} insights - Context insights
   * @private
   */
  async _detectAnomalies(context, insights) {
    if (!this.models.anomaly_detection) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Detecting anomalies in context", { contextType: context.type });
    
    try {
      const anomalyResult = await this.models.anomaly_detection.detect({
        context,
        insights,
        userPatterns: Array.from(this.userPatterns.values()),
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (anomalyResult && anomalyResult.anomalies && anomalyResult.anomalies.length > 0) {
        this.logger.info("[ProactiveIntelligenceSystem] Anomalies detected", { count: anomalyResult.anomalies.length });
        
        // Process each anomaly
        for (const anomaly of anomalyResult.anomalies) {
          const anomalyId = `anomaly_${Date.now()}_${this._generateRandomId()}`;
          
          // Store anomaly
          const processedAnomaly = {
            id: anomalyId,
            ...anomaly,
            detected: new Date(),
            status: 'new',
            addressed: false
          };
          
          // Store in memory tentacle
          if (this.dependencies.memoryTentacle) {
            await this.dependencies.memoryTentacle.storeEntity({ 
              type: "anomalyDetection", 
              id: anomalyId, 
              data: processedAnomaly
            });
          }
          
          // Emit anomaly event
          this.emit('anomalyDetected', processedAnomaly);
          
          // Generate recommendation for anomaly if severe
          if (anomaly.severity === 'high' && this.models.recommendation_engine) {
            this._generateRecommendationsFromAnomaly(processedAnomaly);
          }
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Anomaly detection failed", { error: error.message });
    }
  }
  
  /**
   * Generate recommendations from anomaly
   * @param {Object} anomaly - Anomaly data
   * @private
   */
  async _generateRecommendationsFromAnomaly(anomaly) {
    if (!this.models.recommendation_engine) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Generating recommendations from anomaly", { anomalyId: anomaly.id });
    
    try {
      const recommendationResult = await this.models.recommendation_engine.generateFromAnomaly({
        anomaly,
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (recommendationResult && recommendationResult.recommendations) {
        this.logger.info("[ProactiveIntelligenceSystem] Anomaly-based recommendations generated", { 
          count: recommendationResult.recommendations.length 
        });
        
        // Process recommendations with high priority due to anomaly
        for (const recommendation of recommendationResult.recommendations) {
          const enhancedRecommendation = {
            ...recommendation,
            priority: 'high', // Override priority for anomaly-based recommendations
            source: 'anomaly',
            anomalyId: anomaly.id
          };
          
          await this._processRecommendation(enhancedRecommendation);
        }
      }
    } catch (error) {
      this.logger.warn("[ProactiveIntelligenceSystem] Anomaly-based recommendation generation failed", { error: error.message });
    }
  }
  
  // --- Public API ---
  
  /**
   * Get active recommendations
   * @param {Object} criteria - Filter criteria (e.g., { priority: "high", type: "task" })
   * @returns {Promise<Array<Object>>} Matching recommendations
   */
  async getRecommendations(criteria = {}) {
    this.logger.debug("[ProactiveIntelligenceSystem] Getting recommendations", { criteria });
    let recommendations = Array.from(this.proactiveRecommendations.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      recommendations = recommendations.filter(rec => rec[key] === criteria[key]);
    });
    
    // Sort by priority and generation time
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.generated) - new Date(a.generated);
    });
    
    return recommendations;
  }
  
  /**
   * Update recommendation status with user response
   * @param {string} recommendationId - Recommendation ID
   * @param {string} status - New status (e.g., "accepted", "rejected", "deferred")
   * @param {Object} [feedback] - Optional user feedback
   * @returns {Promise<Object>} Updated recommendation
   */
  async updateRecommendationStatus(recommendationId, status, feedback = null) {
    this.logger.debug("[ProactiveIntelligenceSystem] Updating recommendation status", { recommendationId, status });
    
    const recommendation = this.proactiveRecommendations.get(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation not found: ${recommendationId}`);
    }
    
    const updatedRecommendation = { 
      ...recommendation, 
      status, 
      userResponse: {
        status,
        timestamp: new Date(),
        feedback
      },
      updated: new Date()
    };
    
    // Store updated recommendation
    this.proactiveRecommendations.set(recommendationId, updatedRecommendation);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ 
        type: "proactiveRecommendation", 
        id: recommendationId, 
        data: updatedRecommendation
      });
    }
    
    // Learn from user response
    this._learnFromUserResponse(recommendationId, status, feedback);
    
    this.logger.info("[ProactiveIntelligenceSystem] Recommendation status updated", { recommendationId, status });
    return updatedRecommendation;
  }
  
  /**
   * Learn from user response to improve future recommendations
   * @param {string} recommendationId - Recommendation ID
   * @param {string} status - Response status
   * @param {Object} feedback - User feedback
   * @private
   */
  async _learnFromUserResponse(recommendationId, status, feedback) {
    const recommendation = this.proactiveRecommendations.get(recommendationId);
    if (!recommendation) return;
    
    this.logger.debug("[ProactiveIntelligenceSystem] Learning from user response", { recommendationId, status });
    
    // Update pattern confidence based on user response
    if (recommendation.patternId) {
      const pattern = this.userPatterns.get(recommendation.patternId);
      if (pattern) {
        let confidenceAdjustment = 0;
        
        switch (status) {
          case 'accepted':
            confidenceAdjustment = 0.05; // Increase confidence
            break;
          case 'rejected':
            confidenceAdjustment = -0.05; // Decrease confidence
            break;
          case 'deferred':
            confidenceAdjustment = -0.01; // Slight decrease for deferred
            break;
          default:
            confidenceAdjustment = 0;
        }
        
        const newConfidence = Math.max(0.1, Math.min(0.99, pattern.confidence + confidenceAdjustment));
        
        const updatedPattern = {
          ...pattern,
          confidence: newConfidence,
          lastUpdated: new Date()
        };
        
        this.userPatterns.set(recommendation.patternId, updatedPattern);
        
        // Store in memory tentacle
        if (this.dependencies.memoryTentacle) {
          await this.dependencies.memoryTentacle.updateEntity({ 
            type: "userPattern", 
            id: recommendation.patternId, 
            data: updatedPattern
          });
        }
      }
    }
    
    // Schedule re-analysis of patterns if we have enough feedback
    const responseCount = Array.from(this.proactiveRecommendations.values())
      .filter(rec => rec.userResponse !== null).length;
    
    if (responseCount % 10 === 0) { // Re-analyze after every 10 responses
      setTimeout(() => {
        this._analyzeUserPatterns();
      }, 5 * 60 * 1000); // Wait 5 minutes before re-analyzing
    }
  }
  
  /**
   * Get user patterns
   * @param {Object} criteria - Filter criteria (e.g., { type: "task" })
   * @returns {Promise<Array<Object>>} Matching patterns
   */
  async getUserPatterns(criteria = {}) {
    this.logger.debug("[ProactiveIntelligenceSystem] Getting user patterns", { criteria });
    let patterns = Array.from(this.userPatterns.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      patterns = patterns.filter(pattern => pattern[key] === criteria[key]);
    });
    
    // Sort by confidence (highest first)
    patterns.sort((a, b) => b.confidence - a.confidence);
    
    return patterns;
  }
  
  /**
   * Get current contextual awareness
   * @param {Object} criteria - Filter criteria (e.g., { type: "calendar" })
   * @returns {Promise<Array<Object>>} Matching contexts
   */
  async getContextualAwareness(criteria = {}) {
    this.logger.debug("[ProactiveIntelligenceSystem] Getting contextual awareness", { criteria });
    let contexts = Array.from(this.contextualAwareness.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      contexts = contexts.filter(context => context[key] === criteria[key]);
    });
    
    // Sort by timestamp (newest first)
    contexts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return contexts;
  }
  
  /**
   * Get intent prediction for user action
   * @param {Object} actionContext - Action context
   * @returns {Promise<Object>} Intent prediction
   */
  async predictIntent(actionContext) {
    this.logger.debug("[ProactiveIntelligenceSystem] Predicting intent", { actionType: actionContext.type });
    
    if (!this.models.intent_prediction) {
      throw new Error("Intent prediction model not available");
    }
    
    try {
      const intentResult = await this.models.intent_prediction.predict({
        actionContext,
        recentContexts: this._getRecentContexts(),
        userPatterns: Array.from(this.userPatterns.values()),
        confidenceThreshold: this.options.predictionConfidenceThreshold
      });
      
      if (intentResult && intentResult.intent) {
        this.logger.info("[ProactiveIntelligenceSystem] Intent prediction complete", { 
          actionType: actionContext.type,
          intent: intentResult.intent.type,
          confidence: intentResult.intent.confidence
        });
        
        return intentResult.intent;
      }
      
      throw new Error("Could not predict intent with sufficient confidence");
    } catch (error) {
      this.logger.error("[ProactiveIntelligenceSystem] Intent prediction failed", { error: error.message });
      throw error;
    }
  }
  
  /**
   * Generate a random ID
   * @returns {string} Random ID
   * @private
   */
  _generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

module.exports = ProactiveIntelligenceSystem;
