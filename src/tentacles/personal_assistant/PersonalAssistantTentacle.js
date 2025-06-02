/**
 * @fileoverview Personal Assistant Tentacle - Main entry point for the Personal Assistant functionality.
 * Integrates task management, calendar, contacts, communication, information organization,
 * lifestyle management, personal branding, social media management, and proactive intelligence.
 * 
 * @module src/tentacles/personal_assistant/PersonalAssistantTentacle
 */

const BaseTentacle = require('../../core/tentacles/BaseTentacle');
const TaskManagementSystem = require('./TaskManagementSystem');
const CalendarAndSchedulingEngine = require('./calendar/CalendarAndSchedulingEngine');
const ContactManagementSystem = require('./contacts/ContactManagementSystem');
const CommunicationAssistant = require('./communication/CommunicationAssistant');
const InformationOrganizationSystem = require('./information/InformationOrganizationSystem');
const LifestyleManagementAssistant = require('./lifestyle/LifestyleManagementAssistant');
const PersonalBrandingManagementSystem = require('./branding/PersonalBrandingManagementSystem');
const SocialMediaManagementSystem = require('./social_media/SocialMediaManagementSystem');
const ProactiveIntelligenceSystem = require('./proactive/ProactiveIntelligenceSystem');
const ModelIntegrationService = require('./ai/ModelIntegrationService');
const ModelIntegratedBrandingService = require('./branding/ModelIntegratedBrandingService');
const ModelIntegratedSocialMediaService = require('./social_media/ModelIntegratedSocialMediaService');

/**
 * Personal Assistant Tentacle
 * @extends BaseTentacle
 */
class PersonalAssistantTentacle extends BaseTentacle {
  /**
   * Create a new Personal Assistant Tentacle
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super('personal_assistant', options, dependencies);
    
    this.options = {
      enableProactiveIntelligence: true,
      enablePersonalBranding: true,
      enableSocialMediaManagement: true,
      offlineCapability: 'full', // 'limited', 'standard', 'full'
      privacyLevel: 'high', // 'standard', 'high', 'maximum'
      ...options
    };
    
    // Ensure logger is available
    if (!this.logger) {
      this.logger = dependencies.logger || {
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: () => {}
      };
    }
    
    this.logger.info("[PersonalAssistantTentacle] Initializing Personal Assistant Tentacle");
    
    // Initialize model integration service
    this._initializeModelIntegration();
    
    // Initialize components
    this._initializeComponents();
    
    // Register event listeners
    this._registerEventListeners();
    
    this.logger.info("[PersonalAssistantTentacle] Personal Assistant Tentacle initialized");
  }
  
  /**
   * Initialize model integration
   * @private
   */
  _initializeModelIntegration() {
    this.logger.debug("[PersonalAssistantTentacle] Initializing model integration");
    
    // Create model integration service
    this.modelIntegrationService = new ModelIntegrationService(
      {
        offlineCapability: this.options.offlineCapability,
        modelPriority: 'accuracy',
        featureFlags: {
          enablePersonalBranding: this.options.enablePersonalBranding,
          enableSocialMediaManagement: this.options.enableSocialMediaManagement,
          enableProactiveIntelligence: this.options.enableProactiveIntelligence
        }
      },
      {
        logger: this.logger,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        securityFramework: this.dependencies.securityFramework
      }
    );
  }
  
  /**
   * Initialize all components
   * @private
   */
  _initializeComponents() {
    this.logger.debug("[PersonalAssistantTentacle] Initializing components");
    
    // Core components
    this.taskManagement = new TaskManagementSystem(
      this.options.taskManagement || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager
      }
    );
    
    this.calendarEngine = new CalendarAndSchedulingEngine(
      this.options.calendarEngine || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        taskManagementSystem: this.taskManagement
      }
    );
    
    this.contactManagement = new ContactManagementSystem(
      this.options.contactManagement || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager
      }
    );
    
    this.communicationAssistant = new CommunicationAssistant(
      this.options.communicationAssistant || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        contactManagementSystem: this.contactManagement
      }
    );
    
    this.informationSystem = new InformationOrganizationSystem(
      this.options.informationSystem || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        fileSystemTentacle: this.dependencies.fileSystemTentacle
      }
    );
    
    this.lifestyleAssistant = new LifestyleManagementAssistant(
      this.options.lifestyleAssistant || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        calendarEngine: this.calendarEngine,
        taskManagementSystem: this.taskManagement
      }
    );
    
    // Enhanced components (personal branding and social media)
    if (this.options.enablePersonalBranding) {
      this.personalBranding = new PersonalBrandingManagementSystem(
        this.options.personalBranding || {},
        {
          logger: this.logger,
          memoryTentacle: this.dependencies.memoryTentacle,
          securityFramework: this.dependencies.securityFramework,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          webTentacle: this.dependencies.webTentacle
        }
      );
      
      // Initialize model integrated branding service
      this.brandingService = new ModelIntegratedBrandingService(
        {
          offlineCapability: this.options.offlineCapability,
          contentGenerationQuality: 'high',
          audienceAnalysisDepth: 'comprehensive'
        },
        {
          logger: this.logger,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          securityFramework: this.dependencies.securityFramework,
          personalBrandingSystem: this.personalBranding
        }
      );
    }
    
    if (this.options.enableSocialMediaManagement) {
      this.socialMediaManagement = new SocialMediaManagementSystem(
        this.options.socialMediaManagement || {},
        {
          logger: this.logger,
          memoryTentacle: this.dependencies.memoryTentacle,
          securityFramework: this.dependencies.securityFramework,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          webTentacle: this.dependencies.webTentacle,
          personalBrandingSystem: this.personalBranding
        }
      );
      
      // Initialize model integrated social media service
      this.socialMediaService = new ModelIntegratedSocialMediaService(
        {
          offlineCapability: this.options.offlineCapability,
          contentGenerationQuality: 'high',
          engagementResponseSpeed: 'balanced',
          trendDetectionFrequency: 'daily'
        },
        {
          logger: this.logger,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          securityFramework: this.dependencies.securityFramework,
          socialMediaManagementSystem: this.socialMediaManagement
        }
      );
    }
    
    // Proactive Intelligence System (integrates all components)
    if (this.options.enableProactiveIntelligence) {
      this.proactiveIntelligence = new ProactiveIntelligenceSystem(
        this.options.proactiveIntelligence || {},
        {
          logger: this.logger,
          memoryTentacle: this.dependencies.memoryTentacle,
          securityFramework: this.dependencies.securityFramework,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          taskManagementSystem: this.taskManagement,
          calendarEngine: this.calendarEngine,
          contactManagementSystem: this.contactManagement,
          informationSystem: this.informationSystem,
          webTentacle: this.dependencies.webTentacle
        }
      );
    }
  }
  
  /**
   * Register event listeners between components
   * @private
   */
  _registerEventListeners() {
    this.logger.debug("[PersonalAssistantTentacle] Registering event listeners");
    
    // Task Management events
    this.taskManagement.on('taskCreated', (task) => {
      this.emit('taskCreated', task);
      this.logger.debug("[PersonalAssistantTentacle] Task created", { taskId: task.id });
    });
    
    this.taskManagement.on('taskUpdated', (task) => {
      this.emit('taskUpdated', task);
      this.logger.debug("[PersonalAssistantTentacle] Task updated", { taskId: task.id });
    });
    
    this.taskManagement.on('taskCompleted', (task) => {
      this.emit('taskCompleted', task);
      this.logger.debug("[PersonalAssistantTentacle] Task completed", { taskId: task.id });
    });
    
    // Calendar events
    this.calendarEngine.on('eventCreated', (event) => {
      this.emit('calendarEventCreated', event);
      this.logger.debug("[PersonalAssistantTentacle] Calendar event created", { eventId: event.id });
    });
    
    this.calendarEngine.on('eventReminder', (event) => {
      this.emit('calendarEventReminder', event);
      this.logger.debug("[PersonalAssistantTentacle] Calendar event reminder", { eventId: event.id });
    });
    
    // Communication events
    this.communicationAssistant.on('messageReceived', (message) => {
      this.emit('messageReceived', message);
      this.logger.debug("[PersonalAssistantTentacle] Message received", { messageId: message.id });
    });
    
    this.communicationAssistant.on('messageSent', (message) => {
      this.emit('messageSent', message);
      this.logger.debug("[PersonalAssistantTentacle] Message sent", { messageId: message.id });
    });
    
    // Proactive Intelligence events
    if (this.proactiveIntelligence) {
      this.proactiveIntelligence.on('proactiveRecommendation', (recommendation) => {
        this.emit('proactiveRecommendation', recommendation);
        this.logger.debug("[PersonalAssistantTentacle] Proactive recommendation", { recommendationId: recommendation.id });
      });
      
      this.proactiveIntelligence.on('anomalyDetected', (anomaly) => {
        this.emit('anomalyDetected', anomaly);
        this.logger.debug("[PersonalAssistantTentacle] Anomaly detected", { anomalyId: anomaly.id });
      });
    }
    
    // Personal Branding events
    if (this.personalBranding) {
      this.personalBranding.on('brandingOpportunityDetected', (opportunity) => {
        this.emit('brandingOpportunityDetected', opportunity);
        this.logger.debug("[PersonalAssistantTentacle] Branding opportunity detected", { opportunityId: opportunity.id });
      });
      
      this.personalBranding.on('brandingStrategyUpdated', (strategy) => {
        this.emit('brandingStrategyUpdated', strategy);
        this.logger.debug("[PersonalAssistantTentacle] Branding strategy updated", { strategyId: strategy.id });
      });
    }
    
    // Social Media events
    if (this.socialMediaManagement) {
      this.socialMediaManagement.on('contentScheduled', (content) => {
        this.emit('socialMediaContentScheduled', content);
        this.logger.debug("[PersonalAssistantTentacle] Social media content scheduled", { contentId: content.id });
      });
      
      this.socialMediaManagement.on('engagementOpportunityDetected', (opportunity) => {
        this.emit('socialMediaEngagementOpportunity', opportunity);
        this.logger.debug("[PersonalAssistantTentacle] Social media engagement opportunity", { opportunityId: opportunity.id });
      });
    }
  }
  
  /**
   * Get tentacle status
   * @returns {Promise<Object>} Status object
   */
  async getStatus() {
    const status = {
      name: this.name,
      version: this.version,
      components: {
        taskManagement: await this.taskManagement.getStatus(),
        calendarEngine: await this.calendarEngine.getStatus(),
        contactManagement: await this.contactManagement.getStatus(),
        communicationAssistant: await this.communicationAssistant.getStatus(),
        informationSystem: await this.informationSystem.getStatus(),
        lifestyleAssistant: await this.lifestyleAssistant.getStatus()
      },
      options: {
        enableProactiveIntelligence: this.options.enableProactiveIntelligence,
        enablePersonalBranding: this.options.enablePersonalBranding,
        enableSocialMediaManagement: this.options.enableSocialMediaManagement,
        offlineCapability: this.options.offlineCapability,
        privacyLevel: this.options.privacyLevel
      }
    };
    
    // Add enhanced components if enabled
    if (this.personalBranding) {
      status.components.personalBranding = await this.personalBranding.getStatus();
    }
    
    if (this.socialMediaManagement) {
      status.components.socialMediaManagement = await this.socialMediaManagement.getStatus();
    }
    
    if (this.proactiveIntelligence) {
      status.components.proactiveIntelligence = await this.proactiveIntelligence.getStatus();
    }
    
    // Add model integration services
    try {
      status.modelIntegration = await this.modelIntegrationService.getStatus();
    } catch (error) {
      this.logger.warn("[PersonalAssistantTentacle] Failed to get model integration status", { error: error.message });
    }
    
    return status;
  }
  
  // --- Task Management API ---
  
  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    this.logger.debug("[PersonalAssistantTentacle] Creating task");
    return this.taskManagement.createTask(taskData);
  }
  
  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task
   */
  async getTask(taskId) {
    return this.taskManagement.getTask(taskId);
  }
  
  /**
   * Get all tasks
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Tasks
   */
  async getAllTasks(filter) {
    return this.taskManagement.getAllTasks(filter);
  }
  
  /**
   * Update task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Task updates
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    return this.taskManagement.updateTask(taskId, updates);
  }
  
  /**
   * Complete task
   * @param {string} taskId - Task ID
   * @param {Object} [completionData] - Completion data
   * @returns {Promise<Object>} Completed task
   */
  async completeTask(taskId, completionData) {
    return this.taskManagement.completeTask(taskId, completionData);
  }
  
  // --- Calendar API ---
  
  /**
   * Create calendar event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createCalendarEvent(eventData) {
    this.logger.debug("[PersonalAssistantTentacle] Creating calendar event");
    return this.calendarEngine.createEvent(eventData);
  }
  
  /**
   * Get calendar event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event
   */
  async getCalendarEvent(eventId) {
    return this.calendarEngine.getEvent(eventId);
  }
  
  /**
   * Get calendar events
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Events
   */
  async getCalendarEvents(filter) {
    return this.calendarEngine.getEvents(filter);
  }
  
  /**
   * Update calendar event
   * @param {string} eventId - Event ID
   * @param {Object} updates - Event updates
   * @returns {Promise<Object>} Updated event
   */
  async updateCalendarEvent(eventId, updates) {
    return this.calendarEngine.updateEvent(eventId, updates);
  }
  
  /**
   * Delete calendar event
   * @param {string} eventId - Event ID
   * @returns {Promise<boolean>} Success
   */
  async deleteCalendarEvent(eventId) {
    return this.calendarEngine.deleteEvent(eventId);
  }
  
  // --- Contact Management API ---
  
  /**
   * Create contact
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} Created contact
   */
  async createContact(contactData) {
    this.logger.debug("[PersonalAssistantTentacle] Creating contact");
    return this.contactManagement.createContact(contactData);
  }
  
  /**
   * Get contact by ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object>} Contact
   */
  async getContact(contactId) {
    return this.contactManagement.getContact(contactId);
  }
  
  /**
   * Get all contacts
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Contacts
   */
  async getAllContacts(filter) {
    return this.contactManagement.getAllContacts(filter);
  }
  
  /**
   * Update contact
   * @param {string} contactId - Contact ID
   * @param {Object} updates - Contact updates
   * @returns {Promise<Object>} Updated contact
   */
  async updateContact(contactId, updates) {
    return this.contactManagement.updateContact(contactId, updates);
  }
  
  /**
   * Delete contact
   * @param {string} contactId - Contact ID
   * @returns {Promise<boolean>} Success
   */
  async deleteContact(contactId) {
    return this.contactManagement.deleteContact(contactId);
  }
  
  // --- Communication API ---
  
  /**
   * Send message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Sent message
   */
  async sendMessage(messageData) {
    this.logger.debug("[PersonalAssistantTentacle] Sending message");
    return this.communicationAssistant.sendMessage(messageData);
  }
  
  /**
   * Get message by ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Message
   */
  async getMessage(messageId) {
    return this.communicationAssistant.getMessage(messageId);
  }
  
  /**
   * Get messages
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Messages
   */
  async getMessages(filter) {
    return this.communicationAssistant.getMessages(filter);
  }
  
  /**
   * Generate message draft
   * @param {Object} context - Message context
   * @returns {Promise<Object>} Message draft
   */
  async generateMessageDraft(context) {
    this.logger.debug("[PersonalAssistantTentacle] Generating message draft");
    return this.communicationAssistant.generateDraft(context);
  }
  
  // --- Information Organization API ---
  
  /**
   * Store information
   * @param {Object} informationData - Information data
   * @returns {Promise<Object>} Stored information
   */
  async storeInformation(informationData) {
    this.logger.debug("[PersonalAssistantTentacle] Storing information");
    return this.informationSystem.storeInformation(informationData);
  }
  
  /**
   * Get information by ID
   * @param {string} informationId - Information ID
   * @returns {Promise<Object>} Information
   */
  async getInformation(informationId) {
    return this.informationSystem.getInformation(informationId);
  }
  
  /**
   * Search information
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array<Object>>} Search results
   */
  async searchInformation(searchParams) {
    return this.informationSystem.searchInformation(searchParams);
  }
  
  /**
   * Organize information
   * @param {Array<string>} informationIds - Information IDs
   * @param {Object} organizationData - Organization data
   * @returns {Promise<Object>} Organization result
   */
  async organizeInformation(informationIds, organizationData) {
    this.logger.debug("[PersonalAssistantTentacle] Organizing information");
    return this.informationSystem.organizeInformation(informationIds, organizationData);
  }
  
  // --- Lifestyle Management API ---
  
  /**
   * Create lifestyle goal
   * @param {Object} goalData - Goal data
   * @returns {Promise<Object>} Created goal
   */
  async createLifestyleGoal(goalData) {
    this.logger.debug("[PersonalAssistantTentacle] Creating lifestyle goal");
    return this.lifestyleAssistant.createGoal(goalData);
  }
  
  /**
   * Get lifestyle goal by ID
   * @param {string} goalId - Goal ID
   * @returns {Promise<Object>} Goal
   */
  async getLifestyleGoal(goalId) {
    return this.lifestyleAssistant.getGoal(goalId);
  }
  
  /**
   * Get lifestyle goals
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Goals
   */
  async getLifestyleGoals(filter) {
    return this.lifestyleAssistant.getGoals(filter);
  }
  
  /**
   * Update lifestyle goal
   * @param {string} goalId - Goal ID
   * @param {Object} updates - Goal updates
   * @returns {Promise<Object>} Updated goal
   */
  async updateLifestyleGoal(goalId, updates) {
    return this.lifestyleAssistant.updateGoal(goalId, updates);
  }
  
  /**
   * Track lifestyle metric
   * @param {Object} metricData - Metric data
   * @returns {Promise<Object>} Tracked metric
   */
  async trackLifestyleMetric(metricData) {
    this.logger.debug("[PersonalAssistantTentacle] Tracking lifestyle metric");
    return this.lifestyleAssistant.trackMetric(metricData);
  }
  
  /**
   * Get lifestyle insights
   * @param {Object} [params] - Insight parameters
   * @returns {Promise<Object>} Insights
   */
  async getLifestyleInsights(params) {
    return this.lifestyleAssistant.getInsights(params);
  }
  
  // --- Personal Branding API ---
  
  /**
   * Create or update brand strategy
   * @param {Object} strategyData - Strategy data
   * @returns {Promise<Object>} Created/updated strategy
   */
  async createOrUpdateBrandStrategy(strategyData) {
    if (!this.personalBranding) {
      throw new Error("Personal Branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Creating/updating brand strategy");
    return this.personalBranding.createOrUpdateBrandStrategy(strategyData);
  }
  
  /**
   * Get brand strategy
   * @returns {Promise<Object>} Brand strategy
   */
  async getBrandStrategy() {
    if (!this.personalBranding) {
      throw new Error("Personal Branding is not enabled");
    }
    
    return this.personalBranding.getBrandStrategy();
  }
  
  /**
   * Add or update brand asset
   * @param {Object} assetData - Asset data
   * @returns {Promise<Object>} Created/updated asset
   */
  async addOrUpdateBrandAsset(assetData) {
    if (!this.personalBranding) {
      throw new Error("Personal Branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Adding/updating brand asset");
    return this.personalBranding.addOrUpdateBrandAsset(assetData);
  }
  
  /**
   * Get brand assets
   * @param {Object} [criteria] - Filter criteria
   * @returns {Promise<Array<Object>>} Brand assets
   */
  async getBrandAssets(criteria) {
    if (!this.personalBranding) {
      throw new Error("Personal Branding is not enabled");
    }
    
    return this.personalBranding.getBrandAssets(criteria);
  }
  
  /**
   * Generate branding content
   * @param {Object} params - Content parameters
   * @returns {Promise<Object>} Generated content
   */
  async generateBrandingContent(params) {
    if (!this.personalBranding || !this.brandingService) {
      throw new Error("Personal Branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Generating branding content");
    
    // Use model integrated branding service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.brandingService.generateBrandingContent(params, offlineMode);
  }
  
  /**
   * Analyze brand strategy
   * @param {Object} [strategy] - Brand strategy (uses current if not provided)
   * @returns {Promise<Object>} Strategy insights
   */
  async analyzeBrandStrategy(strategy) {
    if (!this.personalBranding || !this.brandingService) {
      throw new Error("Personal Branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Analyzing brand strategy");
    
    // Get current strategy if not provided
    if (!strategy) {
      strategy = await this.personalBranding.getBrandStrategy();
    }
    
    // Use model integrated branding service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.brandingService.generateBrandStrategyInsights(strategy, offlineMode);
  }
  
  // --- Social Media Management API ---
  
  /**
   * Connect social media profile
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Connected profile
   */
  async connectSocialMediaProfile(profileData) {
    if (!this.socialMediaManagement) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Connecting social media profile");
    return this.socialMediaManagement.connectProfile(profileData);
  }
  
  /**
   * Get connected social media profiles
   * @param {Object} [criteria] - Filter criteria
   * @returns {Promise<Array<Object>>} Connected profiles
   */
  async getConnectedSocialMediaProfiles(criteria) {
    if (!this.socialMediaManagement) {
      throw new Error("Social Media Management is not enabled");
    }
    
    return this.socialMediaManagement.getConnectedProfiles(criteria);
  }
  
  /**
   * Schedule social media post
   * @param {Object} postData - Post data
   * @returns {Promise<Object>} Scheduled post
   */
  async scheduleSocialMediaPost(postData) {
    if (!this.socialMediaManagement) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Scheduling social media post");
    return this.socialMediaManagement.schedulePost(postData);
  }
  
  /**
   * Get scheduled social media posts
   * @param {Object} [criteria] - Filter criteria
   * @returns {Promise<Array<Object>>} Scheduled posts
   */
  async getScheduledSocialMediaPosts(criteria) {
    if (!this.socialMediaManagement) {
      throw new Error("Social Media Management is not enabled");
    }
    
    return this.socialMediaManagement.getScheduledPosts(criteria);
  }
  
  /**
   * Generate social media content ideas
   * @param {Object} params - Content parameters
   * @returns {Promise<Object>} Generated content ideas
   */
  async generateSocialMediaContentIdeas(params) {
    if (!this.socialMediaManagement || !this.socialMediaService) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Generating social media content ideas");
    
    // Use model integrated social media service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.socialMediaService.generateContentIdeas(params, offlineMode);
  }
  
  /**
   * Optimize social media content
   * @param {Object} params - Optimization parameters
   * @returns {Promise<Object>} Optimized content
   */
  async optimizeSocialMediaContent(params) {
    if (!this.socialMediaManagement || !this.socialMediaService) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Optimizing social media content");
    
    // Use model integrated social media service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.socialMediaService.optimizeContent(params, offlineMode);
  }
  
  /**
   * Generate engagement response
   * @param {Object} params - Response parameters
   * @returns {Promise<Object>} Generated response
   */
  async generateEngagementResponse(params) {
    if (!this.socialMediaManagement || !this.socialMediaService) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Generating engagement response");
    
    // Use model integrated social media service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.socialMediaService.generateEngagementResponse(params, offlineMode);
  }
  
  /**
   * Detect social media trends
   * @param {Object} [params] - Detection parameters
   * @returns {Promise<Object>} Detected trends
   */
  async detectSocialMediaTrends(params = {}) {
    if (!this.socialMediaManagement || !this.socialMediaService) {
      throw new Error("Social Media Management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Detecting social media trends");
    
    // Use model integrated social media service
    const offlineMode = !this.dependencies.modelIntegrationManager || 
                        this.options.offlineCapability === 'full';
    
    return this.socialMediaService.detectTrends(params, offlineMode);
  }
}

module.exports = PersonalAssistantTentacle;
