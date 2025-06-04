/**
 * @fileoverview Enhanced Distributed Processing Tentacle with advanced multi-LLM orchestration
 * Provides distributed processing capabilities with superintelligent abilities through
 * collaborative model orchestration and specialized model selection
 * 
 * @module tentacles/distributed_processing/DistributedProcessingTentacle
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { DistributedProcessingService } = require('./DistributedProcessingAPI');
const EnhancedTentacleIntegration = require('../common/EnhancedTentacleIntegration');

// Import advanced orchestration components
const { ModelType, CollaborationStrategy } = require('../../core/miif/models/ModelEnums');

/**
 * Enhanced Distributed Processing Tentacle with superintelligent capabilities
 * Provides distributed processing capabilities with collaborative model orchestration
 * and specialized model selection for optimal task distribution and execution
 * @extends EventEmitter
 */
class DistributedProcessingTentacle extends EventEmitter {
  /**
   * Create a new enhanced Distributed Processing Tentacle with advanced orchestration
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
    this.taskOrchestrator = dependencies.taskOrchestrator;
    this.resourceManager = dependencies.resourceManager;
    this.resultManager = dependencies.resultManager;
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
    if (!this.storage || !this.modelOrchestrator || !this.taskOrchestrator || 
        !this.resourceManager || !this.resultManager || !this.securityFramework) {
      throw new Error("Required dependencies missing for DistributedProcessingTentacle");
    }
    
    this.logger.info("[DistributedProcessingTentacle] Initializing Distributed Processing Tentacle with advanced orchestration");
    
    // Initialize advanced orchestration
    this._initializeAdvancedOrchestration();
    
    // Initialize distributed processing service
    this.distributedProcessingService = new DistributedProcessingService(
      this.taskOrchestrator,
      this.resourceManager,
      this.resultManager
    );
    
    // Active user sessions
    this.activeSessions = new Map();
    
    // Initialize collaboration sessions
    this._initializeCollaborationSessions();
    
    // Task tracking
    this.activeTasks = new Map();
    
    this.logger.info("[DistributedProcessingTentacle] Distributed Processing Tentacle initialized with superintelligent capabilities");
  }
  
  /**
   * Initialize advanced orchestration
   * @private
   */
  _initializeAdvancedOrchestration() {
    this.logger.debug("[DistributedProcessingTentacle] Initializing advanced orchestration");
    
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
      this.logger.info("[DistributedProcessingTentacle] Collaborative intelligence disabled, skipping collaboration sessions");
      return;
    }
    
    this.logger.debug("[DistributedProcessingTentacle] Initializing collaboration sessions");
    
    try {
      // Define collaboration configurations
      const collaborationConfigs = [
        {
          name: "task_decomposition",
          modelType: ModelType.TEXT,
          taskType: "task_decomposition",
          collaborationStrategy: CollaborationStrategy.TASK_DECOMPOSITION,
          offlineOnly: true
        },
        {
          name: "resource_optimization",
          modelType: ModelType.TEXT,
          taskType: "resource_optimization",
          collaborationStrategy: CollaborationStrategy.SPECIALIZED_ROUTING,
          offlineOnly: false
        },
        {
          name: "result_aggregation",
          modelType: ModelType.TEXT,
          taskType: "result_aggregation",
          collaborationStrategy: CollaborationStrategy.ENSEMBLE,
          offlineOnly: true
        },
        {
          name: "error_recovery",
          modelType: ModelType.TEXT,
          taskType: "error_recovery",
          collaborationStrategy: CollaborationStrategy.CONSENSUS,
          offlineOnly: false
        },
        {
          name: "multimodal_processing",
          modelType: ModelType.MULTIMODAL,
          taskType: "multimodal_processing",
          collaborationStrategy: CollaborationStrategy.CROSS_MODAL_FUSION,
          offlineOnly: false
        }
      ];
      
      // Initialize all collaboration sessions
      await this.enhancedIntegration.initializeAdvancedOrchestration("distributed_processing", collaborationConfigs);
      
      this.logger.info("[DistributedProcessingTentacle] Collaboration sessions initialized successfully");
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Failed to initialize collaboration sessions: ${error.message}`);
    }
  }
  
  /**
   * Initialize the tentacle
   * @returns {Promise<boolean>} Initialization result
   */
  async initialize() {
    this.logger.info("[DistributedProcessingTentacle] Initializing");
    
    try {
      // Initialize enhanced integration
      await this.enhancedIntegration.initialize();
      
      // Initialize distributed processing service
      await this.distributedProcessingService.initialize();
      
      // Set up event listeners
      this._setupEventListeners();
      
      this.logger.info("[DistributedProcessingTentacle] Initialized successfully");
      return true;
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Initialization failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for task completion events
    this.distributedProcessingService.on('taskCompleted', (taskId, result) => {
      this.logger.debug(`[DistributedProcessingTentacle] Task completed: ${taskId}`);
      
      const taskInfo = this.activeTasks.get(taskId);
      if (taskInfo) {
        this.emit('task.completed', {
          taskId,
          userId: taskInfo.userId,
          sessionId: taskInfo.sessionId,
          result
        });
        
        this.activeTasks.delete(taskId);
      }
    });
    
    // Listen for task failure events
    this.distributedProcessingService.on('taskFailed', (taskId, error) => {
      this.logger.error(`[DistributedProcessingTentacle] Task failed: ${taskId}`, error);
      
      const taskInfo = this.activeTasks.get(taskId);
      if (taskInfo) {
        this.emit('task.failed', {
          taskId,
          userId: taskInfo.userId,
          sessionId: taskInfo.sessionId,
          error
        });
        
        this.activeTasks.delete(taskId);
      }
    });
    
    // Listen for task progress events
    this.distributedProcessingService.on('taskProgress', (taskId, progress) => {
      this.logger.debug(`[DistributedProcessingTentacle] Task progress: ${taskId} - ${progress.percentage}%`);
      
      const taskInfo = this.activeTasks.get(taskId);
      if (taskInfo) {
        this.emit('task.progress', {
          taskId,
          userId: taskInfo.userId,
          sessionId: taskInfo.sessionId,
          progress
        });
      }
    });
  }
  
  /**
   * Initialize the tentacle for a user
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Initialization result
   */
  async initializeForUser(userProfile) {
    this.logger.info(`[DistributedProcessingTentacle] Initializing for user: ${userProfile.userId}`);
    
    try {
      // Validate user access and permissions
      await this._validateUserAccess(userProfile);
      
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
      
      this.logger.info(`[DistributedProcessingTentacle] Initialized successfully for user: ${userProfile.userId}`);
      this.emit("tentacle.initialized", { userId: userProfile.userId, sessionId });
      
      return {
        success: true,
        sessionId,
        message: "Distributed Processing Tentacle initialized successfully",
        capabilities: {
          collaborativeIntelligence: this.advancedOptions.collaborativeIntelligence,
          specializedModelSelection: this.advancedOptions.specializedModelSelection,
          adaptiveResourceAllocation: this.advancedOptions.adaptiveResourceAllocation,
          selfEvaluation: this.advancedOptions.selfEvaluation,
          offlineCapability: this.advancedOptions.offlineCapability
        }
      };
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Initialization for user failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a distributed task with collaborative intelligence
   * @param {string} sessionId - Session ID
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Task result
   */
  async executeDistributedTask(sessionId, taskType, payload, options = {}) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[DistributedProcessingTentacle] Executing distributed task for user: ${session.userId}, type: ${taskType}`);
    
    try {
      // Determine if we should use collaborative intelligence for task decomposition
      if (this.advancedOptions.collaborativeIntelligence && !options.disableCollaborative && this._isComplexTask(taskType, payload)) {
        return await this._executeDistributedTaskWithCollaborativeIntelligence(session, taskType, payload, options);
      } else if (this.advancedOptions.adaptiveResourceAllocation && !options.disableAdaptiveAllocation) {
        return await this._executeDistributedTaskWithAdaptiveAllocation(session, taskType, payload, options);
      } else {
        return await this._executeStandardDistributedTask(session, taskType, payload, options);
      }
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Distributed task execution failed: ${error.message}`);
      
      // If advanced processing failed, try standard processing as fallback
      if ((error.message.includes("collaborative") || error.message.includes("adaptive")) && 
          (this.advancedOptions.collaborativeIntelligence || this.advancedOptions.adaptiveResourceAllocation)) {
        this.logger.info(`[DistributedProcessingTentacle] Falling back to standard distributed task execution for user: ${session.userId}`);
        try {
          return await this._executeStandardDistributedTask(session, taskType, payload, options);
        } catch (fallbackError) {
          this.logger.error(`[DistributedProcessingTentacle] Fallback distributed task execution also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Execute distributed task with collaborative intelligence
   * @private
   * @param {Object} session - User session
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Task result
   */
  async _executeDistributedTaskWithCollaborativeIntelligence(session, taskType, payload, options) {
    this.logger.debug(`[DistributedProcessingTentacle] Using collaborative intelligence for task decomposition: ${session.userId}`);
    
    try {
      // Execute collaborative task for task decomposition
      const decompositionResult = await this.enhancedIntegration.executeCollaborativeTask(
        "task_decomposition",
        {
          userId: session.userId,
          taskType,
          payload,
          options
        },
        {
          priority: options.priority || "normal",
          timeout: options.timeout || 30000
        }
      );
      
      // Get subtasks from decomposition result
      const subtasks = decompositionResult.result.subtasks;
      
      // Execute each subtask
      const subtaskResults = [];
      for (const subtask of subtasks) {
        const subtaskResult = await this._executeStandardDistributedTask(
          session,
          subtask.taskType || taskType,
          subtask.payload,
          subtask.options || options
        );
        
        subtaskResults.push(subtaskResult);
      }
      
      // Execute collaborative task for result aggregation
      const aggregationResult = await this.enhancedIntegration.executeCollaborativeTask(
        "result_aggregation",
        {
          userId: session.userId,
          taskType,
          originalPayload: payload,
          subtaskResults,
          decompositionStrategy: decompositionResult.strategy
        },
        {
          priority: options.priority || "normal",
          timeout: options.timeout || 30000
        }
      );
      
      return {
        ...aggregationResult.result.aggregatedResult,
        collaborativeExecution: {
          decompositionStrategy: decompositionResult.strategy,
          aggregationStrategy: aggregationResult.strategy,
          subtaskCount: subtasks.length
        }
      };
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Collaborative task execution failed: ${error.message}`);
      throw new Error(`Collaborative task execution failed: ${error.message}`);
    }
  }
  
  /**
   * Execute distributed task with adaptive resource allocation
   * @private
   * @param {Object} session - User session
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Task result
   */
  async _executeDistributedTaskWithAdaptiveAllocation(session, taskType, payload, options) {
    this.logger.debug(`[DistributedProcessingTentacle] Using adaptive resource allocation for distributed task: ${session.userId}`);
    
    try {
      // Get resource allocation strategy
      const allocationStrategy = await this.enhancedIntegration.getAdaptiveResourceAllocation({
        taskType,
        importance: options.importance || "medium",
        complexity: options.complexity || "medium",
        userTier: session.tier
      });
      
      // Apply resource allocation strategy to options
      const enhancedOptions = {
        ...options,
        resourceRequirements: {
          ...options.resourceRequirements,
          ...allocationStrategy.resourceRequirements
        },
        priority: allocationStrategy.priority || options.priority
      };
      
      // Execute standard distributed task with enhanced options
      const result = await this._executeStandardDistributedTask(session, taskType, payload, enhancedOptions);
      
      return {
        ...result,
        adaptiveAllocation: {
          applied: true,
          strategy: allocationStrategy
        }
      };
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Adaptive resource allocation task execution failed: ${error.message}`);
      throw new Error(`Adaptive resource allocation task execution failed: ${error.message}`);
    }
  }
  
  /**
   * Execute standard distributed task
   * @private
   * @param {Object} session - User session
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Task result
   */
  async _executeStandardDistributedTask(session, taskType, payload, options) {
    // Execute the distributed task
    const result = await this.distributedProcessingService.executeDistributed(taskType, payload, options);
    
    // Track the task
    if (result.taskId) {
      this.activeTasks.set(result.taskId, {
        userId: session.userId,
        sessionId: session.sessionId,
        taskType,
        startTime: new Date()
      });
    }
    
    return result;
  }
  
  /**
   * Cancel a distributed task
   * @param {string} sessionId - Session ID
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Cancellation result
   */
  async cancelDistributedTask(sessionId, taskId) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[DistributedProcessingTentacle] Canceling distributed task for user: ${session.userId}, task: ${taskId}`);
    
    try {
      // Check if task belongs to user
      const taskInfo = this.activeTasks.get(taskId);
      if (!taskInfo || taskInfo.userId !== session.userId) {
        throw new Error("Task not found or does not belong to user");
      }
      
      // Cancel the task
      const result = await this.distributedProcessingService.cancelDistributedExecution(taskId);
      
      if (result) {
        this.activeTasks.delete(taskId);
        this.emit('task.canceled', {
          taskId,
          userId: session.userId,
          sessionId
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Task cancellation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get distributed task status
   * @param {string} sessionId - Session ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task status
   */
  async getDistributedTaskStatus(sessionId, taskId) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.debug(`[DistributedProcessingTentacle] Getting distributed task status for user: ${session.userId}, task: ${taskId}`);
    
    try {
      // Check if task belongs to user
      const taskInfo = this.activeTasks.get(taskId);
      if (!taskInfo || taskInfo.userId !== session.userId) {
        throw new Error("Task not found or does not belong to user");
      }
      
      // Get task status
      const status = await this.distributedProcessingService.getExecutionStatus(taskId);
      
      return {
        taskId,
        status,
        startTime: taskInfo.startTime,
        elapsedTime: Date.now() - taskInfo.startTime.getTime()
      };
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Getting task status failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get available distributed capabilities
   * @param {string} sessionId - Session ID
   * @returns {Promise<string[]>} Available capabilities
   */
  async getAvailableDistributedCapabilities(sessionId) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.debug(`[DistributedProcessingTentacle] Getting available distributed capabilities for user: ${session.userId}`);
    
    try {
      // Get available capabilities
      const capabilities = await this.distributedProcessingService.getAvailableDistributedCapabilities();
      
      return capabilities;
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Getting available capabilities failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute multimodal distributed task with cross-modal fusion
   * @param {string} sessionId - Session ID
   * @param {Object} input - Task input
   * @param {Array<string>} modalities - Modalities to use
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Task result
   */
  async executeMultimodalDistributedTask(sessionId, input, modalities, options = {}) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[DistributedProcessingTentacle] Executing multimodal distributed task for user: ${session.userId}`);
    
    try {
      // Check if cross-modal fusion is available
      if (!this.advancedOptions.collaborativeIntelligence) {
        throw new Error("Multimodal distributed tasks require collaborative intelligence to be enabled");
      }
      
      // Execute cross-modal task
      const result = await this.enhancedIntegration.executeCrossModalTask(
        input,
        modalities,
        {
          taskType: "multimodal_processing",
          priority: options.priority || "high",
          timeout: options.timeout || 60000
        }
      );
      
      return {
        ...result,
        crossModalFusion: true
      };
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Multimodal distributed task execution failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle distributed task error with self-evaluation
   * @param {string} sessionId - Session ID
   * @param {string} taskId - Task ID
   * @param {Error} error - Task error
   * @returns {Promise<Object>} Error handling result
   */
  async handleDistributedTaskError(sessionId, taskId, error) {
    this._validateSession(sessionId);
    const session = this.activeSessions.get(sessionId);
    
    this.logger.info(`[DistributedProcessingTentacle] Handling distributed task error for user: ${session.userId}, task: ${taskId}`);
    
    try {
      // Check if task belongs to user
      const taskInfo = this.activeTasks.get(taskId);
      if (!taskInfo || taskInfo.userId !== session.userId) {
        throw new Error("Task not found or does not belong to user");
      }
      
      // Determine if we should use self-evaluation
      if (this.advancedOptions.selfEvaluation) {
        return await this._handleDistributedTaskErrorWithSelfEvaluation(session, taskId, taskInfo, error);
      } else {
        return {
          taskId,
          handled: false,
          error: error.message
        };
      }
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Error handling failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle distributed task error with self-evaluation
   * @private
   * @param {Object} session - User session
   * @param {string} taskId - Task ID
   * @param {Object} taskInfo - Task information
   * @param {Error} error - Task error
   * @returns {Promise<Object>} Error handling result
   */
  async _handleDistributedTaskErrorWithSelfEvaluation(session, taskId, taskInfo, error) {
    this.logger.debug(`[DistributedProcessingTentacle] Using self-evaluation for error handling: ${session.userId}`);
    
    try {
      // Perform self-evaluation
      const evaluationResult = await this.enhancedIntegration.performSelfEvaluation({
        task: "error_recovery",
        taskId,
        taskType: taskInfo.taskType,
        error: error.message,
        stackTrace: error.stack
      });
      
      // If recovery is possible, execute collaborative task for error recovery
      if (evaluationResult.recoveryPossible) {
        const recoveryResult = await this.enhancedIntegration.executeCollaborativeTask(
          "error_recovery",
          {
            userId: session.userId,
            taskId,
            taskType: taskInfo.taskType,
            error: error.message,
            evaluationResult
          },
          {
            priority: "high",
            timeout: 30000
          }
        );
        
        return {
          taskId,
          handled: true,
          recoveryApplied: true,
          recoveryStrategy: recoveryResult.strategy,
          result: recoveryResult.result
        };
      } else {
        return {
          taskId,
          handled: true,
          recoveryApplied: false,
          reason: evaluationResult.reason
        };
      }
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Self-evaluation error handling failed: ${error.message}`);
      throw new Error(`Self-evaluation error handling failed: ${error.message}`);
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
    
    this.logger.info(`[DistributedProcessingTentacle] Ending session for user: ${session.userId}`);
    
    try {
      // Cancel all active tasks for this session
      for (const [taskId, taskInfo] of this.activeTasks.entries()) {
        if (taskInfo.sessionId === sessionId) {
          await this.distributedProcessingService.cancelDistributedExecution(taskId);
          this.activeTasks.delete(taskId);
        }
      }
      
      // End session
      this.activeSessions.delete(sessionId);
      
      this.emit("session.ended", { userId: session.userId, sessionId });
      return true;
      
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Session end failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a task is complex enough to warrant collaborative intelligence
   * @private
   * @param {string} taskType - Type of task
   * @param {*} payload - Task payload
   * @returns {boolean} Whether the task is complex
   */
  _isComplexTask(taskType, payload) {
    // Determine if task is complex based on type and payload
    // This is a simplified implementation
    const complexTaskTypes = [
      'data_processing',
      'machine_learning',
      'image_processing',
      'video_processing',
      'natural_language_processing',
      'optimization'
    ];
    
    if (complexTaskTypes.includes(taskType)) {
      return true;
    }
    
    // Check payload size
    if (payload && typeof payload === 'object') {
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 10000) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Validate user access and permissions
   * @private
   * @param {Object} userProfile - User profile
   * @returns {Promise<boolean>} Validation result
   */
  async _validateUserAccess(userProfile) {
    // Check if user has access to Distributed Processing Tentacle
    const hasAccess = await this.securityFramework.checkTentacleAccess(
      userProfile.userId,
      "DISTRIBUTED_PROCESSING"
    );
    
    if (!hasAccess) {
      throw new Error("User does not have access to Distributed Processing Tentacle.");
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
    this.logger.info("[DistributedProcessingTentacle] Cleaning up resources");
    
    try {
      // Cancel all active tasks
      for (const [taskId] of this.activeTasks.entries()) {
        await this.distributedProcessingService.cancelDistributedExecution(taskId);
      }
      
      // Clean up enhanced integration
      if (this.enhancedIntegration) {
        await this.enhancedIntegration.cleanup();
      }
      
      // End all active sessions
      for (const [sessionId, session] of this.activeSessions.entries()) {
        this.logger.debug(`[DistributedProcessingTentacle] Ending session for user: ${session.userId} during cleanup`);
        this.activeSessions.delete(sessionId);
        this.emit("session.ended", { userId: session.userId, sessionId, reason: "cleanup" });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`[DistributedProcessingTentacle] Cleanup failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = DistributedProcessingTentacle;
