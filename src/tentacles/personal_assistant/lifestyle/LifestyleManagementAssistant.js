/**
 * @fileoverview Lifestyle Management Assistant for the Personal Assistant Tentacle.
 * Manages health, wellness, travel, hobbies, and related personal lifestyle aspects.
 * 
 * @module src/tentacles/personal_assistant/lifestyle/LifestyleManagementAssistant
 */

const EventEmitter = require("events");

/**
 * Lifestyle Management Assistant
 * @extends EventEmitter
 */
class LifestyleManagementAssistant extends EventEmitter {
  /**
   * Create a new Lifestyle Management Assistant
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.securityFramework - Security and Governance Framework
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager
   * @param {Object} [dependencies.webTentacle] - Web Tentacle for external data/bookings
   * @param {Object} [dependencies.medicalHealthTentacle] - Medical/Health Tentacle for deeper health integration
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      defaultUnits: { distance: "km", weight: "kg", temperature: "C" },
      recommendationFrequency: "daily",
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Data structures (backed by Memory Tentacle)
    this.healthGoals = new Map();
    this.wellnessLogs = new Map();
    this.travelPlans = new Map();
    this.hobbies = new Map();
    
    this.logger.info("[LifestyleManagementAssistant] Lifestyle Management Assistant initialized");
    
    // Initialize model integrations
    this.models = {};
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegrations();
    }
  }
  
  /**
   * Initialize model integrations for lifestyle management tasks
   * @private
   */
  async _initializeModelIntegrations() {
    const modelTypes = [
      "lifestyle_recommendation",
      "travel_planning_assist",
      "health_goal_analysis",
      "hobby_suggestion"
    ];
    
    for (const type of modelTypes) {
      try {
        this.models[type] = await this.dependencies.modelIntegrationManager.getModelIntegration(type);
        this.logger.info(`[LifestyleManagementAssistant] Model integration initialized for ${type}`);
      } catch (error) {
        this.logger.warn(`[LifestyleManagementAssistant] Failed to initialize model integration for ${type}`, { error: error.message });
      }
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      healthGoalCount: this.healthGoals.size,
      wellnessLogCount: this.wellnessLogs.size,
      travelPlanCount: this.travelPlans.size,
      hobbyCount: this.hobbies.size,
      modelIntegrations: Object.keys(this.models)
    };
  }
  
  // --- Health & Wellness Management ---
  
  /**
   * Set a health or wellness goal
   * @param {Object} goalData - Goal details
   * @param {string} goalData.type - Type of goal (e.g., "steps", "weight", "sleep", "mindfulness")
   * @param {number} goalData.targetValue - Target value for the goal
   * @param {string} [goalData.unit] - Unit for the target value
   * @param {Date} [goalData.startDate] - Goal start date
   * @param {Date} [goalData.endDate] - Goal end date
   * @param {string} [goalData.frequency] - How often to track (e.g., "daily", "weekly")
   * @returns {Promise<Object>} Created goal
   */
  async setHealthGoal(goalData) {
    this.logger.debug("[LifestyleManagementAssistant] Setting health goal", { type: goalData.type });
    
    const goalId = `hgoal_${Date.now()}_${this._generateRandomId()}`;
    const unit = goalData.unit || this._getDefaultUnit(goalData.type);
    
    const goal = {
      id: goalId,
      type: "healthGoal",
      goalType: goalData.type,
      targetValue: goalData.targetValue,
      unit: unit,
      startDate: goalData.startDate || new Date(),
      endDate: goalData.endDate || null,
      frequency: goalData.frequency || "daily",
      status: "active", // active, completed, paused, cancelled
      progress: 0, // Percentage or current value
      created: new Date(),
      updated: new Date()
    };
    
    // Apply privacy controls (health data is sensitive)
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: "healthGoal",
        entityId: goalId,
        privacyLevel: "highly_sensitive"
      });
    }
    
    // Store goal
    this.healthGoals.set(goalId, goal);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "healthGoal", id: goalId, data: goal });
    }
    
    // Perform AI analysis asynchronously
    this._analyzeHealthGoal(goalId);
    
    this.logger.info("[LifestyleManagementAssistant] Health goal set successfully", { goalId, goalType: goal.goalType });
    return goal;
  }
  
  /**
   * Log a wellness activity or metric
   * @param {Object} logData - Log details
   * @param {string} logData.type - Type of activity/metric (e.g., "steps", "workout", "sleep", "mood")
   * @param {number} logData.value - Measured value
   * @param {string} [logData.unit] - Unit for the value
   * @param {Date} [logData.timestamp] - Time of the activity/measurement
   * @param {string} [logData.notes] - Additional notes
   * @returns {Promise<Object>} Created log entry
   */
  async logWellnessActivity(logData) {
    this.logger.debug("[LifestyleManagementAssistant] Logging wellness activity", { type: logData.type });
    
    const logId = `wlog_${Date.now()}_${this._generateRandomId()}`;
    const unit = logData.unit || this._getDefaultUnit(logData.type);
    
    const logEntry = {
      id: logId,
      type: "wellnessLog",
      logType: logData.type,
      value: logData.value,
      unit: unit,
      timestamp: logData.timestamp || new Date(),
      notes: logData.notes || "",
      source: logData.source || "manual" // manual, device_sync, etc.
    };
    
    // Apply privacy controls
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: "wellnessLog",
        entityId: logId,
        privacyLevel: "highly_sensitive"
      });
    }
    
    // Store log entry
    this.wellnessLogs.set(logId, logEntry);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "wellnessLog", id: logId, data: logEntry });
    }
    
    // Update relevant goal progress asynchronously
    this._updateGoalProgressFromLog(logEntry);
    
    this.logger.info("[LifestyleManagementAssistant] Wellness activity logged successfully", { logId, logType: logEntry.logType });
    return logEntry;
  }
  
  /**
   * Get health goals based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { status: "active", type: "steps" })
   * @returns {Promise<Array<Object>>} Matching goals
   */
  async getHealthGoals(criteria = {}) {
    this.logger.debug("[LifestyleManagementAssistant] Getting health goals", { criteria });
    let goals = Array.from(this.healthGoals.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      goals = goals.filter(goal => goal[key] === criteria[key]);
    });
    
    return goals;
  }
  
  /**
   * Get wellness logs based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { type: "sleep", startDate: ..., endDate: ... })
   * @returns {Promise<Array<Object>>} Matching log entries
   */
  async getWellnessLogs(criteria = {}) {
    this.logger.debug("[LifestyleManagementAssistant] Getting wellness logs", { criteria });
    let logs = Array.from(this.wellnessLogs.values());
    
    // Apply filters
    if (criteria.type) {
      logs = logs.filter(log => log.logType === criteria.type);
    }
    if (criteria.startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= new Date(criteria.startDate));
    }
    if (criteria.endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= new Date(criteria.endDate));
    }
    
    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs;
  }
  
  /**
   * Analyze health goal progress and provide insights
   * @param {string} goalId - Goal ID
   * @private
   */
  async _analyzeHealthGoal(goalId) {
    this.logger.debug("[LifestyleManagementAssistant] Analyzing health goal", { goalId });
    const goal = this.healthGoals.get(goalId);
    if (!goal || !this.models.health_goal_analysis) return;
    
    // Fetch relevant logs
    const logs = await this.getWellnessLogs({ type: goal.goalType, startDate: goal.startDate, endDate: goal.endDate || new Date() });
    
    try {
      const analysisResult = await this.models.health_goal_analysis.analyzeProgress({
        goal: goal,
        logs: logs
      });
      
      if (analysisResult && analysisResult.insights) {
        this.logger.info("[LifestyleManagementAssistant] Health goal analysis complete", { goalId });
        // Emit insights or store them
        this.emit("healthInsight", { goalId, insights: analysisResult.insights });
        // Potentially update goal status or progress based on analysis
        // await this.updateHealthGoal(goalId, { progress: analysisResult.currentProgress, status: analysisResult.predictedStatus });
      }
    } catch (error) {
      this.logger.warn("[LifestyleManagementAssistant] Health goal analysis failed", { goalId, error: error.message });
    }
  }
  
  /**
   * Update goal progress based on a new log entry
   * @param {Object} logEntry - The new wellness log entry
   * @private
   */
  async _updateGoalProgressFromLog(logEntry) {
    const relevantGoals = await this.getHealthGoals({ status: "active", type: logEntry.logType });
    
    for (const goal of relevantGoals) {
      // Simple progress update logic (can be more sophisticated)
      // This assumes progress is cumulative or based on the latest value
      let newProgress = goal.progress;
      if (goal.frequency === "daily" || goal.frequency === "weekly") { // Example: update cumulative progress
         // Requires fetching logs for the current period and recalculating
         // For simplicity, we might just increment based on this log
         // newProgress = calculate_cumulative_progress(goal, logEntry);
      } else { // Example: update based on latest value
         newProgress = (logEntry.value / goal.targetValue) * 100;
      }
      
      // Check if goal completed
      let newStatus = goal.status;
      if (newProgress >= 100) {
         newStatus = "completed";
         this.logger.info("[LifestyleManagementAssistant] Health goal completed!", { goalId: goal.id });
         this.emit("goalCompleted", { goalId: goal.id, goalType: goal.goalType });
      }
      
      // Update the goal if progress or status changed
      if (newProgress !== goal.progress || newStatus !== goal.status) {
         await this.updateHealthGoal(goal.id, { progress: Math.min(100, newProgress), status: newStatus });
      }
    }
  }

  /**
   * Update a health goal
   * @param {string} goalId - Goal ID
   * @param {Object} updates - Goal updates
   * @returns {Promise<Object>} Updated goal
   */
  async updateHealthGoal(goalId, updates) {
     this.logger.debug("[LifestyleManagementAssistant] Updating health goal", { goalId });
     const goal = this.healthGoals.get(goalId);
     if (!goal) throw new Error(`Health goal not found: ${goalId}`);

     const updatedGoal = { ...goal };
     Object.keys(updates).forEach(key => {
        if (!["id", "type", "created"].includes(key)) {
           updatedGoal[key] = updates[key];
        }
     });
     updatedGoal.updated = new Date();

     this.healthGoals.set(goalId, updatedGoal);
     if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.updateEntity({ type: "healthGoal", id: goalId, data: updatedGoal });
     }
     this.logger.info("[LifestyleManagementAssistant] Health goal updated", { goalId });
     return updatedGoal;
  }
  
  // --- Travel Planning ---
  
  /**
   * Create a new travel plan
   * @param {Object} planData - Travel plan details
   * @param {string} planData.destination - Destination city/country
   * @param {Date} planData.startDate - Travel start date
   * @param {Date} planData.endDate - Travel end date
   * @param {string} [planData.purpose] - Purpose of travel (e.g., "vacation", "business")
   * @param {Array<string>} [planData.travelers] - List of traveler names or contact IDs
   * @returns {Promise<Object>} Created travel plan
   */
  async createTravelPlan(planData) {
    this.logger.debug("[LifestyleManagementAssistant] Creating travel plan", { destination: planData.destination });
    
    const planId = `tplan_${Date.now()}_${this._generateRandomId()}`;
    
    const travelPlan = {
      id: planId,
      type: "travelPlan",
      destination: planData.destination,
      startDate: new Date(planData.startDate),
      endDate: new Date(planData.endDate),
      purpose: planData.purpose || "leisure",
      travelers: planData.travelers || [],
      status: "planning", // planning, booked, ongoing, completed, cancelled
      itinerary: [], // Array of events (flights, hotels, activities)
      budget: planData.budget || null,
      notes: planData.notes || "",
      created: new Date(),
      updated: new Date()
    };
    
    // Apply privacy controls
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: "travelPlan",
        entityId: planId,
        privacyLevel: "sensitive"
      });
    }
    
    // Store plan
    this.travelPlans.set(planId, travelPlan);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "travelPlan", id: planId, data: travelPlan });
    }
    
    // Get AI assistance for planning asynchronously
    this._assistTravelPlanning(planId);
    
    this.logger.info("[LifestyleManagementAssistant] Travel plan created successfully", { planId });
    return travelPlan;
  }
  
  /**
   * Add an item to a travel plan itinerary
   * @param {string} planId - Travel plan ID
   * @param {Object} itemData - Itinerary item details (e.g., flight, hotel, activity)
   * @returns {Promise<Object>} Updated travel plan
   */
  async addItineraryItem(planId, itemData) {
    this.logger.debug("[LifestyleManagementAssistant] Adding itinerary item", { planId, itemType: itemData.type });
    const plan = this.travelPlans.get(planId);
    if (!plan) throw new Error(`Travel plan not found: ${planId}`);
    
    const itemId = `item_${Date.now()}_${this._generateRandomId()}`;
    const item = {
      id: itemId,
      ...itemData,
      added: new Date()
    };
    
    plan.itinerary.push(item);
    plan.updated = new Date();
    
    // Sort itinerary by date/time
    plan.itinerary.sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date));
    
    // Update plan
    this.travelPlans.set(planId, plan);
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "travelPlan", id: planId, data: plan });
    }
    
    this.logger.info("[LifestyleManagementAssistant] Itinerary item added", { planId, itemId });
    return plan;
  }
  
  /**
   * Get travel plans based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { status: "planning", destination: "Paris" })
   * @returns {Promise<Array<Object>>} Matching travel plans
   */
  async getTravelPlans(criteria = {}) {
     this.logger.debug("[LifestyleManagementAssistant] Getting travel plans", { criteria });
     let plans = Array.from(this.travelPlans.values());
     Object.keys(criteria).forEach(key => {
        plans = plans.filter(plan => plan[key] === criteria[key]);
     });
     return plans;
  }

  /**
   * Use AI to assist with travel planning (e.g., suggest activities, find flights)
   * @param {string} planId - Travel plan ID
   * @private
   */
  async _assistTravelPlanning(planId) {
    this.logger.debug("[LifestyleManagementAssistant] Assisting travel planning with AI", { planId });
    const plan = this.travelPlans.get(planId);
    if (!plan || !this.models.travel_planning_assist) return;
    
    try {
      const suggestions = await this.models.travel_planning_assist.generateSuggestions({
        destination: plan.destination,
        startDate: plan.startDate,
        endDate: plan.endDate,
        purpose: plan.purpose,
        travelers: plan.travelers,
        existingItinerary: plan.itinerary
      });
      
      if (suggestions && suggestions.recommendations) {
        this.logger.info("[LifestyleManagementAssistant] Received AI travel suggestions", { planId });
        // Emit suggestions or potentially auto-add them to the plan
        this.emit("travelSuggestion", { planId, suggestions: suggestions.recommendations });
        
        // Example: Auto-add suggested activities if confidence is high
        // for (const item of suggestions.recommendations) {
        //    if (item.type === "activity" && item.confidence > 0.8) {
        //       await this.addItineraryItem(planId, item);
        //    }
        // }
      }
    } catch (error) {
      this.logger.warn("[LifestyleManagementAssistant] AI travel planning assistance failed", { planId, error: error.message });
    }
  }
  
  // --- Hobby Management ---
  
  /**
   * Add or update a hobby
   * @param {Object} hobbyData - Hobby details
   * @param {string} hobbyData.name - Name of the hobby
   * @param {string} [hobbyData.description] - Description
   * @param {string} [hobbyData.interestLevel] - e.g., "high", "medium", "low"
   * @param {Date} [hobbyData.lastPracticed] - Date last practiced
   * @returns {Promise<Object>} Added/updated hobby
   */
  async addOrUpdateHobby(hobbyData) {
    this.logger.debug("[LifestyleManagementAssistant] Adding/updating hobby", { name: hobbyData.name });
    
    const hobbyId = `hobby_${hobbyData.name.toLowerCase().replace(/\s+/g, "_")}`;
    const existingHobby = this.hobbies.get(hobbyId);
    
    const hobby = {
      id: hobbyId,
      type: "hobby",
      name: hobbyData.name,
      description: hobbyData.description || (existingHobby ? existingHobby.description : ""),
      interestLevel: hobbyData.interestLevel || (existingHobby ? existingHobby.interestLevel : "medium"),
      lastPracticed: hobbyData.lastPracticed || (existingHobby ? existingHobby.lastPracticed : null),
      resources: hobbyData.resources || (existingHobby ? existingHobby.resources : []), // Links, books, etc.
      created: existingHobby ? existingHobby.created : new Date(),
      updated: new Date()
    };
    
    // Store hobby
    this.hobbies.set(hobbyId, hobby);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "hobby", id: hobbyId, data: hobby });
    }
    
    this.logger.info("[LifestyleManagementAssistant] Hobby added/updated successfully", { hobbyId });
    return hobby;
  }
  
  /**
   * Get hobbies based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { interestLevel: "high" })
   * @returns {Promise<Array<Object>>} Matching hobbies
   */
  async getHobbies(criteria = {}) {
     this.logger.debug("[LifestyleManagementAssistant] Getting hobbies", { criteria });
     let hobbies = Array.from(this.hobbies.values());
     Object.keys(criteria).forEach(key => {
        hobbies = hobbies.filter(hobby => hobby[key] === criteria[key]);
     });
     return hobbies;
  }

  /**
   * Get hobby suggestions based on user profile and interests
   * @returns {Promise<Array<Object>>} Suggested hobbies
   */
  async getHobbySuggestions() {
    this.logger.debug("[LifestyleManagementAssistant] Getting hobby suggestions");
    if (!this.models.hobby_suggestion) {
       this.logger.warn("[LifestyleManagementAssistant] Hobby suggestion model not available");
       return [];
    }

    try {
       // Gather user profile data (e.g., existing hobbies, interests from notes/calendar)
       const userContext = {
          existingHobbies: Array.from(this.hobbies.values()),
          // potentially add interests derived from other tentacles
       };

       const result = await this.models.hobby_suggestion.generateSuggestions({ context: userContext });
       if (result && result.suggestions) {
          this.logger.info("[LifestyleManagementAssistant] Generated hobby suggestions", { count: result.suggestions.length });
          return result.suggestions;
       }
       return [];
    } catch (error) {
       this.logger.error("[LifestyleManagementAssistant] Failed to get hobby suggestions", { error: error.message });
       return [];
    }
  }
  
  // --- General Recommendations ---
  
  /**
   * Get personalized lifestyle recommendations (e.g., activities, wellness tips)
   * @returns {Promise<Array<Object>>} Recommendations
   */
  async getLifestyleRecommendations() {
    this.logger.debug("[LifestyleManagementAssistant] Getting lifestyle recommendations");
    if (!this.models.lifestyle_recommendation) {
      this.logger.warn("[LifestyleManagementAssistant] Lifestyle recommendation model not available");
      return [];
    }
    
    try {
      // Gather context from various sources
      const context = {
        healthGoals: Array.from(this.healthGoals.values()),
        recentWellnessLogs: await this.getWellnessLogs({ startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }), // Last 7 days
        upcomingTravel: await this.getTravelPlans({ status: "planning" || "booked" }),
        hobbies: Array.from(this.hobbies.values()),
        // Add calendar events, user preferences, etc.
      };
      
      const result = await this.models.lifestyle_recommendation.generate({ context });
      
      if (result && result.recommendations) {
        this.logger.info("[LifestyleManagementAssistant] Generated lifestyle recommendations", { count: result.recommendations.length });
        return result.recommendations;
      }
      return [];
    } catch (error) {
      this.logger.error("[LifestyleManagementAssistant] Failed to get lifestyle recommendations", { error: error.message });
      return [];
    }
  }
  
  // --- Utility Methods ---
  
  /**
   * Get default unit for a given type
   * @param {string} type - Type of metric/activity
   * @returns {string} Default unit
   * @private
   */
  _getDefaultUnit(type) {
    switch (type) {
      case "steps": return "steps";
      case "distance": return this.options.defaultUnits.distance;
      case "weight": return this.options.defaultUnits.weight;
      case "sleep": return "hours";
      case "mindfulness": return "minutes";
      case "temperature": return this.options.defaultUnits.temperature;
      default: return "";
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

module.exports = LifestyleManagementAssistant;

