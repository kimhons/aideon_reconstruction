/**
 * @fileoverview HTN Orchestrator with advanced multi-LLM orchestration capabilities.
 * This module coordinates the HTN planning process, integrating collaborative model orchestration
 * for perception, parameter prediction, plan ranking, and adaptive execution.
 */

const EventBus = require('../../core/EventBus');
const PerceptionModel = require('./models/PerceptionModel');
const ParameterPredictionModel = require('./models/ParameterPredictionModel');
const PlanRankingModel = require('./models/PlanRankingModel');
const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');
const { ModelType, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');
const { performance } = require('perf_hooks');

/**
 * Orchestrates the HTN planning process with advanced multi-LLM orchestration capabilities.
 */
class HTNOrchestrator {
  /**
   * Creates a new HTNOrchestrator instance with advanced orchestration capabilities.
   * @param {Object} config - Configuration options.
   * @param {Object} config.mlConfig - ML model configuration.
   * @param {string} config.huggingFaceApiKey - API key for Hugging Face.
   * @param {Object} dependencies - System dependencies required by the orchestrator.
   */
  constructor(config = {}, dependencies = {}) {
    this.eventBus = dependencies.eventBus || new EventBus();
    this.goalStack = [];
    this.currentPlan = null;
    this.currentState = {};
    this.huggingFaceApiKey = config.huggingFaceApiKey || null;
    this.logger = dependencies.logger || console;
    
    // Store model orchestrator reference
    this.modelOrchestrator = dependencies.modelOrchestrationSystem || dependencies.modelOrchestrator;
    
    // Validate required dependencies
    if (!this.modelOrchestrator) {
      throw new Error("Required dependency 'modelOrchestrator' missing for HTNOrchestrator");
    }
    
    // Advanced orchestration options
    this.advancedOptions = {
      collaborativeIntelligence: config.collaborativeIntelligence !== false,
      specializedModelSelection: config.specializedModelSelection !== false,
      adaptiveResourceAllocation: config.adaptiveResourceAllocation !== false,
      selfEvaluation: config.selfEvaluation !== false,
      offlineCapability: config.offlineCapability || 'full' // 'limited', 'standard', 'full'
    };
    
    // Initialize enhanced integration
    this._initializeEnhancedIntegration();
    
    // Initialize ML models with enhanced integration
    this.mlConfig = config.mlConfig || {};
    this.initializeMLModels();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    // Performance metrics
    this.metrics = {
      planningTime: [],
      executionTime: [],
      successRate: {
        attempts: 0,
        successes: 0
      },
      modelUsage: new Map()
    };
    
    // Suspended plans with enhanced state tracking
    this.suspendedPlans = [];
    
    this.logger.info('HTN Orchestrator initialized with advanced multi-LLM orchestration capabilities');
  }

  /**
   * Initialize enhanced integration
   * @private
   */
  _initializeEnhancedIntegration() {
    this.logger.debug('Initializing enhanced integration for HTN Orchestrator');
    
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
   * Initialize collaboration sessions for advanced orchestration
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCollaborationSessions() {
    if (!this.advancedOptions.collaborativeIntelligence) {
      this.logger.info('Collaborative intelligence disabled, skipping collaboration sessions');
      return;
    }
    
    this.logger.debug('Initializing collaboration sessions for HTN Orchestrator');
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "perception",
          modelType: ModelType.MULTIMODAL,
          taskType: "scene_understanding",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        },
        {
          name: "parameter_prediction",
          modelType: ModelType.TEXT,
          taskType: "parameter_prediction",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: true
        },
        {
          name: "plan_ranking",
          modelType: ModelType.TEXT,
          taskType: "plan_evaluation",
          collaborationStrategy: CollaborationStrategy.CHAIN_OF_THOUGHT,
          offlineOnly: true
        },
        {
          name: "error_recovery",
          modelType: ModelType.TEXT,
          taskType: "error_recovery",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: true
        },
        {
          name: "goal_prioritization",
          modelType: ModelType.TEXT,
          taskType: "goal_prioritization",
          collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
          offlineOnly: true
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("htn_planning", collaborationConfigs);
      
      this.logger.info('Collaboration sessions initialized successfully for HTN Orchestrator');
      
    } catch (error) {
      this.logger.error(`Failed to initialize collaboration sessions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initializes ML models for perception, parameter prediction, and plan ranking
   * with enhanced multi-LLM orchestration capabilities.
   * @private
   */
  async initializeMLModels() {
    try {
      // Initialize perception model with enhanced integration
      const perceptionConfig = this.mlConfig.perception || {};
      perceptionConfig.huggingFaceApiKey = this.huggingFaceApiKey;
      perceptionConfig.enhancedIntegration = this.enhancedIntegration;
      this.perceptionModel = new PerceptionModel(perceptionConfig);
      
      // Initialize parameter prediction model with enhanced integration
      const parameterConfig = this.mlConfig.parameterPrediction || {};
      parameterConfig.huggingFaceApiKey = this.huggingFaceApiKey;
      parameterConfig.enhancedIntegration = this.enhancedIntegration;
      this.parameterPredictionModel = new ParameterPredictionModel(parameterConfig);
      
      // Initialize plan ranking model with enhanced integration
      const rankingConfig = this.mlConfig.planRanking || {};
      rankingConfig.huggingFaceApiKey = this.huggingFaceApiKey;
      rankingConfig.enhancedIntegration = this.enhancedIntegration;
      this.planRankingModel = new PlanRankingModel(rankingConfig);
      
      // Initialize collaboration sessions for advanced orchestration
      await this._initializeCollaborationSessions();
      
      this.logger.info('ML models initialized with enhanced multi-LLM orchestration capabilities');
    } catch (error) {
      this.logger.error(`Error initializing ML models: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribes to relevant events on the event bus.
   * @private
   */
  subscribeToEvents() {
    // Subscribe to goal identified events
    this.eventBus.on('goal_identified', this.handleGoalIdentified.bind(this));
    
    // Subscribe to action completed/failed events
    this.eventBus.on('action_completed', this.handleActionCompleted.bind(this));
    this.eventBus.on('action_failed', this.handleActionFailed.bind(this));
    
    // Subscribe to world state changed events
    this.eventBus.on('world_state_changed', this.handleWorldStateChanged.bind(this));
    
    // Subscribe to resource availability events
    this.eventBus.on('resource_availability_changed', this.handleResourceAvailabilityChanged.bind(this));
    
    // Subscribe to model performance events
    this.eventBus.on('model_performance_update', this.handleModelPerformanceUpdate.bind(this));
    
    this.logger.info('Subscribed to events');
  }

  /**
   * Handles a new goal identified by the NLU service with collaborative intelligence.
   * @param {Object} goalEvent - The goal event data.
   * @private
   */
  async handleGoalIdentified(goalEvent) {
    this.logger.info(`Goal identified: ${JSON.stringify(goalEvent)}`);
    
    try {
      // Enhance goal understanding with collaborative intelligence
      const enhancedGoal = await this._enhanceGoalUnderstanding(goalEvent.goal);
      
      // Push the enhanced goal onto the stack
      this.goalStack.push(enhancedGoal);
      
      // If this is the only goal, start planning
      if (this.goalStack.length === 1) {
        await this.startPlanning();
      } else {
        // Use collaborative intelligence for goal prioritization
        const prioritizationResult = await this._prioritizeGoals();
        
        if (prioritizationResult.shouldPreempt) {
          // Suspend the current plan and start the new one
          this.suspendCurrentPlan();
          await this.startPlanning();
        }
      }
    } catch (error) {
      this.logger.error(`Error handling goal identified: ${error.message}`);
      this.eventBus.emit('goal_processing_error', {
        goal: goalEvent.goal,
        error: error.message
      });
    }
  }

  /**
   * Enhances goal understanding with collaborative intelligence.
   * @param {Object} goal - The original goal.
   * @returns {Promise<Object>} - The enhanced goal.
   * @private
   */
  async _enhanceGoalUnderstanding(goal) {
    if (!this.advancedOptions.collaborativeIntelligence) {
      return goal;
    }
    
    try {
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        "goal_prioritization",
        {
          goal,
          currentState: this.currentState,
          existingGoals: this.goalStack
        }
      );
      
      return {
        ...goal,
        enhancedUnderstanding: result.enhancedUnderstanding,
        predictedDifficulty: result.predictedDifficulty,
        estimatedResources: result.estimatedResources,
        priority: result.priority || goal.priority || 0
      };
    } catch (error) {
      this.logger.warn(`Error enhancing goal understanding, using original goal: ${error.message}`);
      return goal;
    }
  }

  /**
   * Prioritizes goals using collaborative intelligence.
   * @returns {Promise<Object>} - Prioritization result.
   * @private
   */
  async _prioritizeGoals() {
    if (!this.advancedOptions.collaborativeIntelligence || this.goalStack.length <= 1) {
      return { shouldPreempt: false };
    }
    
    try {
      const result = await this.enhancedIntegration.executeCollaborativeTask(
        "goal_prioritization",
        {
          goals: this.goalStack,
          currentState: this.currentState,
          currentPlan: this.currentPlan
        }
      );
      
      // Reorder goals based on prioritization
      if (result.reorderedGoals && Array.isArray(result.reorderedGoals)) {
        // Extract current goals
        const currentGoals = [...this.goalStack];
        
        // Clear goal stack
        this.goalStack = [];
        
        // Add goals in new order
        for (const goalId of result.reorderedGoals) {
          const goal = currentGoals.find(g => g.id === goalId);
          if (goal) {
            this.goalStack.push(goal);
          }
        }
        
        // Add any goals that weren't in the reordered list
        for (const goal of currentGoals) {
          if (!result.reorderedGoals.includes(goal.id) && !this.goalStack.some(g => g.id === goal.id)) {
            this.goalStack.push(goal);
          }
        }
      }
      
      return {
        shouldPreempt: result.shouldPreempt || false,
        reason: result.reason
      };
    } catch (error) {
      this.logger.warn(`Error prioritizing goals, using default prioritization: ${error.message}`);
      return { shouldPreempt: this._shouldPreemptCurrentGoal(this.goalStack[this.goalStack.length - 1]) };
    }
  }

  /**
   * Determines whether a new goal should preempt the current goal.
   * @param {Object} newGoal - The new goal to evaluate.
   * @returns {boolean} - Whether the new goal should preempt the current goal.
   * @private
   */
  _shouldPreemptCurrentGoal(newGoal) {
    // Simple priority-based preemption as fallback
    return newGoal.priority > (this.goalStack[0].priority || 0);
  }

  /**
   * Suspends the current plan for later resumption with enhanced state tracking.
   * @private
   */
  suspendCurrentPlan() {
    this.logger.info('Suspending current plan');
    
    // Save the current plan state for later resumption with enhanced tracking
    this.suspendedPlans = this.suspendedPlans || [];
    this.suspendedPlans.push({
      goal: this.goalStack.shift(),
      plan: this.currentPlan,
      state: this.currentState,
      progress: {
        completedActions: this.currentPlan ? this.currentPlan.actions.filter(a => a.completed).length : 0,
        totalActions: this.currentPlan ? this.currentPlan.actions.length : 0,
        estimatedCompletionPercentage: this.currentPlan ? 
          (this.currentPlan.actions.filter(a => a.completed).length / this.currentPlan.actions.length) * 100 : 0
      },
      suspensionTime: Date.now(),
      suspensionReason: 'goal_preemption'
    });
    
    // Notify that the plan has been suspended
    this.eventBus.emit('current_plan_suspended', {
      suspendedPlan: this.currentPlan,
      suspensionReason: 'goal_preemption',
      suspensionTime: Date.now()
    });
    
    this.currentPlan = null;
  }

  /**
   * Starts the planning process for the current goal with collaborative intelligence.
   * @private
   */
  async startPlanning() {
    this.logger.info('Starting planning process with collaborative intelligence');
    const startTime = performance.now();
    
    try {
      // Get the current goal from the top of the stack
      const currentGoal = this.goalStack[0];
      
      // Get the current world state with enhanced perception
      await this.updateWorldState();
      
      // Generate a plan for the current goal with collaborative intelligence
      await this.generatePlan(currentGoal);
      
      // Start executing the plan
      await this.executePlan();
      
      // Record planning time
      const endTime = performance.now();
      this.metrics.planningTime.push(endTime - startTime);
      
      this.logger.info(`Planning completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      this.logger.error(`Error in planning process: ${error.message}`);
      
      // Emit planning error event
      this.eventBus.emit('planning_error', {
        goal: this.goalStack[0],
        error: error.message
      });
      
      // Attempt recovery
      await this._handlePlanningError(error);
    }
  }

  /**
   * Handles planning errors with collaborative intelligence.
   * @param {Error} error - The planning error.
   * @private
   */
  async _handlePlanningError(error) {
    try {
      if (!this.advancedOptions.collaborativeIntelligence) {
        // Fallback to simple error handling
        this.abortGoal();
        return;
      }
      
      // Use collaborative intelligence for error recovery
      const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
        "error_recovery",
        {
          error: error.message,
          goal: this.goalStack[0],
          currentState: this.currentState
        }
      );
      
      switch (recoveryResult.action) {
        case 'retry':
          this.logger.info('Retrying planning process');
          await this.startPlanning();
          break;
        
        case 'simplify_goal':
          this.logger.info('Simplifying goal and retrying');
          this.goalStack[0] = {
            ...this.goalStack[0],
            ...recoveryResult.simplifiedGoal
          };
          await this.startPlanning();
          break;
        
        case 'abort':
          this.logger.info('Aborting goal due to unrecoverable planning error');
          this.abortGoal();
          break;
        
        default:
          this.logger.info('Aborting goal due to unrecoverable planning error');
          this.abortGoal();
      }
    } catch (recoveryError) {
      this.logger.error(`Error in planning error recovery: ${recoveryError.message}`);
      this.abortGoal();
    }
  }

  /**
   * Updates the current world state using enhanced perception with collaborative intelligence.
   * @private
   */
  async updateWorldState() {
    this.logger.info('Updating world state with enhanced perception');
    
    try {
      // Get the raw world state from the world model
      const rawState = this.getRawWorldState();
      
      if (this.advancedOptions.collaborativeIntelligence) {
        // Use collaborative intelligence for enhanced perception
        const result = await this.enhancedIntegration.executeCollaborativeTask(
          "perception",
          {
            rawState,
            currentGoal: this.goalStack[0],
            previousState: this.currentState
          }
        );
        
        this.currentState = {
          ...rawState,
          ...result.enhancedState,
          perceptionConfidence: result.confidence,
          perceptionTimestamp: Date.now(),
          perceptionStrategy: result.strategy
        };
        
        this.logger.info('World state updated with collaborative intelligence perception');
      } else {
        // Use the perception model to enhance the state with ML-derived insights
        this.currentState = await this.perceptionModel.process(rawState);
        this.logger.info('World state updated with ML-enhanced perception');
      }
    } catch (error) {
      this.logger.error(`Error updating world state: ${error.message}`);
      
      // Fallback to raw state
      this.currentState = {
        ...this.getRawWorldState(),
        perceptionError: error.message,
        perceptionTimestamp: Date.now(),
        perceptionFallback: true
      };
      
      this.logger.info('Falling back to raw world state due to perception error');
    }
  }

  /**
   * Gets the raw world state from the world model.
   * @returns {Object} - The raw world state.
   * @private
   */
  getRawWorldState() {
    // In a real implementation, this would call the actual world model
    // For now, we'll return a mock state
    return {
      screenshot: 'base64-encoded-screenshot-data',
      windowHierarchy: {
        activeWindow: {
          title: 'Example Application',
          processId: 12345,
          children: [
            { type: 'button', text: 'Submit', bounds: { x: 100, y: 200, width: 80, height: 30 } },
            { type: 'input', text: '', placeholder: 'Enter your name', bounds: { x: 100, y: 150, width: 200, height: 30 } }
          ]
        }
      },
      systemResources: {
        cpuUsage: 0.3,
        memoryUsage: 0.5,
        diskSpace: 0.7
      },
      timestamp: Date.now()
    };
  }

  /**
   * Generates a plan for the current goal using collaborative intelligence for plan ranking.
   * @param {Object} goal - The goal to plan for.
   * @private
   */
  async generatePlan(goal) {
    this.logger.info(`Generating plan for goal: ${JSON.stringify(goal)}`);
    
    try {
      // In a real implementation, this would call the actual HTN planner
      // For now, we'll generate a mock plan
      const candidatePlans = this.generateCandidatePlans(goal);
      
      if (this.advancedOptions.collaborativeIntelligence) {
        // Use collaborative intelligence for plan ranking
        const result = await this.enhancedIntegration.executeCollaborativeTask(
          "plan_ranking",
          {
            goal,
            candidatePlans,
            currentState: this.currentState
          }
        );
        
        // Select the highest-ranked plan
        this.currentPlan = result.rankedPlans[0].plan;
        
        // Add metadata to the plan
        this.currentPlan.metadata = {
          rankingConfidence: result.confidence,
          rankingStrategy: result.strategy,
          estimatedSuccessProbability: result.rankedPlans[0].estimatedSuccessProbability,
          estimatedCompletionTime: result.rankedPlans[0].estimatedCompletionTime,
          rankingTimestamp: Date.now()
        };
        
        this.logger.info(`Selected plan with collaborative intelligence: ${JSON.stringify(this.currentPlan.id)}`);
      } else {
        // Use the plan ranking model to rank the candidate plans
        const rankedPlans = await this.planRankingModel.rank(candidatePlans, goal, this.currentState);
        
        // Select the highest-ranked plan
        this.currentPlan = rankedPlans[0].plan;
        
        this.logger.info(`Selected plan with score ${rankedPlans[0].score}: ${JSON.stringify(this.currentPlan.id)}`);
      }
      
      // Initialize action completion tracking
      if (this.currentPlan && this.currentPlan.actions) {
        this.currentPlan.actions = this.currentPlan.actions.map(action => ({
          ...action,
          completed: false,
          attempted: false,
          attempts: 0
        }));
      }
    } catch (error) {
      this.logger.error(`Error generating plan: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates candidate plans for a goal.
   * @param {Object} goal - The goal to generate plans for.
   * @returns {Array<Object>} - Array of candidate plans.
   * @private
   */
  generateCandidatePlans(goal) {
    // In a real implementation, this would call the actual HTN planner
    // For now, we'll return mock candidate plans
    return [
      {
        id: 'plan1',
        actions: [
          { type: 'open_application', params: { appName: 'Notepad' } },
          { type: 'type_text', params: { text: 'Hello, world!' } },
          { type: 'save_file', params: { path: 'C:/temp/hello.txt' } }
        ]
      },
      {
        id: 'plan2',
        actions: [
          { type: 'open_application', params: { appName: 'WordPad' } },
          { type: 'type_text', params: { text: 'Hello, world!' } },
          { type: 'save_file', params: { path: 'C:/temp/hello.rtf' } }
        ]
      },
      {
        id: 'plan3',
        actions: [
          { type: 'open_application', params: { appName: 'Browser' } },
          { type: 'navigate_to', params: { url: 'https://example.com/editor' } },
          { type: 'type_text', params: { text: 'Hello, world!' } },
          { type: 'click', params: { elementId: 'save-button' } }
        ]
      }
    ];
  }

  /**
   * Executes the current plan with adaptive resource allocation and self-evaluation.
   * @private
   */
  async executePlan() {
    this.logger.info('Executing plan with adaptive resource allocation');
    const startTime = performance.now();
    
    if (!this.currentPlan || !this.currentPlan.actions || this.currentPlan.actions.length === 0) {
      this.logger.info('No plan to execute');
      return;
    }
    
    try {
      // Get next incomplete action
      const nextActionIndex = this.currentPlan.actions.findIndex(action => !action.completed);
      
      if (nextActionIndex === -1) {
        this.logger.info('All actions in plan completed');
        
        // Record execution success
        this.metrics.successRate.attempts++;
        this.metrics.successRate.successes++;
        
        // Record execution time
        const endTime = performance.now();
        this.metrics.executionTime.push(endTime - startTime);
        
        // Handle plan completion
        this._handlePlanCompletion();
        return;
      }
      
      // Execute the next action
      await this.executeAction(this.currentPlan.actions[nextActionIndex]);
    } catch (error) {
      this.logger.error(`Error executing plan: ${error.message}`);
      
      // Record execution failure
      this.metrics.successRate.attempts++;
      
      // Emit plan execution error event
      this.eventBus.emit('plan_execution_error', {
        plan: this.currentPlan,
        error: error.message
      });
      
      // Attempt recovery
      await this._handlePlanExecutionError(error);
    }
  }

  /**
   * Handles plan execution errors with collaborative intelligence.
   * @param {Error} error - The execution error.
   * @private
   */
  async _handlePlanExecutionError(error) {
    try {
      if (!this.advancedOptions.collaborativeIntelligence) {
        // Fallback to simple error handling
        await this.replanGoal();
        return;
      }
      
      // Use collaborative intelligence for error recovery
      const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
        "error_recovery",
        {
          error: error.message,
          plan: this.currentPlan,
          goal: this.goalStack[0],
          currentState: this.currentState
        }
      );
      
      switch (recoveryResult.action) {
        case 'retry_action':
          this.logger.info('Retrying failed action');
          await this.executePlan();
          break;
        
        case 'skip_action':
          this.logger.info('Skipping failed action');
          // Mark the current action as completed to skip it
          const nextActionIndex = this.currentPlan.actions.findIndex(action => !action.completed);
          if (nextActionIndex !== -1) {
            this.currentPlan.actions[nextActionIndex].completed = true;
            this.currentPlan.actions[nextActionIndex].skipped = true;
          }
          await this.executePlan();
          break;
        
        case 'replan':
          this.logger.info('Replanning due to execution error');
          await this.replanGoal();
          break;
        
        case 'abort':
          this.logger.info('Aborting goal due to unrecoverable execution error');
          this.abortGoal();
          break;
        
        default:
          this.logger.info('Replanning due to execution error');
          await this.replanGoal();
      }
    } catch (recoveryError) {
      this.logger.error(`Error in execution error recovery: ${recoveryError.message}`);
      await this.replanGoal();
    }
  }

  /**
   * Handles successful plan completion.
   * @private
   */
  _handlePlanCompletion() {
    this.logger.info('Plan completed successfully');
    
    // Provide feedback to the plan ranking model
    if (this.advancedOptions.collaborativeIntelligence) {
      this.enhancedIntegration.provideFeedback(
        "plan_ranking",
        {
          plan: this.currentPlan,
          goal: this.goalStack[0],
          outcome: {
            success: true,
            executionTime: this.metrics.executionTime[this.metrics.executionTime.length - 1]
          }
        }
      );
    } else {
      this.planRankingModel.provideFeedback(this.currentPlan, 1.0, true);
    }
    
    // Pop the completed goal from the stack
    this.goalStack.shift();
    
    // Check if there are more goals to process
    if (this.goalStack.length > 0) {
      // Start planning for the next goal
      this.startPlanning();
    } else if (this.suspendedPlans && this.suspendedPlans.length > 0) {
      // Resume a suspended plan if available
      this.resumeSuspendedPlan();
    } else {
      // No more goals or suspended plans
      this.logger.info('All goals completed');
      
      // Emit all goals completed event
      this.eventBus.emit('all_goals_completed', {
        metrics: this.getMetrics()
      });
    }
  }

  /**
   * Executes a single action with parameter prediction and self-evaluation.
   * @param {Object} action - The action to execute.
   * @private
   */
  async executeAction(action) {
    this.logger.info(`Executing action: ${JSON.stringify(action)}`);
    
    try {
      // Mark action as attempted
      action.attempted = true;
      action.attempts++;
      
      // Check if the action has all required parameters
      if (!this.actionHasAllRequiredParams(action)) {
        // Use parameter prediction with collaborative intelligence if available
        if (this.advancedOptions.collaborativeIntelligence) {
          const result = await this.enhancedIntegration.executeCollaborativeTask(
            "parameter_prediction",
            {
              action,
              currentState: this.currentState,
              goal: this.goalStack[0]
            }
          );
          
          // Merge predicted parameters with existing parameters
          action.params = { 
            ...action.params, 
            ...result.predictedParams 
          };
          
          // Add prediction metadata
          action.predictionMetadata = {
            confidence: result.confidence,
            strategy: result.strategy,
            timestamp: Date.now()
          };
          
          this.logger.info(`Action parameters enhanced with collaborative intelligence: ${JSON.stringify(action.params)}`);
        } else {
          // Use the parameter prediction model to predict missing parameters
          const predictedParams = await this.parameterPredictionModel.predict(
            action,
            this.currentState,
            this.goalStack[0]
          );
          
          // Merge predicted parameters with existing parameters
          action.params = { ...action.params, ...predictedParams };
          
          this.logger.info(`Action parameters enhanced with ML predictions: ${JSON.stringify(action.params)}`);
        }
      }
      
      // In a real implementation, this would call the actual action executor
      // For now, we'll simulate action execution
      const success = Math.random() > 0.2; // 80% success rate
      
      if (success) {
        // Mark action as completed
        action.completed = true;
        action.completionTime = Date.now();
        
        // Perform self-evaluation if enabled
        if (this.advancedOptions.selfEvaluation) {
          await this._performActionSelfEvaluation(action);
        }
        
        // Emit action completed event
        this.eventBus.emit('action_completed', {
          action,
          result: { success: true, data: {} }
        });
        
        // Continue with plan execution
        await this.executePlan();
      } else {
        // Emit action failed event
        this.eventBus.emit('action_failed', {
          action,
          error: { message: 'Action execution failed', code: 'EXECUTION_FAILED' }
        });
        
        // Handle action failure
        await this.handleActionFailed({
          action,
          error: { message: 'Action execution failed', code: 'EXECUTION_FAILED' }
        });
      }
    } catch (error) {
      this.logger.error(`Error executing action: ${error.message}`);
      
      // Emit action failed event
      this.eventBus.emit('action_failed', {
        action,
        error: { message: error.message, code: 'EXECUTION_ERROR' }
      });
      
      // Handle action failure
      await this.handleActionFailed({
        action,
        error: { message: error.message, code: 'EXECUTION_ERROR' }
      });
    }
  }

  /**
   * Performs self-evaluation of an action execution.
   * @param {Object} action - The executed action.
   * @private
   */
  async _performActionSelfEvaluation(action) {
    try {
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: 'action_execution',
        action,
        currentState: this.currentState,
        goal: this.goalStack[0],
        criteria: {
          effectiveness: 0.8,
          efficiency: 0.7,
          sideEffects: 0.9
        }
      });
      
      // Add evaluation results to action
      action.evaluationResults = evaluationResult;
      
      // If evaluation indicates issues, log them
      if (evaluationResult.score < 0.7) {
        this.logger.warn(`Action self-evaluation indicates issues: ${evaluationResult.feedback}`);
        
        // Emit evaluation warning event
        this.eventBus.emit('action_evaluation_warning', {
          action,
          evaluation: evaluationResult
        });
      }
    } catch (error) {
      this.logger.warn(`Error performing action self-evaluation: ${error.message}`);
    }
  }

  /**
   * Checks if an action has all required parameters.
   * @param {Object} action - The action to check.
   * @returns {boolean} - Whether the action has all required parameters.
   * @private
   */
  actionHasAllRequiredParams(action) {
    // In a real implementation, this would check against a schema of required parameters
    // For now, we'll use a simple check based on action type
    switch (action.type) {
      case 'open_application':
        return action.params && action.params.appName;
      case 'type_text':
        return action.params && action.params.text;
      case 'click':
        return action.params && (action.params.elementId || (action.params.coordinates && action.params.coordinates.x !== undefined && action.params.coordinates.y !== undefined));
      case 'save_file':
        return action.params && action.params.path;
      case 'navigate_to':
        return action.params && action.params.url;
      default:
        return true; // Assume all parameters are present for unknown action types
    }
  }

  /**
   * Handles the completion of an action with enhanced state tracking.
   * @param {Object} event - The action completed event.
   * @private
   */
  async handleActionCompleted(event) {
    this.logger.info(`Action completed: ${JSON.stringify(event.action)}`);
    
    try {
      // Update the world state based on the action's effects
      await this.updateStateFromAction(event.action, event.result);
      
      // Check if the plan is complete
      if (this.isPlanComplete()) {
        this.logger.info('Plan completed successfully');
        
        // Provide feedback to the plan ranking model
        if (this.advancedOptions.collaborativeIntelligence) {
          this.enhancedIntegration.provideFeedback(
            "plan_ranking",
            {
              plan: this.currentPlan,
              goal: this.goalStack[0],
              outcome: {
                success: true,
                executionTime: performance.now() - (this.currentPlan.startTime || 0)
              }
            }
          );
        } else {
          this.planRankingModel.provideFeedback(this.currentPlan, 1.0, true);
        }
        
        // Record execution success
        this.metrics.successRate.attempts++;
        this.metrics.successRate.successes++;
        
        // Pop the completed goal from the stack
        this.goalStack.shift();
        
        // Check if there are more goals to process
        if (this.goalStack.length > 0) {
          // Start planning for the next goal
          await this.startPlanning();
        } else if (this.suspendedPlans && this.suspendedPlans.length > 0) {
          // Resume a suspended plan if available
          await this.resumeSuspendedPlan();
        } else {
          // No more goals or suspended plans
          this.logger.info('All goals completed');
          
          // Emit all goals completed event
          this.eventBus.emit('all_goals_completed', {
            metrics: this.getMetrics()
          });
        }
      } else {
        // Continue executing the plan
        await this.executePlan();
      }
    } catch (error) {
      this.logger.error(`Error handling action completion: ${error.message}`);
      
      // Attempt recovery
      await this._handleActionCompletionError(error, event.action);
    }
  }

  /**
   * Handles errors during action completion processing.
   * @param {Error} error - The error that occurred.
   * @param {Object} action - The action that was completed.
   * @private
   */
  async _handleActionCompletionError(error, action) {
    try {
      if (!this.advancedOptions.collaborativeIntelligence) {
        // Fallback to simple error handling
        await this.executePlan();
        return;
      }
      
      // Use collaborative intelligence for error recovery
      const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
        "error_recovery",
        {
          error: error.message,
          action,
          plan: this.currentPlan,
          goal: this.goalStack[0],
          currentState: this.currentState
        }
      );
      
      switch (recoveryResult.action) {
        case 'continue':
          this.logger.info('Continuing plan execution despite action completion error');
          await this.executePlan();
          break;
        
        case 'update_state':
          this.logger.info('Updating state with recovery data');
          this.currentState = {
            ...this.currentState,
            ...recoveryResult.stateUpdates
          };
          await this.executePlan();
          break;
        
        case 'replan':
          this.logger.info('Replanning due to action completion error');
          await this.replanGoal();
          break;
        
        default:
          this.logger.info('Continuing plan execution');
          await this.executePlan();
      }
    } catch (recoveryError) {
      this.logger.error(`Error in action completion error recovery: ${recoveryError.message}`);
      await this.executePlan();
    }
  }

  /**
   * Updates the world state based on an action's effects with enhanced tracking.
   * @param {Object} action - The action that was executed.
   * @param {Object} result - The result of the action execution.
   * @private
   */
  async updateStateFromAction(action, result) {
    this.logger.info(`Updating state based on action: ${JSON.stringify(action)}`);
    
    try {
      if (this.advancedOptions.collaborativeIntelligence) {
        // Use collaborative intelligence for state updating
        const stateUpdateResult = await this.enhancedIntegration.executeCollaborativeTask(
          "perception",
          {
            action,
            actionResult: result,
            previousState: this.currentState,
            updateType: 'action_effect'
          }
        );
        
        // Update state with predicted effects
        this.currentState = {
          ...this.currentState,
          ...stateUpdateResult.stateUpdates,
          lastActionEffect: {
            action: action.type,
            timestamp: Date.now(),
            confidence: stateUpdateResult.confidence
          }
        };
      } else {
        // In a real implementation, this would update the world state based on the action's effects
        // For now, we'll just simulate a state update
        this.currentState = {
          ...this.currentState,
          lastAction: action.type,
          lastActionTimestamp: Date.now()
        };
      }
    } catch (error) {
      this.logger.error(`Error updating state from action: ${error.message}`);
      
      // Continue with current state
      this.currentState = {
        ...this.currentState,
        lastAction: action.type,
        lastActionTimestamp: Date.now(),
        stateUpdateError: error.message
      };
    }
  }

  /**
   * Checks if the current plan is complete.
   * @returns {boolean} - Whether the current plan is complete.
   * @private
   */
  isPlanComplete() {
    if (!this.currentPlan || !this.currentPlan.actions) {
      return true;
    }
    
    // Check if all actions are completed
    return this.currentPlan.actions.every(action => action.completed);
  }

  /**
   * Resumes a previously suspended plan with enhanced state restoration.
   * @private
   */
  async resumeSuspendedPlan() {
    this.logger.info('Resuming suspended plan');
    
    try {
      // Pop the most recently suspended plan
      const suspendedPlan = this.suspendedPlans.pop();
      
      if (!suspendedPlan) {
        this.logger.warn('No suspended plan to resume');
        return;
      }
      
      // Restore the goal, plan, and state
      this.goalStack.unshift(suspendedPlan.goal);
      this.currentPlan = suspendedPlan.plan;
      
      // Use collaborative intelligence to adapt the suspended plan if needed
      if (this.advancedOptions.collaborativeIntelligence) {
        const adaptationResult = await this.enhancedIntegration.executeCollaborativeTask(
          "plan_ranking",
          {
            task: 'adapt_suspended_plan',
            suspendedPlan: this.currentPlan,
            suspensionState: suspendedPlan.state,
            currentState: this.currentState,
            goal: suspendedPlan.goal,
            suspensionDuration: Date.now() - suspendedPlan.suspensionTime
          }
        );
        
        if (adaptationResult.shouldAdapt) {
          this.logger.info('Adapting suspended plan based on current state');
          
          // Apply adaptations to the plan
          this.currentPlan = adaptationResult.adaptedPlan;
          
          // Add adaptation metadata
          this.currentPlan.adaptationMetadata = {
            adaptationReason: adaptationResult.adaptationReason,
            adaptationStrategy: adaptationResult.adaptationStrategy,
            adaptationTimestamp: Date.now(),
            originalPlanId: suspendedPlan.plan.id
          };
        } else {
          // Just update the current state
          this.currentState = await this.updateWorldState();
        }
      } else {
        // Just restore the state
        this.currentState = suspendedPlan.state;
      }
      
      // Notify that the plan has been resumed
      this.eventBus.emit('suspended_plan_resumed', {
        resumedPlan: this.currentPlan,
        resumptionTime: Date.now(),
        suspensionDuration: Date.now() - suspendedPlan.suspensionTime
      });
      
      // Continue executing the plan
      await this.executePlan();
    } catch (error) {
      this.logger.error(`Error resuming suspended plan: ${error.message}`);
      
      // Attempt to start fresh with the goal
      if (this.goalStack.length > 0) {
        await this.startPlanning();
      } else if (this.suspendedPlans && this.suspendedPlans.length > 0) {
        // Try the next suspended plan
        await this.resumeSuspendedPlan();
      }
    }
  }

  /**
   * Handles the failure of an action with collaborative intelligence for recovery.
   * @param {Object} event - The action failed event.
   * @private
   */
  async handleActionFailed(event) {
    this.logger.info(`Action failed: ${JSON.stringify(event.action)}, error: ${JSON.stringify(event.error)}`);
    
    try {
      // Provide feedback to the parameter prediction model if applicable
      if (event.action.params) {
        if (this.advancedOptions.collaborativeIntelligence) {
          this.enhancedIntegration.provideFeedback(
            "parameter_prediction",
            {
              action: event.action,
              params: event.action.params,
              outcome: {
                success: false,
                error: event.error
              }
            }
          );
        } else {
          this.parameterPredictionModel.provideFeedback(
            event.action,
            event.action.params,
            event.action.params, // In a real implementation, this would be the actual parameters used
            false
          );
        }
      }
      
      if (this.advancedOptions.collaborativeIntelligence) {
        // Use collaborative intelligence for error recovery
        const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
          "error_recovery",
          {
            action: event.action,
            error: event.error,
            plan: this.currentPlan,
            goal: this.goalStack[0],
            currentState: this.currentState,
            attemptCount: event.action.attempts || 1
          }
        );
        
        // Handle the failure based on the recovery strategy
        switch (recoveryResult.recoveryStrategy) {
          case 'retry_action':
            // Reset action completion status for retry
            event.action.completed = false;
            event.action.retryReason = recoveryResult.reason;
            event.action.retryTimestamp = Date.now();
            
            // Apply parameter adjustments if provided
            if (recoveryResult.adjustedParams) {
              event.action.params = {
                ...event.action.params,
                ...recoveryResult.adjustedParams
              };
              event.action.paramsAdjusted = true;
            }
            
            this.logger.info(`Retrying action with${event.action.paramsAdjusted ? ' adjusted parameters' : 'out parameter changes'}`);
            await this.executePlan();
            break;
          
          case 'skip_action':
            // Mark action as completed but skipped
            event.action.completed = true;
            event.action.skipped = true;
            event.action.skipReason = recoveryResult.reason;
            event.action.skipTimestamp = Date.now();
            
            this.logger.info('Skipping failed action and continuing with plan');
            await this.executePlan();
            break;
          
          case 'alternative_action':
            // Replace the failed action with an alternative
            const actionIndex = this.currentPlan.actions.findIndex(a => a === event.action);
            if (actionIndex !== -1 && recoveryResult.alternativeAction) {
              this.currentPlan.actions[actionIndex] = {
                ...recoveryResult.alternativeAction,
                completed: false,
                attempted: false,
                attempts: 0,
                replacedOriginalAction: true,
                replacementTimestamp: Date.now(),
                replacementReason: recoveryResult.reason
              };
              
              this.logger.info('Replacing failed action with alternative');
              await this.executePlan();
            } else {
              this.logger.warn('Could not replace action with alternative, replanning');
              await this.replanGoal();
            }
            break;
          
          case 'replan_subtask':
            await this.replanSubtask(event.action);
            break;
          
          case 'replan_goal':
            await this.replanGoal();
            break;
          
          case 'abort_goal':
            this.abortGoal();
            break;
          
          default:
            // Default to replanning the goal
            await this.replanGoal();
        }
      } else {
        // Determine the recovery scope based on the action and error
        const recoveryScope = this.determineRecoveryScope(event.action, event.error);
        
        // Handle the failure based on the recovery scope
        switch (recoveryScope) {
          case 'retryAction':
            await this.retryAction(event.action);
            break;
          
          case 'replanSubtask':
            await this.replanSubtask(event.action);
            break;
          
          case 'replanGoal':
            await this.replanGoal();
            break;
          
          case 'abortGoal':
            this.abortGoal();
            break;
          
          default:
            // Default to replanning the goal
            await this.replanGoal();
        }
      }
    } catch (error) {
      this.logger.error(`Error handling action failure: ${error.message}`);
      
      // Fallback to replanning
      await this.replanGoal();
    }
  }

  /**
   * Determines the recovery scope for a failed action.
   * @param {Object} action - The action that failed.
   * @param {Object} error - The error that occurred.
   * @returns {string} - The recovery scope ('retryAction', 'replanSubtask', 'replanGoal', or 'abortGoal').
   * @private
   */
  determineRecoveryScope(action, error) {
    // In a real implementation, this would use the action's recoveryScope metadata and the error details
    
    // If the action has been attempted too many times, escalate the recovery scope
    if (action.attempts >= 3) {
      return 'replanSubtask';
    }
    
    // If the error is transient, retry the action
    if (error.code === 'TRANSIENT_ERROR' || error.code === 'TIMEOUT') {
      return 'retryAction';
    }
    
    // If the error indicates a fundamental issue with the action, replan the subtask
    if (error.code === 'INVALID_ACTION' || error.code === 'PRECONDITION_FAILED') {
      return 'replanSubtask';
    }
    
    // If the error indicates a fundamental issue with the plan, replan the goal
    if (error.code === 'INVALID_PLAN' || error.code === 'GOAL_UNREACHABLE') {
      return 'replanGoal';
    }
    
    // If the error indicates a fundamental issue with the goal, abort the goal
    if (error.code === 'INVALID_GOAL' || error.code === 'PERMISSION_DENIED') {
      return 'abortGoal';
    }
    
    // Default to retrying the action
    return 'retryAction';
  }

  /**
   * Retries a failed action.
   * @param {Object} action - The action to retry.
   * @private
   */
  async retryAction(action) {
    this.logger.info(`Retrying action: ${JSON.stringify(action)}`);
    
    // Reset action completion status
    action.completed = false;
    
    // Continue with plan execution
    await this.executePlan();
  }

  /**
   * Replans a subtask containing a failed action.
   * @param {Object} failedAction - The action that failed.
   * @private
   */
  async replanSubtask(failedAction) {
    this.logger.info(`Replanning subtask containing action: ${JSON.stringify(failedAction)}`);
    
    try {
      // Find the subtask containing the failed action
      // In a real implementation, this would identify the subtask based on the plan structure
      // For now, we'll just replan the entire goal
      await this.replanGoal();
    } catch (error) {
      this.logger.error(`Error replanning subtask: ${error.message}`);
      await this.replanGoal();
    }
  }

  /**
   * Replans the current goal.
   * @private
   */
  async replanGoal() {
    this.logger.info('Replanning current goal');
    
    try {
      // Reset the current plan
      this.currentPlan = null;
      
      // Update the world state
      await this.updateWorldState();
      
      // Generate a new plan for the current goal
      await this.generatePlan(this.goalStack[0]);
      
      // Start executing the new plan
      await this.executePlan();
    } catch (error) {
      this.logger.error(`Error replanning goal: ${error.message}`);
      this.abortGoal();
    }
  }

  /**
   * Aborts the current goal.
   * @private
   */
  abortGoal() {
    this.logger.info('Aborting current goal');
    
    // Record execution failure
    this.metrics.successRate.attempts++;
    
    // Provide feedback to the plan ranking model
    if (this.advancedOptions.collaborativeIntelligence) {
      this.enhancedIntegration.provideFeedback(
        "plan_ranking",
        {
          plan: this.currentPlan,
          goal: this.goalStack[0],
          outcome: {
            success: false,
            aborted: true
          }
        }
      );
    } else if (this.currentPlan) {
      this.planRankingModel.provideFeedback(this.currentPlan, 0.0, false);
    }
    
    // Emit goal aborted event
    this.eventBus.emit('goal_aborted', {
      goal: this.goalStack[0],
      reason: 'Unrecoverable error'
    });
    
    // Pop the aborted goal from the stack
    this.goalStack.shift();
    
    // Reset the current plan
    this.currentPlan = null;
    
    // Check if there are more goals to process
    if (this.goalStack.length > 0) {
      // Start planning for the next goal
      this.startPlanning();
    } else if (this.suspendedPlans && this.suspendedPlans.length > 0) {
      // Resume a suspended plan if available
      this.resumeSuspendedPlan();
    } else {
      // No more goals or suspended plans
      this.logger.info('No more goals to process');
      
      // Emit all goals completed event
      this.eventBus.emit('all_goals_completed', {
        metrics: this.getMetrics(),
        abortedLastGoal: true
      });
    }
  }

  /**
   * Handles changes in world state.
   * @param {Object} event - The world state changed event.
   * @private
   */
  handleWorldStateChanged(event) {
    this.logger.info('World state changed event received');
    
    // Update the current state with the new state
    this.currentState = {
      ...this.currentState,
      ...event.newState,
      lastUpdateSource: 'external',
      lastUpdateTimestamp: Date.now()
    };
    
    // Check if the current plan is still valid
    if (this.currentPlan && this.advancedOptions.collaborativeIntelligence) {
      this._checkPlanValidity();
    }
  }

  /**
   * Checks if the current plan is still valid after a state change.
   * @private
   */
  async _checkPlanValidity() {
    try {
      const validityResult = await this.enhancedIntegration.executeCollaborativeTask(
        "plan_ranking",
        {
          task: 'check_plan_validity',
          plan: this.currentPlan,
          currentState: this.currentState,
          goal: this.goalStack[0]
        }
      );
      
      if (!validityResult.isValid) {
        this.logger.info(`Plan invalidated by state change: ${validityResult.reason}`);
        
        // Emit plan invalidated event
        this.eventBus.emit('plan_invalidated', {
          plan: this.currentPlan,
          reason: validityResult.reason
        });
        
        // Replan the goal
        await this.replanGoal();
      }
    } catch (error) {
      this.logger.error(`Error checking plan validity: ${error.message}`);
    }
  }

  /**
   * Handles changes in resource availability.
   * @param {Object} event - The resource availability changed event.
   * @private
   */
  handleResourceAvailabilityChanged(event) {
    this.logger.info('Resource availability changed event received');
    
    // Update resource allocation if adaptive resource allocation is enabled
    if (this.advancedOptions.adaptiveResourceAllocation && this.currentPlan) {
      this._adaptResourceAllocation(event.resources);
    }
  }

  /**
   * Adapts resource allocation based on available resources.
   * @param {Object} resources - The available resources.
   * @private
   */
  async _adaptResourceAllocation(resources) {
    try {
      const allocationResult = await this.enhancedIntegration.getAdaptiveResourceAllocation({
        plan: this.currentPlan,
        goal: this.goalStack[0],
        availableResources: resources
      });
      
      // Apply resource allocation strategy
      if (allocationResult.strategy) {
        this.logger.info(`Adapting resource allocation: ${allocationResult.strategy}`);
        
        // In a real implementation, this would adjust resource usage based on the strategy
        // For now, we'll just log the adaptation
        this.logger.info(`Resource allocation adapted: ${JSON.stringify(allocationResult.strategy)}`);
      }
    } catch (error) {
      this.logger.error(`Error adapting resource allocation: ${error.message}`);
    }
  }

  /**
   * Handles model performance updates.
   * @param {Object} event - The model performance update event.
   * @private
   */
  handleModelPerformanceUpdate(event) {
    this.logger.info('Model performance update event received');
    
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
   * Adjusts model selection based on performance updates.
   * @param {Object} performanceEvent - The model performance event.
   * @private
   */
  async _adjustModelSelection(performanceEvent) {
    try {
      if (performanceEvent.modelId && performanceEvent.taskType) {
        await this.enhancedIntegration.updateModelPreference({
          modelId: performanceEvent.modelId,
          taskType: performanceEvent.taskType,
          performance: {
            success: performanceEvent.success,
            latency: performanceEvent.latency,
            accuracy: performanceEvent.accuracy
          }
        });
        
        this.logger.info(`Updated model preference for ${performanceEvent.modelId} on ${performanceEvent.taskType}`);
      }
    } catch (error) {
      this.logger.error(`Error adjusting model selection: ${error.message}`);
    }
  }

  /**
   * Gets the current metrics.
   * @returns {Object} - The current metrics.
   */
  getMetrics() {
    const modelUsageArray = Array.from(this.metrics.modelUsage.entries()).map(([modelId, usage]) => ({
      modelId,
      calls: usage.calls,
      successRate: usage.calls > 0 ? usage.successes / usage.calls : 0,
      averageLatency: usage.latency.length > 0 ? usage.latency.reduce((a, b) => a + b, 0) / usage.latency.length : 0
    }));
    
    return {
      planningTime: {
        average: this.metrics.planningTime.length > 0 ? 
          this.metrics.planningTime.reduce((a, b) => a + b, 0) / this.metrics.planningTime.length : 0,
        min: this.metrics.planningTime.length > 0 ? Math.min(...this.metrics.planningTime) : 0,
        max: this.metrics.planningTime.length > 0 ? Math.max(...this.metrics.planningTime) : 0
      },
      executionTime: {
        average: this.metrics.executionTime.length > 0 ? 
          this.metrics.executionTime.reduce((a, b) => a + b, 0) / this.metrics.executionTime.length : 0,
        min: this.metrics.executionTime.length > 0 ? Math.min(...this.metrics.executionTime) : 0,
        max: this.metrics.executionTime.length > 0 ? Math.max(...this.metrics.executionTime) : 0
      },
      successRate: this.metrics.successRate.attempts > 0 ? 
        this.metrics.successRate.successes / this.metrics.successRate.attempts : 0,
      modelUsage: modelUsageArray
    };
  }

  /**
   * Initializes the orchestrator.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization is successful.
   */
  async initialize() {
    try {
      this.logger.info('Initializing HTN Orchestrator with advanced multi-LLM orchestration capabilities');
      
      // Initialize enhanced integration
      await this.enhancedIntegration.initialize();
      
      // Initialize ML models
      await this.initializeMLModels();
      
      this.logger.info('HTN Orchestrator initialization complete');
      return true;
    } catch (error) {
      this.logger.error(`Error initializing HTN Orchestrator: ${error.message}`);
      throw error;
    }
  }

  /**
   * Shuts down the orchestrator.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown is successful.
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down HTN Orchestrator');
      
      // Clean up enhanced integration
      await this.enhancedIntegration.cleanup();
      
      // Clean up ML models
      if (this.perceptionModel && typeof this.perceptionModel.cleanup === 'function') {
        await this.perceptionModel.cleanup();
      }
      
      if (this.parameterPredictionModel && typeof this.parameterPredictionModel.cleanup === 'function') {
        await this.parameterPredictionModel.cleanup();
      }
      
      if (this.planRankingModel && typeof this.planRankingModel.cleanup === 'function') {
        await this.planRankingModel.cleanup();
      }
      
      this.logger.info('HTN Orchestrator shutdown complete');
      return true;
    } catch (error) {
      this.logger.error(`Error shutting down HTN Orchestrator: ${error.message}`);
      return false;
    }
  }
}

module.exports = HTNOrchestrator;
