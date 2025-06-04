/**
 * @fileoverview Workflow Synthesis Engine for Learning from Demonstration.
 * Converts patterns into executable workflows and optimizes them.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Synthesizes executable workflows from extracted patterns.
 */
class WorkflowSynthesisEngine {
  /**
   * Constructor for WorkflowSynthesisEngine.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   * @param {Object} options.reasoningEngine Reasoning engine for workflow optimization
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for WorkflowSynthesisEngine");
    if (!options.logger) throw new Error("Logger is required for WorkflowSynthesisEngine");
    if (!options.configService) throw new Error("ConfigService is required for WorkflowSynthesisEngine");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for WorkflowSynthesisEngine");
    if (!options.reasoningEngine) throw new Error("ReasoningEngine is required for WorkflowSynthesisEngine");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.reasoningEngine = options.reasoningEngine;
    
    this.logger.info("WorkflowSynthesisEngine created");
  }
  
  /**
   * Synthesize workflows from extracted patterns.
   * @param {Object} patternResult Pattern extraction result
   * @param {Object} demonstration Original demonstration data
   * @returns {Promise<Object>} Synthesized workflows
   */
  async synthesizeWorkflows(patternResult, demonstration) {
    if (!patternResult || !patternResult.patterns || !Array.isArray(patternResult.patterns)) {
      throw new Error("Valid pattern extraction result with patterns array is required");
    }
    
    if (!demonstration || !demonstration.events || !Array.isArray(demonstration.events)) {
      throw new Error("Valid demonstration with events array is required");
    }
    
    this.logger.info(`Synthesizing workflows from ${patternResult.patterns.length} patterns for demonstration: ${demonstration.id}`);
    
    try {
      // Prepare the result object
      const result = {
        demonstrationId: demonstration.id,
        timestamp: Date.now(),
        workflows: [],
        metadata: {
          patternCount: patternResult.patterns.length,
          processingTime: 0
        }
      };
      
      const startTime = Date.now();
      
      // Filter patterns by confidence threshold
      const confidenceThreshold = this.configService.get("lfd.workflowSynthesis.confidenceThreshold", 0.6);
      const highConfidencePatterns = patternResult.patterns.filter(pattern => pattern.confidence >= confidenceThreshold);
      
      this.logger.info(`Found ${highConfidencePatterns.length} high-confidence patterns (threshold: ${confidenceThreshold})`);
      
      // Group patterns by type
      const patternsByType = this._groupPatternsByType(highConfidencePatterns);
      
      // Process each pattern type
      for (const [type, patterns] of Object.entries(patternsByType)) {
        switch (type) {
          case 'repetitive':
            const repetitiveWorkflows = await this._synthesizeRepetitiveWorkflows(patterns, demonstration);
            result.workflows.push(...repetitiveWorkflows);
            break;
          case 'sequence':
            const sequenceWorkflows = await this._synthesizeSequenceWorkflows(patterns, demonstration);
            result.workflows.push(...sequenceWorkflows);
            break;
          case 'workflow':
            const workflowTypeWorkflows = await this._synthesizeWorkflowTypeWorkflows(patterns, demonstration);
            result.workflows.push(...workflowTypeWorkflows);
            break;
          case 'data':
            const dataWorkflows = await this._synthesizeDataWorkflows(patterns, demonstration);
            result.workflows.push(...dataWorkflows);
            break;
          default:
            this.logger.warn(`Unknown pattern type: ${type}, skipping workflow synthesis`);
        }
      }
      
      // Optimize workflows
      const optimizedWorkflows = await this._optimizeWorkflows(result.workflows, demonstration);
      result.workflows = optimizedWorkflows;
      
      // Validate workflows
      const validatedWorkflows = await this._validateWorkflows(result.workflows);
      result.workflows = validatedWorkflows;
      
      // Calculate processing time
      result.metadata.processingTime = Date.now() - startTime;
      result.metadata.workflowCount = result.workflows.length;
      
      this.logger.info(`Workflow synthesis complete for demonstration: ${demonstration.id}`, {
        workflowCount: result.workflows.length,
        processingTime: result.metadata.processingTime
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error synthesizing workflows: ${error.message}`, { error, demonstrationId: demonstration.id });
      throw error;
    }
  }
  
  /**
   * Group patterns by their type.
   * @private
   * @param {Array<Object>} patterns Patterns to group
   * @returns {Object} Patterns grouped by type
   */
  _groupPatternsByType(patterns) {
    const groups = {};
    
    for (const pattern of patterns) {
      if (!pattern.type) continue;
      
      if (!groups[pattern.type]) {
        groups[pattern.type] = [];
      }
      
      groups[pattern.type].push(pattern);
    }
    
    return groups;
  }
  
  /**
   * Synthesize workflows from repetitive patterns.
   * @private
   * @param {Array<Object>} patterns Repetitive patterns
   * @param {Object} demonstration Original demonstration
   * @returns {Promise<Array<Object>>} Synthesized workflows
   */
  async _synthesizeRepetitiveWorkflows(patterns, demonstration) {
    const workflows = [];
    
    try {
      for (const pattern of patterns) {
        // Create a workflow template
        const workflow = {
          id: `workflow_rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: `Repetitive ${pattern.actionType} Workflow`,
          type: 'repetitive',
          patternId: pattern.id,
          confidence: pattern.confidence,
          description: `Automates repetitive ${pattern.actionType} actions`,
          steps: [],
          parameters: [],
          metadata: {
            demonstrationId: demonstration.id,
            createdAt: Date.now()
          }
        };
        
        // Extract action IDs from pattern
        const actionIds = pattern.actions || [];
        
        // Find corresponding events in the demonstration
        const events = demonstration.events.filter(event => actionIds.includes(event.id));
        
        // Sort events by timestamp
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        // Create workflow steps from events
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          
          // Create a step
          const step = {
            id: `step_${i + 1}`,
            type: event.type,
            action: this._mapEventTypeToAction(event.type),
            target: event.target || {},
            application: event.application || {},
            parameters: {}
          };
          
          // Extract parameters based on variable properties
          if (pattern.variableProperties) {
            for (const [key, values] of Object.entries(pattern.variableProperties)) {
              // Extract the value for this specific event
              const paramValue = this._extractParameterValue(event, key);
              
              if (paramValue !== undefined) {
                // Create a parameter name
                const paramName = `param_${key.replace(/\./g, '_')}`;
                
                // Add to step parameters
                step.parameters[key] = {
                  name: paramName,
                  value: paramValue
                };
                
                // Add to workflow parameters if not already present
                if (!workflow.parameters.some(p => p.name === paramName)) {
                  workflow.parameters.push({
                    name: paramName,
                    type: typeof paramValue,
                    description: `Parameter for ${key}`,
                    defaultValue: paramValue,
                    required: true
                  });
                }
              }
            }
          }
          
          workflow.steps.push(step);
        }
        
        // Add workflow to result
        workflows.push(workflow);
      }
      
      return workflows;
    } catch (error) {
      this.logger.error(`Error synthesizing repetitive workflows: ${error.message}`, { error });
      return workflows;
    }
  }
  
  /**
   * Synthesize workflows from sequence patterns.
   * @private
   * @param {Array<Object>} patterns Sequence patterns
   * @param {Object} demonstration Original demonstration
   * @returns {Promise<Array<Object>>} Synthesized workflows
   */
  async _synthesizeSequenceWorkflows(patterns, demonstration) {
    const workflows = [];
    
    try {
      for (const pattern of patterns) {
        // Create a workflow template
        const workflow = {
          id: `workflow_seq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: `Action Sequence Workflow`,
          type: 'sequence',
          patternId: pattern.id,
          confidence: pattern.confidence,
          description: `Automates a sequence of ${pattern.actionTypes?.join(', ') || 'actions'}`,
          steps: [],
          parameters: [],
          metadata: {
            demonstrationId: demonstration.id,
            createdAt: Date.now()
          }
        };
        
        // Extract occurrences from pattern
        const occurrences = pattern.occurrences || [];
        
        // Use the first occurrence as a template
        if (occurrences.length > 0) {
          const firstOccurrence = occurrences[0];
          const actionIds = firstOccurrence.actionIds || [];
          
          // Find corresponding events in the demonstration
          const events = demonstration.events.filter(event => actionIds.includes(event.id));
          
          // Sort events by timestamp
          events.sort((a, b) => a.timestamp - b.timestamp);
          
          // Create workflow steps from events
          for (let i = 0; i < events.length; i++) {
            const event = events[i];
            
            // Create a step
            const step = {
              id: `step_${i + 1}`,
              type: event.type,
              action: this._mapEventTypeToAction(event.type),
              target: event.target || {},
              application: event.application || {},
              parameters: {}
            };
            
            // Extract parameters by comparing with other occurrences
            if (occurrences.length > 1) {
              // Find variable parameters by comparing with other occurrences
              const variableParams = this._findVariableParameters(event, occurrences, demonstration);
              
              // Add variable parameters to step
              for (const [key, paramInfo] of Object.entries(variableParams)) {
                step.parameters[key] = {
                  name: paramInfo.name,
                  value: paramInfo.defaultValue
                };
                
                // Add to workflow parameters if not already present
                if (!workflow.parameters.some(p => p.name === paramInfo.name)) {
                  workflow.parameters.push({
                    name: paramInfo.name,
                    type: paramInfo.type,
                    description: paramInfo.description,
                    defaultValue: paramInfo.defaultValue,
                    required: true
                  });
                }
              }
            }
            
            workflow.steps.push(step);
          }
        }
        
        // Add workflow to result
        workflows.push(workflow);
      }
      
      return workflows;
    } catch (error) {
      this.logger.error(`Error synthesizing sequence workflows: ${error.message}`, { error });
      return workflows;
    }
  }
  
  /**
   * Synthesize workflows from workflow-type patterns.
   * @private
   * @param {Array<Object>} patterns Workflow-type patterns
   * @param {Object} demonstration Original demonstration
   * @returns {Promise<Array<Object>>} Synthesized workflows
   */
  async _synthesizeWorkflowTypeWorkflows(patterns, demonstration) {
    const workflows = [];
    
    try {
      for (const pattern of patterns) {
        // Create a workflow template based on subtype
        const subtype = pattern.subtype || 'generic';
        
        const workflow = {
          id: `workflow_${subtype}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: this._getWorkflowNameFromSubtype(subtype),
          type: 'workflow',
          subtype: subtype,
          patternId: pattern.id,
          confidence: pattern.confidence,
          description: this._getWorkflowDescriptionFromSubtype(subtype),
          steps: [],
          parameters: [],
          metadata: {
            demonstrationId: demonstration.id,
            createdAt: Date.now()
          }
        };
        
        // Extract action IDs from pattern
        const actionIds = pattern.actions || [];
        
        // Find corresponding events in the demonstration
        const events = demonstration.events.filter(event => actionIds.includes(event.id));
        
        // Sort events by timestamp
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        // Create workflow steps from events
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          
          // Create a step
          const step = {
            id: `step_${i + 1}`,
            type: event.type,
            action: this._mapEventTypeToAction(event.type),
            target: event.target || {},
            application: event.application || {},
            parameters: {}
          };
          
          // Extract parameters based on workflow subtype
          switch (subtype) {
            case 'file-operations':
              if (event.file) {
                step.parameters['file'] = {
                  name: 'file_path',
                  value: event.file.path
                };
                
                // Add to workflow parameters if not already present
                if (!workflow.parameters.some(p => p.name === 'file_path')) {
                  workflow.parameters.push({
                    name: 'file_path',
                    type: 'string',
                    description: 'Path to the file',
                    defaultValue: event.file.path,
                    required: true
                  });
                }
              }
              break;
              
            case 'form-filling':
              if (event.type === 'action.input' && event.value) {
                const fieldName = event.target?.id || `field_${i}`;
                step.parameters['value'] = {
                  name: `input_${fieldName}`,
                  value: event.value.text
                };
                
                // Add to workflow parameters if not already present
                if (!workflow.parameters.some(p => p.name === `input_${fieldName}`)) {
                  workflow.parameters.push({
                    name: `input_${fieldName}`,
                    type: 'string',
                    description: `Input for ${fieldName}`,
                    defaultValue: event.value.text,
                    required: true
                  });
                }
              }
              break;
              
            case 'copy-paste':
              if (event.type === 'action.copy' && event.content) {
                step.parameters['content'] = {
                  name: 'copied_content',
                  value: event.content.text
                };
                
                // Add to workflow parameters if not already present
                if (!workflow.parameters.some(p => p.name === 'copied_content')) {
                  workflow.parameters.push({
                    name: 'copied_content',
                    type: 'string',
                    description: 'Content to copy',
                    defaultValue: event.content.text,
                    required: true
                  });
                }
              }
              break;
          }
          
          workflow.steps.push(step);
        }
        
        // Add workflow to result
        workflows.push(workflow);
      }
      
      return workflows;
    } catch (error) {
      this.logger.error(`Error synthesizing workflow-type workflows: ${error.message}`, { error });
      return workflows;
    }
  }
  
  /**
   * Synthesize workflows from data transformation patterns.
   * @private
   * @param {Array<Object>} patterns Data transformation patterns
   * @param {Object} demonstration Original demonstration
   * @returns {Promise<Array<Object>>} Synthesized workflows
   */
  async _synthesizeDataWorkflows(patterns, demonstration) {
    const workflows = [];
    
    try {
      for (const pattern of patterns) {
        // Create a workflow template
        const workflow = {
          id: `workflow_data_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: `Data Transformation Workflow`,
          type: 'data',
          patternId: pattern.id,
          confidence: pattern.confidence,
          description: `Automates data transformation operations`,
          steps: [],
          parameters: [],
          metadata: {
            demonstrationId: demonstration.id,
            createdAt: Date.now()
          }
        };
        
        // Extract action IDs from pattern
        const actionIds = pattern.actions || [];
        
        // Find corresponding events in the demonstration
        const events = demonstration.events.filter(event => actionIds.includes(event.id));
        
        // Sort events by timestamp
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        // Create workflow steps from events
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          
          // Create a step
          const step = {
            id: `step_${i + 1}`,
            type: event.type,
            action: this._mapEventTypeToAction(event.type),
            target: event.target || {},
            application: event.application || {},
            parameters: {}
          };
          
          // Extract parameters for data transformation
          if (event.type === 'action.copy' && event.content) {
            step.parameters['sourceContent'] = {
              name: 'source_content',
              value: event.content.text
            };
            
            // Add to workflow parameters if not already present
            if (!workflow.parameters.some(p => p.name === 'source_content')) {
              workflow.parameters.push({
                name: 'source_content',
                type: 'string',
                description: 'Source content for transformation',
                defaultValue: event.content.text,
                required: true
              });
            }
          } else if (event.type === 'action.paste' && event.content) {
            step.parameters['transformedContent'] = {
              name: 'transformed_content',
              value: event.content.text
            };
            
            // Add to workflow parameters if not already present
            if (!workflow.parameters.some(p => p.name === 'transformed_content')) {
              workflow.parameters.push({
                name: 'transformed_content',
                type: 'string',
                description: 'Transformed content',
                defaultValue: event.content.text,
                required: true
              });
            }
          }
          
          workflow.steps.push(step);
        }
        
        // If pattern has transformation rules, add them to the workflow
        if (pattern.transformationRules) {
          workflow.transformationRules = pattern.transformationRules;
        }
        
        // Add workflow to result
        workflows.push(workflow);
      }
      
      return workflows;
    } catch (error) {
      this.logger.error(`Error synthesizing data workflows: ${error.message}`, { error });
      return workflows;
    }
  }
  
  /**
   * Optimize workflows using the reasoning engine.
   * @private
   * @param {Array<Object>} workflows Workflows to optimize
   * @param {Object} demonstration Original demonstration
   * @returns {Promise<Array<Object>>} Optimized workflows
   */
  async _optimizeWorkflows(workflows, demonstration) {
    try {
      this.logger.info(`Optimizing ${workflows.length} workflows`);
      
      const optimizedWorkflows = [];
      
      for (const workflow of workflows) {
        // Clone the workflow to avoid modifying the original
        const optimizedWorkflow = JSON.parse(JSON.stringify(workflow));
        
        // Apply optimization strategies
        await this._removeRedundantSteps(optimizedWorkflow);
        await this._consolidateRelatedSteps(optimizedWorkflow);
        await this._optimizeParameterUsage(optimizedWorkflow);
        
        // Use reasoning engine for advanced optimization if available
        try {
          const reasoningResult = await this.reasoningEngine.optimizeWorkflow(optimizedWorkflow, {
            demonstrationId: demonstration.id,
            optimizationLevel: this.configService.get("lfd.workflowOptimization.level", "medium")
          });
          
          if (reasoningResult && reasoningResult.optimizedWorkflow) {
            optimizedWorkflow.steps = reasoningResult.optimizedWorkflow.steps;
            optimizedWorkflow.metadata.optimizationApplied = true;
            optimizedWorkflow.metadata.optimizationDetails = reasoningResult.optimizationDetails;
          }
        } catch (error) {
          this.logger.warn(`Reasoning engine optimization failed: ${error.message}`, { error, workflowId: workflow.id });
          // Continue with the current optimization level
        }
        
        optimizedWorkflows.push(optimizedWorkflow);
      }
      
      return optimizedWorkflows;
    } catch (error) {
      this.logger.error(`Error optimizing workflows: ${error.message}`, { error });
      // Return original workflows if optimization fails
      return workflows;
    }
  }
  
  /**
   * Remove redundant steps from a workflow.
   * @private
   * @param {Object} workflow Workflow to optimize
   * @returns {Promise<void>}
   */
  async _removeRedundantSteps(workflow) {
    try {
      const steps = workflow.steps;
      
      // No optimization possible with 0 or 1 steps
      if (!steps || steps.length <= 1) {
        return;
      }
      
      const optimizedSteps = [];
      let previousStep = null;
      
      for (const step of steps) {
        // Check if this step is redundant with the previous one
        if (previousStep && 
            step.type === previousStep.type && 
            step.action === previousStep.action &&
            JSON.stringify(step.target) === JSON.stringify(previousStep.target) &&
            JSON.stringify(step.parameters) === JSON.stringify(previousStep.parameters)) {
          // Skip this redundant step
          continue;
        }
        
        optimizedSteps.push(step);
        previousStep = step;
      }
      
      // Update workflow with optimized steps
      workflow.steps = optimizedSteps;
      
      // Add optimization metadata
      if (!workflow.metadata) {
        workflow.metadata = {};
      }
      
      workflow.metadata.redundantStepsRemoved = steps.length - optimizedSteps.length;
    } catch (error) {
      this.logger.error(`Error removing redundant steps: ${error.message}`, { error, workflowId: workflow.id });
      // Don't modify the workflow if optimization fails
    }
  }
  
  /**
   * Consolidate related steps in a workflow.
   * @private
   * @param {Object} workflow Workflow to optimize
   * @returns {Promise<void>}
   */
  async _consolidateRelatedSteps(workflow) {
    try {
      const steps = workflow.steps;
      
      // No optimization possible with less than 3 steps
      if (!steps || steps.length < 3) {
        return;
      }
      
      // Look for patterns that can be consolidated
      // This is a simplified implementation - real-world would be more complex
      
      // Example: Consolidate multiple click steps on the same element
      const optimizedSteps = [];
      let currentGroup = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        if (currentGroup.length === 0) {
          // Start a new group
          currentGroup.push(step);
        } else {
          const lastStep = currentGroup[currentGroup.length - 1];
          
          // Check if this step can be consolidated with the current group
          if (step.type === lastStep.type && 
              step.action === lastStep.action &&
              JSON.stringify(step.target) === JSON.stringify(lastStep.target)) {
            // Add to current group
            currentGroup.push(step);
          } else {
            // Process the current group
            if (currentGroup.length > 1 && currentGroup[0].type === 'action.click') {
              // Consolidate multiple clicks into a single multi-click
              const consolidatedStep = {
                id: currentGroup[0].id,
                type: 'action.multiClick',
                action: 'multiClick',
                target: currentGroup[0].target,
                application: currentGroup[0].application,
                parameters: {
                  clickCount: {
                    name: 'click_count',
                    value: currentGroup.length
                  }
                }
              };
              
              optimizedSteps.push(consolidatedStep);
              
              // Add parameter to workflow if not present
              if (!workflow.parameters.some(p => p.name === 'click_count')) {
                workflow.parameters.push({
                  name: 'click_count',
                  type: 'number',
                  description: 'Number of times to click',
                  defaultValue: currentGroup.length,
                  required: true
                });
              }
            } else {
              // Add all steps from the group
              optimizedSteps.push(...currentGroup);
            }
            
            // Start a new group with the current step
            currentGroup = [step];
          }
        }
      }
      
      // Process the last group
      if (currentGroup.length > 0) {
        if (currentGroup.length > 1 && currentGroup[0].type === 'action.click') {
          // Consolidate multiple clicks
          const consolidatedStep = {
            id: currentGroup[0].id,
            type: 'action.multiClick',
            action: 'multiClick',
            target: currentGroup[0].target,
            application: currentGroup[0].application,
            parameters: {
              clickCount: {
                name: 'click_count',
                value: currentGroup.length
              }
            }
          };
          
          optimizedSteps.push(consolidatedStep);
          
          // Add parameter to workflow if not present
          if (!workflow.parameters.some(p => p.name === 'click_count')) {
            workflow.parameters.push({
              name: 'click_count',
              type: 'number',
              description: 'Number of times to click',
              defaultValue: currentGroup.length,
              required: true
            });
          }
        } else {
          // Add all steps from the group
          optimizedSteps.push(...currentGroup);
        }
      }
      
      // Update workflow with optimized steps
      workflow.steps = optimizedSteps;
      
      // Add optimization metadata
      if (!workflow.metadata) {
        workflow.metadata = {};
      }
      
      workflow.metadata.stepsConsolidated = steps.length - optimizedSteps.length;
    } catch (error) {
      this.logger.error(`Error consolidating related steps: ${error.message}`, { error, workflowId: workflow.id });
      // Don't modify the workflow if optimization fails
    }
  }
  
  /**
   * Optimize parameter usage in a workflow.
   * @private
   * @param {Object} workflow Workflow to optimize
   * @returns {Promise<void>}
   */
  async _optimizeParameterUsage(workflow) {
    try {
      // Identify parameters that are used multiple times
      const parameterUsage = new Map();
      
      // Count parameter usage across steps
      for (const step of workflow.steps) {
        for (const [key, param] of Object.entries(step.parameters)) {
          const paramName = param.name;
          
          if (!parameterUsage.has(paramName)) {
            parameterUsage.set(paramName, {
              count: 0,
              values: new Set()
            });
          }
          
          const usage = parameterUsage.get(paramName);
          usage.count++;
          usage.values.add(param.value);
        }
      }
      
      // Optimize parameters that are used multiple times with the same value
      for (const [paramName, usage] of parameterUsage.entries()) {
        if (usage.count > 1 && usage.values.size === 1) {
          // This parameter is used multiple times with the same value
          // We can optimize by ensuring it's defined once in the workflow parameters
          
          // Find or create the workflow parameter
          let workflowParam = workflow.parameters.find(p => p.name === paramName);
          
          if (!workflowParam) {
            // Create the parameter
            const paramValue = Array.from(usage.values)[0];
            workflowParam = {
              name: paramName,
              type: typeof paramValue,
              description: `Parameter for ${paramName}`,
              defaultValue: paramValue,
              required: true,
              shared: true
            };
            
            workflow.parameters.push(workflowParam);
          } else {
            // Mark as shared
            workflowParam.shared = true;
          }
        }
      }
      
      // Add optimization metadata
      if (!workflow.metadata) {
        workflow.metadata = {};
      }
      
      workflow.metadata.sharedParametersOptimized = Array.from(parameterUsage.entries())
        .filter(([_, usage]) => usage.count > 1 && usage.values.size === 1)
        .length;
    } catch (error) {
      this.logger.error(`Error optimizing parameter usage: ${error.message}`, { error, workflowId: workflow.id });
      // Don't modify the workflow if optimization fails
    }
  }
  
  /**
   * Validate synthesized workflows.
   * @private
   * @param {Array<Object>} workflows Workflows to validate
   * @returns {Promise<Array<Object>>} Validated workflows
   */
  async _validateWorkflows(workflows) {
    try {
      this.logger.info(`Validating ${workflows.length} workflows`);
      
      const validatedWorkflows = [];
      
      for (const workflow of workflows) {
        // Clone the workflow to avoid modifying the original
        const validatedWorkflow = JSON.parse(JSON.stringify(workflow));
        
        // Perform validation checks
        const validationResult = await this._validateWorkflow(validatedWorkflow);
        
        // Add validation metadata
        if (!validatedWorkflow.metadata) {
          validatedWorkflow.metadata = {};
        }
        
        validatedWorkflow.metadata.validationResult = validationResult;
        
        // Only include valid workflows
        if (validationResult.valid) {
          validatedWorkflows.push(validatedWorkflow);
        } else {
          this.logger.warn(`Workflow validation failed: ${validationResult.reason}`, { workflowId: workflow.id });
        }
      }
      
      return validatedWorkflows;
    } catch (error) {
      this.logger.error(`Error validating workflows: ${error.message}`, { error });
      // Return original workflows if validation fails
      return workflows;
    }
  }
  
  /**
   * Validate a single workflow.
   * @private
   * @param {Object} workflow Workflow to validate
   * @returns {Promise<Object>} Validation result
   */
  async _validateWorkflow(workflow) {
    try {
      const result = {
        valid: true,
        issues: []
      };
      
      // Check for required fields
      if (!workflow.id) {
        result.valid = false;
        result.issues.push("Missing workflow ID");
      }
      
      if (!workflow.name) {
        result.valid = false;
        result.issues.push("Missing workflow name");
      }
      
      if (!workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
        result.valid = false;
        result.issues.push("Workflow must have at least one step");
      }
      
      // Check steps
      if (workflow.steps) {
        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          
          if (!step.id) {
            result.valid = false;
            result.issues.push(`Step ${i + 1} is missing an ID`);
          }
          
          if (!step.type) {
            result.valid = false;
            result.issues.push(`Step ${i + 1} is missing a type`);
          }
          
          if (!step.action) {
            result.valid = false;
            result.issues.push(`Step ${i + 1} is missing an action`);
          }
        }
      }
      
      // Check parameters
      if (workflow.parameters) {
        const paramNames = new Set();
        
        for (let i = 0; i < workflow.parameters.length; i++) {
          const param = workflow.parameters[i];
          
          if (!param.name) {
            result.valid = false;
            result.issues.push(`Parameter ${i + 1} is missing a name`);
          } else {
            if (paramNames.has(param.name)) {
              result.valid = false;
              result.issues.push(`Duplicate parameter name: ${param.name}`);
            }
            
            paramNames.add(param.name);
          }
          
          if (param.required && param.defaultValue === undefined) {
            result.valid = false;
            result.issues.push(`Required parameter ${param.name} is missing a default value`);
          }
        }
        
        // Check that all parameter references in steps are valid
        if (workflow.steps) {
          for (let i = 0; i < workflow.steps.length; i++) {
            const step = workflow.steps[i];
            
            if (step.parameters) {
              for (const [key, param] of Object.entries(step.parameters)) {
                if (param.name && !paramNames.has(param.name)) {
                  result.valid = false;
                  result.issues.push(`Step ${i + 1} references undefined parameter: ${param.name}`);
                }
              }
            }
          }
        }
      }
      
      // If validation failed, add a reason summary
      if (!result.valid) {
        result.reason = result.issues.join("; ");
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error in workflow validation: ${error.message}`, { error, workflowId: workflow.id });
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
        issues: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Map event type to action name.
   * @private
   * @param {string} eventType Event type
   * @returns {string} Action name
   */
  _mapEventTypeToAction(eventType) {
    switch (eventType) {
      case 'action.click':
        return 'click';
      case 'action.input':
        return 'input';
      case 'action.keypress':
        return 'keypress';
      case 'action.fileOpen':
        return 'openFile';
      case 'action.fileSave':
        return 'saveFile';
      case 'action.copy':
        return 'copy';
      case 'action.paste':
        return 'paste';
      case 'context.applicationChange':
        return 'switchApplication';
      default:
        return eventType.replace('action.', '');
    }
  }
  
  /**
   * Get workflow name from subtype.
   * @private
   * @param {string} subtype Workflow subtype
   * @returns {string} Workflow name
   */
  _getWorkflowNameFromSubtype(subtype) {
    switch (subtype) {
      case 'file-operations':
        return 'File Operations Workflow';
      case 'form-filling':
        return 'Form Filling Workflow';
      case 'copy-paste':
        return 'Copy-Paste Workflow';
      default:
        return 'Generic Workflow';
    }
  }
  
  /**
   * Get workflow description from subtype.
   * @private
   * @param {string} subtype Workflow subtype
   * @returns {string} Workflow description
   */
  _getWorkflowDescriptionFromSubtype(subtype) {
    switch (subtype) {
      case 'file-operations':
        return 'Automates file operations such as opening and saving files';
      case 'form-filling':
        return 'Automates form filling operations including input fields and button clicks';
      case 'copy-paste':
        return 'Automates copy and paste operations between applications';
      default:
        return 'Automates a generic workflow';
    }
  }
  
  /**
   * Extract parameter value from an event.
   * @private
   * @param {Object} event Event to extract from
   * @param {string} key Parameter key
   * @returns {*} Parameter value or undefined if not found
   */
  _extractParameterValue(event, key) {
    // Split the key into parts
    const parts = key.split('.');
    
    // Navigate the event object
    let value = event;
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }
  
  /**
   * Find variable parameters by comparing with other occurrences.
   * @private
   * @param {Object} event Current event
   * @param {Array<Object>} occurrences Pattern occurrences
   * @param {Object} demonstration Original demonstration
   * @returns {Object} Variable parameters
   */
  _findVariableParameters(event, occurrences, demonstration) {
    const variableParams = {};
    
    try {
      // Find the event index in the first occurrence
      const firstOccurrence = occurrences[0];
      const eventIndex = firstOccurrence.actionIds.indexOf(event.id);
      
      if (eventIndex === -1) {
        return variableParams;
      }
      
      // Compare with corresponding events in other occurrences
      for (let i = 1; i < occurrences.length; i++) {
        const occurrence = occurrences[i];
        
        if (eventIndex >= occurrence.actionIds.length) {
          continue;
        }
        
        const correspondingEventId = occurrence.actionIds[eventIndex];
        const correspondingEvent = demonstration.events.find(e => e.id === correspondingEventId);
        
        if (!correspondingEvent) {
          continue;
        }
        
        // Compare event properties
        this._compareEventProperties(event, correspondingEvent, variableParams);
      }
      
      // Convert variable parameters to the expected format
      const result = {};
      
      for (const [key, values] of Object.entries(variableParams)) {
        const paramName = `param_${key.replace(/\./g, '_')}`;
        
        result[key] = {
          name: paramName,
          type: typeof values[0],
          description: `Parameter for ${key}`,
          defaultValue: values[0],
          required: true
        };
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error finding variable parameters: ${error.message}`, { error, eventId: event.id });
      return variableParams;
    }
  }
  
  /**
   * Compare properties between two events to find variables.
   * @private
   * @param {Object} event1 First event
   * @param {Object} event2 Second event
   * @param {Object} variableParams Variable parameters to update
   */
  _compareEventProperties(event1, event2, variableParams) {
    // Compare target properties
    if (event1.target && event2.target) {
      this._compareObjects(event1.target, event2.target, 'target', variableParams);
    }
    
    // Compare value properties
    if (event1.value && event2.value) {
      this._compareObjects(event1.value, event2.value, 'value', variableParams);
    }
    
    // Compare file properties
    if (event1.file && event2.file) {
      this._compareObjects(event1.file, event2.file, 'file', variableParams);
    }
    
    // Compare content properties
    if (event1.content && event2.content) {
      this._compareObjects(event1.content, event2.content, 'content', variableParams);
    }
  }
  
  /**
   * Compare objects to find different properties.
   * @private
   * @param {Object} obj1 First object
   * @param {Object} obj2 Second object
   * @param {string} prefix Property prefix
   * @param {Object} variableParams Variable parameters to update
   */
  _compareObjects(obj1, obj2, prefix, variableParams) {
    for (const key in obj1) {
      if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
        const value1 = obj1[key];
        const value2 = obj2[key];
        
        if (value1 !== value2) {
          const paramKey = `${prefix}.${key}`;
          
          if (!variableParams[paramKey]) {
            variableParams[paramKey] = [value1];
          }
          
          if (!variableParams[paramKey].includes(value2)) {
            variableParams[paramKey].push(value2);
          }
        }
      }
    }
  }
}

module.exports = WorkflowSynthesisEngine;
