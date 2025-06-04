/**
 * @fileoverview LearningIntegrationManager for the Learning from Demonstration system.
 * Coordinates all components and provides a unified API for the Learning from Demonstration system.
 * Enhanced version with advanced multi-LLM orchestration capabilities for superintelligent learning.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require("../common/events/EventBus");
const Logger = require("../common/utils/Logger");
const Configuration = require("../common/utils/Configuration");
const { LearningError, ValidationError, OperationError } = require("../common/utils/ErrorHandler");
const Demonstration = require("../common/models/Demonstration");
const Action = require("../common/models/Action");
const Intent = require("../common/models/Intent");
const Procedure = require("../common/models/Procedure");
const EnhancedTentacleIntegration = require("../../common/EnhancedTentacleIntegration");
const { ModelType, CollaborationStrategy } = require("../../../core/miif/models/ModelEnums");

// Import core components
const DemonstrationCaptureManager = require("../capture/DemonstrationCaptureManager");
const ActionRecognitionEngine = require("../recognition/ActionRecognitionEngine");
const IntentInferenceSystem = require("../recognition/IntentInferenceSystem");
const ProcedureGenerationEngine = require("../generation/ProcedureGenerationEngine");
const ProcedureOptimizationSystem = require("../generation/ProcedureOptimizationSystem");
const ProcedurePersistenceManager = require("../persistence/ProcedurePersistenceManager");

/**
 * Coordinates all components and provides a unified API for the Learning from Demonstration system.
 * Enhanced version with advanced multi-LLM orchestration capabilities for superintelligent learning.
 */
class LearningIntegrationManager {
  /**
   * Trigger types for learning
   * @enum {string}
   */
  static TRIGGER_TYPES = {
    MANUAL: "manual",
    VOICE: "voice",
    KEYBOARD: "keyboard",
    PATTERN: "pattern",
    SCHEDULED: "scheduled",
    API: "api"
  };

  /**
   * Learning modes
   * @enum {string}
   */
  static LEARNING_MODES = {
    ACTIVE: "active",
    PASSIVE: "passive",
    HYBRID: "hybrid"
  };

  /**
   * Creates a new LearningIntegrationManager instance with advanced multi-LLM orchestration.
   * @param {Object} options - Manager options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   * @param {DemonstrationCaptureManager} [options.captureManager] - Demonstration capture manager
   * @param {ActionRecognitionEngine} [options.recognitionEngine] - Action recognition engine
   * @param {IntentInferenceSystem} [options.intentInferenceSystem] - Intent inference system
   * @param {ProcedureGenerationEngine} [options.generationEngine] - Procedure generation engine
   * @param {ProcedureOptimizationSystem} [options.optimizationSystem] - Procedure optimization system
   * @param {ProcedurePersistenceManager} [options.persistenceManager] - Procedure persistence manager
   * @param {Object} [options.modelOrchestrationSystem] - Model orchestration system for advanced LLM capabilities
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger("LearningIntegrationManager");
    this.config = options.config || new Configuration(LearningIntegrationManager.defaultConfig());
    
    // Store model orchestrator reference
    this.modelOrchestrator = options.modelOrchestrationSystem || options.modelOrchestrator;
    
    // Validate required dependencies
    if (!this.modelOrchestrator) {
      this.logger.warn("Model orchestrator not provided, advanced multi-LLM capabilities will be limited");
    }
    
    // Initialize enhanced integration
    this._initializeEnhancedIntegration(options);
    
    // Initialize components with enhanced integration
    this.captureManager = options.captureManager || new DemonstrationCaptureManager({ 
      eventBus: this.eventBus,
      logger: this.logger.createChild("CaptureManager"),
      config: this.config.scope("capture"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.recognitionEngine = options.recognitionEngine || new ActionRecognitionEngine({
      eventBus: this.eventBus,
      logger: this.logger.createChild("RecognitionEngine"),
      config: this.config.scope("recognition"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.intentInferenceSystem = options.intentInferenceSystem || new IntentInferenceSystem({
      eventBus: this.eventBus,
      logger: this.logger.createChild("IntentInferenceSystem"),
      config: this.config.scope("inference"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.generationEngine = options.generationEngine || new ProcedureGenerationEngine({
      eventBus: this.eventBus,
      logger: this.logger.createChild("GenerationEngine"),
      config: this.config.scope("generation"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.optimizationSystem = options.optimizationSystem || new ProcedureOptimizationSystem({
      eventBus: this.eventBus,
      logger: this.logger.createChild("OptimizationSystem"),
      config: this.config.scope("optimization"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    this.persistenceManager = options.persistenceManager || new ProcedurePersistenceManager({
      eventBus: this.eventBus,
      logger: this.logger.createChild("PersistenceManager"),
      config: this.config.scope("persistence"),
      enhancedIntegration: this.enhancedIntegration
    });
    
    // Initialize state
    this.isInitialized = false;
    this.isLearning = false;
    this.currentDemonstration = null;
    this.currentSession = null;
    this.registeredTriggers = new Map();
    this.integrations = new Map();
    
    // Advanced orchestration options
    this.advancedOptions = {
      collaborativeIntelligence: this.config.get("integration.advanced.collaborativeIntelligence") !== false,
      specializedModelSelection: this.config.get("integration.advanced.specializedModelSelection") !== false,
      adaptiveResourceAllocation: this.config.get("integration.advanced.adaptiveResourceAllocation") !== false,
      selfEvaluation: this.config.get("integration.advanced.selfEvaluation") !== false,
      offlineCapability: this.config.get("integration.advanced.offlineCapability") || 'full' // 'limited', 'standard', 'full'
    };
    
    // Performance metrics for self-evaluation
    this.metrics = {
      learningTime: [],
      recognitionAccuracy: [],
      intentInferenceConfidence: [],
      procedureGenerationQuality: [],
      modelUsage: new Map()
    };
    
    // Setup event listeners
    this._setupEventListeners();
    
    this.logger.info("LearningIntegrationManager created with advanced multi-LLM orchestration capabilities");
  }

  /**
   * Initialize enhanced integration for advanced multi-LLM orchestration
   * @param {Object} options - Options passed to the constructor
   * @private
   */
  _initializeEnhancedIntegration(options) {
    this.logger.debug('Initializing enhanced integration for Learning Integration Manager');
    
    // Configure enhanced tentacle integration
    this.enhancedIntegration = new EnhancedTentacleIntegration(
      {
        collaborativeIntelligence: this.config.get("integration.advanced.collaborativeIntelligence") !== false,
        specializedModelSelection: this.config.get("integration.advanced.specializedModelSelection") !== false,
        adaptiveResourceAllocation: this.config.get("integration.advanced.adaptiveResourceAllocation") !== false,
        selfEvaluation: this.config.get("integration.advanced.selfEvaluation") !== false,
        offlineCapability: this.config.get("integration.advanced.offlineCapability") || 'full'
      },
      {
        logger: this.logger,
        modelOrchestrationSystem: this.modelOrchestrator
      }
    );
  }

  /**
   * Initialize collaboration sessions for advanced orchestration
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCollaborationSessions() {
    if (!this.advancedOptions.collaborativeIntelligence || !this.modelOrchestrator) {
      this.logger.info('Collaborative intelligence disabled or model orchestrator not available, skipping collaboration sessions');
      return;
    }
    
    this.logger.debug('Initializing collaboration sessions for Learning Integration Manager');
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "action_recognition",
          modelType: ModelType.MULTIMODAL,
          taskType: "action_recognition",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        },
        {
          name: "intent_inference",
          modelType: ModelType.TEXT,
          taskType: "intent_inference",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: true
        },
        {
          name: "procedure_generation",
          modelType: ModelType.TEXT,
          taskType: "procedure_generation",
          collaborationStrategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          offlineOnly: true
        },
        {
          name: "procedure_optimization",
          modelType: ModelType.TEXT,
          taskType: "procedure_optimization",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: true
        },
        {
          name: "demonstration_analysis",
          modelType: ModelType.MULTIMODAL,
          taskType: "demonstration_analysis",
          collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
          offlineOnly: false
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("learning", collaborationConfigs);
      
      this.logger.info('Collaboration sessions initialized successfully for Learning Integration Manager');
      
    } catch (error) {
      this.logger.error(`Failed to initialize collaboration sessions: ${error.message}`);
      // Continue without collaborative intelligence
      this.advancedOptions.collaborativeIntelligence = false;
    }
  }

  /**
   * Default configuration for the LearningIntegrationManager.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      integration: {
        autoStart: false,
        defaultLearningMode: LearningIntegrationManager.LEARNING_MODES.ACTIVE,
        enabledTriggers: [
          LearningIntegrationManager.TRIGGER_TYPES.MANUAL,
          LearningIntegrationManager.TRIGGER_TYPES.VOICE,
          LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD
        ],
        triggers: {
          voice: {
            enabled: true,
            commands: ["learn this", "watch and learn", "start recording", "stop recording"]
          },
          keyboard: {
            enabled: true,
            shortcut: "Ctrl+Alt+R"
          },
          pattern: {
            enabled: false,
            minRepetitions: 3,
            timeWindow: 3600000 // 1 hour
          },
          scheduled: {
            enabled: false,
            schedule: []
          }
        },
        notifications: {
          enabled: true,
          showStartNotification: true,
          showStopNotification: true,
          showProgressNotification: false
        },
        avatar: {
          enabled: true,
          showFeedback: true,
          expressEmotions: true
        },
        mcp: {
          enabled: true,
          publishContext: true,
          contextUpdateInterval: 5000
        },
        security: {
          requireConfirmation: true,
          sensitiveDataProtection: true,
          allowedApplications: ["*"]
        },
        offline: {
          enabled: true,
          syncWhenOnline: true
        },
        advanced: {
          collaborativeIntelligence: true,
          specializedModelSelection: true,
          adaptiveResourceAllocation: true,
          selfEvaluation: true,
          offlineCapability: 'full',
          modelPreferences: {
            actionRecognition: ["MobileViT", "CLIP", "GoogleVision"],
            intentInference: ["Llama3_70B", "Mixtral8x22B", "Gemma2527B"],
            procedureGeneration: ["Llama3_70B", "Mixtral8x22B", "DeepSeekV3"],
            procedureOptimization: ["Llama3_70B", "Mixtral8x22B", "MistralLarge"]
          },
          confidenceThresholds: {
            actionRecognition: 0.85,
            intentInference: 0.90,
            procedureGeneration: 0.85,
            procedureOptimization: 0.90
          }
        }
      },
      capture: {
        // Capture-specific configuration passed to DemonstrationCaptureManager
      },
      recognition: {
        // Recognition-specific configuration passed to ActionRecognitionEngine
      },
      inference: {
        // Inference-specific configuration passed to IntentInferenceSystem
      },
      generation: {
        // Generation-specific configuration passed to ProcedureGenerationEngine
      },
      optimization: {
        // Optimization-specific configuration passed to ProcedureOptimizationSystem
      },
      persistence: {
        // Persistence-specific configuration passed to ProcedurePersistenceManager
      }
    };
  }

  /**
   * Initializes the Learning from Demonstration system with advanced multi-LLM orchestration.
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn("LearningIntegrationManager is already initialized");
      return;
    }
    
    try {
      this.logger.info("Initializing LearningIntegrationManager with advanced multi-LLM orchestration");
      
      // Initialize enhanced integration
      await this.enhancedIntegration.initialize();
      
      // Initialize collaboration sessions for advanced orchestration
      await this._initializeCollaborationSessions();
      
      // Initialize all components
      await this._initializeComponents();
      
      // Register default triggers
      this._registerDefaultTriggers();
      
      // Setup integrations with other Aideon systems
      await this._setupIntegrations();
      
      this.isInitialized = true;
      this.eventBus.emit("learning:initialized", {
        advancedCapabilities: {
          collaborativeIntelligence: this.advancedOptions.collaborativeIntelligence,
          specializedModelSelection: this.advancedOptions.specializedModelSelection,
          adaptiveResourceAllocation: this.advancedOptions.adaptiveResourceAllocation,
          selfEvaluation: this.advancedOptions.selfEvaluation,
          offlineCapability: this.advancedOptions.offlineCapability
        }
      });
      
      this.logger.info("LearningIntegrationManager initialized successfully with advanced multi-LLM orchestration");
    } catch (error) {
      this.logger.error("Failed to initialize LearningIntegrationManager", error);
      throw new LearningError("Failed to initialize LearningIntegrationManager", error);
    }
  }

  /**
   * Initializes all components with enhanced integration.
   * @private
   * @returns {Promise<void>} Promise that resolves when all components are initialized
   */
  async _initializeComponents() {
    this.logger.debug("Initializing components with enhanced integration");
    
    try {
      // Initialize components in parallel for efficiency
      await Promise.all([
        this.captureManager.initialize(),
        this.recognitionEngine.initialize(),
        this.intentInferenceSystem.initialize(),
        this.generationEngine.initialize(),
        this.optimizationSystem.initialize(),
        this.persistenceManager.initialize()
      ]);
      
      this.logger.debug("All components initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize components", error);
      throw new LearningError("Failed to initialize components", error);
    }
  }

  /**
   * Starts learning from demonstration with collaborative intelligence.
   * @param {Object} [options={}] - Learning options
   * @param {string} [options.triggerType=MANUAL] - Type of trigger that initiated learning
   * @param {string} [options.mode] - Learning mode to use
   * @param {Object} [options.metadata={}] - Additional metadata for the demonstration
   * @returns {Promise<Object>} Promise resolving to the demonstration session info
   */
  async startLearning(options = {}) {
    if (!this.isInitialized) {
      throw new OperationError("LearningIntegrationManager is not initialized");
    }
    
    if (this.isLearning) {
      this.logger.warn("Learning is already in progress");
      return this.currentSession;
    }
    
    try {
      const triggerType = options.triggerType || LearningIntegrationManager.TRIGGER_TYPES.MANUAL;
      const mode = options.mode || this.config.get("integration.defaultLearningMode");
      const metadata = options.metadata || {};
      
      this.logger.info(`Starting learning from demonstration with collaborative intelligence`, { triggerType, mode });
      
      // Check if trigger is enabled
      if (!this._isTriggerEnabled(triggerType)) {
        throw new OperationError(`Trigger type ${triggerType} is not enabled`);
      }
      
      // Check security constraints
      await this._checkSecurityConstraints(triggerType);
      
      // Use collaborative intelligence to enhance learning setup if available
      let enhancedMetadata = metadata;
      let enhancedMode = mode;
      
      if (this.advancedOptions.collaborativeIntelligence) {
        try {
          const enhancementResult = await this.enhancedIntegration.executeCollaborativeTask(
            "demonstration_analysis",
            {
              task: "setup_learning",
              triggerType,
              mode,
              metadata,
              context: await this._getCurrentContext()
            }
          );
          
          if (enhancementResult && enhancementResult.enhancedMetadata) {
            enhancedMetadata = {
              ...metadata,
              ...enhancementResult.enhancedMetadata
            };
            
            this.logger.debug("Enhanced metadata with collaborative intelligence", enhancedMetadata);
          }
          
          if (enhancementResult && enhancementResult.suggestedMode && 
              Object.values(LearningIntegrationManager.LEARNING_MODES).includes(enhancementResult.suggestedMode)) {
            enhancedMode = enhancementResult.suggestedMode;
            this.logger.debug(`Enhanced mode with collaborative intelligence: ${enhancedMode}`);
          }
        } catch (enhancementError) {
          this.logger.warn("Failed to enhance learning setup with collaborative intelligence", enhancementError);
          // Continue with original metadata and mode
        }
      }
      
      // Create a new demonstration session with enhanced data
      this.currentDemonstration = new Demonstration({
        id: this._generateId(),
        name: enhancedMetadata.name || `Demonstration ${new Date().toLocaleString()}`,
        createdAt: new Date(),
        metadata: {
          ...enhancedMetadata,
          triggerType,
          mode: enhancedMode,
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        },
        actions: []
      });
      
      // Start capturing with enhanced options
      const captureOptions = {
        mode: enhancedMode,
        metadata: {
          triggerType,
          demonstrationId: this.currentDemonstration.id,
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        },
        enhancedCapture: this.advancedOptions.collaborativeIntelligence
      };
      
      const session = await this.captureManager.startCapture(captureOptions);
      this.currentSession = {
        id: session.id,
        demonstrationId: this.currentDemonstration.id,
        startTime: new Date(),
        triggerType,
        mode: enhancedMode,
        status: "recording",
        enhancedWithAI: this.advancedOptions.collaborativeIntelligence
      };
      
      this.isLearning = true;
      
      // Show notification if enabled
      if (this.config.get("integration.notifications.showStartNotification")) {
        const aiEnhancedMessage = this.advancedOptions.collaborativeIntelligence ? 
          " with AI enhancement" : "";
        this._showNotification(
          "Learning started", 
          `Aideon is now learning from your demonstration${aiEnhancedMessage}`
        );
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_started", {
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        });
      }
      
      // Publish context if enabled
      if (this.config.get("integration.mcp.enabled") && this.config.get("integration.mcp.publishContext")) {
        this._publishMCPContext();
      }
      
      // Start performance monitoring if self-evaluation is enabled
      if (this.advancedOptions.selfEvaluation) {
        this._startPerformanceMonitoring();
      }
      
      this.eventBus.emit("learning:started", this.currentSession);
      
      return this.currentSession;
    } catch (error) {
      this.logger.error("Failed to start learning", error);
      throw new LearningError("Failed to start learning", error);
    }
  }

  /**
   * Gets the current context for collaborative intelligence.
   * @private
   * @returns {Promise<Object>} Promise resolving to the current context
   */
  async _getCurrentContext() {
    try {
      // Gather context from various sources
      const activeApplications = await this._getActiveApplications();
      const screenContext = await this._getScreenContext();
      const userContext = await this._getUserContext();
      
      return {
        activeApplications,
        screenContext,
        userContext,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.warn("Failed to get current context", error);
      return {
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * Gets active applications for context.
   * @private
   * @returns {Promise<Array>} Promise resolving to active applications
   */
  async _getActiveApplications() {
    // In a real implementation, this would get active applications from the system
    // For now, return a mock result
    return [
      { name: "Chrome", title: "Google - Google Chrome", pid: 1234 },
      { name: "VSCode", title: "index.js - Visual Studio Code", pid: 5678 }
    ];
  }

  /**
   * Gets screen context.
   * @private
   * @returns {Promise<Object>} Promise resolving to screen context
   */
  async _getScreenContext() {
    // In a real implementation, this would get screen context from the system
    // For now, return a mock result
    return {
      resolution: { width: 1920, height: 1080 },
      activeWindow: { title: "Google - Google Chrome", bounds: { x: 0, y: 0, width: 1200, height: 800 } }
    };
  }

  /**
   * Gets user context.
   * @private
   * @returns {Promise<Object>} Promise resolving to user context
   */
  async _getUserContext() {
    // In a real implementation, this would get user context from the system
    // For now, return a mock result
    return {
      recentActions: ["opened Chrome", "searched Google", "clicked link"],
      preferences: { theme: "dark", language: "en" }
    };
  }

  /**
   * Starts performance monitoring for self-evaluation.
   * @private
   */
  _startPerformanceMonitoring() {
    this.logger.debug("Starting performance monitoring for self-evaluation");
    
    this.performanceData = {
      startTime: Date.now(),
      captureMetrics: {
        startTime: Date.now(),
        actionCount: 0,
        frameRate: [],
        captureLatency: []
      },
      modelMetrics: new Map()
    };
    
    // Setup monitoring interval
    this.performanceMonitoringInterval = setInterval(() => {
      this._collectPerformanceMetrics();
    }, 5000); // Collect metrics every 5 seconds
  }

  /**
   * Collects performance metrics for self-evaluation.
   * @private
   */
  async _collectPerformanceMetrics() {
    if (!this.isLearning || !this.performanceData) {
      return;
    }
    
    try {
      // Collect capture metrics
      const captureMetrics = await this.captureManager.getPerformanceMetrics();
      if (captureMetrics) {
        this.performanceData.captureMetrics.actionCount = captureMetrics.actionCount || 0;
        this.performanceData.captureMetrics.frameRate.push(captureMetrics.currentFrameRate || 0);
        this.performanceData.captureMetrics.captureLatency.push(captureMetrics.captureLatency || 0);
      }
      
      // Collect model usage metrics if available
      if (this.modelOrchestrator && typeof this.modelOrchestrator.getModelUsageMetrics === 'function') {
        const modelMetrics = await this.modelOrchestrator.getModelUsageMetrics();
        if (modelMetrics && Array.isArray(modelMetrics)) {
          for (const metric of modelMetrics) {
            if (metric.modelId) {
              const currentMetrics = this.performanceData.modelMetrics.get(metric.modelId) || {
                calls: 0,
                latency: [],
                tokens: 0
              };
              
              currentMetrics.calls += metric.calls || 0;
              currentMetrics.tokens += metric.tokens || 0;
              
              if (metric.latency) {
                currentMetrics.latency.push(metric.latency);
              }
              
              this.performanceData.modelMetrics.set(metric.modelId, currentMetrics);
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn("Failed to collect performance metrics", error);
    }
  }

  /**
   * Stops the current learning session with collaborative intelligence for analysis.
   * @param {Object} [options={}] - Stop options
   * @param {boolean} [options.discard=false] - Whether to discard the demonstration
   * @param {boolean} [options.generateProcedure=true] - Whether to generate a procedure
   * @returns {Promise<Object>} Promise resolving to the learning results
   */
  async stopLearning(options = {}) {
    if (!this.isLearning) {
      this.logger.warn("No learning session in progress");
      return null;
    }
    
    try {
      const discard = options.discard === true;
      const generateProcedure = options.generateProcedure !== false;
      
      this.logger.info("Stopping learning from demonstration with collaborative intelligence", { discard, generateProcedure });
      
      // Stop performance monitoring if active
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval);
        this.performanceMonitoringInterval = null;
        
        // Final metrics collection
        await this._collectPerformanceMetrics();
      }
      
      // Stop capturing
      const captureResult = await this.captureManager.stopCapture();
      
      // Update session status
      this.currentSession.status = discard ? "discarded" : "completed";
      this.currentSession.endTime = new Date();
      this.currentSession.actionCount = captureResult.actions.length;
      
      // Process the demonstration if not discarded
      let results = {
        session: this.currentSession,
        demonstration: null,
        intent: null,
        procedure: null,
        performanceMetrics: this.performanceData
      };
      
      if (!discard && captureResult.actions.length > 0) {
        // Update the demonstration with captured actions
        this.currentDemonstration.actions = captureResult.actions;
        this.currentDemonstration.updatedAt = new Date();
        
        results.demonstration = this.currentDemonstration;
        
        // Use collaborative intelligence for action recognition if available
        let recognizedActions;
        if (this.advancedOptions.collaborativeIntelligence) {
          try {
            const recognitionResult = await this.enhancedIntegration.executeCollaborativeTask(
              "action_recognition",
              {
                demonstration: this.currentDemonstration,
                context: await this._getCurrentContext()
              }
            );
            
            recognizedActions = recognitionResult.recognizedActions;
            results.recognitionMetrics = recognitionResult.metrics;
            
            this.logger.debug("Actions recognized with collaborative intelligence", { 
              count: recognizedActions.length,
              confidence: recognitionResult.confidence
            });
          } catch (recognitionError) {
            this.logger.warn("Failed to recognize actions with collaborative intelligence, falling back to standard recognition", recognitionError);
            recognizedActions = await this.recognitionEngine.recognizeActions(this.currentDemonstration);
          }
        } else {
          recognizedActions = await this.recognitionEngine.recognizeActions(this.currentDemonstration);
        }
        
        // Use collaborative intelligence for intent inference if available
        let intent;
        if (this.advancedOptions.collaborativeIntelligence) {
          try {
            const inferenceResult = await this.enhancedIntegration.executeCollaborativeTask(
              "intent_inference",
              {
                recognizedActions,
                demonstration: this.currentDemonstration,
                context: await this._getCurrentContext()
              }
            );
            
            intent = inferenceResult.intent;
            results.inferenceMetrics = inferenceResult.metrics;
            
            this.logger.debug("Intent inferred with collaborative intelligence", { 
              intent: intent.name,
              confidence: inferenceResult.confidence
            });
          } catch (inferenceError) {
            this.logger.warn("Failed to infer intent with collaborative intelligence, falling back to standard inference", inferenceError);
            intent = await this.intentInferenceSystem.inferIntent(recognizedActions, this.currentDemonstration);
          }
        } else {
          intent = await this.intentInferenceSystem.inferIntent(recognizedActions, this.currentDemonstration);
        }
        
        if (intent) {
          results.intent = intent;
          
          // Generate and optimize procedure if requested
          if (generateProcedure) {
            // Use collaborative intelligence for procedure generation if available
            let procedure;
            if (this.advancedOptions.collaborativeIntelligence) {
              try {
                const generationResult = await this.enhancedIntegration.executeCollaborativeTask(
                  "procedure_generation",
                  {
                    demonstration: this.currentDemonstration,
                    intent,
                    recognizedActions,
                    context: await this._getCurrentContext()
                  }
                );
                
                procedure = generationResult.procedure;
                results.generationMetrics = generationResult.metrics;
                
                this.logger.debug("Procedure generated with collaborative intelligence", { 
                  procedureId: procedure.id,
                  stepCount: procedure.steps.length,
                  confidence: generationResult.confidence
                });
              } catch (generationError) {
                this.logger.warn("Failed to generate procedure with collaborative intelligence, falling back to standard generation", generationError);
                procedure = await this.generationEngine.generateProcedure(this.currentDemonstration, intent);
              }
            } else {
              procedure = await this.generationEngine.generateProcedure(this.currentDemonstration, intent);
            }
            
            if (procedure) {
              // Use collaborative intelligence for procedure optimization if available
              let optimizedProcedure;
              if (this.advancedOptions.collaborativeIntelligence) {
                try {
                  const optimizationResult = await this.enhancedIntegration.executeCollaborativeTask(
                    "procedure_optimization",
                    {
                      procedure,
                      demonstration: this.currentDemonstration,
                      intent,
                      context: await this._getCurrentContext()
                    }
                  );
                  
                  optimizedProcedure = optimizationResult.optimizedProcedure;
                  results.optimizationMetrics = optimizationResult.metrics;
                  
                  this.logger.debug("Procedure optimized with collaborative intelligence", { 
                    procedureId: optimizedProcedure.id,
                    optimizationScore: optimizationResult.optimizationScore,
                    improvements: optimizationResult.improvements
                  });
                } catch (optimizationError) {
                  this.logger.warn("Failed to optimize procedure with collaborative intelligence, falling back to standard optimization", optimizationError);
                  optimizedProcedure = await this.optimizationSystem.optimizeProcedure(procedure);
                }
              } else {
                optimizedProcedure = await this.optimizationSystem.optimizeProcedure(procedure);
              }
              
              // Save the procedure
              const savedProcedure = await this.persistenceManager.saveProcedure(optimizedProcedure);
              
              results.procedure = savedProcedure;
            }
          }
        }
      }
      
      // Reset state
      this.isLearning = false;
      this.currentDemonstration = null;
      this.currentSession = null;
      this.performanceData = null;
      
      // Show notification if enabled
      if (this.config.get("integration.notifications.showStopNotification")) {
        const message = discard ? 
          "Learning session discarded" : 
          results.procedure ? 
            "Procedure created successfully with AI enhancement" : 
            "Learning session completed";
        
        this._showNotification("Learning stopped", message);
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_stopped", { 
          success: !discard && results.procedure !== null,
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        });
      }
      
      // Perform self-evaluation if enabled
      if (this.advancedOptions.selfEvaluation && !discard && results.procedure) {
        try {
          const evaluationResult = await this._performSelfEvaluation(results);
          results.selfEvaluation = evaluationResult;
        } catch (evaluationError) {
          this.logger.warn("Failed to perform self-evaluation", evaluationError);
        }
      }
      
      this.eventBus.emit("learning:stopped", results);
      
      return results;
    } catch (error) {
      this.logger.error("Failed to stop learning", error);
      throw new LearningError("Failed to stop learning", error);
    }
  }

  /**
   * Performs self-evaluation of the learning process.
   * @param {Object} results - Learning results
   * @private
   * @returns {Promise<Object>} Promise resolving to evaluation results
   */
  async _performSelfEvaluation(results) {
    this.logger.debug("Performing self-evaluation of learning process");
    
    try {
      if (!this.enhancedIntegration) {
        return { performed: false, reason: "Enhanced integration not available" };
      }
      
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: 'learning_from_demonstration',
        results,
        criteria: {
          actionRecognitionAccuracy: 0.9,
          intentInferenceConfidence: 0.85,
          procedureGenerationQuality: 0.9,
          procedureOptimizationEfficiency: 0.85
        }
      });
      
      // Record evaluation metrics
      if (evaluationResult.metrics) {
        if (evaluationResult.metrics.actionRecognitionAccuracy) {
          this.metrics.recognitionAccuracy.push(evaluationResult.metrics.actionRecognitionAccuracy);
        }
        
        if (evaluationResult.metrics.intentInferenceConfidence) {
          this.metrics.intentInferenceConfidence.push(evaluationResult.metrics.intentInferenceConfidence);
        }
        
        if (evaluationResult.metrics.procedureGenerationQuality) {
          this.metrics.procedureGenerationQuality.push(evaluationResult.metrics.procedureGenerationQuality);
        }
      }
      
      // Calculate learning time
      const learningTime = results.session.endTime.getTime() - results.session.startTime.getTime();
      this.metrics.learningTime.push(learningTime);
      
      return {
        performed: true,
        score: evaluationResult.score,
        feedback: evaluationResult.feedback,
        strengths: evaluationResult.strengths,
        weaknesses: evaluationResult.weaknesses,
        improvements: evaluationResult.improvements,
        metrics: evaluationResult.metrics
      };
    } catch (error) {
      this.logger.warn("Failed to perform self-evaluation", error);
      return { performed: false, error: error.message };
    }
  }

  /**
   * Pauses the current learning session with state preservation.
   * @returns {Promise<boolean>} Promise resolving to true if paused successfully
   */
  async pauseLearning() {
    if (!this.isLearning) {
      this.logger.warn("No learning session in progress");
      return false;
    }
    
    try {
      this.logger.info("Pausing learning from demonstration");
      
      // Pause performance monitoring if active
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval);
        this.performanceMonitoringInterval = null;
      }
      
      await this.captureManager.pauseCapture();
      
      // Update session status
      this.currentSession.status = "paused";
      this.currentSession.pausedAt = new Date();
      
      // Preserve state with enhanced integration if available
      if (this.advancedOptions.collaborativeIntelligence) {
        try {
          await this.enhancedIntegration.executeCollaborativeTask(
            "demonstration_analysis",
            {
              task: "preserve_state",
              session: this.currentSession,
              demonstration: this.currentDemonstration,
              performanceData: this.performanceData
            }
          );
          
          this.logger.debug("Learning state preserved with collaborative intelligence");
        } catch (preserveError) {
          this.logger.warn("Failed to preserve learning state with collaborative intelligence", preserveError);
        }
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_paused", {
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        });
      }
      
      this.eventBus.emit("learning:paused", this.currentSession);
      
      return true;
    } catch (error) {
      this.logger.error("Failed to pause learning", error);
      throw new LearningError("Failed to pause learning", error);
    }
  }

  /**
   * Resumes a paused learning session with state restoration.
   * @returns {Promise<boolean>} Promise resolving to true if resumed successfully
   */
  async resumeLearning() {
    if (!this.isLearning) {
      this.logger.warn("No learning session in progress");
      return false;
    }
    
    if (this.currentSession.status !== "paused") {
      this.logger.warn("Learning session is not paused");
      return false;
    }
    
    try {
      this.logger.info("Resuming learning from demonstration");
      
      // Restore state with enhanced integration if available
      if (this.advancedOptions.collaborativeIntelligence) {
        try {
          const restorationResult = await this.enhancedIntegration.executeCollaborativeTask(
            "demonstration_analysis",
            {
              task: "restore_state",
              session: this.currentSession,
              demonstration: this.currentDemonstration
            }
          );
          
          if (restorationResult.restoredState) {
            this.logger.debug("Learning state restored with collaborative intelligence");
          }
        } catch (restoreError) {
          this.logger.warn("Failed to restore learning state with collaborative intelligence", restoreError);
        }
      }
      
      await this.captureManager.resumeCapture();
      
      // Update session status
      this.currentSession.status = "recording";
      this.currentSession.resumedAt = new Date();
      
      // Restart performance monitoring if self-evaluation is enabled
      if (this.advancedOptions.selfEvaluation) {
        this.performanceMonitoringInterval = setInterval(() => {
          this._collectPerformanceMetrics();
        }, 5000);
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_resumed", {
          enhancedWithAI: this.advancedOptions.collaborativeIntelligence
        });
      }
      
      this.eventBus.emit("learning:resumed", this.currentSession);
      
      return true;
    } catch (error) {
      this.logger.error("Failed to resume learning", error);
      throw new LearningError("Failed to resume learning", error);
    }
  }

  /**
   * Sets up event listeners for the learning system.
   * @private
   */
  _setupEventListeners() {
    // Listen for capture events
    this.eventBus.on("capture:action", this._handleCapturedAction.bind(this));
    this.eventBus.on("capture:error", this._handleCaptureError.bind(this));
    
    // Listen for recognition events
    this.eventBus.on("recognition:completed", this._handleRecognitionCompleted.bind(this));
    this.eventBus.on("recognition:error", this._handleRecognitionError.bind(this));
    
    // Listen for inference events
    this.eventBus.on("inference:completed", this._handleInferenceCompleted.bind(this));
    this.eventBus.on("inference:error", this._handleInferenceError.bind(this));
    
    // Listen for generation events
    this.eventBus.on("generation:completed", this._handleGenerationCompleted.bind(this));
    this.eventBus.on("generation:error", this._handleGenerationError.bind(this));
    
    // Listen for optimization events
    this.eventBus.on("optimization:completed", this._handleOptimizationCompleted.bind(this));
    this.eventBus.on("optimization:error", this._handleOptimizationError.bind(this));
    
    // Listen for persistence events
    this.eventBus.on("persistence:saved", this._handlePersistenceSaved.bind(this));
    this.eventBus.on("persistence:error", this._handlePersistenceError.bind(this));
    
    // Listen for model orchestration events if collaborative intelligence is enabled
    if (this.advancedOptions.collaborativeIntelligence) {
      this.eventBus.on("model:performance", this._handleModelPerformance.bind(this));
      this.eventBus.on("model:error", this._handleModelError.bind(this));
    }
    
    this.logger.debug("Event listeners set up");
  }

  /**
   * Handles a captured action event.
   * @param {Object} event - The captured action event
   * @private
   */
  _handleCapturedAction(event) {
    if (!this.isLearning) {
      return;
    }
    
    this.logger.debug("Action captured", { actionType: event.action.type });
    
    // Update performance metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation && this.performanceData) {
      this.performanceData.captureMetrics.actionCount++;
    }
    
    // Show progress notification if enabled
    if (this.config.get("integration.notifications.showProgressNotification")) {
      this._showNotification("Action captured", `Captured ${event.action.type} action`);
    }
    
    // Use collaborative intelligence for real-time feedback if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._provideRealTimeFeedback(event.action);
    }
  }

  /**
   * Provides real-time feedback on captured actions using collaborative intelligence.
   * @param {Object} action - The captured action
   * @private
   */
  async _provideRealTimeFeedback(action) {
    try {
      const feedbackResult = await this.enhancedIntegration.executeCollaborativeTask(
        "demonstration_analysis",
        {
          task: "real_time_feedback",
          action,
          demonstration: this.currentDemonstration
        }
      );
      
      if (feedbackResult.feedback) {
        // Update avatar with feedback if enabled
        if (this.config.get("integration.avatar.enabled") && 
            this.config.get("integration.avatar.showFeedback")) {
          this._updateAvatarState("action_feedback", {
            feedback: feedbackResult.feedback,
            confidence: feedbackResult.confidence,
            actionType: action.type
          });
        }
        
        this.logger.debug("Real-time feedback provided", { 
          actionType: action.type,
          feedback: feedbackResult.feedback
        });
      }
    } catch (error) {
      this.logger.warn("Failed to provide real-time feedback", error);
    }
  }

  /**
   * Handles a capture error event.
   * @param {Object} event - The capture error event
   * @private
   */
  _handleCaptureError(event) {
    this.logger.error("Capture error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("capture", event.error);
    }
  }

  /**
   * Attempts to recover from errors using collaborative intelligence.
   * @param {string} component - The component that experienced the error
   * @param {Error} error - The error that occurred
   * @private
   */
  async _attemptErrorRecovery(component, error) {
    try {
      const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
        "demonstration_analysis",
        {
          task: "error_recovery",
          component,
          error: error.message || String(error),
          demonstration: this.currentDemonstration,
          session: this.currentSession
        }
      );
      
      if (recoveryResult.recoveryAction) {
        this.logger.info(`Recovery action for ${component} error: ${recoveryResult.recoveryAction}`);
        
        switch (recoveryResult.recoveryAction) {
          case "restart_component":
            // Attempt to restart the component
            await this._restartComponent(component);
            break;
            
          case "pause_learning":
            // Pause learning to prevent further errors
            await this.pauseLearning();
            break;
            
          case "stop_learning":
            // Stop learning with discard option based on recovery recommendation
            await this.stopLearning({ discard: recoveryResult.discardRecommended });
            break;
            
          default:
            this.logger.warn(`Unknown recovery action: ${recoveryResult.recoveryAction}`);
        }
      }
    } catch (recoveryError) {
      this.logger.warn("Failed to recover from error", recoveryError);
    }
  }

  /**
   * Restarts a component after an error.
   * @param {string} component - The component to restart
   * @private
   */
  async _restartComponent(component) {
    try {
      this.logger.info(`Attempting to restart ${component} component`);
      
      switch (component) {
        case "capture":
          await this.captureManager.restart();
          break;
          
        case "recognition":
          await this.recognitionEngine.restart();
          break;
          
        case "inference":
          await this.intentInferenceSystem.restart();
          break;
          
        case "generation":
          await this.generationEngine.restart();
          break;
          
        case "optimization":
          await this.optimizationSystem.restart();
          break;
          
        case "persistence":
          await this.persistenceManager.restart();
          break;
          
        default:
          this.logger.warn(`Unknown component: ${component}`);
      }
    } catch (error) {
      this.logger.error(`Failed to restart ${component} component`, error);
    }
  }

  /**
   * Handles a recognition completed event.
   * @param {Object} event - The recognition completed event
   * @private
   */
  _handleRecognitionCompleted(event) {
    this.logger.debug("Recognition completed", { 
      actionCount: event.recognizedActions.length,
      confidence: event.confidence
    });
    
    // Update metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation) {
      this.metrics.recognitionAccuracy.push(event.confidence || 0);
    }
  }

  /**
   * Handles a recognition error event.
   * @param {Object} event - The recognition error event
   * @private
   */
  _handleRecognitionError(event) {
    this.logger.error("Recognition error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("recognition", event.error);
    }
  }

  /**
   * Handles an inference completed event.
   * @param {Object} event - The inference completed event
   * @private
   */
  _handleInferenceCompleted(event) {
    this.logger.debug("Inference completed", { 
      intent: event.intent.name,
      confidence: event.confidence
    });
    
    // Update metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation) {
      this.metrics.intentInferenceConfidence.push(event.confidence || 0);
    }
  }

  /**
   * Handles an inference error event.
   * @param {Object} event - The inference error event
   * @private
   */
  _handleInferenceError(event) {
    this.logger.error("Inference error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("inference", event.error);
    }
  }

  /**
   * Handles a generation completed event.
   * @param {Object} event - The generation completed event
   * @private
   */
  _handleGenerationCompleted(event) {
    this.logger.debug("Generation completed", { 
      procedureId: event.procedure.id,
      stepCount: event.procedure.steps.length
    });
    
    // Update metrics if self-evaluation is enabled
    if (this.advancedOptions.selfEvaluation) {
      this.metrics.procedureGenerationQuality.push(event.quality || 0);
    }
  }

  /**
   * Handles a generation error event.
   * @param {Object} event - The generation error event
   * @private
   */
  _handleGenerationError(event) {
    this.logger.error("Generation error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("generation", event.error);
    }
  }

  /**
   * Handles an optimization completed event.
   * @param {Object} event - The optimization completed event
   * @private
   */
  _handleOptimizationCompleted(event) {
    this.logger.debug("Optimization completed", { 
      procedureId: event.procedure.id,
      optimizationScore: event.optimizationScore
    });
  }

  /**
   * Handles an optimization error event.
   * @param {Object} event - The optimization error event
   * @private
   */
  _handleOptimizationError(event) {
    this.logger.error("Optimization error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("optimization", event.error);
    }
  }

  /**
   * Handles a persistence saved event.
   * @param {Object} event - The persistence saved event
   * @private
   */
  _handlePersistenceSaved(event) {
    this.logger.debug("Persistence saved", { 
      procedureId: event.procedure.id,
      version: event.procedure.version
    });
  }

  /**
   * Handles a persistence error event.
   * @param {Object} event - The persistence error event
   * @private
   */
  _handlePersistenceError(event) {
    this.logger.error("Persistence error", event.error);
    
    // Use collaborative intelligence for error recovery if available
    if (this.advancedOptions.collaborativeIntelligence) {
      this._attemptErrorRecovery("persistence", event.error);
    }
  }

  /**
   * Handles a model performance event.
   * @param {Object} event - The model performance event
   * @private
   */
  _handleModelPerformance(event) {
    if (!this.advancedOptions.collaborativeIntelligence) {
      return;
    }
    
    this.logger.debug("Model performance", { 
      modelId: event.modelId,
      taskType: event.taskType,
      latency: event.latency,
      success: event.success
    });
    
    // Update model usage metrics
    if (event.modelId) {
      const currentUsage = this.metrics.modelUsage.get(event.modelId) || {
        calls: 0,
        successes: 0,
        failures: 0,
        latency: []
      };
      
      currentUsage.calls++;
      if (event.success) {
        currentUsage.successes++;
      } else {
        currentUsage.failures++;
      }
      
      if (event.latency) {
        currentUsage.latency.push(event.latency);
      }
      
      this.metrics.modelUsage.set(event.modelId, currentUsage);
    }
    
    // Adjust model selection if specialized model selection is enabled
    if (this.advancedOptions.specializedModelSelection) {
      this._adjustModelSelection(event);
    }
  }

  /**
   * Adjusts model selection based on performance.
   * @param {Object} event - The model performance event
   * @private
   */
  async _adjustModelSelection(event) {
    try {
      if (event.modelId && event.taskType) {
        await this.enhancedIntegration.updateModelPreference({
          modelId: event.modelId,
          taskType: event.taskType,
          performance: {
            success: event.success,
            latency: event.latency,
            accuracy: event.accuracy
          }
        });
        
        this.logger.debug(`Updated model preference for ${event.modelId} on ${event.taskType}`);
      }
    } catch (error) {
      this.logger.warn("Failed to adjust model selection", error);
    }
  }

  /**
   * Handles a model error event.
   * @param {Object} event - The model error event
   * @private
   */
  _handleModelError(event) {
    if (!this.advancedOptions.collaborativeIntelligence) {
      return;
    }
    
    this.logger.error("Model error", { 
      modelId: event.modelId,
      taskType: event.taskType,
      error: event.error
    });
    
    // Attempt fallback to alternative model if specialized model selection is enabled
    if (this.advancedOptions.specializedModelSelection) {
      this._attemptModelFallback(event);
    }
  }

  /**
   * Attempts to fallback to an alternative model after an error.
   * @param {Object} event - The model error event
   * @private
   */
  async _attemptModelFallback(event) {
    try {
      if (event.modelId && event.taskType) {
        const fallbackResult = await this.enhancedIntegration.requestModelFallback({
          failedModelId: event.modelId,
          taskType: event.taskType,
          error: event.error
        });
        
        if (fallbackResult.fallbackModelId) {
          this.logger.info(`Falling back from ${event.modelId} to ${fallbackResult.fallbackModelId} for ${event.taskType}`);
        }
      }
    } catch (error) {
      this.logger.warn("Failed to fallback to alternative model", error);
    }
  }

  /**
   * Registers default triggers for learning.
   * @private
   */
  _registerDefaultTriggers() {
    const enabledTriggers = this.config.get("integration.enabledTriggers") || [];
    
    for (const triggerType of enabledTriggers) {
      switch (triggerType) {
        case LearningIntegrationManager.TRIGGER_TYPES.VOICE:
          this._registerVoiceTrigger();
          break;
          
        case LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD:
          this._registerKeyboardTrigger();
          break;
          
        case LearningIntegrationManager.TRIGGER_TYPES.PATTERN:
          this._registerPatternTrigger();
          break;
          
        case LearningIntegrationManager.TRIGGER_TYPES.SCHEDULED:
          this._registerScheduledTrigger();
          break;
      }
    }
    
    this.logger.debug("Default triggers registered");
  }

  /**
   * Registers a voice trigger for learning.
   * @private
   */
  _registerVoiceTrigger() {
    if (!this.config.get("integration.triggers.voice.enabled")) {
      return;
    }
    
    const commands = this.config.get("integration.triggers.voice.commands") || [];
    
    // In a real implementation, this would register voice commands with the voice recognition system
    this.logger.debug("Voice trigger registered", { commands });
    
    this.registeredTriggers.set(LearningIntegrationManager.TRIGGER_TYPES.VOICE, {
      type: LearningIntegrationManager.TRIGGER_TYPES.VOICE,
      commands,
      enabled: true
    });
  }

  /**
   * Registers a keyboard trigger for learning.
   * @private
   */
  _registerKeyboardTrigger() {
    if (!this.config.get("integration.triggers.keyboard.enabled")) {
      return;
    }
    
    const shortcut = this.config.get("integration.triggers.keyboard.shortcut");
    
    // In a real implementation, this would register a keyboard shortcut with the system
    this.logger.debug("Keyboard trigger registered", { shortcut });
    
    this.registeredTriggers.set(LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD, {
      type: LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD,
      shortcut,
      enabled: true
    });
  }

  /**
   * Registers a pattern trigger for learning.
   * @private
   */
  _registerPatternTrigger() {
    if (!this.config.get("integration.triggers.pattern.enabled")) {
      return;
    }
    
    const minRepetitions = this.config.get("integration.triggers.pattern.minRepetitions");
    const timeWindow = this.config.get("integration.triggers.pattern.timeWindow");
    
    // In a real implementation, this would register a pattern detector
    this.logger.debug("Pattern trigger registered", { minRepetitions, timeWindow });
    
    this.registeredTriggers.set(LearningIntegrationManager.TRIGGER_TYPES.PATTERN, {
      type: LearningIntegrationManager.TRIGGER_TYPES.PATTERN,
      minRepetitions,
      timeWindow,
      enabled: true
    });
  }

  /**
   * Registers a scheduled trigger for learning.
   * @private
   */
  _registerScheduledTrigger() {
    if (!this.config.get("integration.triggers.scheduled.enabled")) {
      return;
    }
    
    const schedule = this.config.get("integration.triggers.scheduled.schedule") || [];
    
    // In a real implementation, this would register scheduled tasks
    this.logger.debug("Scheduled trigger registered", { scheduleCount: schedule.length });
    
    this.registeredTriggers.set(LearningIntegrationManager.TRIGGER_TYPES.SCHEDULED, {
      type: LearningIntegrationManager.TRIGGER_TYPES.SCHEDULED,
      schedule,
      enabled: true
    });
  }

  /**
   * Checks if a trigger type is enabled.
   * @param {string} triggerType - The trigger type to check
   * @returns {boolean} Whether the trigger type is enabled
   * @private
   */
  _isTriggerEnabled(triggerType) {
    const enabledTriggers = this.config.get("integration.enabledTriggers") || [];
    return enabledTriggers.includes(triggerType);
  }

  /**
   * Checks security constraints before starting learning.
   * @param {string} triggerType - The trigger type that initiated learning
   * @returns {Promise<boolean>} Promise resolving to true if security constraints are met
   * @private
   */
  async _checkSecurityConstraints(triggerType) {
    if (!this.config.get("integration.security.requireConfirmation")) {
      return true;
    }
    
    // In a real implementation, this would check security constraints and possibly ask for user confirmation
    this.logger.debug("Security constraints checked", { triggerType });
    
    return true;
  }

  /**
   * Shows a notification to the user.
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   * @private
   */
  _showNotification(title, message) {
    if (!this.config.get("integration.notifications.enabled")) {
      return;
    }
    
    // In a real implementation, this would show a notification to the user
    this.logger.debug("Notification shown", { title, message });
    
    this.eventBus.emit("learning:notification", { title, message });
  }

  /**
   * Updates the avatar state.
   * @param {string} state - The new avatar state
   * @param {Object} [data={}] - Additional data for the state
   * @private
   */
  _updateAvatarState(state, data = {}) {
    if (!this.config.get("integration.avatar.enabled")) {
      return;
    }
    
    // In a real implementation, this would update the avatar state
    this.logger.debug("Avatar state updated", { state, data });
    
    this.eventBus.emit("learning:avatar_state", { state, data });
  }

  /**
   * Publishes context to the Model Context Protocol (MCP).
   * @private
   */
  _publishMCPContext() {
    if (!this.config.get("integration.mcp.enabled") || !this.config.get("integration.mcp.publishContext")) {
      return;
    }
    
    // In a real implementation, this would publish context to the MCP
    this.logger.debug("MCP context published");
    
    // Setup interval for regular context updates
    if (!this.mcpContextInterval) {
      const interval = this.config.get("integration.mcp.contextUpdateInterval") || 5000;
      
      this.mcpContextInterval = setInterval(() => {
        if (this.isLearning) {
          this._publishMCPContext();
        }
      }, interval);
    }
  }

  /**
   * Sets up integrations with other Aideon systems.
   * @returns {Promise<void>} Promise that resolves when integrations are set up
   * @private
   */
  async _setupIntegrations() {
    // In a real implementation, this would set up integrations with other Aideon systems
    this.logger.debug("Integrations set up");
    
    // Setup enhanced integrations with collaborative intelligence if available
    if (this.advancedOptions.collaborativeIntelligence) {
      await this._setupEnhancedIntegrations();
    }
  }

  /**
   * Sets up enhanced integrations with collaborative intelligence.
   * @returns {Promise<void>} Promise that resolves when enhanced integrations are set up
   * @private
   */
  async _setupEnhancedIntegrations() {
    try {
      // Register with the model orchestration system
      if (this.modelOrchestrator && typeof this.modelOrchestrator.registerTentacle === 'function') {
        await this.modelOrchestrator.registerTentacle("learning", {
          capabilities: [
            "action_recognition",
            "intent_inference",
            "procedure_generation",
            "procedure_optimization",
            "demonstration_analysis"
          ],
          modelPreferences: this.config.get("integration.advanced.modelPreferences") || {}
        });
        
        this.logger.debug("Registered with model orchestration system");
      }
      
      // Setup cross-tentacle integrations
      await this._setupCrossTentacleIntegrations();
      
    } catch (error) {
      this.logger.warn("Failed to setup enhanced integrations", error);
    }
  }

  /**
   * Sets up cross-tentacle integrations.
   * @returns {Promise<void>} Promise that resolves when cross-tentacle integrations are set up
   * @private
   */
  async _setupCrossTentacleIntegrations() {
    try {
      // In a real implementation, this would set up integrations with other tentacles
      const integrations = [
        { tentacle: "avatar", capabilities: ["feedback", "emotion"] },
        { tentacle: "memory", capabilities: ["store", "retrieve"] },
        { tentacle: "reasoning", capabilities: ["analyze", "infer"] }
      ];
      
      for (const integration of integrations) {
        this.integrations.set(integration.tentacle, {
          tentacle: integration.tentacle,
          capabilities: integration.capabilities,
          status: "connected"
        });
      }
      
      this.logger.debug("Cross-tentacle integrations set up", { 
        count: this.integrations.size 
      });
    } catch (error) {
      this.logger.warn("Failed to setup cross-tentacle integrations", error);
    }
  }

  /**
   * Generates a unique ID.
   * @returns {string} A unique ID
   * @private
   */
  _generateId() {
    return `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets the current metrics.
   * @returns {Object} The current metrics
   */
  getMetrics() {
    const modelUsageArray = Array.from(this.metrics.modelUsage.entries()).map(([modelId, usage]) => ({
      modelId,
      calls: usage.calls,
      successRate: usage.calls > 0 ? usage.successes / usage.calls : 0,
      averageLatency: usage.latency.length > 0 ? usage.latency.reduce((a, b) => a + b, 0) / usage.latency.length : 0
    }));
    
    return {
      learningTime: {
        average: this.metrics.learningTime.length > 0 ? 
          this.metrics.learningTime.reduce((a, b) => a + b, 0) / this.metrics.learningTime.length : 0,
        min: this.metrics.learningTime.length > 0 ? Math.min(...this.metrics.learningTime) : 0,
        max: this.metrics.learningTime.length > 0 ? Math.max(...this.metrics.learningTime) : 0
      },
      recognitionAccuracy: {
        average: this.metrics.recognitionAccuracy.length > 0 ? 
          this.metrics.recognitionAccuracy.reduce((a, b) => a + b, 0) / this.metrics.recognitionAccuracy.length : 0
      },
      intentInferenceConfidence: {
        average: this.metrics.intentInferenceConfidence.length > 0 ? 
          this.metrics.intentInferenceConfidence.reduce((a, b) => a + b, 0) / this.metrics.intentInferenceConfidence.length : 0
      },
      procedureGenerationQuality: {
        average: this.metrics.procedureGenerationQuality.length > 0 ? 
          this.metrics.procedureGenerationQuality.reduce((a, b) => a + b, 0) / this.metrics.procedureGenerationQuality.length : 0
      },
      modelUsage: modelUsageArray
    };
  }

  /**
   * Cleans up resources used by the LearningIntegrationManager.
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   */
  async cleanup() {
    this.logger.info("Cleaning up LearningIntegrationManager");
    
    // Stop any active learning session
    if (this.isLearning) {
      try {
        await this.stopLearning({ discard: true });
      } catch (error) {
        this.logger.error("Failed to stop learning during cleanup", error);
      }
    }
    
    // Clear intervals
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = null;
    }
    
    if (this.mcpContextInterval) {
      clearInterval(this.mcpContextInterval);
      this.mcpContextInterval = null;
    }
    
    // Clean up components
    try {
      await Promise.all([
        this.captureManager.cleanup(),
        this.recognitionEngine.cleanup(),
        this.intentInferenceSystem.cleanup(),
        this.generationEngine.cleanup(),
        this.optimizationSystem.cleanup(),
        this.persistenceManager.cleanup()
      ]);
    } catch (error) {
      this.logger.error("Failed to clean up components", error);
    }
    
    // Clean up enhanced integration
    if (this.enhancedIntegration) {
      try {
        await this.enhancedIntegration.cleanup();
      } catch (error) {
        this.logger.error("Failed to clean up enhanced integration", error);
      }
    }
    
    // Reset state
    this.isInitialized = false;
    this.isLearning = false;
    this.currentDemonstration = null;
    this.currentSession = null;
    this.registeredTriggers.clear();
    this.integrations.clear();
    
    this.logger.info("LearningIntegrationManager cleaned up");
  }
}

module.exports = LearningIntegrationManager;
