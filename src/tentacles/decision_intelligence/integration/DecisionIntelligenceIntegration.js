/**
 * @fileoverview Decision Intelligence Integration Service
 * 
 * This component provides integration points between the Decision Intelligence Tentacle
 * and other tentacles in the Aideon system.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Decision Intelligence Integration Service
 */
class DecisionIntelligenceIntegration {
  /**
   * Creates a new instance of the Decision Intelligence Integration Service
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} decisionIntelligenceTentacle Reference to the Decision Intelligence Tentacle
   * @param {Object} config Configuration options
   */
  constructor(aideon, decisionIntelligenceTentacle, config = {}) {
    this.aideon = aideon;
    this.decisionIntelligenceTentacle = decisionIntelligenceTentacle;
    this.logger = new Logger('DecisionIntelligenceIntegration');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      enabledIntegrations: config.enabledIntegrations || ['planner', 'assistant', 'knowledge', 'workflow'],
      autoRegisterEvents: config.autoRegisterEvents !== undefined ? config.autoRegisterEvents : true,
      ...config
    };
    
    // Integration handlers
    this.integrationHandlers = new Map();
    
    // Registered tentacles
    this.registeredTentacles = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.registerTentacle = this.registerTentacle.bind(this);
    this.unregisterTentacle = this.unregisterTentacle.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Decision Intelligence Integration Service
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Decision Intelligence Integration Service');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize integration handlers
      await this._initializeIntegrationHandlers();
      
      // Register event listeners if auto-register is enabled
      if (this.config.autoRegisterEvents) {
        this._registerEventListeners();
      }
      
      this.initialized = true;
      this.logger.info('Decision Intelligence Integration Service initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'decisionIntelligenceIntegration' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('integration');
      
      if (config) {
        this.config.enabledIntegrations = config.get('enabledIntegrations') || this.config.enabledIntegrations;
        this.config.autoRegisterEvents = config.get('autoRegisterEvents') !== undefined ? config.get('autoRegisterEvents') : this.config.autoRegisterEvents;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Initializes integration handlers
   * @private
   * @returns {Promise<void>} A promise that resolves when integration handlers are initialized
   */
  async _initializeIntegrationHandlers() {
    this.logger.info('Initializing integration handlers');
    
    // Initialize handlers for enabled integrations
    for (const integration of this.config.enabledIntegrations) {
      switch (integration) {
        case 'planner':
          this.integrationHandlers.set('planner', this._createPlannerIntegrationHandler());
          break;
        case 'assistant':
          this.integrationHandlers.set('assistant', this._createAssistantIntegrationHandler());
          break;
        case 'knowledge':
          this.integrationHandlers.set('knowledge', this._createKnowledgeIntegrationHandler());
          break;
        case 'workflow':
          this.integrationHandlers.set('workflow', this._createWorkflowIntegrationHandler());
          break;
        default:
          this.logger.warn(`Unknown integration type: ${integration}`);
      }
    }
    
    this.logger.info(`Initialized ${this.integrationHandlers.size} integration handlers`);
  }
  
  /**
   * Creates a planner integration handler
   * @private
   * @returns {Object} The planner integration handler
   */
  _createPlannerIntegrationHandler() {
    return {
      name: 'planner',
      description: 'Integrates with the Planner Tentacle for decision-aware planning',
      tentacleType: 'planner',
      
      // Event handlers
      eventHandlers: {
        'planner:plan:created': this._handlePlanCreated.bind(this),
        'planner:task:created': this._handleTaskCreated.bind(this),
        'planner:decision:requested': this._handleDecisionRequested.bind(this)
      },
      
      // API methods
      evaluateDecisionPoint: async (decisionPoint, context) => {
        this.logger.info(`Evaluating decision point for planner: ${decisionPoint.id}`);
        
        try {
          // Validate decision point
          if (!decisionPoint || !decisionPoint.id || !decisionPoint.options) {
            throw new Error('Invalid decision point');
          }
          
          // Prepare decision task
          const decisionTask = {
            id: `planner-decision-${decisionPoint.id}`,
            type: decisionPoint.type || 'multi-option',
            data: {
              decisionPoint,
              options: decisionPoint.options,
              context: {
                ...context,
                source: 'planner'
              }
            },
            options: {
              framework: decisionPoint.framework || 'maut',
              explanationLevel: decisionPoint.explanationLevel || 'detailed'
            }
          };
          
          // Execute decision task
          const result = await this.decisionIntelligenceTentacle.executeTask(decisionTask, {
            userId: context.userId || 'system',
            tentacleId: 'planner'
          });
          
          return result;
        } catch (error) {
          this.logger.error('Error evaluating decision point for planner', error);
          throw error;
        }
      },
      
      suggestDecisionPoints: async (plan, context) => {
        this.logger.info(`Suggesting decision points for plan: ${plan.id}`);
        
        try {
          // Analyze plan for potential decision points
          const analysisTask = {
            id: `planner-analysis-${plan.id}`,
            type: 'custom',
            data: {
              plan,
              context: {
                ...context,
                source: 'planner'
              }
            },
            options: {
              analysisType: 'decision-point-detection'
            }
          };
          
          // Execute analysis task
          const result = await this.decisionIntelligenceTentacle.executeTask(analysisTask, {
            userId: context.userId || 'system',
            tentacleId: 'planner'
          });
          
          return result.result.decisionPoints || [];
        } catch (error) {
          this.logger.error('Error suggesting decision points for planner', error);
          return [];
        }
      }
    };
  }
  
  /**
   * Creates an assistant integration handler
   * @private
   * @returns {Object} The assistant integration handler
   */
  _createAssistantIntegrationHandler() {
    return {
      name: 'assistant',
      description: 'Integrates with the Assistant Tentacle for decision support',
      tentacleType: 'assistant',
      
      // Event handlers
      eventHandlers: {
        'assistant:conversation:created': this._handleConversationCreated.bind(this),
        'assistant:message:received': this._handleMessageReceived.bind(this),
        'assistant:decision:requested': this._handleAssistantDecisionRequested.bind(this)
      },
      
      // API methods
      analyzeConversation: async (conversation, context) => {
        this.logger.info(`Analyzing conversation for decision points: ${conversation.id}`);
        
        try {
          // Prepare analysis task
          const analysisTask = {
            id: `assistant-analysis-${conversation.id}`,
            type: 'custom',
            data: {
              conversation,
              context: {
                ...context,
                source: 'assistant'
              }
            },
            options: {
              analysisType: 'conversation-decision-analysis'
            }
          };
          
          // Execute analysis task
          const result = await this.decisionIntelligenceTentacle.executeTask(analysisTask, {
            userId: context.userId || 'system',
            tentacleId: 'assistant'
          });
          
          return result.result;
        } catch (error) {
          this.logger.error('Error analyzing conversation for assistant', error);
          return {
            decisionPoints: [],
            recommendations: [],
            confidence: 0
          };
        }
      },
      
      generateDecisionExplanation: async (decision, context) => {
        this.logger.info(`Generating decision explanation: ${decision.id}`);
        
        try {
          // Prepare explanation task
          const explanationTask = {
            id: `assistant-explanation-${decision.id}`,
            type: 'custom',
            data: {
              decision,
              context: {
                ...context,
                source: 'assistant'
              }
            },
            options: {
              explanationType: 'conversational',
              format: context.format || 'text'
            }
          };
          
          // Execute explanation task
          const result = await this.decisionIntelligenceTentacle.executeTask(explanationTask, {
            userId: context.userId || 'system',
            tentacleId: 'assistant'
          });
          
          return result.result.explanation;
        } catch (error) {
          this.logger.error('Error generating decision explanation for assistant', error);
          return 'Unable to generate explanation at this time.';
        }
      }
    };
  }
  
  /**
   * Creates a knowledge integration handler
   * @private
   * @returns {Object} The knowledge integration handler
   */
  _createKnowledgeIntegrationHandler() {
    return {
      name: 'knowledge',
      description: 'Integrates with the Knowledge Tentacle for decision-relevant knowledge',
      tentacleType: 'knowledge',
      
      // Event handlers
      eventHandlers: {
        'knowledge:item:created': this._handleKnowledgeItemCreated.bind(this),
        'knowledge:query:executed': this._handleKnowledgeQueryExecuted.bind(this),
        'knowledge:decision:requested': this._handleKnowledgeDecisionRequested.bind(this)
      },
      
      // API methods
      findRelevantKnowledge: async (decisionContext, options) => {
        this.logger.info(`Finding relevant knowledge for decision: ${decisionContext.id}`);
        
        try {
          // Prepare knowledge search task
          const searchTask = {
            id: `knowledge-search-${decisionContext.id}`,
            type: 'custom',
            data: {
              decisionContext,
              options: {
                ...options,
                source: 'knowledge'
              }
            },
            options: {
              searchType: 'decision-relevant-knowledge',
              maxResults: options.maxResults || 10,
              minRelevance: options.minRelevance || 0.7
            }
          };
          
          // Execute search task
          const result = await this.decisionIntelligenceTentacle.executeTask(searchTask, {
            userId: decisionContext.userId || 'system',
            tentacleId: 'knowledge'
          });
          
          return result.result.knowledgeItems || [];
        } catch (error) {
          this.logger.error('Error finding relevant knowledge', error);
          return [];
        }
      },
      
      evaluateKnowledgeRelevance: async (knowledgeItem, decisionContext) => {
        this.logger.info(`Evaluating knowledge relevance: ${knowledgeItem.id}`);
        
        try {
          // Prepare relevance evaluation task
          const evaluationTask = {
            id: `knowledge-relevance-${knowledgeItem.id}`,
            type: 'custom',
            data: {
              knowledgeItem,
              decisionContext,
              context: {
                source: 'knowledge'
              }
            },
            options: {
              evaluationType: 'knowledge-relevance'
            }
          };
          
          // Execute evaluation task
          const result = await this.decisionIntelligenceTentacle.executeTask(evaluationTask, {
            userId: decisionContext.userId || 'system',
            tentacleId: 'knowledge'
          });
          
          return result.result.relevance;
        } catch (error) {
          this.logger.error('Error evaluating knowledge relevance', error);
          return 0;
        }
      }
    };
  }
  
  /**
   * Creates a workflow integration handler
   * @private
   * @returns {Object} The workflow integration handler
   */
  _createWorkflowIntegrationHandler() {
    return {
      name: 'workflow',
      description: 'Integrates with the Workflow Tentacle for decision-based workflows',
      tentacleType: 'workflow',
      
      // Event handlers
      eventHandlers: {
        'workflow:created': this._handleWorkflowCreated.bind(this),
        'workflow:step:started': this._handleWorkflowStepStarted.bind(this),
        'workflow:decision:requested': this._handleWorkflowDecisionRequested.bind(this)
      },
      
      // API methods
      evaluateWorkflowDecision: async (decisionPoint, workflowContext) => {
        this.logger.info(`Evaluating workflow decision: ${decisionPoint.id}`);
        
        try {
          // Prepare decision task
          const decisionTask = {
            id: `workflow-decision-${decisionPoint.id}`,
            type: decisionPoint.type || 'multi-option',
            data: {
              decisionPoint,
              workflowContext,
              options: decisionPoint.options,
              context: {
                source: 'workflow',
                workflowId: workflowContext.workflowId
              }
            },
            options: {
              framework: decisionPoint.framework || 'maut',
              explanationLevel: decisionPoint.explanationLevel || 'detailed'
            }
          };
          
          // Execute decision task
          const result = await this.decisionIntelligenceTentacle.executeTask(decisionTask, {
            userId: workflowContext.userId || 'system',
            tentacleId: 'workflow'
          });
          
          return result;
        } catch (error) {
          this.logger.error('Error evaluating workflow decision', error);
          throw error;
        }
      },
      
      createDecisionBasedWorkflow: async (decisionTree, context) => {
        this.logger.info(`Creating decision-based workflow from tree: ${decisionTree.id}`);
        
        try {
          // Prepare workflow creation task
          const workflowTask = {
            id: `workflow-creation-${decisionTree.id}`,
            type: 'custom',
            data: {
              decisionTree,
              context: {
                ...context,
                source: 'workflow'
              }
            },
            options: {
              taskType: 'decision-tree-to-workflow'
            }
          };
          
          // Execute workflow creation task
          const result = await this.decisionIntelligenceTentacle.executeTask(workflowTask, {
            userId: context.userId || 'system',
            tentacleId: 'workflow'
          });
          
          return result.result.workflow;
        } catch (error) {
          this.logger.error('Error creating decision-based workflow', error);
          throw error;
        }
      }
    };
  }
  
  /**
   * Registers event listeners
   * @private
   */
  _registerEventListeners() {
    this.logger.info('Registering event listeners');
    
    if (!this.aideon || !this.aideon.events) {
      this.logger.warn('Event system not available, skipping event registration');
      return;
    }
    
    // Register handlers for each integration
    for (const handler of this.integrationHandlers.values()) {
      for (const [eventName, eventHandler] of Object.entries(handler.eventHandlers || {})) {
        this.aideon.events.on(eventName, eventHandler);
        this.logger.info(`Registered handler for event: ${eventName}`);
      }
    }
  }
  
  /**
   * Handles plan created event
   * @private
   * @param {Object} event The event data
   */
  async _handlePlanCreated(event) {
    this.logger.info(`Handling plan created event: ${event.planId}`);
    
    try {
      const plannerHandler = this.integrationHandlers.get('planner');
      if (!plannerHandler) {
        return;
      }
      
      // Get planner tentacle
      const plannerTentacle = this.registeredTentacles.get('planner');
      if (!plannerTentacle) {
        return;
      }
      
      // Get plan details
      const plan = await plannerTentacle.getPlan(event.planId);
      
      // Suggest decision points
      const decisionPoints = await plannerHandler.suggestDecisionPoints(plan, {
        userId: event.userId,
        timestamp: event.timestamp
      });
      
      if (decisionPoints.length > 0) {
        this.logger.info(`Suggested ${decisionPoints.length} decision points for plan: ${event.planId}`);
        
        // Notify planner tentacle of suggested decision points
        await plannerTentacle.addDecisionPoints(event.planId, decisionPoints);
      }
    } catch (error) {
      this.logger.error('Error handling plan created event', error);
    }
  }
  
  /**
   * Handles task created event
   * @private
   * @param {Object} event The event data
   */
  async _handleTaskCreated(event) {
    this.logger.info(`Handling task created event: ${event.taskId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles decision requested event
   * @private
   * @param {Object} event The event data
   */
  async _handleDecisionRequested(event) {
    this.logger.info(`Handling decision requested event: ${event.decisionId}`);
    
    try {
      const plannerHandler = this.integrationHandlers.get('planner');
      if (!plannerHandler) {
        return;
      }
      
      // Get planner tentacle
      const plannerTentacle = this.registeredTentacles.get('planner');
      if (!plannerTentacle) {
        return;
      }
      
      // Get decision point details
      const decisionPoint = await plannerTentacle.getDecisionPoint(event.decisionId);
      
      // Evaluate decision point
      const result = await plannerHandler.evaluateDecisionPoint(decisionPoint, {
        userId: event.userId,
        timestamp: event.timestamp
      });
      
      // Send decision result back to planner
      await plannerTentacle.submitDecisionResult(event.decisionId, result);
      
      this.logger.info(`Submitted decision result for: ${event.decisionId}`);
    } catch (error) {
      this.logger.error('Error handling decision requested event', error);
    }
  }
  
  /**
   * Handles conversation created event
   * @private
   * @param {Object} event The event data
   */
  async _handleConversationCreated(event) {
    this.logger.info(`Handling conversation created event: ${event.conversationId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles message received event
   * @private
   * @param {Object} event The event data
   */
  async _handleMessageReceived(event) {
    this.logger.info(`Handling message received event: ${event.messageId}`);
    
    try {
      const assistantHandler = this.integrationHandlers.get('assistant');
      if (!assistantHandler) {
        return;
      }
      
      // Get assistant tentacle
      const assistantTentacle = this.registeredTentacles.get('assistant');
      if (!assistantTentacle) {
        return;
      }
      
      // Get conversation details
      const conversation = await assistantTentacle.getConversation(event.conversationId);
      
      // Analyze conversation for decision points
      const analysis = await assistantHandler.analyzeConversation(conversation, {
        userId: event.userId,
        messageId: event.messageId
      });
      
      if (analysis.decisionPoints && analysis.decisionPoints.length > 0) {
        this.logger.info(`Detected ${analysis.decisionPoints.length} decision points in conversation: ${event.conversationId}`);
        
        // Notify assistant tentacle of detected decision points
        await assistantTentacle.addDecisionContext(event.conversationId, {
          decisionPoints: analysis.decisionPoints,
          recommendations: analysis.recommendations,
          confidence: analysis.confidence
        });
      }
    } catch (error) {
      this.logger.error('Error handling message received event', error);
    }
  }
  
  /**
   * Handles assistant decision requested event
   * @private
   * @param {Object} event The event data
   */
  async _handleAssistantDecisionRequested(event) {
    this.logger.info(`Handling assistant decision requested event: ${event.decisionId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles knowledge item created event
   * @private
   * @param {Object} event The event data
   */
  async _handleKnowledgeItemCreated(event) {
    this.logger.info(`Handling knowledge item created event: ${event.itemId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles knowledge query executed event
   * @private
   * @param {Object} event The event data
   */
  async _handleKnowledgeQueryExecuted(event) {
    this.logger.info(`Handling knowledge query executed event: ${event.queryId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles knowledge decision requested event
   * @private
   * @param {Object} event The event data
   */
  async _handleKnowledgeDecisionRequested(event) {
    this.logger.info(`Handling knowledge decision requested event: ${event.decisionId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles workflow created event
   * @private
   * @param {Object} event The event data
   */
  async _handleWorkflowCreated(event) {
    this.logger.info(`Handling workflow created event: ${event.workflowId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles workflow step started event
   * @private
   * @param {Object} event The event data
   */
  async _handleWorkflowStepStarted(event) {
    this.logger.info(`Handling workflow step started event: ${event.stepId}`);
    
    // Implementation details would depend on specific requirements
  }
  
  /**
   * Handles workflow decision requested event
   * @private
   * @param {Object} event The event data
   */
  async _handleWorkflowDecisionRequested(event) {
    this.logger.info(`Handling workflow decision requested event: ${event.decisionId}`);
    
    try {
      const workflowHandler = this.integrationHandlers.get('workflow');
      if (!workflowHandler) {
        return;
      }
      
      // Get workflow tentacle
      const workflowTentacle = this.registeredTentacles.get('workflow');
      if (!workflowTentacle) {
        return;
      }
      
      // Get decision point details
      const decisionPoint = await workflowTentacle.getDecisionPoint(event.decisionId);
      
      // Get workflow context
      const workflowContext = await workflowTentacle.getWorkflowContext(event.workflowId);
      
      // Evaluate workflow decision
      const result = await workflowHandler.evaluateWorkflowDecision(decisionPoint, workflowContext);
      
      // Submit decision result
      await workflowTentacle.submitDecisionResult(event.decisionId, result);
      
      this.logger.info(`Submitted workflow decision result for: ${event.decisionId}`);
    } catch (error) {
      this.logger.error('Error handling workflow decision requested event', error);
    }
  }
  
  /**
   * Shuts down the Decision Intelligence Integration Service
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Decision Intelligence Integration Service');
    
    try {
      // Unregister event listeners
      if (this.aideon && this.aideon.events) {
        for (const handler of this.integrationHandlers.values()) {
          for (const [eventName, eventHandler] of Object.entries(handler.eventHandlers || {})) {
            this.aideon.events.off(eventName, eventHandler);
          }
        }
      }
      
      // Clear handlers and registered tentacles
      this.integrationHandlers.clear();
      this.registeredTentacles.clear();
      
      this.initialized = false;
      this.logger.info('Decision Intelligence Integration Service shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'decisionIntelligenceIntegration' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Decision Intelligence Integration Service
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      integrationHandlers: Array.from(this.integrationHandlers.keys()),
      registeredTentacles: Array.from(this.registeredTentacles.keys())
    };
  }
  
  /**
   * Registers a tentacle with the integration service
   * @param {string} tentacleType The type of tentacle
   * @param {Object} tentacle The tentacle instance
   * @returns {Promise<boolean>} A promise that resolves with the registration result
   */
  async registerTentacle(tentacleType, tentacle) {
    if (!this.initialized) {
      throw new Error('Decision Intelligence Integration Service not initialized');
    }
    
    if (!tentacleType) {
      throw new Error('Tentacle type is required');
    }
    
    if (!tentacle) {
      throw new Error('Tentacle instance is required');
    }
    
    this.logger.info(`Registering tentacle of type: ${tentacleType}`);
    
    try {
      // Check if handler exists for this tentacle type
      const handler = Array.from(this.integrationHandlers.values())
        .find(h => h.tentacleType === tentacleType);
      
      if (!handler) {
        this.logger.warn(`No integration handler found for tentacle type: ${tentacleType}`);
        return false;
      }
      
      // Register tentacle
      this.registeredTentacles.set(tentacleType, tentacle);
      
      // Emit tentacle registered event
      this.events.emit('tentacle:registered', {
        tentacleType,
        timestamp: Date.now()
      });
      
      this.logger.info(`Tentacle of type ${tentacleType} registered successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Tentacle registration failed: ${tentacleType}`, error);
      return false;
    }
  }
  
  /**
   * Unregisters a tentacle from the integration service
   * @param {string} tentacleType The type of tentacle
   * @returns {Promise<boolean>} A promise that resolves with the unregistration result
   */
  async unregisterTentacle(tentacleType) {
    if (!this.initialized) {
      throw new Error('Decision Intelligence Integration Service not initialized');
    }
    
    if (!tentacleType) {
      throw new Error('Tentacle type is required');
    }
    
    this.logger.info(`Unregistering tentacle of type: ${tentacleType}`);
    
    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleType)) {
        this.logger.warn(`No tentacle of type ${tentacleType} is registered`);
        return false;
      }
      
      // Unregister tentacle
      this.registeredTentacles.delete(tentacleType);
      
      // Emit tentacle unregistered event
      this.events.emit('tentacle:unregistered', {
        tentacleType,
        timestamp: Date.now()
      });
      
      this.logger.info(`Tentacle of type ${tentacleType} unregistered successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Tentacle unregistration failed: ${tentacleType}`, error);
      return false;
    }
  }
  
  /**
   * Registers API endpoints for the Decision Intelligence Integration Service
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register integration status endpoint
    api.register(`${namespace}/integration/status`, {
      get: async (req, res) => {
        try {
          const status = this.getStatus();
          return res.json(status);
        } catch (error) {
          this.logger.error('API error in integration status endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register tentacle registration endpoint
    api.register(`${namespace}/integration/tentacles`, {
      post: async (req, res) => {
        try {
          const { tentacleType, tentacleId } = req.body;
          
          if (!tentacleType) {
            return res.status(400).json({
              error: 'Tentacle type is required'
            });
          }
          
          if (!tentacleId) {
            return res.status(400).json({
              error: 'Tentacle ID is required'
            });
          }
          
          // Get tentacle instance from Aideon
          const tentacle = this.aideon.getTentacle(tentacleId);
          
          if (!tentacle) {
            return res.status(404).json({
              error: `Tentacle with ID ${tentacleId} not found`
            });
          }
          
          // Register tentacle
          const result = await this.registerTentacle(tentacleType, tentacle);
          
          return res.json({
            success: result,
            tentacleType,
            tentacleId
          });
        } catch (error) {
          this.logger.error('API error in tentacle registration endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      delete: async (req, res) => {
        try {
          const { tentacleType } = req.body;
          
          if (!tentacleType) {
            return res.status(400).json({
              error: 'Tentacle type is required'
            });
          }
          
          // Unregister tentacle
          const result = await this.unregisterTentacle(tentacleType);
          
          return res.json({
            success: result,
            tentacleType
          });
        } catch (error) {
          this.logger.error('API error in tentacle unregistration endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { DecisionIntelligenceIntegration };
