/**
 * @fileoverview LearningIntegrationManager for the Learning from Demonstration system.
 * Coordinates all components and provides a unified API for the Learning from Demonstration system.
 * Extended version with support for advanced features and integration with other Aideon systems.
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

// Import core components
const DemonstrationCaptureManager = require("../capture/DemonstrationCaptureManager");
const ActionRecognitionEngine = require("../recognition/ActionRecognitionEngine");
const IntentInferenceSystem = require("../recognition/IntentInferenceSystem");
const ProcedureGenerationEngine = require("../generation/ProcedureGenerationEngine");
const ProcedureOptimizationSystem = require("../generation/ProcedureOptimizationSystem");
const ProcedurePersistenceManager = require("../persistence/ProcedurePersistenceManager");

/**
 * Coordinates all components and provides a unified API for the Learning from Demonstration system.
 * Extended version with support for advanced features and integration with other Aideon systems.
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
   * Creates a new LearningIntegrationManager instance.
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
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger("LearningIntegrationManager");
    this.config = options.config || new Configuration(LearningIntegrationManager.defaultConfig());
    
    // Initialize components
    this.captureManager = options.captureManager || new DemonstrationCaptureManager({ 
      eventBus: this.eventBus,
      logger: this.logger.createChild("CaptureManager"),
      config: this.config.scope("capture")
    });
    
    this.recognitionEngine = options.recognitionEngine || new ActionRecognitionEngine({
      eventBus: this.eventBus,
      logger: this.logger.createChild("RecognitionEngine"),
      config: this.config.scope("recognition")
    });
    
    this.intentInferenceSystem = options.intentInferenceSystem || new IntentInferenceSystem({
      eventBus: this.eventBus,
      logger: this.logger.createChild("IntentInferenceSystem"),
      config: this.config.scope("inference")
    });
    
    this.generationEngine = options.generationEngine || new ProcedureGenerationEngine({
      eventBus: this.eventBus,
      logger: this.logger.createChild("GenerationEngine"),
      config: this.config.scope("generation")
    });
    
    this.optimizationSystem = options.optimizationSystem || new ProcedureOptimizationSystem({
      eventBus: this.eventBus,
      logger: this.logger.createChild("OptimizationSystem"),
      config: this.config.scope("optimization")
    });
    
    this.persistenceManager = options.persistenceManager || new ProcedurePersistenceManager({
      eventBus: this.eventBus,
      logger: this.logger.createChild("PersistenceManager"),
      config: this.config.scope("persistence")
    });
    
    // Initialize state
    this.isInitialized = false;
    this.isLearning = false;
    this.currentDemonstration = null;
    this.currentSession = null;
    this.registeredTriggers = new Map();
    this.integrations = new Map();
    
    // Setup event listeners
    this._setupEventListeners();
    
    this.logger.info("LearningIntegrationManager created");
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
   * Initializes the Learning from Demonstration system.
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn("LearningIntegrationManager is already initialized");
      return;
    }
    
    try {
      this.logger.info("Initializing LearningIntegrationManager");
      
      // Initialize all components
      await this._initializeComponents();
      
      // Register default triggers
      this._registerDefaultTriggers();
      
      // Setup integrations with other Aideon systems
      await this._setupIntegrations();
      
      this.isInitialized = true;
      this.eventBus.emit("learning:initialized");
      this.logger.info("LearningIntegrationManager initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize LearningIntegrationManager", error);
      throw new LearningError("Failed to initialize LearningIntegrationManager", error);
    }
  }

  /**
   * Starts learning from demonstration.
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
      
      this.logger.info(`Starting learning from demonstration`, { triggerType, mode });
      
      // Check if trigger is enabled
      if (!this._isTriggerEnabled(triggerType)) {
        throw new OperationError(`Trigger type ${triggerType} is not enabled`);
      }
      
      // Check security constraints
      await this._checkSecurityConstraints(triggerType);
      
      // Create a new demonstration session
      this.currentDemonstration = new Demonstration({
        id: this._generateId(),
        name: metadata.name || `Demonstration ${new Date().toLocaleString()}`,
        createdAt: new Date(),
        metadata: {
          ...metadata,
          triggerType,
          mode
        },
        actions: []
      });
      
      // Start capturing
      const captureOptions = {
        mode,
        metadata: {
          triggerType,
          demonstrationId: this.currentDemonstration.id
        }
      };
      
      const session = await this.captureManager.startCapture(captureOptions);
      this.currentSession = {
        id: session.id,
        demonstrationId: this.currentDemonstration.id,
        startTime: new Date(),
        triggerType,
        mode,
        status: "recording"
      };
      
      this.isLearning = true;
      
      // Show notification if enabled
      if (this.config.get("integration.notifications.showStartNotification")) {
        this._showNotification("Learning started", "Aideon is now learning from your demonstration");
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_started");
      }
      
      // Publish context if enabled
      if (this.config.get("integration.mcp.enabled") && this.config.get("integration.mcp.publishContext")) {
        this._publishMCPContext();
      }
      
      this.eventBus.emit("learning:started", this.currentSession);
      
      return this.currentSession;
    } catch (error) {
      this.logger.error("Failed to start learning", error);
      throw new LearningError("Failed to start learning", error);
    }
  }

  /**
   * Stops the current learning session.
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
      
      this.logger.info("Stopping learning from demonstration", { discard, generateProcedure });
      
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
        procedure: null
      };
      
      if (!discard && captureResult.actions.length > 0) {
        // Update the demonstration with captured actions
        this.currentDemonstration.actions = captureResult.actions;
        this.currentDemonstration.updatedAt = new Date();
        
        results.demonstration = this.currentDemonstration;
        
        // Recognize patterns and infer intent
        const recognizedActions = await this.recognitionEngine.recognizeActions(this.currentDemonstration);
        const intent = await this.intentInferenceSystem.inferIntent(recognizedActions, this.currentDemonstration);
        
        if (intent) {
          results.intent = intent;
          
          // Generate and optimize procedure if requested
          if (generateProcedure) {
            const procedure = await this.generationEngine.generateProcedure(this.currentDemonstration, intent);
            
            if (procedure) {
              // Optimize the procedure
              const optimizedProcedure = await this.optimizationSystem.optimizeProcedure(procedure);
              
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
      
      // Show notification if enabled
      if (this.config.get("integration.notifications.showStopNotification")) {
        const message = discard ? 
          "Learning session discarded" : 
          results.procedure ? 
            "Procedure created successfully" : 
            "Learning session completed";
        
        this._showNotification("Learning stopped", message);
      }
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_stopped", { success: !discard && results.procedure !== null });
      }
      
      this.eventBus.emit("learning:stopped", results);
      
      return results;
    } catch (error) {
      this.logger.error("Failed to stop learning", error);
      throw new LearningError("Failed to stop learning", error);
    }
  }

  /**
   * Pauses the current learning session.
   * @returns {Promise<boolean>} Promise resolving to true if paused successfully
   */
  async pauseLearning() {
    if (!this.isLearning) {
      this.logger.warn("No learning session in progress");
      return false;
    }
    
    try {
      this.logger.info("Pausing learning from demonstration");
      
      await this.captureManager.pauseCapture();
      
      // Update session status
      this.currentSession.status = "paused";
      this.currentSession.pausedAt = new Date();
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_paused");
      }
      
      this.eventBus.emit("learning:paused", this.currentSession);
      
      return true;
    } catch (error) {
      this.logger.error("Failed to pause learning", error);
      throw new LearningError("Failed to pause learning", error);
    }
  }

  /**
   * Resumes a paused learning session.
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
      
      await this.captureManager.resumeCapture();
      
      // Update session status
      this.currentSession.status = "recording";
      this.currentSession.resumedAt = new Date();
      
      // Update avatar if enabled
      if (this.config.get("integration.avatar.enabled")) {
        this._updateAvatarState("learning_resumed");
      }
      
      this.eventBus.emit("learning:resumed", this.currentSession);
      
      return true;
    } catch (error) {
      this.logger.error("Failed to resume learning", error);
      throw new LearningError("Failed to resume learning", error);
    }
  }

  /**
   * Gets the current learning status.
   * @returns {Object|null} Current learning status or null if not learning
   */
  getLearningStatus() {
    if (!this.isLearning) {
      return null;
    }
    
    return {
      ...this.currentSession,
      elapsedTime: this._calculateElapsedTime()
    };
  }

  /**
   * Registers a trigger for learning.
   * @param {string} triggerType - Type of trigger
   * @param {Object} triggerConfig - Trigger configuration
   * @param {Function} triggerHandler - Trigger handler function
   * @returns {boolean} True if registered successfully
   */
  registerTrigger(triggerType, triggerConfig, triggerHandler) {
    if (!triggerType || !triggerHandler || typeof triggerHandler !== "function") {
      this.logger.error("Invalid trigger registration parameters");
      return false;
    }
    
    try {
      this.registeredTriggers.set(triggerType, {
        config: triggerConfig || {},
        handler: triggerHandler,
        enabled: true
      });
      
      this.logger.info(`Registered trigger: ${triggerType}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register trigger: ${triggerType}`, error);
      return false;
    }
  }

  /**
   * Unregisters a trigger.
   * @param {string} triggerType - Type of trigger to unregister
   * @returns {boolean} True if unregistered successfully
   */
  unregisterTrigger(triggerType) {
    const result = this.registeredTriggers.delete(triggerType);
    
    if (result) {
      this.logger.info(`Unregistered trigger: ${triggerType}`);
    }
    
    return result;
  }

  /**
   * Enables or disables a trigger.
   * @param {string} triggerType - Type of trigger
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {boolean} True if successful
   */
  setTriggerEnabled(triggerType, enabled) {
    const trigger = this.registeredTriggers.get(triggerType);
    
    if (!trigger) {
      this.logger.warn(`Trigger not found: ${triggerType}`);
      return false;
    }
    
    trigger.enabled = enabled === true;
    this.logger.info(`${enabled ? "Enabled" : "Disabled"} trigger: ${triggerType}`);
    
    return true;
  }

  /**
   * Handles a trigger event.
   * @param {string} triggerType - Type of trigger
   * @param {Object} [eventData={}] - Event data
   * @returns {Promise<Object|null>} Promise resolving to session info or null
   */
  async handleTrigger(triggerType, eventData = {}) {
    if (!this._isTriggerEnabled(triggerType)) {
      this.logger.warn(`Trigger ${triggerType} is not enabled`);
      return null;
    }
    
    try {
      this.logger.info(`Handling trigger: ${triggerType}`);
      
      // If already learning, stop learning
      if (this.isLearning) {
        return await this.stopLearning();
      }
      
      // Otherwise, start learning
      return await this.startLearning({
        triggerType,
        metadata: eventData
      });
    } catch (error) {
      this.logger.error(`Failed to handle trigger: ${triggerType}`, error);
      return null;
    }
  }

  /**
   * Registers an integration with another Aideon system.
   * @param {string} systemName - Name of the system to integrate with
   * @param {Object} integration - Integration object
   * @returns {boolean} True if registered successfully
   */
  registerIntegration(systemName, integration) {
    if (!systemName || !integration) {
      this.logger.error("Invalid integration registration parameters");
      return false;
    }
    
    try {
      this.integrations.set(systemName, integration);
      this.logger.info(`Registered integration: ${systemName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register integration: ${systemName}`, error);
      return false;
    }
  }

  /**
   * Unregisters an integration.
   * @param {string} systemName - Name of the system to unregister
   * @returns {boolean} True if unregistered successfully
   */
  unregisterIntegration(systemName) {
    const result = this.integrations.delete(systemName);
    
    if (result) {
      this.logger.info(`Unregistered integration: ${systemName}`);
    }
    
    return result;
  }

  /**
   * Gets a procedure by ID.
   * @param {string} procedureId - ID of the procedure to get
   * @returns {Promise<Object|null>} Promise resolving to the procedure or null
   */
  async getProcedure(procedureId) {
    try {
      return await this.persistenceManager.getProcedure(procedureId);
    } catch (error) {
      this.logger.error(`Failed to get procedure: ${procedureId}`, error);
      return null;
    }
  }

  /**
   * Gets all procedures.
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} Promise resolving to array of procedures
   */
  async getAllProcedures(options = {}) {
    try {
      return await this.persistenceManager.getAllProcedures(options);
    } catch (error) {
      this.logger.error("Failed to get all procedures", error);
      return [];
    }
  }

  /**
   * Deletes a procedure.
   * @param {string} procedureId - ID of the procedure to delete
   * @returns {Promise<boolean>} Promise resolving to true if deleted successfully
   */
  async deleteProcedure(procedureId) {
    try {
      return await this.persistenceManager.deleteProcedure(procedureId);
    } catch (error) {
      this.logger.error(`Failed to delete procedure: ${procedureId}`, error);
      return false;
    }
  }

  /**
   * Analyzes a procedure and returns optimization recommendations.
   * @param {string} procedureId - ID of the procedure to analyze
   * @returns {Promise<Object|null>} Promise resolving to recommendations or null
   */
  async analyzeProcedure(procedureId) {
    try {
      const procedure = await this.persistenceManager.getProcedure(procedureId);
      
      if (!procedure) {
        this.logger.warn(`Procedure not found: ${procedureId}`);
        return null;
      }
      
      return await this.optimizationSystem.analyzeProcedure(procedure);
    } catch (error) {
      this.logger.error(`Failed to analyze procedure: ${procedureId}`, error);
      return null;
    }
  }

  /**
   * Optimizes a procedure.
   * @param {string} procedureId - ID of the procedure to optimize
   * @param {Object} [options={}] - Optimization options
   * @returns {Promise<Object|null>} Promise resolving to optimized procedure or null
   */
  async optimizeProcedure(procedureId, options = {}) {
    try {
      const procedure = await this.persistenceManager.getProcedure(procedureId);
      
      if (!procedure) {
        this.logger.warn(`Procedure not found: ${procedureId}`);
        return null;
      }
      
      const optimizedProcedure = await this.optimizationSystem.optimizeProcedure(procedure, options);
      
      // Save the optimized procedure
      return await this.persistenceManager.saveProcedure(optimizedProcedure);
    } catch (error) {
      this.logger.error(`Failed to optimize procedure: ${procedureId}`, error);
      return null;
    }
  }

  /**
   * Initializes all components.
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   * @private
   */
  async _initializeComponents() {
    // Initialize capture manager
    if (this.captureManager && typeof this.captureManager.initialize === "function") {
      await this.captureManager.initialize();
    }
    
    // Initialize recognition engine
    if (this.recognitionEngine && typeof this.recognitionEngine.initialize === "function") {
      await this.recognitionEngine.initialize();
    }
    
    // Initialize intent inference system
    if (this.intentInferenceSystem && typeof this.intentInferenceSystem.initialize === "function") {
      await this.intentInferenceSystem.initialize();
    }
    
    // Initialize generation engine
    if (this.generationEngine && typeof this.generationEngine.initialize === "function") {
      await this.generationEngine.initialize();
    }
    
    // Initialize optimization system
    if (this.optimizationSystem && typeof this.optimizationSystem.initialize === "function") {
      await this.optimizationSystem.initialize();
    }
    
    // Initialize persistence manager
    if (this.persistenceManager && typeof this.persistenceManager.initialize === "function") {
      await this.persistenceManager.initialize();
    }
  }

  /**
   * Registers default triggers.
   * @private
   */
  _registerDefaultTriggers() {
    // Voice trigger
    if (this.config.get("integration.triggers.voice.enabled")) {
      this.registerTrigger(
        LearningIntegrationManager.TRIGGER_TYPES.VOICE,
        this.config.get("integration.triggers.voice"),
        async (voiceCommand) => {
          const commands = this.config.get("integration.triggers.voice.commands", []);
          
          if (!voiceCommand || !commands.includes(voiceCommand.toLowerCase())) {
            return null;
          }
          
          return await this.handleTrigger(LearningIntegrationManager.TRIGGER_TYPES.VOICE, { command: voiceCommand });
        }
      );
    }
    
    // Keyboard trigger
    if (this.config.get("integration.triggers.keyboard.enabled")) {
      this.registerTrigger(
        LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD,
        this.config.get("integration.triggers.keyboard"),
        async (keyboardEvent) => {
          const shortcut = this.config.get("integration.triggers.keyboard.shortcut");
          
          if (!keyboardEvent || keyboardEvent.shortcut !== shortcut) {
            return null;
          }
          
          return await this.handleTrigger(LearningIntegrationManager.TRIGGER_TYPES.KEYBOARD, { shortcut });
        }
      );
    }
    
    // Pattern trigger
    if (this.config.get("integration.triggers.pattern.enabled")) {
      this.registerTrigger(
        LearningIntegrationManager.TRIGGER_TYPES.PATTERN,
        this.config.get("integration.triggers.pattern"),
        async (patternData) => {
          const minRepetitions = this.config.get("integration.triggers.pattern.minRepetitions", 3);
          
          if (!patternData || !patternData.repetitions || patternData.repetitions < minRepetitions) {
            return null;
          }
          
          return await this.handleTrigger(LearningIntegrationManager.TRIGGER_TYPES.PATTERN, patternData);
        }
      );
    }
    
    // Scheduled trigger
    if (this.config.get("integration.triggers.scheduled.enabled")) {
      this.registerTrigger(
        LearningIntegrationManager.TRIGGER_TYPES.SCHEDULED,
        this.config.get("integration.triggers.scheduled"),
        async (scheduleData) => {
          if (!scheduleData || !scheduleData.scheduleId) {
            return null;
          }
          
          return await this.handleTrigger(LearningIntegrationManager.TRIGGER_TYPES.SCHEDULED, scheduleData);
        }
      );
    }
  }

  /**
   * Sets up integrations with other Aideon systems.
   * @returns {Promise<void>} Promise that resolves when setup is complete
   * @private
   */
  async _setupIntegrations() {
    // Avatar System integration
    if (this.config.get("integration.avatar.enabled")) {
      try {
        // This is a placeholder for actual Avatar System integration
        // In a real implementation, we would import and initialize the Avatar System
        this.logger.info("Setting up Avatar System integration");
        
        // Register integration
        this.registerIntegration("avatar", {
          updateState: (state, data) => {
            this.logger.debug(`Avatar state update: ${state}`, data);
            // In a real implementation, this would update the avatar state
          }
        });
      } catch (error) {
        this.logger.error("Failed to set up Avatar System integration", error);
      }
    }
    
    // MCP integration
    if (this.config.get("integration.mcp.enabled")) {
      try {
        // This is a placeholder for actual MCP integration
        // In a real implementation, we would import and initialize the MCP
        this.logger.info("Setting up MCP integration");
        
        // Register integration
        this.registerIntegration("mcp", {
          publishContext: (context) => {
            this.logger.debug("Publishing context to MCP", context);
            // In a real implementation, this would publish context to MCP
          }
        });
        
        // Set up periodic context updates
        if (this.config.get("integration.mcp.publishContext")) {
          const interval = this.config.get("integration.mcp.contextUpdateInterval", 5000);
          
          setInterval(() => {
            if (this.isLearning) {
              this._publishMCPContext();
            }
          }, interval);
        }
      } catch (error) {
        this.logger.error("Failed to set up MCP integration", error);
      }
    }
    
    // Task Automation System integration
    try {
      // This is a placeholder for actual Task Automation System integration
      this.logger.info("Setting up Task Automation System integration");
      
      // Register integration
      this.registerIntegration("taskAutomation", {
        executeProcedure: async (procedureId, parameters) => {
          this.logger.debug(`Executing procedure: ${procedureId}`, parameters);
          // In a real implementation, this would execute the procedure
          return { success: true, procedureId };
        }
      });
    } catch (error) {
      this.logger.error("Failed to set up Task Automation System integration", error);
    }
  }

  /**
   * Sets up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Listen for configuration changes
    this.config.addChangeListener((key, newValue, oldValue) => {
      this.logger.debug(`Configuration changed: ${key}`, { newValue, oldValue });
    });
    
    // Listen for demonstration capture events
    this.eventBus.on("capture:started", ({ sessionId }) => {
      this.logger.debug(`Capture started: ${sessionId}`);
    });
    
    this.eventBus.on("capture:stopped", ({ sessionId, actions }) => {
      this.logger.debug(`Capture stopped: ${sessionId}, ${actions.length} actions captured`);
    });
    
    this.eventBus.on("capture:action", ({ sessionId, action }) => {
      this.logger.debug(`Action captured: ${action.type} in session ${sessionId}`);
      
      // Update progress notification if enabled
      if (this.config.get("integration.notifications.showProgressNotification")) {
        this._showNotification("Learning in progress", `Captured action: ${action.type}`);
      }
    });
    
    // Listen for intent inference events
    this.eventBus.on("intent:inferred", ({ intentId, intent }) => {
      this.logger.debug(`Intent inferred: ${intentId} (${intent.name})`);
    });
    
    // Listen for procedure generation events
    this.eventBus.on("procedure:generated", ({ procedureId, procedure }) => {
      this.logger.debug(`Procedure generated: ${procedureId} (${procedure.name})`);
    });
    
    // Listen for procedure optimization events
    this.eventBus.on("procedure:optimized", ({ procedureId, procedure }) => {
      this.logger.debug(`Procedure optimized: ${procedureId} (${procedure.name})`);
    });
    
    // Listen for procedure persistence events
    this.eventBus.on("procedure:saved", ({ procedureId, procedure }) => {
      this.logger.debug(`Procedure saved: ${procedureId} (${procedure.name})`);
    });
  }

  /**
   * Checks if a trigger is enabled.
   * @param {string} triggerType - Type of trigger
   * @returns {boolean} True if trigger is enabled
   * @private
   */
  _isTriggerEnabled(triggerType) {
    // Check if trigger type is in enabled triggers list
    const enabledTriggers = this.config.get("integration.enabledTriggers", []);
    if (!enabledTriggers.includes(triggerType)) {
      return false;
    }
    
    // Check if trigger is registered and enabled
    const trigger = this.registeredTriggers.get(triggerType);
    return trigger && trigger.enabled;
  }

  /**
   * Checks security constraints before starting learning.
   * @param {string} triggerType - Type of trigger
   * @returns {Promise<boolean>} Promise resolving to true if constraints are met
   * @private
   */
  async _checkSecurityConstraints(triggerType) {
    const requireConfirmation = this.config.get("integration.security.requireConfirmation");
    
    if (requireConfirmation && triggerType !== LearningIntegrationManager.TRIGGER_TYPES.MANUAL) {
      // In a real implementation, this would show a confirmation dialog
      this.logger.debug("Security constraint: confirmation required");
      
      // For now, we'll just simulate confirmation
      return true;
    }
    
    return true;
  }

  /**
   * Shows a notification.
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @private
   */
  _showNotification(title, message) {
    // This is a placeholder for actual notification implementation
    this.logger.debug(`Notification: ${title} - ${message}`);
    
    // In a real implementation, this would show a system notification
    this.eventBus.emit("notification", { title, message });
  }

  /**
   * Updates the avatar state.
   * @param {string} state - New state
   * @param {Object} [data={}] - Additional data
   * @private
   */
  _updateAvatarState(state, data = {}) {
    const avatarIntegration = this.integrations.get("avatar");
    
    if (avatarIntegration && typeof avatarIntegration.updateState === "function") {
      avatarIntegration.updateState(state, data);
    }
  }

  /**
   * Publishes context to MCP.
   * @private
   */
  _publishMCPContext() {
    const mcpIntegration = this.integrations.get("mcp");
    
    if (mcpIntegration && typeof mcpIntegration.publishContext === "function") {
      const context = {
        type: "learning_from_demonstration",
        status: this.isLearning ? this.currentSession.status : "inactive",
        session: this.currentSession,
        timestamp: new Date()
      };
      
      mcpIntegration.publishContext(context);
    }
  }

  /**
   * Calculates elapsed time for the current session.
   * @returns {number} Elapsed time in milliseconds
   * @private
   */
  _calculateElapsedTime() {
    if (!this.isLearning || !this.currentSession) {
      return 0;
    }
    
    const now = new Date();
    let elapsed = 0;
    
    if (this.currentSession.status === "paused") {
      elapsed = this.currentSession.pausedAt - this.currentSession.startTime;
    } else {
      elapsed = now - this.currentSession.startTime;
    }
    
    return elapsed;
  }

  /**
   * Generates a unique ID.
   * @returns {string} Unique ID
   * @private
   */
  _generateId() {
    return `lfd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

module.exports = LearningIntegrationManager;
