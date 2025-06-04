/**
 * @fileoverview Enhanced Avatar Tentacle with advanced multi-LLM orchestration
 * Provides comprehensive avatar behavior and emotional intelligence capabilities
 * with superintelligent abilities through collaborative model orchestration
 * 
 * @module tentacles/avatar/AvatarTentacle
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');

// Import advanced orchestration components
const { ModelType, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');

// Import behavior components
const BehaviorSystemManager = require('./behavior/BehaviorSystemManager');
const BehaviorRuleEngine = require('./behavior/BehaviorRuleEngine');
const BehaviorPersistenceManager = require('./behavior/BehaviorPersistenceManager');
const BehaviorIntegrationManager = require('./behavior/BehaviorIntegrationManager');
const ConversationStyleManager = require('./behavior/ConversationStyleManager');
const NonverbalBehaviorManager = require('./behavior/NonverbalBehaviorManager');
const SocialNormsManager = require('./behavior/SocialNormsManager');

// Import emotional components
const EmotionalIntelligenceManager = require('./emotional/EmotionalIntelligenceManager');
const EmotionRecognitionEngine = require('./emotional/EmotionRecognitionEngine');
const EmotionalContextAnalyzer = require('./emotional/EmotionalContextAnalyzer');
const EmotionalMemorySystem = require('./emotional/EmotionalMemorySystem');
const EmotionalLearningModule = require('./emotional/EmotionalLearningModule');
const EmpatheticResponseGenerator = require('./emotional/EmpatheticResponseGenerator');

/**
 * Enhanced Avatar Tentacle with superintelligent capabilities
 * Provides comprehensive avatar behavior and emotional intelligence
 * with collaborative model orchestration and specialized model selection
 * @extends EventEmitter
 */
class AvatarTentacle extends EventEmitter {
  /**
   * Create a new enhanced Avatar Tentacle with advanced orchestration
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.storage = dependencies.storage;
    this.config = dependencies.config;
    this.modelOrchestrator = dependencies.modelOrchestrationSystem || dependencies.modelOrchestrator;
    this.apiServiceIntegration = dependencies.apiServiceIntegration;
    this.resourceManager = dependencies.resourceManager;
    this.securityFramework = dependencies.securityFramework;
    
    // Advanced orchestration options
    this.advancedOptions = {
      collaborativeIntelligence: options.collaborativeIntelligence !== false,
      specializedModelSelection: options.specializedModelSelection !== false,
      adaptiveResourceAllocation: options.adaptiveResourceAllocation !== false,
      selfEvaluation: options.selfEvaluation !== false,
      offlineCapability: options.offlineCapability || 'full' // 'limited', 'standard', 'full'
    };
    
    // Validate required dependencies
    if (!this.storage || !this.modelOrchestrator || !this.resourceManager || !this.securityFramework) {
      throw new Error("Required dependencies missing for AvatarTentacle");
    }
    
    this.logger.info("[AvatarTentacle] Initializing Avatar Tentacle with advanced orchestration");
    
    // Initialize advanced orchestration
    this._initializeAdvancedOrchestration();
    
    // Initialize components with enhanced integration
    this._initializeComponents();
    
    // Set up event forwarding from components
    this._setupEventForwarding();
    
    // Active user sessions
    this.activeSessions = new Map();
    
    // Initialize collaboration sessions
    this._initializeCollaborationSessions();
    
    this.logger.info("[AvatarTentacle] Avatar Tentacle initialized with superintelligent capabilities");
  }
  
  /**
   * Initialize advanced orchestration
   * @private
   */
  _initializeAdvancedOrchestration() {
    this.logger.debug("[AvatarTentacle] Initializing advanced orchestration");
    
    // Configure enhanced tentacle integration
    this.enhancedIntegration = new EnhancedTentacleIntegration(
      {
        collaborativeIntelligence: this.advancedOptions.collaborativeIntelligence,
        specializedModelSelection: this.advancedOptions.specializedModelSelection,
        adaptiveResourceAllocation: this.advancedOptions.adaptiveResourceAllocation,
        selfEvaluation: this.advancedOptions.selfEvaluation,
        offlineCapability: this.advancedOptions.offlineCapability
      },
      {
        logger: this.logger,
        modelOrchestrationSystem: this.modelOrchestrator
      }
    );
  }
  
  /**
   * Initialize components with enhanced integration
   * @private
   */
  _initializeComponents() {
    this.logger.debug("[AvatarTentacle] Initializing components with enhanced integration");
    
    // Initialize behavior components
    this.behaviorSystemManager = new BehaviorSystemManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.behaviorRuleEngine = new BehaviorRuleEngine({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.behaviorPersistenceManager = new BehaviorPersistenceManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.behaviorIntegrationManager = new BehaviorIntegrationManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.conversationStyleManager = new ConversationStyleManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.nonverbalBehaviorManager = new NonverbalBehaviorManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.socialNormsManager = new SocialNormsManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    // Initialize emotional components
    this.emotionalIntelligenceManager = new EmotionalIntelligenceManager({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.emotionRecognitionEngine = new EmotionRecognitionEngine({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.emotionalContextAnalyzer = new EmotionalContextAnalyzer({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.emotionalMemorySystem = new EmotionalMemorySystem({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.emotionalLearningModule = new EmotionalLearningModule({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.empatheticResponseGenerator = new EmpatheticResponseGenerator({
      logger: this.logger,
      storage: this.storage,
      config: this.config,
      enhancedIntegration: this.enhancedIntegration
    });
  }
  
  /**
   * Initialize collaboration sessions for advanced orchestration
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCollaborationSessions() {
    if (!this.advancedOptions.collaborativeIntelligence) {
      this.logger.info("[AvatarTentacle] Collaborative intelligence disabled, skipping collaboration sessions");
      return;
    }
    
    this.logger.debug("[AvatarTentacle] Initializing collaboration sessions");
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "behavior_generation",
          modelType: ModelType.TEXT,
          taskType: "behavior_generation",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: true
        },
        {
          name: "conversation_style",
          modelType: ModelType.TEXT,
          taskType: "conversation_style",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: false
        },
        {
          name: "nonverbal_behavior",
          modelType: ModelType.MULTIMODAL,
          taskType: "nonverbal_behavior",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        },
        {
          name: "emotion_recognition",
          modelType: ModelType.MULTIMODAL,
          taskType: "emotion_recognition",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        },
        {
          name: "empathetic_response",
          modelType: ModelType.TEXT,
          taskType: "empathetic_response",
          collaborationStrategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          offlineOnly: true
        },
        {
          name: "social_norms",
          modelType: ModelType.TEXT,
          taskType: "social_norms",
          collaborationStrategy: CollaborationStrategy.CONSENSUS,
          offlineOnly: true
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("avatar", collaborationConfigs);
      
      this.logger.info("[AvatarTentacle] Collaboration sessions initialized successfully");
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Failed to initialize collaboration sessions: ${error.message}`);
    }
  }
  
  /**
   * Set up event forwarding from components
   * @private
   */
  _setupEventForwarding() {
    // Forward events from behavior components
    this.behaviorSystemManager.on("behavior.updated", (data) => {
      this.emit("avatar.behavior.updated", data);
    });
    
    this.conversationStyleManager.on("style.changed", (data) => {
      this.emit("avatar.conversation.style.changed", data);
    });
    
    this.nonverbalBehaviorManager.on("nonverbal.generated", (data) => {
      this.emit("avatar.nonverbal.generated", data);
    });
    
    // Forward events from emotional components
    this.emotionRecognitionEngine.on("emotion.recognized", (data) => {
      this.emit("avatar.emotion.recognized", data);
    });
    
    this.empatheticResponseGenerator.on("response.generated", (data) => {
      this.emit("avatar.empathetic.response.generated", data);
    });
  }
  
  /**
   * Initialize the tentacle for a user
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(userProfile) {
    this.logger.info(`[AvatarTentacle] Initializing for user: ${userProfile.userId}`);
    
    try {
      // Validate user access and permissions
      await this._validateUserAccess(userProfile);
      
      // Initialize all components
      await this.behaviorSystemManager.initialize(userProfile);
      await this.behaviorRuleEngine.initialize(userProfile);
      await this.behaviorPersistenceManager.initialize(userProfile);
      await this.behaviorIntegrationManager.initialize(userProfile);
      await this.conversationStyleManager.initialize(userProfile);
      await this.nonverbalBehaviorManager.initialize(userProfile);
      await this.socialNormsManager.initialize(userProfile);
      
      await this.emotionalIntelligenceManager.initialize(userProfile);
      await this.emotionRecognitionEngine.initialize(userProfile);
      await this.emotionalContextAnalyzer.initialize(userProfile);
      await this.emotionalMemorySystem.initialize(userProfile);
      await this.emotionalLearningModule.initialize(userProfile);
      await this.empatheticResponseGenerator.initialize(userProfile);
      
      // Create or retrieve user session
      const sessionId = uuidv4();
      const session = {
        sessionId,
        userId: userProfile.userId,
        startTime: new Date(),
        tier: userProfile.tier,
        lastActivity: new Date()
      };
      
      this.activeSessions.set(sessionId, session);
      
      this.logger.info(`[AvatarTentacle] Initialized successfully for user: ${userProfile.userId}`);
      this.emit("tentacle.initialized", { userId: userProfile.userId, sessionId });
      
      return {
        success: true,
        sessionId,
        message: "Avatar Tentacle initialized successfully",
        capabilities: {
          collaborativeIntelligence: this.advancedOptions.collaborativeIntelligence,
          specializedModelSelection: this.advancedOptions.specializedModelSelection,
          adaptiveResourceAllocation: this.advancedOptions.adaptiveResourceAllocation,
          selfEvaluation: this.advancedOptions.selfEvaluation,
          offlineCapability: this.advancedOptions.offlineCapability
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate avatar behavior with collaborative intelligence
   * @param {string} sessionId - Session ID
   * @param {Object} options - Behavior generation options
   * @returns {Promise<Object>} Generated behavior
   */
  async generateBehavior(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Generating behavior for user: ${session.userId}`);
    
    try {
      // Determine if we should use collaborative intelligence
      if (this.advancedOptions.collaborativeIntelligence && !options.disableCollaborative) {
        return await this._generateBehaviorCollaboratively(session, options);
      } else {
        return await this.behaviorSystemManager.generateBehavior(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Behavior generation failed: ${error.message}`);
      
      // If collaborative processing failed, try standard processing as fallback
      if (error.message.includes("collaborative") && this.advancedOptions.collaborativeIntelligence) {
        this.logger.info(`[AvatarTentacle] Falling back to standard behavior generation for user: ${session.userId}`);
        try {
          return await this.behaviorSystemManager.generateBehavior(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback behavior generation also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Generate behavior using collaborative intelligence
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Behavior generation options
   * @returns {Promise<Object>} Generated behavior
   */
  async _generateBehaviorCollaboratively(session, options) {
    this.logger.debug(`[AvatarTentacle] Using collaborative intelligence for behavior generation: ${session.userId}`);
    
    try {
      // Execute collaborative task for behavior generation
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        "behavior_generation",
        {
          userId: session.userId,
          context: options.context,
          behaviorType: options.behaviorType,
          constraints: options.constraints,
          userPreferences: options.userPreferences
        },
        {
          priority: options.priority || "normal",
          timeout: options.timeout || 30000
        }
      );
      
      // Return enhanced behavior
      return {
        ...result.result,
        collaborativeExecution: {
          strategy: result.strategy,
          modelCount: result.modelResults?.length || 0
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Collaborative behavior generation failed: ${error.message}`);
      throw new Error(`Collaborative behavior generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate conversation style with specialized model selection
   * @param {string} sessionId - Session ID
   * @param {Object} options - Conversation style options
   * @returns {Promise<Object>} Generated conversation style
   */
  async generateConversationStyle(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Generating conversation style for user: ${session.userId}`);
    
    try {
      // Determine if we should use specialized model selection
      if (this.advancedOptions.specializedModelSelection && !options.disableSpecialized) {
        return await this._generateConversationStyleWithSpecializedModel(session, options);
      } else {
        return await this.conversationStyleManager.generateStyle(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Conversation style generation failed: ${error.message}`);
      
      // If specialized processing failed, try standard processing as fallback
      if (error.message.includes("specialized") && this.advancedOptions.specializedModelSelection) {
        this.logger.info(`[AvatarTentacle] Falling back to standard conversation style generation for user: ${session.userId}`);
        try {
          return await this.conversationStyleManager.generateStyle(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback conversation style generation also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Generate conversation style using specialized model selection
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Conversation style options
   * @returns {Promise<Object>} Generated conversation style
   */
  async _generateConversationStyleWithSpecializedModel(session, options) {
    this.logger.debug(`[AvatarTentacle] Using specialized model for conversation style generation: ${session.userId}`);
    
    try {
      // Select specialized model for conversation style generation
      const model = await this.enhancedIntegration.selectSpecializedModel({
        taskType: "conversation_style",
        requirements: {
          styleType: options.styleType,
          formality: options.formality,
          emotionalTone: options.emotionalTone
        }
      });
      
      // Use the selected model to generate conversation style
      const result = await model.execute({
        task: "generate_conversation_style",
        userId: session.userId,
        options
      });
      
      return {
        ...result,
        specializedModel: {
          modelId: model.modelId
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Specialized model conversation style generation failed: ${error.message}`);
      throw new Error(`Specialized model conversation style generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate nonverbal behavior with cross-modal fusion
   * @param {string} sessionId - Session ID
   * @param {Object} options - Nonverbal behavior options
   * @returns {Promise<Object>} Generated nonverbal behavior
   */
  async generateNonverbalBehavior(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Generating nonverbal behavior for user: ${session.userId}`);
    
    try {
      // Determine if we should use cross-modal fusion
      if (this.advancedOptions.collaborativeIntelligence && !options.disableCrossModal) {
        return await this._generateNonverbalBehaviorWithCrossModalFusion(session, options);
      } else {
        return await this.nonverbalBehaviorManager.generateBehavior(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Nonverbal behavior generation failed: ${error.message}`);
      
      // If cross-modal processing failed, try standard processing as fallback
      if (error.message.includes("cross-modal") && this.advancedOptions.collaborativeIntelligence) {
        this.logger.info(`[AvatarTentacle] Falling back to standard nonverbal behavior generation for user: ${session.userId}`);
        try {
          return await this.nonverbalBehaviorManager.generateBehavior(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback nonverbal behavior generation also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Generate nonverbal behavior using cross-modal fusion
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Nonverbal behavior options
   * @returns {Promise<Object>} Generated nonverbal behavior
   */
  async _generateNonverbalBehaviorWithCrossModalFusion(session, options) {
    this.logger.debug(`[AvatarTentacle] Using cross-modal fusion for nonverbal behavior generation: ${session.userId}`);
    
    try {
      // Execute cross-modal task
      const result = await this.enhancedIntegration.executeCrossModalTask(
        {
          userId: session.userId,
          context: options.context,
          textContent: options.textContent,
          emotionalState: options.emotionalState,
          behaviorType: options.behaviorType
        },
        ["text", "image", "video"],
        {
          taskType: "nonverbal_behavior",
          priority: options.priority || "normal",
          timeout: options.timeout || 30000
        }
      );
      
      return {
        ...result,
        crossModalFusion: true
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Cross-modal nonverbal behavior generation failed: ${error.message}`);
      throw new Error(`Cross-modal nonverbal behavior generation failed: ${error.message}`);
    }
  }
  
  /**
   * Recognize emotions with collaborative intelligence
   * @param {string} sessionId - Session ID
   * @param {Object} options - Emotion recognition options
   * @returns {Promise<Object>} Recognized emotions
   */
  async recognizeEmotions(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Recognizing emotions for user: ${session.userId}`);
    
    try {
      // Determine if we should use collaborative intelligence
      if (this.advancedOptions.collaborativeIntelligence && !options.disableCollaborative) {
        return await this._recognizeEmotionsCollaboratively(session, options);
      } else {
        return await this.emotionRecognitionEngine.recognizeEmotions(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Emotion recognition failed: ${error.message}`);
      
      // If collaborative processing failed, try standard processing as fallback
      if (error.message.includes("collaborative") && this.advancedOptions.collaborativeIntelligence) {
        this.logger.info(`[AvatarTentacle] Falling back to standard emotion recognition for user: ${session.userId}`);
        try {
          return await this.emotionRecognitionEngine.recognizeEmotions(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback emotion recognition also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Recognize emotions using collaborative intelligence
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Emotion recognition options
   * @returns {Promise<Object>} Recognized emotions
   */
  async _recognizeEmotionsCollaboratively(session, options) {
    this.logger.debug(`[AvatarTentacle] Using collaborative intelligence for emotion recognition: ${session.userId}`);
    
    try {
      // Execute collaborative task for emotion recognition
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        "emotion_recognition",
        {
          userId: session.userId,
          input: options.input,
          inputType: options.inputType,
          context: options.context
        },
        {
          priority: options.priority || "high",
          timeout: options.timeout || 30000
        }
      );
      
      // Return enhanced emotions
      return {
        ...result.result,
        collaborativeExecution: {
          strategy: result.strategy,
          modelCount: result.modelResults?.length || 0
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Collaborative emotion recognition failed: ${error.message}`);
      throw new Error(`Collaborative emotion recognition failed: ${error.message}`);
    }
  }
  
  /**
   * Generate empathetic response with self-evaluation
   * @param {string} sessionId - Session ID
   * @param {Object} options - Empathetic response options
   * @returns {Promise<Object>} Generated empathetic response
   */
  async generateEmpatheticResponse(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Generating empathetic response for user: ${session.userId}`);
    
    try {
      // Determine if we should use self-evaluation
      if (this.advancedOptions.selfEvaluation && !options.disableSelfEvaluation) {
        return await this._generateEmpatheticResponseWithSelfEvaluation(session, options);
      } else {
        return await this.empatheticResponseGenerator.generateResponse(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Empathetic response generation failed: ${error.message}`);
      
      // If self-evaluation failed, try standard processing as fallback
      if (error.message.includes("self-evaluation") && this.advancedOptions.selfEvaluation) {
        this.logger.info(`[AvatarTentacle] Falling back to standard empathetic response generation for user: ${session.userId}`);
        try {
          return await this.empatheticResponseGenerator.generateResponse(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback empathetic response generation also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Generate empathetic response with self-evaluation
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Empathetic response options
   * @returns {Promise<Object>} Generated empathetic response
   */
  async _generateEmpatheticResponseWithSelfEvaluation(session, options) {
    this.logger.debug(`[AvatarTentacle] Using self-evaluation for empathetic response generation: ${session.userId}`);
    
    try {
      // Generate initial response
      const initialResponse = await this.empatheticResponseGenerator.generateResponse(options);
      
      // Perform self-evaluation
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: "empathetic_response_evaluation",
        response: initialResponse.response,
        context: options.context,
        emotionalState: options.emotionalState,
        userPreferences: options.userPreferences
      });
      
      // If evaluation score is below threshold, regenerate response
      if (evaluationResult.score < 0.8) {
        this.logger.debug(`[AvatarTentacle] Self-evaluation score below threshold (${evaluationResult.score}), regenerating response`);
        
        // Execute collaborative task for empathetic response
        const result = await this.enhancedIntegration.executeCollaborativeTask(
          "empathetic_response",
          {
            userId: session.userId,
            context: options.context,
            emotionalState: options.emotionalState,
            userPreferences: options.userPreferences,
            previousResponse: initialResponse.response,
            evaluationFeedback: evaluationResult.feedback
          },
          {
            priority: options.priority || "high",
            timeout: options.timeout || 30000
          }
        );
        
        return {
          ...result.result,
          selfEvaluation: {
            performed: true,
            initialScore: evaluationResult.score,
            feedback: evaluationResult.feedback
          },
          collaborativeExecution: {
            strategy: result.strategy,
            modelCount: result.modelResults?.length || 0
          }
        };
      } else {
        // Return initial response with evaluation results
        return {
          ...initialResponse,
          selfEvaluation: {
            performed: true,
            score: evaluationResult.score,
            feedback: evaluationResult.feedback
          }
        };
      }
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Self-evaluation empathetic response generation failed: ${error.message}`);
      throw new Error(`Self-evaluation empathetic response generation failed: ${error.message}`);
    }
  }
  
  /**
   * Apply social norms with collaborative intelligence
   * @param {string} sessionId - Session ID
   * @param {Object} options - Social norms options
   * @returns {Promise<Object>} Applied social norms
   */
  async applySocialNorms(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Applying social norms for user: ${session.userId}`);
    
    try {
      // Determine if we should use collaborative intelligence
      if (this.advancedOptions.collaborativeIntelligence && !options.disableCollaborative) {
        return await this._applySocialNormsCollaboratively(session, options);
      } else {
        return await this.socialNormsManager.applySocialNorms(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Social norms application failed: ${error.message}`);
      
      // If collaborative processing failed, try standard processing as fallback
      if (error.message.includes("collaborative") && this.advancedOptions.collaborativeIntelligence) {
        this.logger.info(`[AvatarTentacle] Falling back to standard social norms application for user: ${session.userId}`);
        try {
          return await this.socialNormsManager.applySocialNorms(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback social norms application also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Apply social norms using collaborative intelligence
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Social norms options
   * @returns {Promise<Object>} Applied social norms
   */
  async _applySocialNormsCollaboratively(session, options) {
    this.logger.debug(`[AvatarTentacle] Using collaborative intelligence for social norms application: ${session.userId}`);
    
    try {
      // Execute collaborative task for social norms
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        "social_norms",
        {
          userId: session.userId,
          content: options.content,
          context: options.context,
          culturalContext: options.culturalContext,
          socialContext: options.socialContext
        },
        {
          priority: options.priority || "normal",
          timeout: options.timeout || 30000
        }
      );
      
      // Return enhanced social norms
      return {
        ...result.result,
        collaborativeExecution: {
          strategy: result.strategy,
          modelCount: result.modelResults?.length || 0
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Collaborative social norms application failed: ${error.message}`);
      throw new Error(`Collaborative social norms application failed: ${error.message}`);
    }
  }
  
  /**
   * Update emotional memory with adaptive resource allocation
   * @param {string} sessionId - Session ID
   * @param {Object} options - Emotional memory options
   * @returns {Promise<Object>} Updated emotional memory
   */
  async updateEmotionalMemory(sessionId, options) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Updating emotional memory for user: ${session.userId}`);
    
    try {
      // Determine if we should use adaptive resource allocation
      if (this.advancedOptions.adaptiveResourceAllocation && !options.disableAdaptiveAllocation) {
        return await this._updateEmotionalMemoryWithAdaptiveAllocation(session, options);
      } else {
        return await this.emotionalMemorySystem.updateMemory(options);
      }
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Emotional memory update failed: ${error.message}`);
      
      // If adaptive allocation failed, try standard processing as fallback
      if (error.message.includes("adaptive") && this.advancedOptions.adaptiveResourceAllocation) {
        this.logger.info(`[AvatarTentacle] Falling back to standard emotional memory update for user: ${session.userId}`);
        try {
          return await this.emotionalMemorySystem.updateMemory(options);
        } catch (fallbackError) {
          this.logger.error(`[AvatarTentacle] Fallback emotional memory update also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Update emotional memory with adaptive resource allocation
   * @private
   * @param {Object} session - User session
   * @param {Object} options - Emotional memory options
   * @returns {Promise<Object>} Updated emotional memory
   */
  async _updateEmotionalMemoryWithAdaptiveAllocation(session, options) {
    this.logger.debug(`[AvatarTentacle] Using adaptive resource allocation for emotional memory update: ${session.userId}`);
    
    try {
      // Get resource allocation strategy
      const allocationStrategy = await this.enhancedIntegration.getAdaptiveResourceAllocation({
        taskType: "emotional_memory_update",
        importance: options.importance || "medium",
        complexity: options.complexity || "medium",
        userTier: session.tier
      });
      
      // Apply resource allocation strategy
      const enhancedOptions = {
        ...options,
        resourceAllocation: allocationStrategy
      };
      
      // Update emotional memory with enhanced options
      const result = await this.emotionalMemorySystem.updateMemory(enhancedOptions);
      
      return {
        ...result,
        adaptiveAllocation: {
          applied: true,
          strategy: allocationStrategy
        }
      };
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Adaptive resource allocation emotional memory update failed: ${error.message}`);
      throw new Error(`Adaptive resource allocation emotional memory update failed: ${error.message}`);
    }
  }
  
  /**
   * End user session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async endSession(sessionId) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[AvatarTentacle] Ending session for user: ${session.userId}`);
    
    try {
      // End session
      this.activeSessions.delete(sessionId);
      
      this.emit("session.ended", { userId: session.userId, sessionId });
      return true;
      
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Session end failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate user access and permissions
   * @private
   * @param {Object} userProfile - User profile
   * @returns {Promise<boolean>} Validation result
   */
  async _validateUserAccess(userProfile) {
    // Check if user has access to Avatar Tentacle
    const hasAccess = await this.securityFramework.checkTentacleAccess(
      userProfile.userId,
      "AVATAR"
    );
    
    if (!hasAccess) {
      throw new Error("User does not have access to Avatar Tentacle.");
    }
    
    return true;
  }
  
  /**
   * Validate session
   * @private
   * @param {string} sessionId - Session ID
   * @throws {Error} If session is invalid
   */
  _validateSession(sessionId) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error("Invalid or expired session. Please initialize the tentacle first.");
    }
    
    // Update last activity timestamp
    const session = this.activeSessions.get(sessionId);
    session.lastActivity = new Date();
  }
  
  /**
   * Clean up resources before shutdown
   * @returns {Promise<boolean>} Success status
   */
  async cleanup() {
    this.logger.info("[AvatarTentacle] Cleaning up resources");
    
    try {
      // Clean up enhanced integration
      if (this.enhancedIntegration) {
        await this.enhancedIntegration.cleanup();
      }
      
      // End all active sessions
      for (const [sessionId, session] of this.activeSessions.entries()) {
        this.logger.debug(`[AvatarTentacle] Ending session for user: ${session.userId} during cleanup`);
        this.activeSessions.delete(sessionId);
        this.emit("session.ended", { userId: session.userId, sessionId, reason: "cleanup" });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`[AvatarTentacle] Cleanup failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = AvatarTentacle;
