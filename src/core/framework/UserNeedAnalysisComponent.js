/**
 * @fileoverview UserNeedAnalysisComponent - Analyzes user behavior and needs to recommend tentacles.
 * This module provides a component that monitors user activity, identifies patterns and needs,
 * and recommends appropriate tentacles to enhance the user experience.
 * 
 * @module core/framework/UserNeedAnalysisComponent
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// Import the ModularTentacleFramework
const { 
  createModularTentacleFramework,
  TentacleCategory,
  CapabilityType
} = require('./ModularTentacleFramework');

// Import the TentaclePluginSystem
const {
  createTentacleRegistry
} = require('./TentaclePluginSystem');

/**
 * User activity types for tracking and analysis
 */
const UserActivityType = {
  COMMAND: 'command',
  SEARCH: 'search',
  NAVIGATION: 'navigation',
  FILE_OPERATION: 'file_operation',
  APPLICATION_USAGE: 'application_usage',
  CONTENT_CREATION: 'content_creation',
  COMMUNICATION: 'communication',
  SYSTEM_CONFIGURATION: 'system_configuration',
  ERROR_ENCOUNTER: 'error_encounter',
  HELP_REQUEST: 'help_request',
  TENTACLE_USAGE: 'tentacle_usage'
};

/**
 * User need categories that can be identified
 */
const UserNeedCategory = {
  PRODUCTIVITY: 'productivity',
  CREATIVITY: 'creativity',
  COMMUNICATION: 'communication',
  INFORMATION: 'information',
  AUTOMATION: 'automation',
  LEARNING: 'learning',
  ENTERTAINMENT: 'entertainment',
  ORGANIZATION: 'organization',
  TECHNICAL: 'technical',
  SPECIALIZED: 'specialized'
};

/**
 * Recommendation types for different kinds of suggestions
 */
const RecommendationType = {
  NEW_TENTACLE: 'new_tentacle',
  CAPABILITY_ENHANCEMENT: 'capability_enhancement',
  WORKFLOW_OPTIMIZATION: 'workflow_optimization',
  FEATURE_DISCOVERY: 'feature_discovery',
  TRAINING_SUGGESTION: 'training_suggestion'
};

/**
 * Confidence levels for recommendations
 */
const ConfidenceLevel = {
  VERY_LOW: 'very_low',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high'
};

// Error types
class UserActivityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserActivityValidationError";
  }
}

class UserProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserProfileError";
  }
}

class RecommendationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecommendationError";
  }
}

/**
 * Creates a UserNeedAnalysisComponent instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the component
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {Object} [config.tentacleFramework] - Existing tentacle framework instance
 * @param {Object} [config.tentacleRegistry] - Existing tentacle registry instance
 * @param {Object} [config.userProfileStore] - User profile storage
 * @param {Object} [config.activityStore] - Activity storage
 * @param {Object} [config.recommendationEngine] - Recommendation engine
 * @param {Object} [config.patternRecognizer] - Pattern recognizer
 * @returns {Object} UserNeedAnalysisComponent instance with all methods as own properties
 */
function createUserNeedAnalysisComponent(config = {}) {
  // Create default dependencies if not provided
  const logger = config.logger || {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    debug: (message, ...args) => {},
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
  };
  
  const eventEmitter = config.eventEmitter || new EventEmitter();
  
  const metrics = config.metrics || {
    recordMetric: (name, data) => {}
  };
  
  // Use existing framework or create a new one
  const tentacleFramework = config.tentacleFramework || createModularTentacleFramework({
    logger,
    eventEmitter,
    metrics
  });
  
  // Use existing registry or create a new one
  const tentacleRegistry = config.tentacleRegistry || createTentacleRegistry({
    logger,
    eventEmitter,
    metrics,
    tentacleFramework
  });
  
  // Create component instance with all properties and methods directly on the object
  const component = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "UserNeedAnalysisComponent",
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    tentacleFramework: tentacleFramework,
    tentacleRegistry: tentacleRegistry,
    
    // User profile and activity tracking
    userProfiles: new Map(),
    activityHistory: new Map(),
    activityPatterns: new Map(),
    identifiedNeeds: new Map(),
    recommendations: new Map(),
    
    // Configuration
    activityTrackingEnabled: config.activityTrackingEnabled !== false,
    recommendationEnabled: config.recommendationEnabled !== false,
    autoGrowthEnabled: config.autoGrowthEnabled !== false,
    privacySettings: config.privacySettings || {
      collectPersonalData: false,
      storeActivityHistory: true,
      activityRetentionDays: 30,
      shareAnalytics: false
    },
    
    // Analysis settings
    analysisFrequency: config.analysisFrequency || 'daily',
    confidenceThreshold: config.confidenceThreshold || 0.7,
    patternRecognitionThreshold: config.patternRecognitionThreshold || 3,
    recommendationLimit: config.recommendationLimit || 5,
    
    // Methods as direct properties to ensure preservation across module boundaries
    initialize: function() {
      this.logger.info(`Initializing UserNeedAnalysisComponent: ${this.name} (ID: ${this.id})`);
      
      // Initialize stores
      this.initializeStores();
      
      // Register event listeners
      this.registerEventListeners();
      
      // Load existing user profiles
      this.loadUserProfiles();
      
      // Schedule regular analysis
      this.scheduleAnalysis();
      
      this.eventEmitter.emit("user-need-analysis:initialized", {
        componentId: this.id,
        name: this.name
      });
      
      return this;
    },
    
    /**
     * Initializes data stores.
     */
    initializeStores: function() {
      // Use provided stores or create in-memory ones
      this.userProfileStore = config.userProfileStore || {
        getProfile: (userId) => this.userProfiles.get(userId),
        saveProfile: (userId, profile) => this.userProfiles.set(userId, profile),
        listProfiles: () => Array.from(this.userProfiles.entries()).map(([id, profile]) => ({ id, ...profile }))
      };
      
      this.activityStore = config.activityStore || {
        addActivity: (userId, activity) => {
          if (!this.activityHistory.has(userId)) {
            this.activityHistory.set(userId, []);
          }
          this.activityHistory.get(userId).push(activity);
        },
        getActivities: (userId, options = {}) => {
          const activities = this.activityHistory.get(userId) || [];
          
          if (options.type) {
            return activities.filter(a => a.type === options.type);
          }
          
          if (options.since) {
            return activities.filter(a => a.timestamp >= options.since);
          }
          
          return activities;
        },
        clearOldActivities: (userId, olderThan) => {
          if (this.activityHistory.has(userId)) {
            const activities = this.activityHistory.get(userId);
            const newActivities = activities.filter(a => a.timestamp >= olderThan);
            this.activityHistory.set(userId, newActivities);
          }
        }
      };
      
      this.recommendationEngine = config.recommendationEngine || {
        generateRecommendations: (userId, needs, context) => {
          return this.generateRecommendationsInternal(userId, needs, context);
        }
      };
      
      this.patternRecognizer = config.patternRecognizer || {
        recognizePatterns: (activities) => {
          return this.recognizePatternsInternal(activities);
        }
      };
    },
    
    /**
     * Registers event listeners.
     */
    registerEventListeners: function() {
      // Listen for user activity events
      this.eventEmitter.on("user:activity", this.handleUserActivity.bind(this));
      
      // Listen for tentacle usage events
      this.eventEmitter.on("tentacle:used", this.handleTentacleUsed.bind(this));
      
      // Listen for error events
      this.eventEmitter.on("system:error", this.handleSystemError.bind(this));
      
      // Listen for user feedback
      this.eventEmitter.on("user:feedback", this.handleUserFeedback.bind(this));
    },
    
    /**
     * Loads existing user profiles.
     */
    loadUserProfiles: function() {
      try {
        const profiles = this.userProfileStore.listProfiles();
        
        this.logger.info(`Loaded ${profiles.length} user profiles`);
        
        // Process each profile
        for (const profile of profiles) {
          this.userProfiles.set(profile.id, profile);
        }
      } catch (error) {
        this.logger.error(`Error loading user profiles: ${error.message}`, error);
      }
    },
    
    /**
     * Schedules regular analysis of user needs.
     */
    scheduleAnalysis: function() {
      // This is a placeholder for scheduling
      // In a real implementation, this would set up a timer or cron job
      this.logger.info(`Scheduled user need analysis with frequency: ${this.analysisFrequency}`);
      
      // For demonstration, run initial analysis
      setTimeout(() => {
        this.analyzeAllUserNeeds();
      }, 5000);
    },
    
    /**
     * Handles user activity events.
     * 
     * @param {Object} event - Activity event data
     */
    handleUserActivity: function(event) {
      if (!this.activityTrackingEnabled) {
        return;
      }
      
      try {
        const { userId, type, data, timestamp = Date.now() } = event;
        
        // Validate activity
        this.validateUserActivity(event);
        
        // Create activity record
        const activity = {
          id: uuidv4(),
          userId,
          type,
          data,
          timestamp
        };
        
        // Store activity
        this.activityStore.addActivity(userId, activity);
        
        // Record metric
        this.metrics.recordMetric("user_activity", {
          userId,
          type,
          timestamp
        });
        
        // Check if we should analyze patterns
        this.checkForPatternAnalysis(userId);
      } catch (error) {
        this.logger.error(`Error handling user activity: ${error.message}`, error);
      }
    },
    
    /**
     * Validates a user activity event.
     * 
     * @param {Object} event - Activity event data
     * @throws {UserActivityValidationError} If the activity is invalid
     */
    validateUserActivity: function(event) {
      if (!event.userId) {
        throw new UserActivityValidationError("Missing userId in activity event");
      }
      
      if (!event.type) {
        throw new UserActivityValidationError("Missing type in activity event");
      }
      
      if (!Object.values(UserActivityType).includes(event.type)) {
        this.logger.warn(`Unknown activity type: ${event.type}`);
      }
      
      if (!event.data) {
        throw new UserActivityValidationError("Missing data in activity event");
      }
    },
    
    /**
     * Handles tentacle usage events.
     * 
     * @param {Object} event - Tentacle usage event data
     */
    handleTentacleUsed: function(event) {
      if (!this.activityTrackingEnabled) {
        return;
      }
      
      try {
        const { userId, tentacleId, tentacleType, operation, timestamp = Date.now() } = event;
        
        // Create activity record
        const activity = {
          id: uuidv4(),
          userId,
          type: UserActivityType.TENTACLE_USAGE,
          data: {
            tentacleId,
            tentacleType,
            operation
          },
          timestamp
        };
        
        // Store activity
        this.activityStore.addActivity(userId, activity);
        
        // Update user profile with tentacle usage
        this.updateUserTentacleUsage(userId, tentacleId, tentacleType);
      } catch (error) {
        this.logger.error(`Error handling tentacle usage: ${error.message}`, error);
      }
    },
    
    /**
     * Handles system error events.
     * 
     * @param {Object} event - Error event data
     */
    handleSystemError: function(event) {
      if (!this.activityTrackingEnabled) {
        return;
      }
      
      try {
        const { userId, errorType, errorMessage, context, timestamp = Date.now() } = event;
        
        // Create activity record
        const activity = {
          id: uuidv4(),
          userId,
          type: UserActivityType.ERROR_ENCOUNTER,
          data: {
            errorType,
            errorMessage,
            context
          },
          timestamp
        };
        
        // Store activity
        this.activityStore.addActivity(userId, activity);
        
        // Check if this error suggests a need for a specific tentacle
        this.checkErrorForTentacleNeed(userId, errorType, context);
      } catch (error) {
        this.logger.error(`Error handling system error event: ${error.message}`, error);
      }
    },
    
    /**
     * Handles user feedback events.
     * 
     * @param {Object} event - Feedback event data
     */
    handleUserFeedback: function(event) {
      try {
        const { userId, feedbackType, rating, comments, context, timestamp = Date.now() } = event;
        
        // Update user profile with feedback
        this.updateUserFeedback(userId, feedbackType, rating, comments, context);
        
        // If this is feedback about a recommendation, update recommendation effectiveness
        if (context && context.recommendationId) {
          this.updateRecommendationEffectiveness(userId, context.recommendationId, rating);
        }
      } catch (error) {
        this.logger.error(`Error handling user feedback: ${error.message}`, error);
      }
    },
    
    /**
     * Updates a user profile with tentacle usage information.
     * 
     * @param {string} userId - User ID
     * @param {string} tentacleId - Tentacle ID
     * @param {string} tentacleType - Tentacle type
     */
    updateUserTentacleUsage: function(userId, tentacleId, tentacleType) {
      // Get or create user profile
      const profile = this.getUserProfile(userId);
      
      // Initialize tentacle usage if needed
      if (!profile.tentacleUsage) {
        profile.tentacleUsage = {};
      }
      
      if (!profile.tentacleUsage[tentacleType]) {
        profile.tentacleUsage[tentacleType] = {
          count: 0,
          lastUsed: null,
          instances: {}
        };
      }
      
      // Update usage stats
      profile.tentacleUsage[tentacleType].count++;
      profile.tentacleUsage[tentacleType].lastUsed = Date.now();
      
      // Update instance stats
      if (!profile.tentacleUsage[tentacleType].instances[tentacleId]) {
        profile.tentacleUsage[tentacleType].instances[tentacleId] = {
          count: 0,
          lastUsed: null
        };
      }
      
      profile.tentacleUsage[tentacleType].instances[tentacleId].count++;
      profile.tentacleUsage[tentacleType].instances[tentacleId].lastUsed = Date.now();
      
      // Save updated profile
      this.userProfileStore.saveProfile(userId, profile);
    },
    
    /**
     * Updates a user profile with feedback information.
     * 
     * @param {string} userId - User ID
     * @param {string} feedbackType - Feedback type
     * @param {number} rating - Rating (1-5)
     * @param {string} comments - User comments
     * @param {Object} context - Feedback context
     */
    updateUserFeedback: function(userId, feedbackType, rating, comments, context) {
      // Get or create user profile
      const profile = this.getUserProfile(userId);
      
      // Initialize feedback if needed
      if (!profile.feedback) {
        profile.feedback = [];
      }
      
      // Add feedback
      profile.feedback.push({
        type: feedbackType,
        rating,
        comments,
        context,
        timestamp: Date.now()
      });
      
      // Save updated profile
      this.userProfileStore.saveProfile(userId, profile);
    },
    
    /**
     * Updates the effectiveness of a recommendation based on user feedback.
     * 
     * @param {string} userId - User ID
     * @param {string} recommendationId - Recommendation ID
     * @param {number} rating - Rating (1-5)
     */
    updateRecommendationEffectiveness: function(userId, recommendationId, rating) {
      // Get recommendations for user
      if (!this.recommendations.has(userId)) {
        return;
      }
      
      const userRecommendations = this.recommendations.get(userId);
      const recommendation = userRecommendations.find(r => r.id === recommendationId);
      
      if (!recommendation) {
        return;
      }
      
      // Update effectiveness
      recommendation.feedback = {
        rating,
        timestamp: Date.now()
      };
      
      // Update confidence based on feedback
      if (rating >= 4) {
        // Positive feedback increases confidence
        recommendation.confidence = Math.min(1.0, recommendation.confidence + 0.1);
      } else if (rating <= 2) {
        // Negative feedback decreases confidence
        recommendation.confidence = Math.max(0.0, recommendation.confidence - 0.2);
      }
      
      // Save updated recommendations
      this.recommendations.set(userId, userRecommendations);
    },
    
    /**
     * Gets or creates a user profile.
     * 
     * @param {string} userId - User ID
     * @returns {Object} User profile
     */
    getUserProfile: function(userId) {
      let profile = this.userProfileStore.getProfile(userId);
      
      if (!profile) {
        // Create new profile
        profile = {
          id: userId,
          created: Date.now(),
          lastUpdated: Date.now(),
          preferences: {},
          tentacleUsage: {},
          identifiedNeeds: [],
          feedback: []
        };
        
        this.userProfileStore.saveProfile(userId, profile);
      }
      
      return profile;
    },
    
    /**
     * Checks if pattern analysis should be performed for a user.
     * 
     * @param {string} userId - User ID
     */
    checkForPatternAnalysis: function(userId) {
      // Get recent activities
      const recentActivities = this.activityStore.getActivities(userId, {
        since: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      });
      
      // Check if we have enough activities for analysis
      if (recentActivities.length >= this.patternRecognitionThreshold) {
        this.analyzeUserPatterns(userId);
      }
    },
    
    /**
     * Analyzes patterns in user activities.
     * 
     * @param {string} userId - User ID
     */
    analyzeUserPatterns: function(userId) {
      try {
        // Get activities
        const activities = this.activityStore.getActivities(userId);
        
        if (activities.length === 0) {
          return;
        }
        
        // Recognize patterns
        const patterns = this.patternRecognizer.recognizePatterns(activities);
        
        // Store patterns
        this.activityPatterns.set(userId, patterns);
        
        // Identify needs based on patterns
        const needs = this.identifyUserNeeds(userId, patterns);
        
        // Store identified needs
        this.identifiedNeeds.set(userId, needs);
        
        // Generate recommendations based on needs
        if (this.recommendationEnabled) {
          this.generateRecommendations(userId, needs);
        }
        
        // Emit event
        this.eventEmitter.emit("user-need-analysis:patterns-analyzed", {
          userId,
          patternCount: patterns.length,
          needCount: needs.length
        });
      } catch (error) {
        this.logger.error(`Error analyzing user patterns for ${userId}: ${error.message}`, error);
      }
    },
    
    /**
     * Recognizes patterns in user activities (internal implementation).
     * 
     * @param {Array<Object>} activities - User activities
     * @returns {Array<Object>} Recognized patterns
     */
    recognizePatternsInternal: function(activities) {
      // This is a simplified implementation
      // In a real system, this would use more sophisticated pattern recognition algorithms
      
      const patterns = [];
      
      // Group activities by type
      const byType = {};
      for (const activity of activities) {
        if (!byType[activity.type]) {
          byType[activity.type] = [];
        }
        byType[activity.type].push(activity);
      }
      
      // Look for frequency patterns
      for (const [type, typeActivities] of Object.entries(byType)) {
        if (typeActivities.length >= this.patternRecognitionThreshold) {
          patterns.push({
            type: 'frequency',
            activityType: type,
            count: typeActivities.length,
            confidence: Math.min(1.0, typeActivities.length / 10)
          });
        }
      }
      
      // Look for sequence patterns (simplified)
      if (activities.length >= 5) {
        const sequences = {};
        
        for (let i = 0; i < activities.length - 1; i++) {
          const pair = `${activities[i].type}:${activities[i+1].type}`;
          sequences[pair] = (sequences[pair] || 0) + 1;
        }
        
        for (const [pair, count] of Object.entries(sequences)) {
          if (count >= 3) {
            const [first, second] = pair.split(':');
            patterns.push({
              type: 'sequence',
              firstActivityType: first,
              secondActivityType: second,
              count,
              confidence: Math.min(1.0, count / 5)
            });
          }
        }
      }
      
      // Look for time patterns
      const timeDistribution = Array(24).fill(0);
      for (const activity of activities) {
        const hour = new Date(activity.timestamp).getHours();
        timeDistribution[hour]++;
      }
      
      const maxHourCount = Math.max(...timeDistribution);
      if (maxHourCount >= 5) {
        const peakHours = [];
        for (let hour = 0; hour < 24; hour++) {
          if (timeDistribution[hour] >= maxHourCount * 0.7) {
            peakHours.push(hour);
          }
        }
        
        patterns.push({
          type: 'time',
          peakHours,
          distribution: timeDistribution,
          confidence: Math.min(1.0, maxHourCount / 10)
        });
      }
      
      return patterns;
    },
    
    /**
     * Identifies user needs based on recognized patterns.
     * 
     * @param {string} userId - User ID
     * @param {Array<Object>} patterns - Recognized patterns
     * @returns {Array<Object>} Identified needs
     */
    identifyUserNeeds: function(userId, patterns) {
      const needs = [];
      const profile = this.getUserProfile(userId);
      
      // Analyze frequency patterns
      const frequencyPatterns = patterns.filter(p => p.type === 'frequency');
      for (const pattern of frequencyPatterns) {
        if (pattern.confidence >= this.confidenceThreshold) {
          // Map activity types to need categories
          const needCategory = this.mapActivityTypeToNeedCategory(pattern.activityType);
          
          if (needCategory) {
            needs.push({
              id: uuidv4(),
              userId,
              category: needCategory,
              source: 'frequency_pattern',
              confidence: pattern.confidence,
              data: {
                activityType: pattern.activityType,
                count: pattern.count
              },
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Analyze sequence patterns
      const sequencePatterns = patterns.filter(p => p.type === 'sequence');
      for (const pattern of sequencePatterns) {
        if (pattern.confidence >= this.confidenceThreshold) {
          // Check for workflow optimization needs
          needs.push({
            id: uuidv4(),
            userId,
            category: UserNeedCategory.AUTOMATION,
            source: 'sequence_pattern',
            confidence: pattern.confidence,
            data: {
              firstActivityType: pattern.firstActivityType,
              secondActivityType: pattern.secondActivityType,
              count: pattern.count
            },
            timestamp: Date.now()
          });
        }
      }
      
      // Analyze time patterns
      const timePatterns = patterns.filter(p => p.type === 'time');
      for (const pattern of timePatterns) {
        if (pattern.confidence >= this.confidenceThreshold) {
          // Check for scheduling or productivity needs
          needs.push({
            id: uuidv4(),
            userId,
            category: UserNeedCategory.PRODUCTIVITY,
            source: 'time_pattern',
            confidence: pattern.confidence,
            data: {
              peakHours: pattern.peakHours,
              distribution: pattern.distribution
            },
            timestamp: Date.now()
          });
        }
      }
      
      // Analyze tentacle usage
      if (profile.tentacleUsage) {
        for (const [tentacleType, usage] of Object.entries(profile.tentacleUsage)) {
          if (usage.count >= 10) {
            // High usage suggests a need for enhanced capabilities
            needs.push({
              id: uuidv4(),
              userId,
              category: this.mapTentacleTypeToNeedCategory(tentacleType),
              source: 'tentacle_usage',
              confidence: Math.min(1.0, usage.count / 20),
              data: {
                tentacleType,
                usageCount: usage.count
              },
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Update user profile with identified needs
      profile.identifiedNeeds = needs.map(need => ({
        id: need.id,
        category: need.category,
        confidence: need.confidence,
        timestamp: need.timestamp
      }));
      
      this.userProfileStore.saveProfile(userId, profile);
      
      return needs;
    },
    
    /**
     * Maps an activity type to a need category.
     * 
     * @param {string} activityType - Activity type
     * @returns {string} Need category
     */
    mapActivityTypeToNeedCategory: function(activityType) {
      // This is a simplified mapping
      const mapping = {
        [UserActivityType.COMMAND]: UserNeedCategory.TECHNICAL,
        [UserActivityType.SEARCH]: UserNeedCategory.INFORMATION,
        [UserActivityType.NAVIGATION]: UserNeedCategory.ORGANIZATION,
        [UserActivityType.FILE_OPERATION]: UserNeedCategory.ORGANIZATION,
        [UserActivityType.APPLICATION_USAGE]: UserNeedCategory.PRODUCTIVITY,
        [UserActivityType.CONTENT_CREATION]: UserNeedCategory.CREATIVITY,
        [UserActivityType.COMMUNICATION]: UserNeedCategory.COMMUNICATION,
        [UserActivityType.SYSTEM_CONFIGURATION]: UserNeedCategory.TECHNICAL,
        [UserActivityType.ERROR_ENCOUNTER]: UserNeedCategory.TECHNICAL,
        [UserActivityType.HELP_REQUEST]: UserNeedCategory.LEARNING,
        [UserActivityType.TENTACLE_USAGE]: UserNeedCategory.SPECIALIZED
      };
      
      return mapping[activityType] || UserNeedCategory.PRODUCTIVITY;
    },
    
    /**
     * Maps a tentacle type to a need category.
     * 
     * @param {string} tentacleType - Tentacle type
     * @returns {string} Need category
     */
    mapTentacleTypeToNeedCategory: function(tentacleType) {
      // This would be a more comprehensive mapping in a real implementation
      if (tentacleType.includes('creativity')) {
        return UserNeedCategory.CREATIVITY;
      } else if (tentacleType.includes('communication')) {
        return UserNeedCategory.COMMUNICATION;
      } else if (tentacleType.includes('information')) {
        return UserNeedCategory.INFORMATION;
      } else if (tentacleType.includes('automation')) {
        return UserNeedCategory.AUTOMATION;
      } else if (tentacleType.includes('learning')) {
        return UserNeedCategory.LEARNING;
      } else if (tentacleType.includes('entertainment')) {
        return UserNeedCategory.ENTERTAINMENT;
      } else if (tentacleType.includes('organization')) {
        return UserNeedCategory.ORGANIZATION;
      } else if (tentacleType.includes('technical')) {
        return UserNeedCategory.TECHNICAL;
      }
      
      return UserNeedCategory.SPECIALIZED;
    },
    
    /**
     * Checks if an error suggests a need for a specific tentacle.
     * 
     * @param {string} userId - User ID
     * @param {string} errorType - Error type
     * @param {Object} context - Error context
     */
    checkErrorForTentacleNeed: function(userId, errorType, context) {
      // This is a simplified implementation
      // In a real system, this would use more sophisticated analysis
      
      // Get error frequency
      const errorActivities = this.activityStore.getActivities(userId, {
        type: UserActivityType.ERROR_ENCOUNTER
      });
      
      const similarErrors = errorActivities.filter(a => 
        a.data.errorType === errorType || 
        (a.data.errorMessage && context.errorMessage && 
         a.data.errorMessage.includes(context.errorMessage.substring(0, 10)))
      );
      
      if (similarErrors.length >= 3) {
        // Recurring errors suggest a need for error handling tentacles
        const need = {
          id: uuidv4(),
          userId,
          category: UserNeedCategory.TECHNICAL,
          source: 'recurring_error',
          confidence: Math.min(1.0, similarErrors.length / 5),
          data: {
            errorType,
            errorCount: similarErrors.length,
            context
          },
          timestamp: Date.now()
        };
        
        // Add to identified needs
        if (!this.identifiedNeeds.has(userId)) {
          this.identifiedNeeds.set(userId, []);
        }
        
        this.identifiedNeeds.get(userId).push(need);
        
        // Update user profile
        const profile = this.getUserProfile(userId);
        profile.identifiedNeeds.push({
          id: need.id,
          category: need.category,
          confidence: need.confidence,
          timestamp: need.timestamp
        });
        
        this.userProfileStore.saveProfile(userId, profile);
        
        // Generate recommendations if enabled
        if (this.recommendationEnabled) {
          this.generateRecommendations(userId, [need]);
        }
      }
    },
    
    /**
     * Generates recommendations for a user based on identified needs.
     * 
     * @param {string} userId - User ID
     * @param {Array<Object>} needs - Identified needs
     */
    generateRecommendations: function(userId, needs) {
      try {
        if (needs.length === 0) {
          return;
        }
        
        // Get user profile
        const profile = this.getUserProfile(userId);
        
        // Generate context for recommendation engine
        const context = {
          profile,
          activities: this.activityStore.getActivities(userId),
          patterns: this.activityPatterns.get(userId) || [],
          existingRecommendations: this.recommendations.get(userId) || []
        };
        
        // Generate recommendations
        const recommendations = this.recommendationEngine.generateRecommendations(userId, needs, context);
        
        // Store recommendations
        this.recommendations.set(userId, recommendations);
        
        // Emit event
        this.eventEmitter.emit("user-need-analysis:recommendations-generated", {
          userId,
          recommendationCount: recommendations.length
        });
        
        // Auto-grow tentacles if enabled
        if (this.autoGrowthEnabled) {
          this.processAutoGrowth(userId, recommendations);
        }
      } catch (error) {
        this.logger.error(`Error generating recommendations for ${userId}: ${error.message}`, error);
      }
    },
    
    /**
     * Generates recommendations internally.
     * 
     * @param {string} userId - User ID
     * @param {Array<Object>} needs - Identified needs
     * @param {Object} context - Recommendation context
     * @returns {Array<Object>} Generated recommendations
     */
    generateRecommendationsInternal: function(userId, needs, context) {
      // This is a simplified implementation
      // In a real system, this would use more sophisticated recommendation algorithms
      
      const recommendations = [];
      const existingRecommendations = context.existingRecommendations || [];
      
      // Group needs by category
      const needsByCategory = {};
      for (const need of needs) {
        if (!needsByCategory[need.category]) {
          needsByCategory[need.category] = [];
        }
        needsByCategory[need.category].push(need);
      }
      
      // Process each category
      for (const [category, categoryNeeds] of Object.entries(needsByCategory)) {
        // Calculate aggregate confidence
        const totalConfidence = categoryNeeds.reduce((sum, need) => sum + need.confidence, 0);
        const averageConfidence = totalConfidence / categoryNeeds.length;
        
        // Skip if confidence is too low
        if (averageConfidence < this.confidenceThreshold) {
          continue;
        }
        
        // Find tentacles that match this need category
        const matchingTentacles = this.findTentaclesForNeedCategory(category);
        
        // Create recommendations for each matching tentacle
        for (const tentacle of matchingTentacles) {
          // Check if we already have a recommendation for this tentacle
          const existingRecommendation = existingRecommendations.find(r => 
            r.type === RecommendationType.NEW_TENTACLE && 
            r.data.tentacleType === tentacle.type
          );
          
          if (existingRecommendation) {
            // Update existing recommendation
            existingRecommendation.confidence = Math.max(existingRecommendation.confidence, averageConfidence);
            existingRecommendation.lastUpdated = Date.now();
            recommendations.push(existingRecommendation);
          } else {
            // Create new recommendation
            recommendations.push({
              id: uuidv4(),
              userId,
              type: RecommendationType.NEW_TENTACLE,
              needCategory: category,
              confidence: averageConfidence,
              data: {
                tentacleType: tentacle.type,
                tentacleCategory: tentacle.category,
                capabilities: tentacle.capabilities
              },
              created: Date.now(),
              lastUpdated: Date.now(),
              status: 'PENDING'
            });
          }
        }
        
        // Check if we need to recommend capability enhancements
        if (category === UserNeedCategory.PRODUCTIVITY || category === UserNeedCategory.AUTOMATION) {
          // Find workflow optimization opportunities
          const workflowRecommendation = {
            id: uuidv4(),
            userId,
            type: RecommendationType.WORKFLOW_OPTIMIZATION,
            needCategory: category,
            confidence: averageConfidence * 0.9, // Slightly lower confidence
            data: {
              optimizationType: 'sequence',
              activities: categoryNeeds.map(need => need.data)
            },
            created: Date.now(),
            lastUpdated: Date.now(),
            status: 'PENDING'
          };
          
          recommendations.push(workflowRecommendation);
        }
      }
      
      // Limit number of recommendations
      return recommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.recommendationLimit);
    },
    
    /**
     * Finds tentacles that match a need category.
     * 
     * @param {string} needCategory - Need category
     * @returns {Array<Object>} Matching tentacles
     */
    findTentaclesForNeedCategory: function(needCategory) {
      // This is a simplified implementation
      // In a real system, this would query the tentacle registry
      
      // Get all available tentacle types
      const tentacleTypes = this.tentacleRegistry.listTentacles();
      
      // Filter by capability that matches the need category
      return tentacleTypes.filter(tentacle => {
        // Map need category to capability
        const requiredCapability = this.mapNeedCategoryToCapability(needCategory);
        
        // Check if tentacle has the required capability
        return tentacle.capabilities && 
               tentacle.capabilities.some(cap => cap === requiredCapability);
      });
    },
    
    /**
     * Maps a need category to a capability.
     * 
     * @param {string} needCategory - Need category
     * @returns {string} Capability
     */
    mapNeedCategoryToCapability: function(needCategory) {
      // This is a simplified mapping
      const mapping = {
        [UserNeedCategory.PRODUCTIVITY]: 'productivity_enhancement',
        [UserNeedCategory.CREATIVITY]: 'creative_assistance',
        [UserNeedCategory.COMMUNICATION]: 'communication_facilitation',
        [UserNeedCategory.INFORMATION]: 'information_retrieval',
        [UserNeedCategory.AUTOMATION]: 'task_automation',
        [UserNeedCategory.LEARNING]: 'learning_assistance',
        [UserNeedCategory.ENTERTAINMENT]: 'entertainment_provision',
        [UserNeedCategory.ORGANIZATION]: 'organization_assistance',
        [UserNeedCategory.TECHNICAL]: 'technical_support',
        [UserNeedCategory.SPECIALIZED]: 'specialized_assistance'
      };
      
      return mapping[needCategory] || 'general_assistance';
    },
    
    /**
     * Processes auto-growth of tentacles based on recommendations.
     * 
     * @param {string} userId - User ID
     * @param {Array<Object>} recommendations - Generated recommendations
     */
    processAutoGrowth: function(userId, recommendations) {
      // Filter for high-confidence new tentacle recommendations
      const tentacleRecommendations = recommendations.filter(r => 
        r.type === RecommendationType.NEW_TENTACLE && 
        r.confidence >= this.confidenceThreshold && 
        r.status === 'PENDING'
      );
      
      for (const recommendation of tentacleRecommendations) {
        try {
          // Check if tentacle already exists
          const existingTentacles = this.tentacleRegistry.getTentaclesByType(recommendation.data.tentacleType);
          
          if (existingTentacles.length > 0) {
            // Tentacle already exists, mark as APPLIED
            recommendation.status = 'APPLIED';
            recommendation.lastUpdated = Date.now();
            continue;
          }
          
          // Try to create tentacle
          this.logger.info(`Auto-growing tentacle of type ${recommendation.data.tentacleType} for user ${userId}`);
          
          // Check if tentacle is available in registry
          const tentacleConfigurations = this.tentacleRegistry.listTentacleConfigurations();
          const matchingConfig = tentacleConfigurations.find(c => c.type === recommendation.data.tentacleType);
          
          if (matchingConfig) {
            // Create tentacle from configuration
            const tentacle = this.tentacleRegistry.createTentacleFromConfiguration(matchingConfig.id);
            
            // Mark recommendation as APPLIED
            recommendation.status = 'APPLIED';
            recommendation.lastUpdated = Date.now();
            recommendation.data.tentacleId = tentacle.id;
            
            // Emit event
            this.eventEmitter.emit("user-need-analysis:tentacle-grown", {
              userId,
              recommendationId: recommendation.id,
              tentacleId: tentacle.id,
              tentacleType: recommendation.data.tentacleType
            });
          } else {
            // Check if tentacle is available as a plugin
            const plugins = this.tentacleRegistry.pluginSystem.listPlugins();
            const matchingPlugin = plugins.find(p => 
              p.state === 'ACTIVE' && 
              p.tentacles && 
              p.tentacles.some(t => t.type === recommendation.data.tentacleType)
            );
            
            if (matchingPlugin) {
              // Create tentacle from plugin
              const tentacle = this.tentacleRegistry.createTentacleFromPlugin(
                matchingPlugin.name,
                recommendation.data.tentacleType
              );
              
              // Mark recommendation as APPLIED
              recommendation.status = 'APPLIED';
              recommendation.lastUpdated = Date.now();
              recommendation.data.tentacleId = tentacle.id;
              
              // Emit event
              this.eventEmitter.emit("user-need-analysis:tentacle-grown", {
                userId,
                recommendationId: recommendation.id,
                tentacleId: tentacle.id,
                tentacleType: recommendation.data.tentacleType
              });
            } else {
              // Tentacle not available, mark as PENDING
              this.logger.warn(`Cannot auto-grow tentacle of type ${recommendation.data.tentacleType}: not available`);
              recommendation.status = 'PENDING';
              recommendation.lastUpdated = Date.now();
            }
          }
        } catch (error) {
          this.logger.error(`Error auto-growing tentacle for recommendation ${recommendation.id}: ${error.message}`, error);
          
          // Mark recommendation as ERROR
          recommendation.status = 'ERROR';
          recommendation.lastUpdated = Date.now();
          recommendation.error = error.message;
        }
      }
      
      // Update recommendations
      this.recommendations.set(userId, recommendations);
    },
    
    /**
     * Analyzes needs for all users.
     */
    analyzeAllUserNeeds: function() {
      this.logger.info("Analyzing needs for all users");
      
      const profiles = this.userProfileStore.listProfiles();
      
      for (const profile of profiles) {
        this.analyzeUserPatterns(profile.id);
      }
    },
    
    /**
     * Gets recommendations for a user.
     * 
     * @param {string} userId - User ID
     * @returns {Array<Object>} User recommendations
     */
    getUserRecommendations: function(userId) {
      return this.recommendations.get(userId) || [];
    },
    
    /**
     * Gets identified needs for a user.
     * 
     * @param {string} userId - User ID
     * @returns {Array<Object>} Identified needs
     */
    getUserNeeds: function(userId) {
      return this.identifiedNeeds.get(userId) || [];
    },
    
    /**
     * Gets activity patterns for a user.
     * 
     * @param {string} userId - User ID
     * @returns {Array<Object>} Activity patterns
     */
    getUserPatterns: function(userId) {
      return this.activityPatterns.get(userId) || [];
    },
    
    /**
     * Clears old activity data based on retention policy.
     */
    clearOldActivityData: function() {
      const retentionDays = this.privacySettings.activityRetentionDays || 30;
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      
      this.logger.info(`Clearing activity data older than ${retentionDays} days`);
      
      // Clear for each user
      for (const userId of this.activityHistory.keys()) {
        this.activityStore.clearOldActivities(userId, cutoffTime);
      }
    },
    
    /**
     * Gets statistics about the component.
     * 
     * @returns {Object} Component statistics
     */
    getStatistics: function() {
      const userCount = this.userProfiles.size;
      let totalActivities = 0;
      let totalPatterns = 0;
      let totalNeeds = 0;
      let totalRecommendations = 0;
      
      for (const activities of this.activityHistory.values()) {
        totalActivities += activities.length;
      }
      
      for (const patterns of this.activityPatterns.values()) {
        totalPatterns += patterns.length;
      }
      
      for (const needs of this.identifiedNeeds.values()) {
        totalNeeds += needs.length;
      }
      
      for (const recommendations of this.recommendations.values()) {
        totalRecommendations += recommendations.length;
      }
      
      return {
        userCount,
        totalActivities,
        totalPatterns,
        totalNeeds,
        totalRecommendations,
        activityTrackingEnabled: this.activityTrackingEnabled,
        recommendationEnabled: this.recommendationEnabled,
        autoGrowthEnabled: this.autoGrowthEnabled,
        timestamp: Date.now()
      };
    },
    
    // Event interface methods
    on: function(event, listener) {
      this.eventEmitter.on(event, listener);
      return this;
    },
    
    once: function(event, listener) {
      this.eventEmitter.once(event, listener);
      return this;
    },
    
    off: function(event, listener) {
      this.eventEmitter.off(event, listener);
      return this;
    },
    
    emit: function(event, ...args) {
      return this.eventEmitter.emit(event, ...args);
    }
  };
  
  // Initialize component
  component.initialize();
  
  // Log creation
  logger.info(`Created UserNeedAnalysisComponent: ${component.name} (ID: ${component.id})`);
  
  // Add debugging helper to verify method presence
  component.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`UserNeedAnalysisComponent has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return component;
}

module.exports = {
  createUserNeedAnalysisComponent,
  // Export constants
  UserActivityType,
  UserNeedCategory,
  RecommendationType,
  ConfidenceLevel,
  // Export error types
  UserActivityValidationError,
  UserProfileError,
  RecommendationError
};
