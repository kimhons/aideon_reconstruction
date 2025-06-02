/**
 * @fileoverview Learning Profile Manager for the Aideon Academy Tentacle
 * Manages detailed learner profiles, including preferences, progress, and adaptive parameters
 * 
 * @module src/tentacles/aideon_academy/learning_profile/LearningProfileManager
 */

const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const { LearningStyle, LearningPace, BloomsLevel } = require("../types/AcademyTypes");

/**
 * Learning Profile Manager
 * Manages detailed learner profiles for personalized learning experiences
 * @extends EventEmitter
 */
class LearningProfileManager extends EventEmitter {
  /**
   * Create a new Learning Profile Manager
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies (logger, storage, config)
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.storage = dependencies.storage;
    this.config = dependencies.config;
    
    if (!this.storage) {
      throw new Error("Storage dependency is required for LearningProfileManager");
    }
    
    this.logger.info("[LearningProfileManager] Learning Profile Manager initialized");
  }
  
  /**
   * Create a new learner profile
   * @param {string} userId - User ID
   * @param {Object} initialData - Initial profile data (preferences, goals, etc.)
   * @returns {Promise<Object>} The newly created learner profile
   */
  async createProfile(userId, initialData = {}) {
    this.logger.info(`[LearningProfileManager] Creating new profile for user: ${userId}`);
    
    const profileId = uuidv4();
    const now = new Date();
    
    const defaultProfile = {
      profileId,
      userId,
      createdAt: now,
      lastUpdatedAt: now,
      tier: initialData.tier || "core", // Default to core tier
      demographics: {
        ageGroup: initialData.ageGroup || "adult", // e.g., child, teen, adult, senior
        language: initialData.language || "en",
        // Add other relevant demographic info as needed
      },
      preferences: {
        learningStyle: initialData.learningStyle || LearningStyle.VISUAL,
        learningPace: initialData.learningPace || LearningPace.MODERATE,
        preferredModality: initialData.preferredModality || ["text", "visual"], // e.g., text, visual, auditory, kinesthetic
        accessibilityNeeds: initialData.accessibilityNeeds || [],
        uiTheme: initialData.uiTheme || "default",
        ...initialData.preferences
      },
      learningState: {
        currentGoals: initialData.learningGoals || [],
        knowledgeMap: {}, // Subject -> { masteryLevel, lastAssessed, concepts: { conceptId: { mastery, history } } }
        skillLevels: {}, // Skill -> { level, lastAssessed }
        currentBloomsLevel: BloomsLevel.REMEMBERING,
        engagementLevel: 0.5, // 0 to 1 scale
        confidenceLevel: 0.5, // 0 to 1 scale
      },
      creditSystem: {
        tier: initialData.tier || "core",
        allocatedCredits: this._getAllocatedCreditsForTier(initialData.tier || "core"),
        consumedCredits: 0,
        purchasedCredits: 0,
        lastReplenished: now,
      },
      history: {
        completedModules: [],
        assessmentHistory: [],
        sessionLogs: [],
      },
      privacySettings: {
        dataSharingConsent: initialData.dataSharingConsent || false,
        anonymizeAnalytics: initialData.anonymizeAnalytics || true,
      }
    };
    
    try {
      await this.storage.saveUserProfile(userId, defaultProfile);
      this.logger.info(`[LearningProfileManager] Profile created successfully for user: ${userId}`);
      this.emit("profileCreated", { userId, profileId });
      return defaultProfile;
    } catch (error) {
      this.logger.error(`[LearningProfileManager] Failed to create profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get learner profile
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Learner profile or null if not found
   */
  async getProfile(userId) {
    this.logger.debug(`[LearningProfileManager] Getting profile for user: ${userId}`);
    try {
      const profile = await this.storage.getUserProfile(userId);
      if (!profile) {
        this.logger.warn(`[LearningProfileManager] Profile not found for user: ${userId}`);
        return null;
      }
      // Ensure credit system reflects current tier settings
      profile.creditSystem.allocatedCredits = this._getAllocatedCreditsForTier(profile.tier);
      return profile;
    } catch (error) {
      this.logger.error(`[LearningProfileManager] Failed to get profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update learner profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates (partial profile object)
   * @returns {Promise<Object>} Updated learner profile
   */
  async updateProfile(userId, updates) {
    this.logger.info(`[LearningProfileManager] Updating profile for user: ${userId}`);
    
    try {
      const currentProfile = await this.getProfile(userId);
      if (!currentProfile) {
        throw new Error(`Profile not found for user: ${userId}`);
      }
      
      // Deep merge updates into the current profile
      const updatedProfile = this._deepMerge(currentProfile, updates);
      updatedProfile.lastUpdatedAt = new Date();
      
      // Handle tier changes specifically for credit allocation
      if (updates.tier && updates.tier !== currentProfile.tier) {
        updatedProfile.creditSystem.tier = updates.tier;
        updatedProfile.creditSystem.allocatedCredits = this._getAllocatedCreditsForTier(updates.tier);
        // Potentially reset consumed credits or handle prorated allocation - depends on business logic
        this.logger.info(`[LearningProfileManager] User ${userId} tier changed to ${updates.tier}`);
      }
      
      await this.storage.saveUserProfile(userId, updatedProfile);
      this.logger.info(`[LearningProfileManager] Profile updated successfully for user: ${userId}`);
      this.emit("profileUpdated", { userId, updates });
      return updatedProfile;
    } catch (error) {
      this.logger.error(`[LearningProfileManager] Failed to update profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update knowledge map for a specific subject
   * @param {string} userId - User ID
   * @param {string} subject - Subject identifier
   * @param {Object} knowledgeUpdates - Updates to the knowledge map for the subject
   * @returns {Promise<Object>} Updated learner profile
   */
  async updateKnowledgeMap(userId, subject, knowledgeUpdates) {
    this.logger.debug(`[LearningProfileManager] Updating knowledge map for user ${userId}, subject ${subject}`);
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error(`Profile not found for user: ${userId}`);
    
    if (!profile.learningState.knowledgeMap[subject]) {
      profile.learningState.knowledgeMap[subject] = { masteryLevel: 0, lastAssessed: null, concepts: {} };
    }
    
    // Merge updates for concepts
    if (knowledgeUpdates.concepts) {
      for (const conceptId in knowledgeUpdates.concepts) {
        if (!profile.learningState.knowledgeMap[subject].concepts[conceptId]) {
          profile.learningState.knowledgeMap[subject].concepts[conceptId] = { mastery: 0, history: [] };
        }
        const currentConcept = profile.learningState.knowledgeMap[subject].concepts[conceptId];
        const updatedConcept = knowledgeUpdates.concepts[conceptId];
        
        currentConcept.mastery = updatedConcept.mastery !== undefined ? updatedConcept.mastery : currentConcept.mastery;
        currentConcept.history.push({ timestamp: new Date(), mastery: currentConcept.mastery, source: updatedConcept.source || "assessment" });
        // Limit history size if needed
        if (currentConcept.history.length > 20) {
           currentConcept.history.shift();
        }
      }
    }
    
    // Update overall subject mastery and assessment time
    profile.learningState.knowledgeMap[subject].masteryLevel = knowledgeUpdates.masteryLevel !== undefined ? knowledgeUpdates.masteryLevel : profile.learningState.knowledgeMap[subject].masteryLevel;
    profile.learningState.knowledgeMap[subject].lastAssessed = new Date();
    
    return this.updateProfile(userId, { learningState: profile.learningState });
  }
  
  /**
   * Update credit balance
   * @param {string} userId - User ID
   * @param {number} consumedCredits - Amount of credits consumed
   * @param {number} [purchasedCredits=0] - Amount of credits purchased
   * @returns {Promise<Object>} Updated learner profile
   */
  async updateCreditBalance(userId, consumedCredits, purchasedCredits = 0) {
    this.logger.info(`[LearningProfileManager] Updating credit balance for user ${userId}: consumed=${consumedCredits}, purchased=${purchasedCredits}`);
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error(`Profile not found for user: ${userId}`);
    
    profile.creditSystem.consumedCredits += consumedCredits;
    profile.creditSystem.purchasedCredits += purchasedCredits;
    
    // Potentially add logic for credit replenishment based on subscription cycle
    
    return this.updateProfile(userId, { creditSystem: profile.creditSystem });
  }
  
  /**
   * Get allocated credits for a specific tier
   * @param {string} tier - User tier (core, pro, enterprise, etc.)
   * @returns {number} Allocated credits
   * @private
   */
  _getAllocatedCreditsForTier(tier) {
    // This should fetch from config or a dedicated service
    // Placeholder values for the four tiers
    switch (tier.toLowerCase()) {
      case "free": return 1000;
      case "standard": return 10000;
      case "pro": return 50000;
      case "enterprise": return 200000;
      default: return 1000; // Default to free tier allocation
    }
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   * @private
   */
  _deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);
    
    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];
      
      if (isObject(targetValue) && isObject(sourceValue)) {
        this._deepMerge(targetValue, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });
    
    return target;
  }
}

module.exports = LearningProfileManager;
