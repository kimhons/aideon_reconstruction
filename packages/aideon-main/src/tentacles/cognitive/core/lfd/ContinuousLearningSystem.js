/**
 * @fileoverview Continuous Learning System for Learning from Demonstration.
 * Updates knowledge over time based on new demonstrations and feedback.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Manages continuous learning for the LfD system.
 */
class ContinuousLearningSystem {
  /**
   * Constructor for ContinuousLearningSystem.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   * @param {Object} options.selfImprovementEngine Self-improvement engine
   * @param {Object} options.performanceMonitor Performance monitor
   * @param {Object} options.eventBus Global event bus
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for ContinuousLearningSystem");
    if (!options.logger) throw new Error("Logger is required for ContinuousLearningSystem");
    if (!options.configService) throw new Error("ConfigService is required for ContinuousLearningSystem");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for ContinuousLearningSystem");
    if (!options.selfImprovementEngine) throw new Error("SelfImprovementEngine is required for ContinuousLearningSystem");
    if (!options.performanceMonitor) throw new Error("PerformanceMonitor is required for ContinuousLearningSystem");
    if (!options.eventBus) throw new Error("EventBus is required for ContinuousLearningSystem");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.selfImprovementEngine = options.selfImprovementEngine;
    this.performanceMonitor = options.performanceMonitor;
    this.eventBus = options.eventBus;
    
    // Initialize state
    this.isActive = false;
    this.learningCycles = [];
    this.eventListeners = [];
    
    this.logger.info("ContinuousLearningSystem created");
  }
  
  /**
   * Start the continuous learning system.
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isActive) {
      this.logger.warn("Continuous learning system is already active");
      return;
    }
    
    this.logger.info("Starting continuous learning system");
    
    try {
      // Register event listeners
      this._registerEventListeners();
      
      // Schedule periodic learning cycles
      await this._schedulePeriodicLearningCycles();
      
      // Initialize learning state
      await this._initializeLearningState();
      
      this.isActive = true;
      this.logger.info("Continuous learning system started");
    } catch (error) {
      this.logger.error(`Error starting continuous learning system: ${error.message}`, { error });
      this._unregisterEventListeners();
      throw error;
    }
  }
  
  /**
   * Stop the continuous learning system.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isActive) {
      this.logger.warn("Continuous learning system is not active");
      return;
    }
    
    this.logger.info("Stopping continuous learning system");
    
    try {
      // Unregister event listeners
      this._unregisterEventListeners();
      
      // Cancel scheduled learning cycles
      this._cancelScheduledLearningCycles();
      
      this.isActive = false;
      this.logger.info("Continuous learning system stopped");
    } catch (error) {
      this.logger.error(`Error stopping continuous learning system: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Trigger a learning cycle.
   * @param {Object} options Learning cycle options
   * @returns {Promise<Object>} Learning cycle result
   */
  async triggerLearningCycle(options = {}) {
    this.logger.info("Triggering learning cycle");
    
    try {
      // Create learning cycle
      const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const cycle = {
        id: cycleId,
        startTime: Date.now(),
        endTime: null,
        status: 'running',
        source: options.source || 'manual',
        tasks: [],
        results: {},
        metrics: {}
      };
      
      // Add to learning cycles
      this.learningCycles.push(cycle);
      
      // Execute learning cycle
      const result = await this._executeLearningCycle(cycle, options);
      
      return result;
    } catch (error) {
      this.logger.error(`Error triggering learning cycle: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get learning cycle history.
   * @param {Object} options Filter options
   * @returns {Array<Object>} Learning cycles
   */
  getLearningCycleHistory(options = {}) {
    let cycles = [...this.learningCycles];
    
    // Apply filters
    if (options.status) {
      cycles = cycles.filter(cycle => cycle.status === options.status);
    }
    
    if (options.timeRange) {
      cycles = cycles.filter(cycle => 
        cycle.startTime >= options.timeRange.start && 
        cycle.startTime <= options.timeRange.end
      );
    }
    
    if (options.limit) {
      cycles = cycles.slice(0, options.limit);
    }
    
    return cycles;
  }
  
  /**
   * Get learning metrics.
   * @returns {Object} Learning metrics
   */
  getLearningMetrics() {
    try {
      // Calculate metrics from learning cycles
      const completedCycles = this.learningCycles.filter(cycle => cycle.status === 'completed');
      const failedCycles = this.learningCycles.filter(cycle => cycle.status === 'failed');
      
      const metrics = {
        totalCycles: this.learningCycles.length,
        completedCycles: completedCycles.length,
        failedCycles: failedCycles.length,
        successRate: this.learningCycles.length > 0 
          ? (completedCycles.length / this.learningCycles.length) * 100 
          : 0,
        averageDuration: completedCycles.length > 0 
          ? completedCycles.reduce((sum, cycle) => sum + (cycle.endTime - cycle.startTime), 0) / completedCycles.length 
          : 0,
        lastCycleTime: completedCycles.length > 0 
          ? Math.max(...completedCycles.map(cycle => cycle.endTime)) 
          : null,
        taskMetrics: this._calculateTaskMetrics(),
        improvementMetrics: this._calculateImprovementMetrics()
      };
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting learning metrics: ${error.message}`, { error });
      return {
        error: error.message,
        totalCycles: this.learningCycles.length
      };
    }
  }
  
  /**
   * Register event listeners.
   * @private
   */
  _registerEventListeners() {
    // Define event handlers
    const handlers = [
      {
        event: 'demonstration.completed',
        handler: this._handleDemonstrationCompleted.bind(this)
      },
      {
        event: 'workflow.feedback',
        handler: this._handleWorkflowFeedback.bind(this)
      },
      {
        event: 'workflow.execution.completed',
        handler: this._handleWorkflowExecutionCompleted.bind(this)
      }
    ];
    
    // Register handlers
    for (const { event, handler } of handlers) {
      this.eventBus.on(event, handler);
      this.eventListeners.push({ event, handler });
    }
    
    this.logger.info(`Registered ${handlers.length} event listeners`);
  }
  
  /**
   * Unregister event listeners.
   * @private
   */
  _unregisterEventListeners() {
    for (const { event, handler } of this.eventListeners) {
      this.eventBus.off(event, handler);
    }
    
    this.eventListeners = [];
    this.logger.info("Unregistered all event listeners");
  }
  
  /**
   * Schedule periodic learning cycles.
   * @private
   * @returns {Promise<void>}
   */
  async _schedulePeriodicLearningCycles() {
    try {
      // Get configuration
      const config = this.configService.get("lfd.continuousLearning", {});
      
      // Schedule daily learning cycle
      if (config.dailyCycleTime) {
        const [hour, minute] = config.dailyCycleTime.split(':').map(Number);
        
        this.logger.info(`Scheduling daily learning cycle at ${hour}:${minute}`);
        
        // Calculate initial delay
        const now = new Date();
        const scheduledTime = new Date(now);
        scheduledTime.setHours(hour, minute, 0, 0);
        
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        const initialDelay = scheduledTime.getTime() - now.getTime();
        
        // Schedule daily cycle
        this.dailyCycleTimeout = setTimeout(() => {
          // Trigger learning cycle
          this.triggerLearningCycle({ source: 'scheduled', type: 'daily' })
            .catch(error => this.logger.error(`Error in scheduled daily learning cycle: ${error.message}`, { error }));
          
          // Schedule next cycle
          const dailyInterval = 24 * 60 * 60 * 1000; // 24 hours
          this.dailyCycleInterval = setInterval(() => {
            this.triggerLearningCycle({ source: 'scheduled', type: 'daily' })
              .catch(error => this.logger.error(`Error in scheduled daily learning cycle: ${error.message}`, { error }));
          }, dailyInterval);
        }, initialDelay);
      }
      
      // Schedule weekly learning cycle
      if (config.weeklyCycleDay && config.weeklyCycleTime) {
        const day = config.weeklyCycleDay; // 0-6, where 0 is Sunday
        const [hour, minute] = config.weeklyCycleTime.split(':').map(Number);
        
        this.logger.info(`Scheduling weekly learning cycle on day ${day} at ${hour}:${minute}`);
        
        // Calculate initial delay
        const now = new Date();
        const scheduledTime = new Date(now);
        scheduledTime.setHours(hour, minute, 0, 0);
        
        // Adjust to next occurrence of the specified day
        const currentDay = scheduledTime.getDay();
        const daysToAdd = (day - currentDay + 7) % 7;
        
        if (daysToAdd === 0 && scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 7);
        } else {
          scheduledTime.setDate(scheduledTime.getDate() + daysToAdd);
        }
        
        const initialDelay = scheduledTime.getTime() - now.getTime();
        
        // Schedule weekly cycle
        this.weeklyCycleTimeout = setTimeout(() => {
          // Trigger learning cycle
          this.triggerLearningCycle({ source: 'scheduled', type: 'weekly' })
            .catch(error => this.logger.error(`Error in scheduled weekly learning cycle: ${error.message}`, { error }));
          
          // Schedule next cycle
          const weeklyInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
          this.weeklyCycleInterval = setInterval(() => {
            this.triggerLearningCycle({ source: 'scheduled', type: 'weekly' })
              .catch(error => this.logger.error(`Error in scheduled weekly learning cycle: ${error.message}`, { error }));
          }, weeklyInterval);
        }, initialDelay);
      }
    } catch (error) {
      this.logger.error(`Error scheduling periodic learning cycles: ${error.message}`, { error });
    }
  }
  
  /**
   * Cancel scheduled learning cycles.
   * @private
   */
  _cancelScheduledLearningCycles() {
    // Clear daily cycle
    if (this.dailyCycleTimeout) {
      clearTimeout(this.dailyCycleTimeout);
      this.dailyCycleTimeout = null;
    }
    
    if (this.dailyCycleInterval) {
      clearInterval(this.dailyCycleInterval);
      this.dailyCycleInterval = null;
    }
    
    // Clear weekly cycle
    if (this.weeklyCycleTimeout) {
      clearTimeout(this.weeklyCycleTimeout);
      this.weeklyCycleTimeout = null;
    }
    
    if (this.weeklyCycleInterval) {
      clearInterval(this.weeklyCycleInterval);
      this.weeklyCycleInterval = null;
    }
    
    this.logger.info("Cancelled all scheduled learning cycles");
  }
  
  /**
   * Initialize learning state.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeLearningState() {
    try {
      // Load previous learning cycles from knowledge graph
      const cycleNodes = await this.knowledgeGraphManager.getNodes('LearningCycle');
      
      if (cycleNodes.length > 0) {
        // Convert to learning cycle objects
        const cycles = cycleNodes.map(node => ({
          id: node.id,
          startTime: node.properties.startTime,
          endTime: node.properties.endTime,
          status: node.properties.status,
          source: node.properties.source,
          tasks: node.properties.tasks || [],
          results: node.properties.results || {},
          metrics: node.properties.metrics || {}
        }));
        
        // Sort by start time
        cycles.sort((a, b) => a.startTime - b.startTime);
        
        // Add to learning cycles
        this.learningCycles = cycles;
        
        this.logger.info(`Loaded ${cycles.length} previous learning cycles`);
      }
    } catch (error) {
      this.logger.error(`Error initializing learning state: ${error.message}`, { error });
    }
  }
  
  /**
   * Execute a learning cycle.
   * @private
   * @param {Object} cycle Learning cycle
   * @param {Object} options Learning cycle options
   * @returns {Promise<Object>} Learning cycle result
   */
  async _executeLearningCycle(cycle, options) {
    try {
      this.logger.info(`Executing learning cycle: ${cycle.id}`);
      
      // Determine tasks to execute
      const tasks = await this._determineLearningTasks(options);
      cycle.tasks = tasks;
      
      // Execute each task
      for (const task of tasks) {
        try {
          this.logger.info(`Executing learning task: ${task.type}`);
          
          task.startTime = Date.now();
          task.status = 'running';
          
          // Execute task based on type
          switch (task.type) {
            case 'patternExtraction':
              task.result = await this._executePatternExtractionTask(task);
              break;
            case 'modelImprovement':
              task.result = await this._executeModelImprovementTask(task);
              break;
            case 'workflowRefinement':
              task.result = await this._executeWorkflowRefinementTask(task);
              break;
            case 'knowledgeGraphCleanup':
              task.result = await this._executeKnowledgeGraphCleanupTask(task);
              break;
            default:
              throw new Error(`Unknown task type: ${task.type}`);
          }
          
          task.endTime = Date.now();
          task.status = 'completed';
          task.duration = task.endTime - task.startTime;
          
          // Add to cycle results
          if (!cycle.results[task.type]) {
            cycle.results[task.type] = [];
          }
          cycle.results[task.type].push(task.result);
          
          this.logger.info(`Completed learning task: ${task.type}`);
        } catch (error) {
          this.logger.error(`Error executing learning task: ${error.message}`, { error, taskType: task.type });
          
          task.endTime = Date.now();
          task.status = 'failed';
          task.error = error.message;
          task.duration = task.endTime - task.startTime;
        }
      }
      
      // Calculate metrics
      cycle.metrics = this._calculateCycleMetrics(cycle);
      
      // Update cycle status
      cycle.endTime = Date.now();
      cycle.status = cycle.tasks.some(task => task.status === 'failed') ? 'failed' : 'completed';
      
      // Store cycle in knowledge graph
      await this._storeLearningCycle(cycle);
      
      this.logger.info(`Completed learning cycle: ${cycle.id}`);
      
      return {
        cycleId: cycle.id,
        status: cycle.status,
        duration: cycle.endTime - cycle.startTime,
        tasks: cycle.tasks.map(task => ({
          type: task.type,
          status: task.status,
          duration: task.duration
        })),
        metrics: cycle.metrics
      };
    } catch (error) {
      this.logger.error(`Error executing learning cycle: ${error.message}`, { error, cycleId: cycle.id });
      
      // Update cycle status
      cycle.endTime = Date.now();
      cycle.status = 'failed';
      cycle.error = error.message;
      
      // Store cycle in knowledge graph
      await this._storeLearningCycle(cycle);
      
      throw error;
    }
  }
  
  /**
   * Determine learning tasks for a cycle.
   * @private
   * @param {Object} options Learning cycle options
   * @returns {Promise<Array<Object>>} Learning tasks
   */
  async _determineLearningTasks(options) {
    try {
      const tasks = [];
      
      // If specific tasks are requested, use those
      if (options.tasks && Array.isArray(options.tasks)) {
        for (const taskType of options.tasks) {
          tasks.push({
            type: taskType,
            options: options[taskType] || {}
          });
        }
        
        return tasks;
      }
      
      // Determine tasks based on cycle type
      const cycleType = options.type || 'daily';
      
      if (cycleType === 'daily') {
        // Daily tasks
        tasks.push({
          type: 'patternExtraction',
          options: {
            timeRange: {
              start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
              end: Date.now()
            }
          }
        });
        
        tasks.push({
          type: 'workflowRefinement',
          options: {
            timeRange: {
              start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
              end: Date.now()
            },
            autoApply: true
          }
        });
      } else if (cycleType === 'weekly') {
        // Weekly tasks
        tasks.push({
          type: 'patternExtraction',
          options: {
            timeRange: {
              start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
              end: Date.now()
            }
          }
        });
        
        tasks.push({
          type: 'modelImprovement',
          options: {
            modelType: 'patternModel',
            timeRange: {
              start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
              end: Date.now()
            }
          }
        });
        
        tasks.push({
          type: 'modelImprovement',
          options: {
            modelType: 'workflowModel',
            timeRange: {
              start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
              end: Date.now()
            }
          }
        });
        
        tasks.push({
          type: 'knowledgeGraphCleanup',
          options: {
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
          }
        });
      } else if (cycleType === 'manual') {
        // Manual cycle - include all tasks
        tasks.push({
          type: 'patternExtraction',
          options: {}
        });
        
        tasks.push({
          type: 'modelImprovement',
          options: {
            modelType: 'patternModel'
          }
        });
        
        tasks.push({
          type: 'modelImprovement',
          options: {
            modelType: 'workflowModel'
          }
        });
        
        tasks.push({
          type: 'workflowRefinement',
          options: {
            autoApply: true
          }
        });
      }
      
      return tasks;
    } catch (error) {
      this.logger.error(`Error determining learning tasks: ${error.message}`, { error });
      return [];
    }
  }
  
  /**
   * Execute pattern extraction task.
   * @private
   * @param {Object} task Task object
   * @returns {Promise<Object>} Task result
   */
  async _executePatternExtractionTask(task) {
    try {
      // Schedule task with self-improvement engine
      const taskId = await this.selfImprovementEngine.scheduleImprovementTask('patternExtraction', task.options);
      
      // Wait for task to complete
      let taskStatus = null;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)
      
      while (attempts < maxAttempts) {
        taskStatus = this.selfImprovementEngine.getTaskStatus(taskId);
        
        if (!taskStatus) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        if (taskStatus.status === 'completed' || taskStatus.status === 'error') {
          break;
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      if (taskStatus.status === 'error') {
        throw new Error(`Task failed: ${taskStatus.error}`);
      }
      
      if (taskStatus.status !== 'completed') {
        throw new Error(`Task did not complete in time: ${taskId}`);
      }
      
      return taskStatus.result;
    } catch (error) {
      this.logger.error(`Error executing pattern extraction task: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Execute model improvement task.
   * @private
   * @param {Object} task Task object
   * @returns {Promise<Object>} Task result
   */
  async _executeModelImprovementTask(task) {
    try {
      // Schedule task with self-improvement engine
      const taskId = await this.selfImprovementEngine.scheduleImprovementTask('modelImprovement', task.options);
      
      // Wait for task to complete
      let taskStatus = null;
      let attempts = 0;
      const maxAttempts = 120; // Wait up to 10 minutes (120 * 5 seconds)
      
      while (attempts < maxAttempts) {
        taskStatus = this.selfImprovementEngine.getTaskStatus(taskId);
        
        if (!taskStatus) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        if (taskStatus.status === 'completed' || taskStatus.status === 'error') {
          break;
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      if (taskStatus.status === 'error') {
        throw new Error(`Task failed: ${taskStatus.error}`);
      }
      
      if (taskStatus.status !== 'completed') {
        throw new Error(`Task did not complete in time: ${taskId}`);
      }
      
      return taskStatus.result;
    } catch (error) {
      this.logger.error(`Error executing model improvement task: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Execute workflow refinement task.
   * @private
   * @param {Object} task Task object
   * @returns {Promise<Object>} Task result
   */
  async _executeWorkflowRefinementTask(task) {
    try {
      // Get workflows to refine
      let workflows = [];
      
      if (task.options.workflowIds) {
        // Specific workflows
        for (const workflowId of task.options.workflowIds) {
          const workflow = await this.knowledgeGraphManager.getNode('Workflow', workflowId);
          if (workflow) {
            workflows.push(workflow);
          }
        }
      } else if (task.options.timeRange) {
        // Workflows in time range
        workflows = await this.knowledgeGraphManager.getNodes('Workflow', {
          property: 'createdAt',
          operator: 'between',
          value: [task.options.timeRange.start, task.options.timeRange.end]
        });
      } else {
        // All workflows
        workflows = await this.knowledgeGraphManager.getNodes('Workflow');
      }
      
      if (workflows.length === 0) {
        return {
          message: "No workflows found to refine",
          workflowsRefined: 0
        };
      }
      
      // Refine each workflow
      const refinementResults = {};
      
      for (const workflow of workflows) {
        try {
          // Schedule refinement task
          const taskId = await this.selfImprovementEngine.scheduleImprovementTask('workflowRefinement', {
            workflowId: workflow.id,
            autoApply: task.options.autoApply
          });
          
          // Wait for task to complete
          let taskStatus = null;
          let attempts = 0;
          const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)
          
          while (attempts < maxAttempts) {
            taskStatus = this.selfImprovementEngine.getTaskStatus(taskId);
            
            if (!taskStatus) {
              throw new Error(`Task not found: ${taskId}`);
            }
            
            if (taskStatus.status === 'completed' || taskStatus.status === 'error') {
              break;
            }
            
            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
          }
          
          if (taskStatus.status === 'error') {
            refinementResults[workflow.id] = {
              status: 'error',
              error: taskStatus.error
            };
          } else if (taskStatus.status !== 'completed') {
            refinementResults[workflow.id] = {
              status: 'timeout',
              error: 'Task did not complete in time'
            };
          } else {
            refinementResults[workflow.id] = {
              status: 'completed',
              result: taskStatus.result
            };
          }
        } catch (error) {
          refinementResults[workflow.id] = {
            status: 'error',
            error: error.message
          };
        }
      }
      
      // Calculate summary
      const summary = {
        totalWorkflows: workflows.length,
        successfulRefinements: Object.values(refinementResults).filter(r => r.status === 'completed').length,
        failedRefinements: Object.values(refinementResults).filter(r => r.status !== 'completed').length,
        refinements: refinementResults
      };
      
      return summary;
    } catch (error) {
      this.logger.error(`Error executing workflow refinement task: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Execute knowledge graph cleanup task.
   * @private
   * @param {Object} task Task object
   * @returns {Promise<Object>} Task result
   */
  async _executeKnowledgeGraphCleanupTask(task) {
    try {
      // Schedule task with self-improvement engine
      const taskId = await this.selfImprovementEngine.scheduleImprovementTask('knowledgeGraphCleanup', task.options);
      
      // Wait for task to complete
      let taskStatus = null;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)
      
      while (attempts < maxAttempts) {
        taskStatus = this.selfImprovementEngine.getTaskStatus(taskId);
        
        if (!taskStatus) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        if (taskStatus.status === 'completed' || taskStatus.status === 'error') {
          break;
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      if (taskStatus.status === 'error') {
        throw new Error(`Task failed: ${taskStatus.error}`);
      }
      
      if (taskStatus.status !== 'completed') {
        throw new Error(`Task did not complete in time: ${taskId}`);
      }
      
      return taskStatus.result;
    } catch (error) {
      this.logger.error(`Error executing knowledge graph cleanup task: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Calculate metrics for a learning cycle.
   * @private
   * @param {Object} cycle Learning cycle
   * @returns {Object} Cycle metrics
   */
  _calculateCycleMetrics(cycle) {
    try {
      // Calculate task metrics
      const taskMetrics = {
        total: cycle.tasks.length,
        completed: cycle.tasks.filter(task => task.status === 'completed').length,
        failed: cycle.tasks.filter(task => task.status === 'failed').length,
        byType: {}
      };
      
      // Calculate metrics by task type
      for (const task of cycle.tasks) {
        if (!taskMetrics.byType[task.type]) {
          taskMetrics.byType[task.type] = {
            total: 0,
            completed: 0,
            failed: 0,
            averageDuration: 0
          };
        }
        
        const typeMetrics = taskMetrics.byType[task.type];
        typeMetrics.total++;
        
        if (task.status === 'completed') {
          typeMetrics.completed++;
        } else if (task.status === 'failed') {
          typeMetrics.failed++;
        }
        
        if (task.duration) {
          const totalDuration = typeMetrics.averageDuration * (typeMetrics.completed - 1) + task.duration;
          typeMetrics.averageDuration = typeMetrics.completed > 0 ? totalDuration / typeMetrics.completed : 0;
        }
      }
      
      // Calculate result metrics
      const resultMetrics = {};
      
      // Pattern extraction metrics
      if (cycle.results.patternExtraction) {
        const patternResults = cycle.results.patternExtraction;
        
        resultMetrics.patternExtraction = {
          totalPatterns: patternResults.reduce((sum, result) => sum + (result.patternsExtracted || 0), 0),
          demonstrationCount: patternResults.reduce((sum, result) => sum + (result.demonstrationCount || 0), 0)
        };
      }
      
      // Model improvement metrics
      if (cycle.results.modelImprovement) {
        const modelResults = cycle.results.modelImprovement;
        
        resultMetrics.modelImprovement = {
          modelsImproved: modelResults.length,
          byModelType: {}
        };
        
        for (const result of modelResults) {
          if (result.modelType) {
            resultMetrics.modelImprovement.byModelType[result.modelType] = {
              newVersion: result.newVersion,
              improvements: result.improvements ? result.improvements.length : 0
            };
          }
        }
      }
      
      // Workflow refinement metrics
      if (cycle.results.workflowRefinement) {
        const refinementResults = cycle.results.workflowRefinement;
        
        resultMetrics.workflowRefinement = {
          totalWorkflows: refinementResults.reduce((sum, result) => sum + (result.totalWorkflows || 0), 0),
          successfulRefinements: refinementResults.reduce((sum, result) => sum + (result.successfulRefinements || 0), 0),
          failedRefinements: refinementResults.reduce((sum, result) => sum + (result.failedRefinements || 0), 0)
        };
      }
      
      // Knowledge graph cleanup metrics
      if (cycle.results.knowledgeGraphCleanup) {
        const cleanupResults = cycle.results.knowledgeGraphCleanup;
        
        resultMetrics.knowledgeGraphCleanup = {
          nodesRemoved: cleanupResults.reduce((sum, result) => sum + (result.nodesRemoved || 0), 0),
          relationshipsRemoved: cleanupResults.reduce((sum, result) => sum + (result.relationshipsRemoved || 0), 0)
        };
      }
      
      return {
        duration: cycle.endTime - cycle.startTime,
        tasks: taskMetrics,
        results: resultMetrics
      };
    } catch (error) {
      this.logger.error(`Error calculating cycle metrics: ${error.message}`, { error, cycleId: cycle.id });
      return {
        error: error.message
      };
    }
  }
  
  /**
   * Calculate task metrics across all learning cycles.
   * @private
   * @returns {Object} Task metrics
   */
  _calculateTaskMetrics() {
    try {
      const metrics = {
        byType: {}
      };
      
      // Collect all tasks from all cycles
      const allTasks = this.learningCycles.flatMap(cycle => cycle.tasks || []);
      
      // Calculate metrics by task type
      for (const task of allTasks) {
        if (!metrics.byType[task.type]) {
          metrics.byType[task.type] = {
            total: 0,
            completed: 0,
            failed: 0,
            averageDuration: 0
          };
        }
        
        const typeMetrics = metrics.byType[task.type];
        typeMetrics.total++;
        
        if (task.status === 'completed') {
          typeMetrics.completed++;
        } else if (task.status === 'failed') {
          typeMetrics.failed++;
        }
        
        if (task.duration) {
          const totalDuration = typeMetrics.averageDuration * (typeMetrics.completed - 1) + task.duration;
          typeMetrics.averageDuration = typeMetrics.completed > 0 ? totalDuration / typeMetrics.completed : 0;
        }
      }
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error calculating task metrics: ${error.message}`, { error });
      return {
        error: error.message
      };
    }
  }
  
  /**
   * Calculate improvement metrics across all learning cycles.
   * @private
   * @returns {Object} Improvement metrics
   */
  _calculateImprovementMetrics() {
    try {
      const metrics = {
        patternExtraction: {
          totalPatterns: 0,
          demonstrationCount: 0
        },
        modelImprovement: {
          modelsImproved: 0,
          byModelType: {}
        },
        workflowRefinement: {
          totalWorkflows: 0,
          successfulRefinements: 0,
          failedRefinements: 0
        },
        knowledgeGraphCleanup: {
          nodesRemoved: 0,
          relationshipsRemoved: 0
        }
      };
      
      // Process each cycle
      for (const cycle of this.learningCycles) {
        if (cycle.status !== 'completed') {
          continue;
        }
        
        // Pattern extraction metrics
        if (cycle.results.patternExtraction) {
          for (const result of cycle.results.patternExtraction) {
            metrics.patternExtraction.totalPatterns += result.patternsExtracted || 0;
            metrics.patternExtraction.demonstrationCount += result.demonstrationCount || 0;
          }
        }
        
        // Model improvement metrics
        if (cycle.results.modelImprovement) {
          metrics.modelImprovement.modelsImproved += cycle.results.modelImprovement.length;
          
          for (const result of cycle.results.modelImprovement) {
            if (result.modelType) {
              if (!metrics.modelImprovement.byModelType[result.modelType]) {
                metrics.modelImprovement.byModelType[result.modelType] = {
                  improvementCount: 0,
                  latestVersion: 0
                };
              }
              
              metrics.modelImprovement.byModelType[result.modelType].improvementCount++;
              
              if (result.newVersion > metrics.modelImprovement.byModelType[result.modelType].latestVersion) {
                metrics.modelImprovement.byModelType[result.modelType].latestVersion = result.newVersion;
              }
            }
          }
        }
        
        // Workflow refinement metrics
        if (cycle.results.workflowRefinement) {
          for (const result of cycle.results.workflowRefinement) {
            metrics.workflowRefinement.totalWorkflows += result.totalWorkflows || 0;
            metrics.workflowRefinement.successfulRefinements += result.successfulRefinements || 0;
            metrics.workflowRefinement.failedRefinements += result.failedRefinements || 0;
          }
        }
        
        // Knowledge graph cleanup metrics
        if (cycle.results.knowledgeGraphCleanup) {
          for (const result of cycle.results.knowledgeGraphCleanup) {
            metrics.knowledgeGraphCleanup.nodesRemoved += result.nodesRemoved || 0;
            metrics.knowledgeGraphCleanup.relationshipsRemoved += result.relationshipsRemoved || 0;
          }
        }
      }
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error calculating improvement metrics: ${error.message}`, { error });
      return {
        error: error.message
      };
    }
  }
  
  /**
   * Store learning cycle in knowledge graph.
   * @private
   * @param {Object} cycle Learning cycle
   * @returns {Promise<void>}
   */
  async _storeLearningCycle(cycle) {
    try {
      // Create cycle node
      const cycleNode = {
        type: 'LearningCycle',
        id: cycle.id,
        properties: {
          startTime: cycle.startTime,
          endTime: cycle.endTime,
          status: cycle.status,
          source: cycle.source,
          tasks: cycle.tasks,
          results: cycle.results,
          metrics: cycle.metrics,
          error: cycle.error
        }
      };
      
      // Check if node already exists
      const existingNode = await this.knowledgeGraphManager.getNode('LearningCycle', cycle.id);
      
      if (existingNode) {
        // Update existing node
        await this.knowledgeGraphManager.updateNode('LearningCycle', cycle.id, cycleNode.properties);
      } else {
        // Add new node
        await this.knowledgeGraphManager.addNode(cycleNode);
      }
    } catch (error) {
      this.logger.error(`Error storing learning cycle in knowledge graph: ${error.message}`, { error, cycleId: cycle.id });
    }
  }
  
  /**
   * Handle demonstration completed event.
   * @private
   * @param {Object} event Event data
   * @returns {Promise<void>}
   */
  async _handleDemonstrationCompleted(event) {
    try {
      this.logger.info(`Handling demonstration completed event for demonstration: ${event.demonstrationId}`);
      
      // Check if automatic pattern extraction is enabled
      const autoExtract = this.configService.get("lfd.continuousLearning.autoExtractPatterns", true);
      
      if (autoExtract) {
        // Schedule pattern extraction task
        await this.selfImprovementEngine.scheduleImprovementTask('patternExtraction', {
          demonstrationIds: [event.demonstrationId],
          source: 'event'
        });
      }
    } catch (error) {
      this.logger.error(`Error handling demonstration completed event: ${error.message}`, { error, demonstrationId: event.demonstrationId });
    }
  }
  
  /**
   * Handle workflow feedback event.
   * @private
   * @param {Object} event Event data
   * @returns {Promise<void>}
   */
  async _handleWorkflowFeedback(event) {
    try {
      this.logger.info(`Handling workflow feedback event for workflow: ${event.workflowId}`);
      
      // Check if automatic workflow refinement is enabled
      const autoRefine = this.configService.get("lfd.continuousLearning.autoRefineWorkflows", true);
      
      if (autoRefine) {
        // Schedule workflow refinement task
        await this.selfImprovementEngine.scheduleImprovementTask('workflowRefinement', {
          workflowId: event.workflowId,
          feedbackIds: [event.feedbackId],
          autoApply: true,
          source: 'event'
        });
      }
    } catch (error) {
      this.logger.error(`Error handling workflow feedback event: ${error.message}`, { error, workflowId: event.workflowId });
    }
  }
  
  /**
   * Handle workflow execution completed event.
   * @private
   * @param {Object} event Event data
   * @returns {Promise<void>}
   */
  async _handleWorkflowExecutionCompleted(event) {
    try {
      this.logger.info(`Handling workflow execution completed event for workflow: ${event.workflowId}`);
      
      // Check if execution failed
      if (!event.success) {
        // Check if automatic workflow refinement is enabled
        const autoRefine = this.configService.get("lfd.continuousLearning.autoRefineWorkflows", true);
        
        if (autoRefine) {
          // Schedule workflow refinement task
          await this.selfImprovementEngine.scheduleImprovementTask('workflowRefinement', {
            workflowId: event.workflowId,
            executionIds: [event.executionId],
            autoApply: true,
            source: 'event'
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error handling workflow execution completed event: ${error.message}`, { error, workflowId: event.workflowId });
    }
  }
}

module.exports = ContinuousLearningSystem;
