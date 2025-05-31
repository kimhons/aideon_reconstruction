/**
 * @fileoverview ProcedureOptimizationSystem for the Learning from Demonstration system.
 * Optimizes generated procedures for efficiency, robustness, and adaptability.
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

/**
 * Optimizes generated procedures for efficiency, robustness, and adaptability.
 */
class ProcedureOptimizationSystem {
  /**
   * Optimization techniques
   * @enum {string}
   */
  static TECHNIQUES = {
    REDUNDANCY_REMOVAL: "redundancy_removal",
    TIMING_OPTIMIZATION: "timing_optimization",
    ERROR_HANDLING: "error_handling",
    CONDITIONAL_BRANCHING: "conditional_branching",
    LOOP_DETECTION: "loop_detection",
    VARIABLE_EXTRACTION: "variable_extraction"
  };

  /**
   * Creates a new ProcedureOptimizationSystem instance.
   * @param {Object} options - System options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger("ProcedureOptimizationSystem");
    this.config = options.config || new Configuration(ProcedureOptimizationSystem.defaultConfig());
    
    this.optimizationTechniques = new Map();
    
    this._setupEventListeners();
    this._registerDefaultTechniques();
    
    this.logger.info("ProcedureOptimizationSystem initialized");
  }

  /**
   * Default configuration for the ProcedureOptimizationSystem.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      optimization: {
        autoOptimize: true,
        techniques: {
          redundancy_removal: {
            enabled: true,
            weight: 1.0,
            minRedundancyThreshold: 0.8
          },
          timing_optimization: {
            enabled: true,
            weight: 0.8,
            minWaitTime: 100,
            maxWaitTime: 5000,
            dynamicWaits: true
          },
          error_handling: {
            enabled: true,
            weight: 0.9,
            retryCount: 3,
            retryDelay: 1000,
            addTimeouts: true
          },
          conditional_branching: {
            enabled: false,
            weight: 0.7,
            maxBranchDepth: 2
          },
          loop_detection: {
            enabled: true,
            weight: 0.8,
            minRepetitions: 2,
            maxLoopIterations: 10
          },
          variable_extraction: {
            enabled: true,
            weight: 0.9,
            extractTextInputs: true,
            extractSelectors: true
          }
        }
      }
    };
  }

  /**
   * Optimizes a procedure using configured techniques.
   * @param {Procedure} procedure - Procedure to optimize
   * @param {Object} [options={}] - Optimization options
   * @param {Array<string>} [options.techniques] - Specific techniques to apply
   * @param {boolean} [options.createCopy=true] - Whether to create a copy or modify in place
   * @returns {Promise<Procedure>} Promise resolving to the optimized procedure
   */
  async optimizeProcedure(procedure, options = {}) {
    if (!(procedure instanceof Procedure)) {
      throw new ValidationError("Invalid procedure object");
    }
    
    const createCopy = options.createCopy !== false;
    const workingProcedure = createCopy ? procedure.clone() : procedure;
    
    try {
      this.logger.debug("Optimizing procedure", {
        procedureId: workingProcedure.id,
        techniques: options.techniques || "all enabled"
      });
      
      // Determine which techniques to apply
      const techniquesToApply = options.techniques || 
        Array.from(this.optimizationTechniques.keys())
          .filter(technique => this.config.get(`optimization.techniques.${technique}.enabled`, false));
      
      if (techniquesToApply.length === 0) {
        this.logger.warn("No optimization techniques enabled or specified");
        return workingProcedure;
      }
      
      // Apply each technique in sequence
      for (const techniqueName of techniquesToApply) {
        const technique = this.optimizationTechniques.get(techniqueName);
        
        if (!technique) {
          this.logger.warn(`Optimization technique not found: ${techniqueName}`);
          continue;
        }
        
        const techniqueConfig = this.config.scope(`optimization.techniques.${techniqueName}`);
        
        if (!techniqueConfig.get("enabled", true)) {
          this.logger.debug(`Skipping disabled technique: ${techniqueName}`);
          continue;
        }
        
        this.logger.debug(`Applying optimization technique: ${techniqueName}`);
        await technique.optimize(workingProcedure, techniqueConfig);
      }
      
      // Update metadata
      workingProcedure.metadata = workingProcedure.metadata || {};
      workingProcedure.metadata.optimized = true;
      workingProcedure.metadata.optimizationTechniques = techniquesToApply;
      workingProcedure.metadata.optimizedAt = new Date();
      workingProcedure.updatedAt = new Date();
      
      this.logger.info(`Optimized procedure: ${workingProcedure.id}`);
      this.eventBus.emit("procedure:optimized", { procedureId: workingProcedure.id, procedure: workingProcedure });
      
      return workingProcedure;
    } catch (error) {
      this.logger.error("Failed to optimize procedure", error);
      this.eventBus.emit("optimization:error", { error, procedureId: workingProcedure.id });
      throw new LearningError("Failed to optimize procedure", error);
    }
  }

  /**
   * Registers an optimization technique.
   * @param {string} techniqueName - Unique name for the technique
   * @param {Object} technique - Technique implementation
   * @returns {ProcedureOptimizationSystem} This instance for chaining
   */
  registerOptimizationTechnique(techniqueName, technique) {
    if (!techniqueName || typeof techniqueName !== "string") {
      throw new ValidationError("Technique name is required and must be a string");
    }
    
    if (!technique || typeof technique.optimize !== "function") {
      throw new ValidationError("Technique must implement optimize method");
    }
    
    this.optimizationTechniques.set(techniqueName, technique);
    this.logger.info(`Registered optimization technique: ${techniqueName}`);
    
    return this;
  }

  /**
   * Unregisters an optimization technique.
   * @param {string} techniqueName - Name of the technique to unregister
   * @returns {boolean} True if technique was unregistered, false if not found
   */
  unregisterOptimizationTechnique(techniqueName) {
    const result = this.optimizationTechniques.delete(techniqueName);
    
    if (result) {
      this.logger.info(`Unregistered optimization technique: ${techniqueName}`);
    }
    
    return result;
  }

  /**
   * Analyzes a procedure and returns optimization recommendations.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Promise<Object>} Promise resolving to optimization recommendations
   */
  async analyzeProcedure(procedure) {
    if (!(procedure instanceof Procedure)) {
      throw new ValidationError("Invalid procedure object");
    }
    
    try {
      this.logger.debug(`Analyzing procedure: ${procedure.id}`);
      
      const recommendations = {
        procedureId: procedure.id,
        recommendations: [],
        metrics: {
          redundancy: 0,
          efficiency: 0,
          robustness: 0,
          adaptability: 0
        }
      };
      
      // Check for redundant steps
      const redundantSteps = this._findRedundantSteps(procedure);
      if (redundantSteps.length > 0) {
        recommendations.recommendations.push({
          technique: ProcedureOptimizationSystem.TECHNIQUES.REDUNDANCY_REMOVAL,
          description: `Found ${redundantSteps.length} redundant steps that could be removed`,
          impact: "medium",
          details: { redundantStepIds: redundantSteps.map(step => step.id) }
        });
        
        recommendations.metrics.redundancy = redundantSteps.length / procedure.steps.length;
      }
      
      // Check for timing optimization opportunities
      const timingIssues = this._findTimingIssues(procedure);
      if (timingIssues.length > 0) {
        recommendations.recommendations.push({
          technique: ProcedureOptimizationSystem.TECHNIQUES.TIMING_OPTIMIZATION,
          description: `Found ${timingIssues.length} steps with timing issues`,
          impact: "high",
          details: { timingIssues }
        });
        
        recommendations.metrics.efficiency = 1 - (timingIssues.length / procedure.steps.length);
      }
      
      // Check for error handling opportunities
      const errorProneSteps = this._findErrorProneSteps(procedure);
      if (errorProneSteps.length > 0) {
        recommendations.recommendations.push({
          technique: ProcedureOptimizationSystem.TECHNIQUES.ERROR_HANDLING,
          description: `Found ${errorProneSteps.length} steps that could benefit from error handling`,
          impact: "high",
          details: { errorProneStepIds: errorProneSteps.map(step => step.id) }
        });
        
        recommendations.metrics.robustness = 1 - (errorProneSteps.length / procedure.steps.length);
      }
      
      // Check for loop opportunities
      const loopOpportunities = this._findLoopOpportunities(procedure);
      if (loopOpportunities.length > 0) {
        recommendations.recommendations.push({
          technique: ProcedureOptimizationSystem.TECHNIQUES.LOOP_DETECTION,
          description: `Found ${loopOpportunities.length} potential loops`,
          impact: "medium",
          details: { loopOpportunities }
        });
      }
      
      // Check for variable extraction opportunities
      const variableOpportunities = this._findVariableOpportunities(procedure);
      if (variableOpportunities.length > 0) {
        recommendations.recommendations.push({
          technique: ProcedureOptimizationSystem.TECHNIQUES.VARIABLE_EXTRACTION,
          description: `Found ${variableOpportunities.length} opportunities for variable extraction`,
          impact: "medium",
          details: { variableOpportunities }
        });
        
        recommendations.metrics.adaptability = variableOpportunities.length / 10; // Arbitrary scale
      }
      
      this.logger.info(`Analysis complete for procedure: ${procedure.id}`);
      this.eventBus.emit("procedure:analyzed", { procedureId: procedure.id, recommendations });
      
      return recommendations;
    } catch (error) {
      this.logger.error("Failed to analyze procedure", error);
      throw new LearningError("Failed to analyze procedure", error);
    }
  }

  /**
   * Registers default optimization techniques.
   * @private
   */
  _registerDefaultTechniques() {
    // Redundancy Removal Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.REDUNDANCY_REMOVAL, {
      optimize: async (procedure, config) => {
        const redundantSteps = this._findRedundantSteps(procedure);
        
        if (redundantSteps.length === 0) {
          return procedure; // No redundancies found
        }
        
        this.logger.debug(`Found ${redundantSteps.length} redundant steps to remove`);
        
        // Remove redundant steps
        const redundantStepIds = new Set(redundantSteps.map(step => step.id));
        procedure.steps = procedure.steps.filter(step => !redundantStepIds.has(step.id));
        
        // Re-order remaining steps
        procedure.steps = procedure.steps.map((step, index) => ({ ...step, order: index + 1 }));
        
        return procedure;
      }
    });
    
    // Timing Optimization Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.TIMING_OPTIMIZATION, {
      optimize: async (procedure, config) => {
        const minWaitTime = config.get("minWaitTime", 100);
        const maxWaitTime = config.get("maxWaitTime", 5000);
        const dynamicWaits = config.get("dynamicWaits", true);
        
        // Optimize wait times
        for (const step of procedure.steps) {
          if (step.type === Procedure.STEP_TYPES.WAIT) {
            // Ensure wait times are within reasonable bounds
            if (step.parameters.duration < minWaitTime) {
              step.parameters.duration = minWaitTime;
              step.description = `Wait for ${minWaitTime} milliseconds`;
            } else if (step.parameters.duration > maxWaitTime) {
              step.parameters.duration = maxWaitTime;
              step.description = `Wait for ${maxWaitTime} milliseconds`;
            }
          }
        }
        
        // Add dynamic waits if enabled
        if (dynamicWaits) {
          // Find UI interactions that might need waits
          for (let i = 0; i < procedure.steps.length - 1; i++) {
            const currentStep = procedure.steps[i];
            const nextStep = procedure.steps[i + 1];
            
            // If a UI interaction is followed by another action without a wait
            if (currentStep.action === Action.TYPES.UI_INTERACTION && 
                nextStep.type !== Procedure.STEP_TYPES.WAIT) {
              
              // Insert a dynamic wait step
              const waitStep = {
                id: `wait_after_${currentStep.id}`,
                type: Procedure.STEP_TYPES.WAIT,
                action: Action.TYPES.WAIT,
                parameters: {
                  duration: 500, // Default wait time
                  dynamic: true, // Flag as dynamic wait
                  condition: {
                    type: "element_state",
                    target: currentStep.parameters.elementProperties || {},
                    state: "stable"
                  }
                },
                order: currentStep.order + 0.5, // Insert between steps
                description: "Wait for UI to stabilize"
              };
              
              procedure.steps.push(waitStep);
            }
          }
          
          // Re-sort steps by order
          procedure.steps.sort((a, b) => a.order - b.order);
          
          // Re-number steps
          procedure.steps = procedure.steps.map((step, index) => ({ ...step, order: index + 1 }));
        }
        
        return procedure;
      }
    });
    
    // Error Handling Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.ERROR_HANDLING, {
      optimize: async (procedure, config) => {
        const retryCount = config.get("retryCount", 3);
        const retryDelay = config.get("retryDelay", 1000);
        const addTimeouts = config.get("addTimeouts", true);
        
        // Find error-prone steps
        const errorProneSteps = this._findErrorProneSteps(procedure);
        
        for (const step of errorProneSteps) {
          // Add retry logic
          step.errorHandling = {
            retry: {
              count: retryCount,
              delay: retryDelay
            },
            fallback: {
              action: "skip" // Default fallback action
            }
          };
          
          // Add timeout if configured
          if (addTimeouts) {
            step.errorHandling.timeout = 10000; // Default 10 second timeout
          }
          
          // Update description
          step.description = `${step.description} (with error handling)`;
        }
        
        return procedure;
      }
    });
    
    // Loop Detection Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.LOOP_DETECTION, {
      optimize: async (procedure, config) => {
        const minRepetitions = config.get("minRepetitions", 2);
        const maxLoopIterations = config.get("maxLoopIterations", 10);
        
        // Find loop opportunities
        const loopOpportunities = this._findLoopOpportunities(procedure);
        
        if (loopOpportunities.length === 0) {
          return procedure; // No loops found
        }
        
        // Process each loop opportunity
        for (const loop of loopOpportunities) {
          if (loop.repetitions < minRepetitions) {
            continue; // Skip if below threshold
          }
          
          // Extract the steps in the loop
          const loopSteps = procedure.steps.slice(loop.startIndex, loop.endIndex + 1);
          
          // Create a loop step to replace the repeated steps
          const loopStep = {
            id: `loop_${loop.startIndex}_${loop.endIndex}`,
            type: Procedure.STEP_TYPES.CONTROL,
            action: "LOOP",
            parameters: {
              iterations: loop.repetitions,
              maxIterations: maxLoopIterations,
              steps: loopSteps.map(step => ({ ...step })) // Clone steps
            },
            order: loop.startIndex + 1,
            description: `Repeat ${loopSteps.length} steps ${loop.repetitions} times`
          };
          
          // Remove the original repeated steps
          procedure.steps = [
            ...procedure.steps.slice(0, loop.startIndex),
            loopStep,
            ...procedure.steps.slice(loop.endIndex + 1)
          ];
          
          // Re-number steps
          procedure.steps = procedure.steps.map((step, index) => ({ ...step, order: index + 1 }));
        }
        
        return procedure;
      }
    });
    
    // Variable Extraction Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.VARIABLE_EXTRACTION, {
      optimize: async (procedure, config) => {
        const extractTextInputs = config.get("extractTextInputs", true);
        const extractSelectors = config.get("extractSelectors", true);
        
        // Find variable opportunities
        const variableOpportunities = this._findVariableOpportunities(procedure);
        
        if (variableOpportunities.length === 0) {
          return procedure; // No variables to extract
        }
        
        // Initialize variables collection if not exists
        procedure.variables = procedure.variables || {};
        
        // Process each variable opportunity
        for (const variable of variableOpportunities) {
          if (variable.type === "text" && extractTextInputs) {
            // Extract text input as variable
            const varName = `input_${Object.keys(procedure.variables).length + 1}`;
            procedure.variables[varName] = {
              type: "string",
              defaultValue: variable.value,
              description: `Extracted from step ${variable.stepId}`
            };
            
            // Update step to use variable
            const step = procedure.steps.find(s => s.id === variable.stepId);
            if (step) {
              step.parameters.text = `{{${varName}}}`;
              step.description = `Enter text from variable: ${varName}`;
            }
          } else if (variable.type === "selector" && extractSelectors) {
            // Extract selector as variable
            const varName = `selector_${Object.keys(procedure.variables).length + 1}`;
            procedure.variables[varName] = {
              type: "selector",
              defaultValue: variable.value,
              description: `Extracted from step ${variable.stepId}`
            };
            
            // Update step to use variable
            const step = procedure.steps.find(s => s.id === variable.stepId);
            if (step && step.parameters.elementProperties) {
              step.parameters.elementProperties.selector = `{{${varName}}}`;
              step.description = `Interact with element from variable: ${varName}`;
            }
          }
        }
        
        return procedure;
      }
    });
    
    // Conditional Branching Technique
    this.registerOptimizationTechnique(ProcedureOptimizationSystem.TECHNIQUES.CONDITIONAL_BRANCHING, {
      optimize: async (procedure, config) => {
        // This is a placeholder for future implementation
        // Conditional branching is more complex and would require deeper analysis
        this.logger.warn("Conditional branching optimization is not yet fully implemented");
        return procedure;
      }
    });
  }

  /**
   * Finds redundant steps in a procedure.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Array<Object>} Array of redundant steps
   * @private
   */
  _findRedundantSteps(procedure) {
    const redundantSteps = [];
    
    // Skip if too few steps
    if (!procedure.steps || procedure.steps.length < 3) {
      return redundantSteps;
    }
    
    // Check for consecutive identical mouse moves
    let lastMouseMoveStep = null;
    
    for (const step of procedure.steps) {
      if (step.action === Action.TYPES.MOUSE_MOVE) {
        if (lastMouseMoveStep && 
            Math.abs(step.parameters.x - lastMouseMoveStep.parameters.x) < 5 &&
            Math.abs(step.parameters.y - lastMouseMoveStep.parameters.y) < 5) {
          // Mouse move to nearly the same location
          redundantSteps.push(lastMouseMoveStep);
        }
        lastMouseMoveStep = step;
      } else {
        lastMouseMoveStep = null;
      }
      
      // Check for no-op steps
      if (step.action === Action.TYPES.WAIT && step.parameters.duration < 50) {
        redundantSteps.push(step); // Too short to be useful
      }
      
      // Check for empty text inputs
      if (step.action === Action.TYPES.TEXT_INPUT && 
          (!step.parameters.text || step.parameters.text.trim() === "")) {
        redundantSteps.push(step);
      }
    }
    
    // Check for mouse moves immediately before clicks at the same location
    for (let i = 0; i < procedure.steps.length - 1; i++) {
      const currentStep = procedure.steps[i];
      const nextStep = procedure.steps[i + 1];
      
      if (currentStep.action === Action.TYPES.MOUSE_MOVE && 
          nextStep.action === Action.TYPES.MOUSE_CLICK &&
          Math.abs(currentStep.parameters.x - nextStep.parameters.x) < 5 &&
          Math.abs(currentStep.parameters.y - nextStep.parameters.y) < 5) {
        redundantSteps.push(currentStep);
      }
    }
    
    return redundantSteps;
  }

  /**
   * Finds timing issues in a procedure.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Array<Object>} Array of timing issues
   * @private
   */
  _findTimingIssues(procedure) {
    const timingIssues = [];
    
    // Skip if too few steps
    if (!procedure.steps || procedure.steps.length < 2) {
      return timingIssues;
    }
    
    // Check for missing waits after UI interactions
    for (let i = 0; i < procedure.steps.length - 1; i++) {
      const currentStep = procedure.steps[i];
      const nextStep = procedure.steps[i + 1];
      
      if (currentStep.action === Action.TYPES.UI_INTERACTION && 
          nextStep.type !== Procedure.STEP_TYPES.WAIT) {
        timingIssues.push({
          stepId: currentStep.id,
          issue: "missing_wait_after_ui",
          description: "Missing wait after UI interaction",
          recommendation: "Add wait step after UI interaction"
        });
      }
    }
    
    // Check for excessive waits
    for (const step of procedure.steps) {
      if (step.type === Procedure.STEP_TYPES.WAIT && 
          step.parameters.duration > 5000) {
        timingIssues.push({
          stepId: step.id,
          issue: "excessive_wait",
          description: `Excessive wait time: ${step.parameters.duration}ms`,
          recommendation: "Reduce wait time or make it dynamic"
        });
      }
    }
    
    // Check for consecutive waits
    for (let i = 0; i < procedure.steps.length - 1; i++) {
      const currentStep = procedure.steps[i];
      const nextStep = procedure.steps[i + 1];
      
      if (currentStep.type === Procedure.STEP_TYPES.WAIT && 
          nextStep.type === Procedure.STEP_TYPES.WAIT) {
        timingIssues.push({
          stepId: nextStep.id,
          issue: "consecutive_waits",
          description: "Consecutive wait steps",
          recommendation: "Combine consecutive wait steps"
        });
      }
    }
    
    return timingIssues;
  }

  /**
   * Finds error-prone steps in a procedure.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Array<Object>} Array of error-prone steps
   * @private
   */
  _findErrorProneSteps(procedure) {
    const errorProneSteps = [];
    
    // Skip if no steps
    if (!procedure.steps || procedure.steps.length === 0) {
      return errorProneSteps;
    }
    
    for (const step of procedure.steps) {
      // UI interactions are error-prone
      if (step.action === Action.TYPES.UI_INTERACTION) {
        errorProneSteps.push(step);
      }
      
      // API calls are error-prone
      if (step.action === Action.TYPES.API_CALL) {
        errorProneSteps.push(step);
      }
      
      // System events can fail
      if (step.action === Action.TYPES.SYSTEM_EVENT) {
        errorProneSteps.push(step);
      }
      
      // Steps that already have error handling are not considered error-prone
      if (step.errorHandling) {
        const index = errorProneSteps.indexOf(step);
        if (index !== -1) {
          errorProneSteps.splice(index, 1);
        }
      }
    }
    
    return errorProneSteps;
  }

  /**
   * Finds loop opportunities in a procedure.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Array<Object>} Array of loop opportunities
   * @private
   */
  _findLoopOpportunities(procedure) {
    const loopOpportunities = [];
    
    // Skip if too few steps
    if (!procedure.steps || procedure.steps.length < 6) {
      return loopOpportunities;
    }
    
    // Look for repeated sequences of steps
    const minSequenceLength = 2; // Minimum steps in a sequence
    const maxSequenceLength = Math.floor(procedure.steps.length / 2); // Maximum half the procedure
    
    for (let seqLength = minSequenceLength; seqLength <= maxSequenceLength; seqLength++) {
      for (let startIndex = 0; startIndex <= procedure.steps.length - (2 * seqLength); startIndex++) {
        // Extract the potential sequence
        const sequence = procedure.steps.slice(startIndex, startIndex + seqLength);
        
        // Count repetitions
        let repetitions = 1;
        let currentIndex = startIndex + seqLength;
        
        while (currentIndex <= procedure.steps.length - seqLength) {
          const nextSequence = procedure.steps.slice(currentIndex, currentIndex + seqLength);
          
          // Check if sequences match
          const sequencesMatch = this._sequencesMatch(sequence, nextSequence);
          
          if (sequencesMatch) {
            repetitions++;
            currentIndex += seqLength;
          } else {
            break;
          }
        }
        
        // If we found repetitions
        if (repetitions > 1) {
          loopOpportunities.push({
            startIndex,
            endIndex: currentIndex - 1,
            length: seqLength,
            repetitions
          });
          
          // Skip ahead to avoid overlapping loops
          startIndex = currentIndex - 1;
        }
      }
    }
    
    return loopOpportunities;
  }

  /**
   * Checks if two sequences of steps match.
   * @param {Array<Object>} seq1 - First sequence
   * @param {Array<Object>} seq2 - Second sequence
   * @returns {boolean} True if sequences match
   * @private
   */
  _sequencesMatch(seq1, seq2) {
    if (seq1.length !== seq2.length) {
      return false;
    }
    
    for (let i = 0; i < seq1.length; i++) {
      const step1 = seq1[i];
      const step2 = seq2[i];
      
      // Check action type
      if (step1.action !== step2.action) {
        return false;
      }
      
      // For UI interactions, check element type
      if (step1.action === Action.TYPES.UI_INTERACTION) {
        if (step1.parameters.elementType !== step2.parameters.elementType) {
          return false;
        }
        
        // Allow different element IDs but same type
        continue;
      }
      
      // For mouse actions, allow small variations
      if (step1.action === Action.TYPES.MOUSE_CLICK || 
          step1.action === Action.TYPES.MOUSE_MOVE) {
        // Skip detailed parameter checking
        continue;
      }
      
      // For other actions, check basic parameter equality
      if (JSON.stringify(step1.parameters) !== JSON.stringify(step2.parameters)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Finds variable extraction opportunities in a procedure.
   * @param {Procedure} procedure - Procedure to analyze
   * @returns {Array<Object>} Array of variable opportunities
   * @private
   */
  _findVariableOpportunities(procedure) {
    const variableOpportunities = [];
    
    // Skip if no steps
    if (!procedure.steps || procedure.steps.length === 0) {
      return variableOpportunities;
    }
    
    // Look for text inputs that could be variables
    for (const step of procedure.steps) {
      if (step.action === Action.TYPES.TEXT_INPUT && 
          step.parameters.text && 
          step.parameters.text.length > 3) {
        
        variableOpportunities.push({
          stepId: step.id,
          type: "text",
          value: step.parameters.text
        });
      }
      
      // Look for UI element selectors that could be variables
      if (step.action === Action.TYPES.UI_INTERACTION && 
          step.parameters.elementProperties) {
        
        const elementProps = step.parameters.elementProperties;
        
        if (elementProps.id || elementProps.selector) {
          variableOpportunities.push({
            stepId: step.id,
            type: "selector",
            value: elementProps.id || elementProps.selector
          });
        }
      }
    }
    
    return variableOpportunities;
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
    
    // Listen for procedure generation events
    this.eventBus.on("procedure:generated", async ({ procedureId, procedure }) => {
      // Auto-optimize if configured
      if (this.config.get("optimization.autoOptimize")) {
        try {
          this.logger.debug("Auto-optimizing generated procedure");
          await this.optimizeProcedure(procedure, { createCopy: false });
        } catch (error) {
          this.logger.error("Failed to auto-optimize procedure", error);
        }
      }
    });
  }
}

module.exports = ProcedureOptimizationSystem;
