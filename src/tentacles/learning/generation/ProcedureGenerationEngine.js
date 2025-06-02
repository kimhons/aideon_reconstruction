/**
 * @fileoverview ProcedureGenerationEngine for the Learning from Demonstration system.
 * Generates executable procedures from demonstrations and inferred intents.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require("../common/events/EventBus");
const Logger = require("../common/utils/Logger");
const Configuration = require("../common/utils/Configuration");
const { LearningError, ValidationError, OperationError } = require("../common/utils/ErrorHandler");
const Procedure = require("../common/models/Procedure");
const Action = require("../common/models/Action");
const Intent = require("../common/models/Intent");
const { v4: uuidv4 } = require("uuid");

/**
 * Generates executable procedures from demonstrations and inferred intents.
 */
class ProcedureGenerationEngine {
  /**
   * Generation strategies
   * @enum {string}
   */
  static STRATEGIES = {
    DIRECT_MAPPING: "direct_mapping",
    TEMPLATE_BASED: "template_based",
    AI_ASSISTED: "ai_assisted" // Placeholder for future implementation
  };

  /**
   * Creates a new ProcedureGenerationEngine instance.
   * @param {Object} options - Engine options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger("ProcedureGenerationEngine");
    this.config = options.config || new Configuration(ProcedureGenerationEngine.defaultConfig());
    
    this.generationStrategies = new Map();
    
    this._setupEventListeners();
    this._registerDefaultStrategies();
    
    this.logger.info("ProcedureGenerationEngine initialized");
  }

  /**
   * Default configuration for the ProcedureGenerationEngine.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      generation: {
        defaultStrategy: ProcedureGenerationEngine.STRATEGIES.DIRECT_MAPPING,
        minActionCount: 3,
        maxSteps: 100,
        parameterizeSteps: true,
        addControlFlow: false, // Future feature
        simplifySequences: true,
        strategies: {
          direct_mapping: {
            enabled: true,
            weight: 1.0
          },
          template_based: {
            enabled: true,
            weight: 0.8,
            templatePath: "./templates/procedures"
          },
          ai_assisted: {
            enabled: false,
            weight: 0.6,
            modelEndpoint: ""
          }
        }
      }
    };
  }

  /**
   * Generates a procedure from a demonstration and inferred intent.
   * @param {Object} demonstration - Demonstration object
   * @param {Intent} intent - Inferred intent object
   * @param {Object} [options={}] - Generation options
   * @param {string} [options.strategy] - Specific strategy to use
   * @returns {Promise<Procedure|null>} Promise resolving to the generated procedure or null
   */
  async generateProcedure(demonstration, intent, options = {}) {
    if (!demonstration || !demonstration.actions || !Array.isArray(demonstration.actions)) {
      throw new ValidationError("Invalid demonstration object");
    }
    
    if (!(intent instanceof Intent)) {
      throw new ValidationError("Invalid intent object");
    }
    
    const actions = demonstration.actions;
    const minActionCount = this.config.get("generation.minActionCount", 3);
    
    if (actions.length < minActionCount) {
      this.logger.warn(`Demonstration has too few actions (${actions.length} < ${minActionCount}), skipping procedure generation.`);
      return null;
    }
    
    try {
      this.logger.debug("Generating procedure", {
        demonstrationId: demonstration.id,
        intentId: intent.id,
        strategy: options.strategy || this.config.get("generation.defaultStrategy")
      });
      
      const strategyName = options.strategy || this.config.get("generation.defaultStrategy");
      const strategy = this.generationStrategies.get(strategyName);
      
      if (!strategy) {
        throw new OperationError(`Generation strategy not found: ${strategyName}`);
      }
      
      // Generate procedure using the selected strategy
      const procedure = await strategy.generate(demonstration, intent, this.config.scope("generation"));
      
      if (!procedure) {
        this.logger.warn("Procedure generation failed or returned null");
        return null;
      }
      
      // Validate and potentially optimize the procedure
      this._validateProcedure(procedure);
      
      if (this.config.get("generation.simplifySequences")) {
        this._simplifyProcedure(procedure);
      }
      
      this.logger.info(`Generated procedure: ${procedure.id} (${procedure.name})`);
      this.eventBus.emit("procedure:generated", { procedureId: procedure.id, procedure });
      
      return procedure;
    } catch (error) {
      this.logger.error("Failed to generate procedure", error);
      this.eventBus.emit("generation:error", { error });
      throw new LearningError("Failed to generate procedure", error);
    }
  }

  /**
   * Registers a generation strategy.
   * @param {string} strategyName - Unique name for the strategy
   * @param {Object} strategy - Strategy implementation
   * @returns {ProcedureGenerationEngine} This instance for chaining
   */
  registerGenerationStrategy(strategyName, strategy) {
    if (!strategyName || typeof strategyName !== "string") {
      throw new ValidationError("Strategy name is required and must be a string");
    }
    
    if (!strategy || typeof strategy.generate !== "function") {
      throw new ValidationError("Strategy must implement generate method");
    }
    
    this.generationStrategies.set(strategyName, strategy);
    this.logger.info(`Registered generation strategy: ${strategyName}`);
    
    return this;
  }

  /**
   * Unregisters a generation strategy.
   * @param {string} strategyName - Name of the strategy to unregister
   * @returns {boolean} True if strategy was unregistered, false if not found
   */
  unregisterGenerationStrategy(strategyName) {
    const result = this.generationStrategies.delete(strategyName);
    
    if (result) {
      this.logger.info(`Unregistered generation strategy: ${strategyName}`);
    }
    
    return result;
  }

  /**
   * Registers default generation strategies.
   * @private
   */
  _registerDefaultStrategies() {
    // Direct Mapping Strategy
    this.registerGenerationStrategy(ProcedureGenerationEngine.STRATEGIES.DIRECT_MAPPING, {
      generate: async (demonstration, intent, config) => {
        const actions = demonstration.actions || [];
        const parameterize = config.get("parameterizeSteps", true);
        
        const steps = actions.map((action, index) => {
          const step = {
            id: `step_${index + 1}`,
            type: this._mapActionTypeToStepType(action.type),
            action: action.type,
            parameters: { ...action.data },
            order: index + 1,
            description: this._generateStepDescription(action)
          };
          
          // Parameterize step if enabled
          if (parameterize) {
            this._parameterizeStep(step, intent);
          }
          
          return step;
        });
        
        // Limit number of steps
        const maxSteps = config.get("maxSteps", 100);
        if (steps.length > maxSteps) {
          this.logger.warn(`Procedure exceeds max steps (${steps.length} > ${maxSteps}), truncating.`);
          steps.length = maxSteps;
        }
        
        return new Procedure({
          id: uuidv4(),
          name: intent.name || "Generated Procedure",
          description: intent.description || "Procedure generated from demonstration",
          version: "1.0.0",
          createdAt: new Date(),
          updatedAt: new Date(),
          source: {
            demonstrationId: demonstration.id,
            intentId: intent.id,
            strategy: ProcedureGenerationEngine.STRATEGIES.DIRECT_MAPPING
          },
          steps,
          parameters: intent.parameters || {},
          metadata: {
            confidence: intent.confidence,
            actionCount: actions.length,
            originalDemonstrationName: demonstration.name,
            originalDemonstrationMetadata: demonstration.metadata
          }
        });
      }
    });
    
    // Template Based Strategy
    this.registerGenerationStrategy(ProcedureGenerationEngine.STRATEGIES.TEMPLATE_BASED, {
      generate: async (demonstration, intent, config) => {
        // Placeholder for template-based generation
        // This would involve finding a matching procedure template based on the intent
        // and filling it in using the demonstration actions.
        this.logger.warn("Template-based generation strategy is not yet fully implemented.");
        
        // Fallback to direct mapping for now
        const directMappingStrategy = this.generationStrategies.get(ProcedureGenerationEngine.STRATEGIES.DIRECT_MAPPING);
        return await directMappingStrategy.generate(demonstration, intent, config);
      }
    });
    
    // AI Assisted Strategy
    this.registerGenerationStrategy(ProcedureGenerationEngine.STRATEGIES.AI_ASSISTED, {
      generate: async (demonstration, intent, config) => {
        // Placeholder for AI-assisted generation
        // This would involve sending the demonstration and intent to an AI model
        // to generate a more robust or generalized procedure.
        this.logger.warn("AI-assisted generation strategy is not yet implemented.");
        
        // Fallback to direct mapping for now
        const directMappingStrategy = this.generationStrategies.get(ProcedureGenerationEngine.STRATEGIES.DIRECT_MAPPING);
        return await directMappingStrategy.generate(demonstration, intent, config);
      }
    });
  }

  /**
   * Maps an action type to a procedure step type.
   * @param {string} actionType - Action type
   * @returns {string} Step type
   * @private
   */
  _mapActionTypeToStepType(actionType) {
    switch (actionType) {
      case Action.TYPES.MOUSE_MOVE:
      case Action.TYPES.MOUSE_CLICK:
      case Action.TYPES.MOUSE_DRAG:
      case Action.TYPES.MOUSE_SCROLL:
        return Procedure.STEP_TYPES.INPUT;
        
      case Action.TYPES.KEY_PRESS:
      case Action.TYPES.TEXT_INPUT:
        return Procedure.STEP_TYPES.INPUT;
        
      case Action.TYPES.UI_INTERACTION:
        return Procedure.STEP_TYPES.UI;
        
      case Action.TYPES.SYSTEM_EVENT:
        return Procedure.STEP_TYPES.SYSTEM;
        
      case Action.TYPES.API_CALL:
        return Procedure.STEP_TYPES.API;
        
      case Action.TYPES.WAIT:
        return Procedure.STEP_TYPES.WAIT;
        
      default:
        return Procedure.STEP_TYPES.CUSTOM;
    }
  }

  /**
   * Generates a description for a procedure step based on the action.
   * @param {Action} action - Action object
   * @returns {string} Step description
   * @private
   */
  _generateStepDescription(action) {
    switch (action.type) {
      case Action.TYPES.MOUSE_CLICK:
        const button = action.data.button || "left";
        const doubleClick = action.data.doubleClick ? "double-click" : "click";
        return `${doubleClick} ${button} mouse button at (${action.data.x}, ${action.data.y})`;
        
      case Action.TYPES.MOUSE_MOVE:
        return `Move mouse to (${action.data.x}, ${action.data.y})`;
        
      case Action.TYPES.MOUSE_DRAG:
        return `Drag mouse from (${action.data.startX}, ${action.data.startY}) to (${action.data.endX}, ${action.data.endY})`;
        
      case Action.TYPES.MOUSE_SCROLL:
        const direction = action.data.deltaY > 0 ? "down" : "up";
        return `Scroll ${direction} by ${Math.abs(action.data.deltaY)} units`;
        
      case Action.TYPES.KEY_PRESS:
        const modifiers = [];
        if (action.data.ctrl) modifiers.push("Ctrl");
        if (action.data.alt) modifiers.push("Alt");
        if (action.data.shift) modifiers.push("Shift");
        if (action.data.meta) modifiers.push("Meta");
        const modifierString = modifiers.length > 0 ? `${modifiers.join("+")}+` : "";
        return `Press ${modifierString}${action.data.key}`;
        
      case Action.TYPES.TEXT_INPUT:
        const text = action.data.text || "";
        const truncatedText = text.length > 20 ? `${text.substring(0, 20)}...` : text;
        return `Enter text: "${truncatedText}"`;
        
      case Action.TYPES.UI_INTERACTION:
        const elementType = action.data.elementType || "element";
        const actionName = action.data.action || "interact with";
        let elementDesc = "";
        if (action.data.elementProperties) {
          if (action.data.elementProperties.id) elementDesc = ` with ID "${action.data.elementProperties.id}"`;
          else if (action.data.elementProperties.name) elementDesc = ` named "${action.data.elementProperties.name}"`;
          else if (action.data.elementProperties.className) elementDesc = ` with class "${action.data.elementProperties.className}"`;
        }
        return `${actionName} ${elementType}${elementDesc}`;
        
      case Action.TYPES.SYSTEM_EVENT:
        return `System event: ${action.data.category || "unknown"} - ${action.data.action || "unknown"}`;
        
      case Action.TYPES.API_CALL:
        return `API call to ${action.data.endpoint || "unknown endpoint"}`;
        
      case Action.TYPES.WAIT:
        const duration = action.data.duration || 1000;
        return `Wait for ${duration} milliseconds`;
        
      default:
        return `Perform ${action.type} action`;
    }
  }

  /**
   * Parameterizes a procedure step based on intent parameters.
   * @param {Object} step - Procedure step object
   * @param {Intent} intent - Inferred intent object
   * @private
   */
  _parameterizeStep(step, intent) {
    if (!intent.parameters || Object.keys(intent.parameters).length === 0) {
      return; // No intent parameters to use
    }
    
    // Iterate through step parameters and try to match with intent parameters
    for (const [paramKey, paramValue] of Object.entries(step.parameters)) {
      // Example: Parameterize text input based on intent parameter
      if (step.action === Action.TYPES.TEXT_INPUT && paramKey === "text") {
        for (const [intentParamKey, intentParam] of Object.entries(intent.parameters)) {
          // Simple matching logic (can be improved)
          if (typeof paramValue === "string" && 
              typeof intentParam.value === "string" && 
              paramValue.includes(intentParam.value)) {
            
            step.parameters[paramKey] = `{{${intentParamKey}}}`; // Replace with parameter placeholder
            step.description = `Enter text from parameter: ${intentParamKey}`;
            break; // Assume first match is sufficient
          }
        }
      }
      
      // Example: Parameterize UI element interaction based on intent parameter
      if (step.action === Action.TYPES.UI_INTERACTION && paramKey === "elementProperties") {
        for (const [intentParamKey, intentParam] of Object.entries(intent.parameters)) {
          if (typeof intentParam.value === "string" && 
              (paramValue.id === intentParam.value || 
               paramValue.name === intentParam.value || 
               paramValue.text === intentParam.value)) {
            
            step.parameters[paramKey] = { selector: `{{${intentParamKey}}}` }; // Use selector placeholder
            step.description = `Interact with element specified by parameter: ${intentParamKey}`;
            break;
          }
        }
      }
      
      // Add more parameterization rules as needed
    }
  }

  /**
   * Validates a generated procedure.
   * @param {Procedure} procedure - Procedure to validate
   * @private
   */
  _validateProcedure(procedure) {
    if (!(procedure instanceof Procedure)) {
      throw new ValidationError("Invalid procedure object for validation");
    }
    
    if (!procedure.id || !procedure.name || !procedure.steps || !Array.isArray(procedure.steps)) {
      throw new ValidationError("Procedure is missing required fields (id, name, steps)");
    }
    
    if (procedure.steps.length === 0) {
      this.logger.warn(`Generated procedure has no steps: ${procedure.id}`);
    }
    
    // Check step validity
    for (const step of procedure.steps) {
      if (!step.id || !step.type || !step.action || !step.parameters || !step.order) {
        throw new ValidationError(`Invalid step found in procedure ${procedure.id}: ${JSON.stringify(step)}`);
      }
    }
    
    this.logger.debug(`Procedure validation passed: ${procedure.id}`);
  }

  /**
   * Simplifies a procedure by removing redundant actions.
   * @param {Procedure} procedure - Procedure to simplify
   * @private
   */
  _simplifyProcedure(procedure) {
    if (!procedure || !procedure.steps || procedure.steps.length < 2) {
      return; // Nothing to simplify
    }
    
    const originalStepCount = procedure.steps.length;
    const simplifiedSteps = [];
    
    let lastStep = null;
    
    for (const currentStep of procedure.steps) {
      let skipStep = false;
      
      if (lastStep) {
        // Rule 1: Remove consecutive identical MOUSE_MOVE steps
        if (currentStep.action === Action.TYPES.MOUSE_MOVE && 
            lastStep.action === Action.TYPES.MOUSE_MOVE) {
          skipStep = true; // Keep only the last MOUSE_MOVE in a sequence
        }
        
        // Rule 2: Remove MOUSE_MOVE immediately before a MOUSE_CLICK at the same location
        if (currentStep.action === Action.TYPES.MOUSE_CLICK && 
            lastStep.action === Action.TYPES.MOUSE_MOVE &&
            currentStep.parameters.x === lastStep.parameters.x &&
            currentStep.parameters.y === lastStep.parameters.y) {
          // The MOUSE_MOVE is redundant, skip it (by not adding the lastStep)
          if (simplifiedSteps.length > 0 && simplifiedSteps[simplifiedSteps.length - 1] === lastStep) {
            simplifiedSteps.pop();
          }
        }
        
        // Rule 3: Combine consecutive TEXT_INPUT steps
        if (currentStep.action === Action.TYPES.TEXT_INPUT && 
            lastStep.action === Action.TYPES.TEXT_INPUT &&
            simplifiedSteps.length > 0 && 
            simplifiedSteps[simplifiedSteps.length - 1] === lastStep) {
          
          // Append text to the last step
          const lastTextInputStep = simplifiedSteps[simplifiedSteps.length - 1];
          lastTextInputStep.parameters.text = (lastTextInputStep.parameters.text || "") + (currentStep.parameters.text || "");
          lastTextInputStep.description = this._generateStepDescription(lastTextInputStep);
          skipStep = true; // Skip adding the current step as it was merged
        }
        
        // Add more simplification rules as needed
      }
      
      if (!skipStep) {
        simplifiedSteps.push(currentStep);
      }
      
      lastStep = currentStep;
    }
    
    // Re-order steps
    procedure.steps = simplifiedSteps.map((step, index) => ({ ...step, order: index + 1 }));
    
    const removedCount = originalStepCount - procedure.steps.length;
    if (removedCount > 0) {
      this.logger.debug(`Simplified procedure ${procedure.id}, removed ${removedCount} redundant steps.`);
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
    
    // Listen for intent inference results
    this.eventBus.on("intent:inferred", async ({ intentId, intent, demonstration }) => {
      // Auto-generate procedure if configured
      if (this.config.get("generation.autoGenerate")) {
        if (!demonstration) {
          this.logger.warn("Cannot auto-generate procedure without demonstration object");
          return;
        }
        
        try {
          this.logger.debug("Auto-generating procedure for inferred intent");
          await this.generateProcedure(demonstration, intent);
        } catch (error) {
          this.logger.error("Failed to auto-generate procedure", error);
        }
      }
    });
  }
}

module.exports = ProcedureGenerationEngine;
