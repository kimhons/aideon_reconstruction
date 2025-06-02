/**
 * @fileoverview Reasoning Engine for the Aideon AI Desktop Agent.
 * Provides multi-strategy reasoning capabilities with explanation generation and uncertainty handling.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { ReasoningStrategyManager } = require('./ReasoningStrategyManager');
const { IntegrationHub } = require('./IntegrationHub');
const { UncertaintyHandler } = require('./UncertaintyHandler');
const { ExplanationGenerator } = require('./ExplanationGenerator');
const { PerformanceOptimizer } = require('./PerformanceOptimizer');
const { ModelStrategyManager } = require('./ModelStrategyManager');
const { ReasoningTaskStatus } = require('./ReasoningTaskStatus');

/**
 * Reasoning Engine for the Aideon AI Desktop Agent.
 * Provides multi-strategy reasoning capabilities with explanation generation and uncertainty handling.
 * 
 * @extends EventEmitter
 */
class ReasoningEngine extends EventEmitter {
  /**
   * Creates a new ReasoningEngine instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.securityManager - Security manager
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.knowledgeGraphManager - Knowledge Graph Manager instance
   * @param {Object} [options.reasoningStrategyManager] - Reasoning Strategy Manager
   * @param {Object} [options.integrationHub] - Integration Hub for tentacle integration
   * @param {Object} [options.uncertaintyHandler] - Uncertainty Handler
   * @param {Object} [options.explanationGenerator] - Explanation Generator
   * @param {Object} [options.performanceOptimizer] - Performance Optimizer
   * @param {Object} [options.modelStrategyManager] - Model Strategy Manager
   */
  constructor(options) {
    super();
    
    if (!options.knowledgeGraphManager) {
      throw new Error("ReasoningEngine requires a knowledgeGraphManager instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    
    // Core components
    this.reasoningStrategyManager = options.reasoningStrategyManager || new ReasoningStrategyManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      knowledgeGraphManager: this.knowledgeGraphManager
    });
    
    this.integrationHub = options.integrationHub || new IntegrationHub({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      reasoningEngine: this
    });
    
    // Advanced components (initialized in Phase 3 and 5)
    this.uncertaintyHandler = options.uncertaintyHandler;
    this.explanationGenerator = options.explanationGenerator;
    this.performanceOptimizer = options.performanceOptimizer;
    this.modelStrategyManager = options.modelStrategyManager;

    // Task management
    this.tasks = new Map(); // Map of taskId -> task
    this.taskQueue = []; // Queue of pending task IDs
    
    this.initialized = false;
  }

  /**
   * Initializes the Reasoning Engine and its components.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing ReasoningEngine");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("reasoningEngine_initialize");
    }

    try {
      // Initialize core components
      await this.reasoningStrategyManager.initialize();
      await this.integrationHub.initialize();
      
      // Initialize advanced components if available
      if (this.uncertaintyHandler) {
        await this.uncertaintyHandler.initialize();
      }
      
      if (this.explanationGenerator) {
        await this.explanationGenerator.initialize();
      }
      
      if (this.performanceOptimizer) {
        await this.performanceOptimizer.initialize();
      }
      
      if (this.modelStrategyManager) {
        await this.modelStrategyManager.initialize();
      }

      this.initialized = true;

      if (this.logger) {
        this.logger.info("ReasoningEngine initialized successfully");
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("ReasoningEngine initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`ReasoningEngine initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Ensures the engine is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the engine is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("ReasoningEngine is not initialized. Call initialize() first.");
    }
  }

  /**
   * Submits a reasoning task to the engine.
   * 
   * @param {Object} taskData - Task data
   * @param {string} taskData.query - The reasoning query or problem statement
   * @param {Object} taskData.context - Context information for the reasoning task
   * @param {string[]} [taskData.preferredStrategies] - Preferred reasoning strategies to use
   * @param {Object} [taskData.constraints] - Constraints for the reasoning process
   * @param {Object} [taskData.metadata] - Additional metadata for the task
   * @param {number} [taskData.priority=5] - Task priority (1-10, higher is more important)
   * @param {string} [taskData.tentacleId] - ID of the tentacle submitting the task
   * @returns {Promise<string>} - ID of the submitted task
   */
  async submitTask(taskData) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("reasoningEngine_submitTask");
    }

    try {
      // Validate required fields
      if (!taskData.query) {
        throw new Error("Task query is required");
      }

      // Generate unique task ID
      const taskId = uuidv4();
      
      // Create task object
      const task = {
        id: taskId,
        query: taskData.query,
        context: taskData.context || {},
        preferredStrategies: taskData.preferredStrategies || [],
        constraints: taskData.constraints || {},
        metadata: {
          ...(taskData.metadata || {}),
          submittedAt: Date.now(),
          tentacleId: taskData.tentacleId,
          priority: taskData.priority || 5
        },
        status: ReasoningTaskStatus.PENDING,
        result: null,
        explanation: null,
        confidence: null,
        error: null
      };
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskSecurityPolicies) {
        await this.securityManager.applyTaskSecurityPolicies(task);
      }
      
      // Store task
      this.tasks.set(taskId, task);
      
      // Add to queue based on priority
      this._addToQueue(taskId, task.metadata.priority);
      
      if (this.logger) {
        this.logger.debug(`Submitted reasoning task: ${taskId}`, { 
          query: taskData.query,
          tentacleId: taskData.tentacleId,
          priority: task.metadata.priority
        });
      }
      
      this.emit("taskSubmitted", { taskId, task });
      
      // Process queue if not already processing
      this._processNextTask();
      
      return taskId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to submit reasoning task: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves the status and result of a reasoning task.
   * 
   * @param {string} taskId - ID of the task to retrieve
   * @returns {Promise<Object>} - Task status and result
   */
  async getTaskStatus(taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("reasoningEngine_getTaskStatus");
    }

    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskAccessPolicies) {
        await this.securityManager.applyTaskAccessPolicies(task);
      }
      
      if (this.logger) {
        this.logger.debug(`Retrieved task status: ${taskId}`, { status: task.status });
      }
      
      return {
        id: task.id,
        status: task.status,
        result: task.result,
        explanation: task.explanation,
        confidence: task.confidence,
        error: task.error,
        metadata: task.metadata
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve task status: ${error.message}`, { taskId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Cancels a pending or in-progress reasoning task.
   * 
   * @param {string} taskId - ID of the task to cancel
   * @returns {Promise<boolean>} - True if the task was successfully canceled
   */
  async cancelTask(taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("reasoningEngine_cancelTask");
    }

    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskCancelPolicies) {
        await this.securityManager.applyTaskCancelPolicies(task);
      }
      
      // Check if task can be canceled
      if (task.status === ReasoningTaskStatus.COMPLETED || 
          task.status === ReasoningTaskStatus.FAILED ||
          task.status === ReasoningTaskStatus.CANCELED) {
        return false;
      }
      
      // Update task status
      task.status = ReasoningTaskStatus.CANCELED;
      task.metadata.canceledAt = Date.now();
      
      // Remove from queue if pending
      if (task.status === ReasoningTaskStatus.PENDING) {
        this.taskQueue = this.taskQueue.filter(id => id !== taskId);
      }
      
      if (this.logger) {
        this.logger.debug(`Canceled reasoning task: ${taskId}`);
      }
      
      this.emit("taskCanceled", { taskId, task });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to cancel task: ${error.message}`, { taskId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Adds a task to the priority queue.
   * 
   * @private
   * @param {string} taskId - ID of the task to add
   * @param {number} priority - Priority of the task
   */
  _addToQueue(taskId, priority) {
    // Find the correct position based on priority (higher priority first)
    let insertIndex = this.taskQueue.length;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTaskId = this.taskQueue[i];
      const queuedTask = this.tasks.get(queuedTaskId);
      
      if (queuedTask && priority > queuedTask.metadata.priority) {
        insertIndex = i;
        break;
      }
    }
    
    // Insert at the determined position
    this.taskQueue.splice(insertIndex, 0, taskId);
  }

  /**
   * Processes the next task in the queue.
   * 
   * @private
   */
  async _processNextTask() {
    // Check if there are tasks to process
    if (this.taskQueue.length === 0) {
      return;
    }
    
    // Get the next task
    const taskId = this.taskQueue.shift();
    const task = this.tasks.get(taskId);
    
    if (!task) {
      // Task not found, process next
      this._processNextTask();
      return;
    }
    
    // Update task status
    task.status = ReasoningTaskStatus.PROCESSING;
    task.metadata.processingStartedAt = Date.now();
    
    this.emit("taskProcessingStarted", { taskId, task });
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer(`reasoningEngine_processTask_${taskId}`);
    }
    
    try {
      // Determine reasoning strategy
      const strategyResult = await this.reasoningStrategyManager.selectStrategy(task);
      
      // Execute reasoning
      const result = await this.reasoningStrategyManager.executeStrategy(
        strategyResult.strategyName,
        task
      );
      
      // Generate explanation if available
      let explanation = null;
      if (this.explanationGenerator) {
        explanation = await this.explanationGenerator.generateExplanation(task, result, strategyResult);
      }
      
      // Update task with result
      task.status = ReasoningTaskStatus.COMPLETED;
      task.result = result;
      task.explanation = explanation;
      task.confidence = result.confidence;
      task.metadata.completedAt = Date.now();
      
      if (this.logger) {
        this.logger.debug(`Completed reasoning task: ${taskId}`, { 
          strategy: strategyResult.strategyName,
          confidence: result.confidence
        });
      }
      
      this.emit("taskCompleted", { taskId, task });
    } catch (error) {
      // Update task with error
      task.status = ReasoningTaskStatus.FAILED;
      task.error = {
        message: error.message,
        stack: error.stack
      };
      task.metadata.failedAt = Date.now();
      
      if (this.logger) {
        this.logger.error(`Failed to process reasoning task: ${error.message}`, { 
          taskId, 
          error: error.stack 
        });
      }
      
      this.emit("taskFailed", { taskId, task, error });
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
      
      // Process next task
      this._processNextTask();
    }
  }

  /**
   * Cleans up completed tasks older than the specified age.
   * 
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} - Number of tasks cleaned up
   */
  async cleanupTasks(maxAgeMs) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("reasoningEngine_cleanupTasks");
    }

    try {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [taskId, task] of this.tasks.entries()) {
        // Only clean up completed, failed, or canceled tasks
        if (task.status !== ReasoningTaskStatus.COMPLETED && 
            task.status !== ReasoningTaskStatus.FAILED &&
            task.status !== ReasoningTaskStatus.CANCELED) {
          continue;
        }
        
        // Check task age
        const completionTime = task.metadata.completedAt || 
                              task.metadata.failedAt || 
                              task.metadata.canceledAt;
        
        if (completionTime && (now - completionTime > maxAgeMs)) {
          this.tasks.delete(taskId);
          cleanedCount++;
        }
      }
      
      if (this.logger && cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} old reasoning task
(Content truncated due to size limit. Use line ranges to read in chunks)