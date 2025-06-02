/**
 * @fileoverview Personal Assistant Tentacle - Main entry point for the Personal Assistant functionality.
 * Integrates task management, calendar, contacts, communication, information organization,
 * lifestyle management, personal branding, social media management, and proactive intelligence.
 * Enhanced with advanced multi-LLM orchestration for superintelligent capabilities.
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

// Import advanced orchestration components
const { ModelType, ModelSelectionStrategy, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');
const { ModelOrchestrationSystem } = require('../../core/miif/models/orchestration/ModelOrchestrationSystem');

/**
 * Personal Assistant Tentacle
 * Enhanced with advanced multi-LLM orchestration for superintelligent capabilities
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
      privacyLevel: 'high', // 'standard', 'high', 'maximum',
      collaborativeIntelligence: true, // Enable collaborative model orchestration
      specializedModelSelection: true, // Enable specialized model selection
      adaptiveResourceAllocation: true, // Enable adaptive resource allocation
      selfEvaluation: true, // Enable self-evaluation and correction
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
    
    this.logger.info("[PersonalAssistantTentacle] Initializing Personal Assistant Tentacle with advanced orchestration");
    
    // Initialize advanced model orchestration
    this._initializeAdvancedOrchestration();
    
    // Initialize model integration service
    this._initializeModelIntegration();
    
    // Initialize components
    this._initializeComponents();
    
    // Register event listeners
    this._registerEventListeners();
    
    // Initialize collaboration sessions
    this._initializeCollaborationSessions();
    
    this.logger.info("[PersonalAssistantTentacle] Personal Assistant Tentacle initialized with superintelligent capabilities");
  }
  
  /**
   * Initialize advanced model orchestration
   * @private
   */
  _initializeAdvancedOrchestration() {
    this.logger.debug("[PersonalAssistantTentacle] Initializing advanced model orchestration");
    
    // Get model orchestration system from dependencies or create new one
    this.modelOrchestrationSystem = this.dependencies.modelOrchestrationSystem || 
      new ModelOrchestrationSystem(
        {
          offlineCapability: this.options.offlineCapability,
          collaborativeIntelligence: this.options.collaborativeIntelligence,
          specializedModelSelection: this.options.specializedModelSelection,
          adaptiveResourceAllocation: this.options.adaptiveResourceAllocation,
          selfEvaluation: this.options.selfEvaluation
        },
        {
          logger: this.logger,
          adminPanel: this.dependencies.adminPanel,
          securityFramework: this.dependencies.securityFramework
        }
      );
    
    // Initialize orchestration system if not already initialized
    if (!this.modelOrchestrationSystem.initialized) {
      this.modelOrchestrationSystem.initialize().catch(error => {
        this.logger.error("[PersonalAssistantTentacle] Failed to initialize model orchestration system", { error: error.message });
      });
    }
  }
  
  /**
   * Initialize model integration
   * @private
   */
  _initializeModelIntegration() {
    this.logger.debug("[PersonalAssistantTentacle] Initializing model integration");
    
    // Create model integration service with advanced orchestration
    this.modelIntegrationService = new ModelIntegrationService(
      {
        offlineCapability: this.options.offlineCapability,
        modelPriority: 'accuracy',
        featureFlags: {
          enablePersonalBranding: this.options.enablePersonalBranding,
          enableSocialMediaManagement: this.options.enableSocialMediaManagement,
          enableProactiveIntelligence: this.options.enableProactiveIntelligence,
          enableCollaborativeIntelligence: this.options.collaborativeIntelligence,
          enableSpecializedModelSelection: this.options.specializedModelSelection
        }
      },
      {
        logger: this.logger,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        securityFramework: this.dependencies.securityFramework,
        modelOrchestrationSystem: this.modelOrchestrationSystem
      }
    );
  }
  
  /**
   * Initialize all components
   * @private
   */
  _initializeComponents() {
    this.logger.debug("[PersonalAssistantTentacle] Initializing components with advanced orchestration");
    
    // Core components
    this.taskManagement = new TaskManagementSystem(
      this.options.taskManagement || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        modelOrchestrationSystem: this.modelOrchestrationSystem
      }
    );
    
    this.calendarEngine = new CalendarAndSchedulingEngine(
      this.options.calendarEngine || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        modelOrchestrationSystem: this.modelOrchestrationSystem,
        taskManagementSystem: this.taskManagement
      }
    );
    
    this.contactManagement = new ContactManagementSystem(
      this.options.contactManagement || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        modelOrchestrationSystem: this.modelOrchestrationSystem
      }
    );
    
    this.communicationAssistant = new CommunicationAssistant(
      this.options.communicationAssistant || {},
      {
        logger: this.logger,
        memoryTentacle: this.dependencies.memoryTentacle,
        securityFramework: this.dependencies.securityFramework,
        modelIntegrationManager: this.dependencies.modelIntegrationManager,
        modelOrchestrationSystem: this.modelOrchestrationSystem,
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
        modelOrchestrationSystem: this.modelOrchestrationSystem,
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
        modelOrchestrationSystem: this.modelOrchestrationSystem,
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
          modelOrchestrationSystem: this.modelOrchestrationSystem,
          webTentacle: this.dependencies.webTentacle
        }
      );
      
      // Initialize model integrated branding service
      this.brandingService = new ModelIntegratedBrandingService(
        {
          offlineCapability: this.options.offlineCapability,
          contentGenerationQuality: 'high',
          audienceAnalysisDepth: 'comprehensive',
          enableCollaborativeIntelligence: this.options.collaborativeIntelligence,
          enableSpecializedModelSelection: this.options.specializedModelSelection
        },
        {
          logger: this.logger,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          modelOrchestrationSystem: this.modelOrchestrationSystem,
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
          modelOrchestrationSystem: this.modelOrchestrationSystem,
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
          trendDetectionFrequency: 'daily',
          enableCollaborativeIntelligence: this.options.collaborativeIntelligence,
          enableSpecializedModelSelection: this.options.specializedModelSelection
        },
        {
          logger: this.logger,
          modelIntegrationManager: this.dependencies.modelIntegrationManager,
          modelOrchestrationSystem: this.modelOrchestrationSystem,
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
          modelOrchestrationSystem: this.modelOrchestrationSystem,
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
   * Initialize collaboration sessions for advanced orchestration
   * @private
   */
  _initializeCollaborationSessions() {
    if (!this.options.collaborativeIntelligence || !this.modelOrchestrationSystem) {
      return;
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Initializing collaboration sessions");
    
    // Create collaboration sessions for different domains
    this._createCollaborationSessions().catch(error => {
      this.logger.error("[PersonalAssistantTentacle] Failed to create collaboration sessions", { error: error.message });
    });
  }
  
  /**
   * Create collaboration sessions for different domains
   * @private
   * @returns {Promise<void>}
   */
  async _createCollaborationSessions() {
    try {
      // Task Management collaboration session
      this.taskCollaborationSession = await this.modelOrchestrationSystem.createCollaborationSession({
        sessionId: 'personal_assistant_task_management',
        modelType: ModelType.TEXT,
        taskType: 'task_management',
        collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
        offlineOnly: this.options.offlineCapability === 'full'
      });
      
      // Communication collaboration session
      this.communicationCollaborationSession = await this.modelOrchestrationSystem.createCollaborationSession({
        sessionId: 'personal_assistant_communication',
        modelType: ModelType.TEXT,
        taskType: 'communication',
        collaborationStrategy: CollaborationStrategy.ENSEMBLE,
        offlineOnly: this.options.offlineCapability === 'full'
      });
      
      // If personal branding is enabled, create branding collaboration session
      if (this.options.enablePersonalBranding) {
        this.brandingCollaborationSession = await this.modelOrchestrationSystem.createCollaborationSession({
          sessionId: 'personal_assistant_branding',
          modelType: ModelType.TEXT,
          taskType: 'content_generation',
          collaborationStrategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          offlineOnly: false // Allow online models for branding
        });
      }
      
      // If social media management is enabled, create social media collaboration session
      if (this.options.enableSocialMediaManagement) {
        this.socialMediaCollaborationSession = await this.modelOrchestrationSystem.createCollaborationSession({
          sessionId: 'personal_assistant_social_media',
          modelTypes: [ModelType.TEXT, ModelType.IMAGE],
          taskType: 'social_media_management',
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: false // Allow online models for social media
        });
      }
      
      // If proactive intelligence is enabled, create proactive collaboration session
      if (this.options.enableProactiveIntelligence) {
        this.proactiveCollaborationSession = await this.modelOrchestrationSystem.createCollaborationSession({
          sessionId: 'personal_assistant_proactive',
          modelTypes: [ModelType.TEXT, ModelType.IMAGE, ModelType.VIDEO],
          taskType: 'proactive_intelligence',
          collaborationStrategy: CollaborationStrategy.CONSENSUS,
          offlineOnly: this.options.offlineCapability === 'full'
        });
      }
      
      this.logger.debug("[PersonalAssistantTentacle] Collaboration sessions initialized");
    } catch (error) {
      this.logger.error("[PersonalAssistantTentacle] Failed to create collaboration sessions", { error: error.message });
      throw error;
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
    
    // Model Orchestration events
    if (this.modelOrchestrationSystem) {
      this.modelOrchestrationSystem.on('modelPerformanceRecorded', (performance) => {
        this.emit('modelPerformanceRecorded', performance);
        this.logger.debug("[PersonalAssistantTentacle] Model performance recorded", { modelId: performance.modelId });
      });
      
      this.modelOrchestrationSystem.on('collaborationSessionCreated', (sessionId) => {
        this.emit('collaborationSessionCreated', sessionId);
        this.logger.debug("[PersonalAssistantTentacle] Collaboration session created", { sessionId });
      });
      
      this.modelOrchestrationSystem.on('collaborationSessionClosed', (sessionId) => {
        this.emit('collaborationSessionClosed', sessionId);
        this.logger.debug("[PersonalAssistantTentacle] Collaboration session closed", { sessionId });
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
        privacyLevel: this.options.privacyLevel,
        collaborativeIntelligence: this.options.collaborativeIntelligence,
        specializedModelSelection: this.options.specializedModelSelection,
        adaptiveResourceAllocation: this.options.adaptiveResourceAllocation,
        selfEvaluation: this.options.selfEvaluation
      },
      advancedOrchestration: {
        initialized: this.modelOrchestrationSystem ? this.modelOrchestrationSystem.initialized : false,
        collaborationSessions: {
          taskManagement: this.taskCollaborationSession || null,
          communication: this.communicationCollaborationSession || null,
          branding: this.brandingCollaborationSession || null,
          socialMedia: this.socialMediaCollaborationSession || null,
          proactive: this.proactiveCollaborationSession || null
        }
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
  
  // --- Task Management API with Collaborative Intelligence ---
  
  /**
   * Create a new task with collaborative intelligence
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    this.logger.debug("[PersonalAssistantTentacle] Creating task with collaborative intelligence");
    
    if (this.options.collaborativeIntelligence && this.taskCollaborationSession) {
      try {
        // Use collaborative intelligence to enhance task data
        const enhancedTaskData = await this.modelOrchestrationSystem.executeCollaborativeTask({
          sessionId: this.taskCollaborationSession,
          input: {
            operation: 'enhance_task',
            taskData
          },
          options: {
            useContextualMemory: true,
            enableSelfEvaluation: this.options.selfEvaluation
          }
        });
        
        // Create task with enhanced data
        return this.taskManagement.createTask(enhancedTaskData);
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use collaborative intelligence for task creation", { error: error.message });
        // Fall back to standard task creation
        return this.taskManagement.createTask(taskData);
      }
    }
    
    // Standard task creation
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
   * Get all tasks with intelligent filtering
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Tasks
   */
  async getAllTasks(filter) {
    if (this.options.specializedModelSelection && this.modelOrchestrationSystem) {
      try {
        // Use specialized model to enhance filter criteria
        const model = await this.modelOrchestrationSystem.getModelForTask({
          modelType: ModelType.TEXT,
          taskType: 'task_filtering',
          selectionStrategy: ModelSelectionStrategy.SPECIALIZED
        });
        
        if (model) {
          // Enhance filter criteria
          const enhancedFilter = await model.execute({
            operation: 'enhance_task_filter',
            filter
          });
          
          // Use enhanced filter
          return this.taskManagement.getAllTasks(enhancedFilter);
        }
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use specialized model for task filtering", { error: error.message });
      }
    }
    
    // Standard task retrieval
    return this.taskManagement.getAllTasks(filter);
  }
  
  /**
   * Update task with intelligent enhancement
   * @param {string} taskId - Task ID
   * @param {Object} updates - Task updates
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    if (this.options.collaborativeIntelligence && this.taskCollaborationSession) {
      try {
        // Get current task
        const currentTask = await this.taskManagement.getTask(taskId);
        
        // Use collaborative intelligence to enhance updates
        const enhancedUpdates = await this.modelOrchestrationSystem.executeCollaborativeTask({
          sessionId: this.taskCollaborationSession,
          input: {
            operation: 'enhance_task_update',
            currentTask,
            updates
          },
          options: {
            useContextualMemory: true,
            enableSelfEvaluation: this.options.selfEvaluation
          }
        });
        
        // Update task with enhanced updates
        return this.taskManagement.updateTask(taskId, enhancedUpdates);
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use collaborative intelligence for task update", { error: error.message });
        // Fall back to standard task update
        return this.taskManagement.updateTask(taskId, updates);
      }
    }
    
    // Standard task update
    return this.taskManagement.updateTask(taskId, updates);
  }
  
  /**
   * Complete task with intelligent verification
   * @param {string} taskId - Task ID
   * @param {Object} [completionData] - Completion data
   * @returns {Promise<Object>} Completed task
   */
  async completeTask(taskId, completionData) {
    if (this.options.selfEvaluation && this.modelOrchestrationSystem) {
      try {
        // Get current task
        const currentTask = await this.taskManagement.getTask(taskId);
        
        // Use specialized model to verify task completion
        const model = await this.modelOrchestrationSystem.getModelForTask({
          modelType: ModelType.TEXT,
          taskType: 'task_verification',
          selectionStrategy: ModelSelectionStrategy.SPECIALIZED
        });
        
        if (model) {
          // Verify task completion
          const verificationResult = await model.execute({
            operation: 'verify_task_completion',
            task: currentTask,
            completionData
          });
          
          // If verification failed, return task with verification feedback
          if (!verificationResult.verified) {
            this.logger.warn("[PersonalAssistantTentacle] Task completion verification failed", { 
              taskId, 
              feedback: verificationResult.feedback 
            });
            
            // Update task with verification feedback
            return this.taskManagement.updateTask(taskId, {
              verificationFeedback: verificationResult.feedback,
              status: 'verification_failed'
            });
          }
          
          // Use verified completion data
          return this.taskManagement.completeTask(taskId, verificationResult.enhancedCompletionData || completionData);
        }
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use self-evaluation for task completion", { error: error.message });
      }
    }
    
    // Standard task completion
    return this.taskManagement.completeTask(taskId, completionData);
  }
  
  // --- Enhanced Personal Branding API with Collaborative Intelligence ---
  
  /**
   * Generate personal branding content with collaborative intelligence
   * @param {Object} contentRequest - Content request
   * @returns {Promise<Object>} Generated content
   */
  async generateBrandingContent(contentRequest) {
    if (!this.options.enablePersonalBranding || !this.brandingService) {
      throw new Error("Personal branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Generating branding content with collaborative intelligence");
    
    if (this.options.collaborativeIntelligence && this.brandingCollaborationSession) {
      try {
        // Use collaborative intelligence to generate content
        const enhancedContent = await this.modelOrchestrationSystem.executeCollaborativeTask({
          sessionId: this.brandingCollaborationSession,
          input: {
            operation: 'generate_branding_content',
            contentRequest
          },
          options: {
            useContextualMemory: true,
            enableSelfEvaluation: this.options.selfEvaluation,
            qualityThreshold: 0.95
          }
        });
        
        // Record model performance
        await this.modelOrchestrationSystem.recordModelPerformance('branding_content_generation', {
          taskType: 'content_generation',
          strategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          accuracy: enhancedContent.qualityScore || 0.9,
          latency: enhancedContent.generationTime || 500
        });
        
        return enhancedContent;
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use collaborative intelligence for branding content", { error: error.message });
        // Fall back to standard content generation
        return this.brandingService.generateContent(contentRequest);
      }
    }
    
    // Standard content generation
    return this.brandingService.generateContent(contentRequest);
  }
  
  /**
   * Analyze audience with specialized model selection
   * @param {Object} audienceData - Audience data
   * @returns {Promise<Object>} Audience analysis
   */
  async analyzeAudience(audienceData) {
    if (!this.options.enablePersonalBranding || !this.brandingService) {
      throw new Error("Personal branding is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Analyzing audience with specialized model selection");
    
    if (this.options.specializedModelSelection && this.modelOrchestrationSystem) {
      try {
        // Use specialized model for audience analysis
        const model = await this.modelOrchestrationSystem.getModelForTask({
          modelType: ModelType.TEXT,
          taskType: 'audience_analysis',
          selectionStrategy: ModelSelectionStrategy.SPECIALIZED
        });
        
        if (model) {
          // Perform audience analysis
          const analysis = await model.execute({
            operation: 'analyze_audience',
            audienceData
          });
          
          // Record model performance
          await this.modelOrchestrationSystem.recordModelPerformance(model.modelId, {
            taskType: 'audience_analysis',
            accuracy: analysis.confidenceScore || 0.9,
            latency: analysis.analysisTime || 300
          });
          
          return analysis;
        }
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use specialized model for audience analysis", { error: error.message });
      }
    }
    
    // Standard audience analysis
    return this.brandingService.analyzeAudience(audienceData);
  }
  
  // --- Enhanced Social Media API with Cross-Modal Intelligence ---
  
  /**
   * Generate social media content with cross-modal intelligence
   * @param {Object} contentRequest - Content request
   * @returns {Promise<Object>} Generated content
   */
  async generateSocialMediaContent(contentRequest) {
    if (!this.options.enableSocialMediaManagement || !this.socialMediaService) {
      throw new Error("Social media management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Generating social media content with cross-modal intelligence");
    
    if (this.options.collaborativeIntelligence && this.socialMediaCollaborationSession) {
      try {
        // Use cross-modal collaborative intelligence to generate content
        const enhancedContent = await this.modelOrchestrationSystem.executeCollaborativeTask({
          sessionId: this.socialMediaCollaborationSession,
          input: {
            operation: 'generate_social_media_content',
            contentRequest,
            includeVisualSuggestions: true
          },
          options: {
            useContextualMemory: true,
            enableSelfEvaluation: this.options.selfEvaluation,
            qualityThreshold: 0.95,
            maxIterations: 3
          }
        });
        
        // Record model performance
        await this.modelOrchestrationSystem.recordModelPerformance('social_media_content_generation', {
          taskType: 'content_generation',
          strategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          accuracy: enhancedContent.qualityScore || 0.9,
          latency: enhancedContent.generationTime || 800
        });
        
        return enhancedContent;
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use cross-modal intelligence for social media content", { error: error.message });
        // Fall back to standard content generation
        return this.socialMediaService.generateContent(contentRequest);
      }
    }
    
    // Standard content generation
    return this.socialMediaService.generateContent(contentRequest);
  }
  
  /**
   * Analyze social media engagement with specialized model selection
   * @param {Object} engagementData - Engagement data
   * @returns {Promise<Object>} Engagement analysis
   */
  async analyzeSocialMediaEngagement(engagementData) {
    if (!this.options.enableSocialMediaManagement || !this.socialMediaService) {
      throw new Error("Social media management is not enabled");
    }
    
    this.logger.debug("[PersonalAssistantTentacle] Analyzing social media engagement with specialized model selection");
    
    if (this.options.specializedModelSelection && this.modelOrchestrationSystem) {
      try {
        // Use specialized model for engagement analysis
        const model = await this.modelOrchestrationSystem.getModelForTask({
          modelType: ModelType.TEXT,
          taskType: 'engagement_analysis',
          selectionStrategy: ModelSelectionStrategy.SPECIALIZED
        });
        
        if (model) {
          // Perform engagement analysis
          const analysis = await model.execute({
            operation: 'analyze_engagement',
            engagementData
          });
          
          // Record model performance
          await this.modelOrchestrationSystem.recordModelPerformance(model.modelId, {
            taskType: 'engagement_analysis',
            accuracy: analysis.confidenceScore || 0.9,
            latency: analysis.analysisTime || 400
          });
          
          return analysis;
        }
      } catch (error) {
        this.logger.warn("[PersonalAssistantTentacle] Failed to use specialized model for engagement analysis", { error: error.message });
      }
    }
    
    // Standard engagement analysis
    return this.socialMediaService.analyzeEngagement(engagementData);
  }
  
  /**
   * Shutdown tentacle and clean up resources
   * @returns {Promise<boolean>} Success status
   */
  async shutdown() {
    this.logger.info("[PersonalAssistantTentacle] Shutting down Personal Assistant Tentacle");
    
    // Close collaboration sessions
    if (this.modelOrchestrationSystem) {
      if (this.taskCollaborationSession) {
        await this.modelOrchestrationSystem.closeCollaborationSession(this.taskCollaborationSession);
      }
      
      if (this.communicationCollaborationSession) {
        await this.modelOrchestrationSystem.closeCollaborationSession(this.communicationCollaborationSession);
      }
      
      if (this.brandingCollaborationSession) {
        await this.modelOrchestrationSystem.closeCollaborationSession(this.brandingCollaborationSession);
      }
      
      if (this.socialMediaCollaborationSession) {
        await this.modelOrchestrationSystem.closeCollaborationSession(this.socialMediaCollaborationSession);
      }
      
      if (this.proactiveCollaborationSession) {
        await this.modelOrchestrationSystem.closeCollaborationSession(this.proactiveCollaborationSession);
      }
    }
    
    // Shutdown components
    await Promise.all([
      this.taskManagement.shutdown(),
      this.calendarEngine.shutdown(),
      this.contactManagement.shutdown(),
      this.communicationAssistant.shutdown(),
      this.informationSystem.shutdown(),
      this.lifestyleAssistant.shutdown(),
      this.personalBranding?.shutdown(),
      this.socialMediaManagement?.shutdown(),
      this.proactiveIntelligence?.shutdown(),
      this.modelIntegrationService.shutdown()
    ]);
    
    this.logger.info("[PersonalAssistantTentacle] Personal Assistant Tentacle shutdown complete");
    return super.shutdown();
  }
}

module.exports = PersonalAssistantTentacle;
