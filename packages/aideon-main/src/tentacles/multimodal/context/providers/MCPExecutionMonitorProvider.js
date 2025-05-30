/**
 * @fileoverview MCPExecutionMonitorProvider for Task Execution tentacles.
 * Provides context management capabilities for execution monitoring components.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { MCPTaskExecutionContextProvider } = require('./MCPTaskExecutionContextProvider');
const { validateTaskExecutionContext } = require('../schemas/TaskExecutionContextSchemas');

/**
 * MCP Context Provider for ExecutionMonitor.
 * Manages context related to task execution progress and status.
 */
class MCPExecutionMonitorProvider extends MCPTaskExecutionContextProvider {
  /**
   * Creates a new MCPExecutionMonitorProvider instance.
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super({
      ...options,
      providerId: options.providerId || 'execution-monitor'
    });
    
    // Initialize execution tracking
    this.taskProgress = new Map();
    this.taskStatus = new Map();
    
    this.logger.info('MCPExecutionMonitorProvider initialized');
  }
  
  /**
   * Gets the supported context types for this provider.
   * 
   * @returns {string[]} Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      'task.execution.progress',
      'task.execution.status'
    ];
  }
  
  /**
   * Gets relevant context types for this provider.
   * 
   * @returns {string[]} Array of relevant context types
   */
  getRelevantContextTypes() {
    return [
      'task.planning.plan',
      'task.planning.goal',
      'task.resource.allocation',
      'task.error.detection',
      'task.error.recovery'
    ];
  }
  
  /**
   * Validates context data against schema.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data to validate
   * @throws {Error} If validation fails
   */
  validateContextData(contextType, contextData) {
    const validationResult = validateTaskExecutionContext(contextType, contextData);
    
    if (!validationResult.isValid) {
      throw new Error(`Invalid context data for ${contextType}: ${validationResult.errors.join(', ')}`);
    }
  }
  
  /**
   * Applies privacy controls to context data.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @returns {Object} Privacy-controlled context data
   */
  applyPrivacyControls(contextType, contextData) {
    // Create a deep copy to avoid modifying the original
    const sanitizedData = JSON.parse(JSON.stringify(contextData));
    
    // Apply privacy controls based on context type
    if (contextType === 'task.execution.status') {
      // Redact sensitive information in logs
      if (sanitizedData.logs && Array.isArray(sanitizedData.logs)) {
        sanitizedData.logs = sanitizedData.logs.map(log => {
          // Create a copy of the log
          const sanitizedLog = { ...log };
          
          // Redact sensitive information in log messages
          if (sanitizedLog.message) {
            // Redact passwords, tokens, keys, etc.
            sanitizedLog.message = sanitizedLog.message
              .replace(/password\s*[:=]\s*['"].*?['"]/gi, 'password: "[REDACTED]"')
              .replace(/token\s*[:=]\s*['"].*?['"]/gi, 'token: "[REDACTED]"')
              .replace(/key\s*[:=]\s*['"].*?['"]/gi, 'key: "[REDACTED]"')
              .replace(/secret\s*[:=]\s*['"].*?['"]/gi, 'secret: "[REDACTED]"');
          }
          
          return sanitizedLog;
        });
      }
      
      // Redact sensitive information in error details
      if (sanitizedData.error && sanitizedData.error.details) {
        // Check for sensitive fields in error details
        if (sanitizedData.error.details.credentials) {
          sanitizedData.error.details.credentials = '[REDACTED]';
        }
        if (sanitizedData.error.details.authToken) {
          sanitizedData.error.details.authToken = '[REDACTED]';
        }
      }
    }
    
    return sanitizedData;
  }
  
  /**
   * Processes consumed context.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processContext(contextType, contextData, metadata) {
    this.logger.debug(`Processing context: ${contextType}`, { providerId: metadata.providerId });
    
    switch (contextType) {
      case 'task.planning.plan':
      case 'task.planning.goal':
        await this.processPlanningContext(contextType, contextData, metadata);
        break;
      case 'task.resource.allocation':
        await this.processResourceAllocationContext(contextData, metadata);
        break;
      case 'task.error.detection':
        await this.processErrorDetectionContext(contextData, metadata);
        break;
      case 'task.error.recovery':
        await this.processErrorRecoveryContext(contextData, metadata);
        break;
      default:
        this.logger.debug(`No specific processing for context type: ${contextType}`);
    }
  }
  
  /**
   * Processes planning context.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processPlanningContext(contextType, contextData, metadata) {
    // Implementation would initialize execution monitoring for new plans
    
    if (contextType === 'task.planning.plan') {
      // Initialize progress tracking for new plan
      const initialProgress = {
        taskId: contextData.planId,
        planId: contextData.planId,
        status: 'pending',
        progress: 0,
        completedSteps: [],
        remainingSteps: contextData.steps ? contextData.steps.map(step => step.stepId) : [],
        updatedAt: Date.now()
      };
      
      // Initialize status tracking for new plan
      const initialStatus = {
        taskId: contextData.planId,
        planId: contextData.planId,
        status: 'pending',
        statusDetails: 'Task initialized from plan',
        updatedAt: Date.now()
      };
      
      // Store initial progress and status
      this.taskProgress.set(contextData.planId, initialProgress);
      this.taskStatus.set(contextData.planId, initialStatus);
      
      // Provide initial contexts
      await this.provideContext('task.execution.progress', initialProgress);
      await this.provideContext('task.execution.status', initialStatus);
      
      this.logger.info(`Initialized execution monitoring for plan ${contextData.planId}`);
    }
  }
  
  /**
   * Processes resource allocation context.
   * 
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processResourceAllocationContext(contextData, metadata) {
    // Implementation would update execution status based on resource allocations
    
    // Example: Update task status when resources are allocated
    if (contextData.status === 'active') {
      const taskId = contextData.taskId;
      
      // Get current status
      const currentStatus = this.taskStatus.get(taskId);
      
      if (currentStatus && currentStatus.status === 'pending') {
        // Update status to in_progress if resources are now allocated
        const updatedStatus = {
          ...currentStatus,
          status: 'in_progress',
          statusDetails: 'Resources allocated, execution started',
          updatedAt: Date.now()
        };
        
        // Update progress as well
        const currentProgress = this.taskProgress.get(taskId);
        if (currentProgress) {
          const updatedProgress = {
            ...currentProgress,
            status: 'in_progress',
            startTime: Date.now(),
            updatedAt: Date.now()
          };
          
          // Store updated progress
          this.taskProgress.set(taskId, updatedProgress);
          
          // Provide updated progress context
          await this.provideContext('task.execution.progress', updatedProgress);
        }
        
        // Store updated status
        this.taskStatus.set(taskId, updatedStatus);
        
        // Provide updated status context
        await this.provideContext('task.execution.status', updatedStatus);
        
        this.logger.info(`Task ${taskId} status updated to in_progress due to resource allocation`);
      }
    }
  }
  
  /**
   * Processes error detection context.
   * 
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processErrorDetectionContext(contextData, metadata) {
    // Implementation would update execution status based on detected errors
    
    const taskId = contextData.taskId;
    
    // Get current status
    const currentStatus = this.taskStatus.get(taskId);
    
    if (currentStatus) {
      // Update status based on error severity
      let newStatus = currentStatus.status;
      
      if (contextData.severity === 'critical' || contextData.impact === 'blocking') {
        newStatus = 'failed';
      } else if (contextData.severity === 'high' || contextData.impact === 'major') {
        // Only change to paused if not already failed
        if (currentStatus.status !== 'failed') {
          newStatus = 'paused';
        }
      }
      
      // If status changed, update it
      if (newStatus !== currentStatus.status) {
        const updatedStatus = {
          ...currentStatus,
          status: newStatus,
          statusDetails: `Error detected: ${contextData.message}`,
          error: {
            code: contextData.errorCode,
            message: contextData.message,
            details: contextData.details,
            timestamp: contextData.detectedAt
          },
          updatedAt: Date.now()
        };
        
        // Update progress as well
        const currentProgress = this.taskProgress.get(taskId);
        if (currentProgress) {
          const updatedProgress = {
            ...currentProgress,
            status: newStatus,
            updatedAt: Date.now()
          };
          
          // Store updated progress
          this.taskProgress.set(taskId, updatedProgress);
          
          // Provide updated progress context
          await this.provideContext('task.execution.progress', updatedProgress);
        }
        
        // Store updated status
        this.taskStatus.set(taskId, updatedStatus);
        
        // Provide updated status context
        await this.provideContext('task.execution.status', updatedStatus);
        
        this.logger.info(`Task ${taskId} status updated to ${newStatus} due to error: ${contextData.errorType}`);
      }
    }
  }
  
  /**
   * Processes error recovery context.
   * 
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processErrorRecoveryContext(contextData, metadata) {
    // Implementation would update execution status based on recovery status
    
    const taskId = contextData.taskId;
    
    // Get current status
    const currentStatus = this.taskStatus.get(taskId);
    
    if (currentStatus) {
      // Update status based on recovery status
      let newStatus = currentStatus.status;
      
      if (contextData.status === 'succeeded') {
        // Recovery succeeded, resume execution
        newStatus = 'in_progress';
      } else if (contextData.status === 'failed') {
        // Recovery failed, mark task as failed
        newStatus = 'failed';
      }
      
      // If status changed, update it
      if (newStatus !== currentStatus.status) {
        const updatedStatus = {
          ...currentStatus,
          status: newStatus,
          statusDetails: `Recovery ${contextData.status}: ${contextData.strategy}`,
          updatedAt: Date.now()
        };
        
        // Update progress as well
        const currentProgress = this.taskProgress.get(taskId);
        if (currentProgress) {
          const updatedProgress = {
            ...currentProgress,
            status: newStatus,
            updatedAt: Date.now()
          };
          
          // Store updated progress
          this.taskProgress.set(taskId, updatedProgress);
          
          // Provide updated progress context
          await this.provideContext('task.execution.progress', updatedProgress);
        }
        
        // Store updated status
        this.taskStatus.set(taskId, updatedStatus);
        
        // Provide updated status context
        await this.provideContext('task.execution.status', updatedStatus);
        
        this.logger.info(`Task ${taskId} status updated to ${newStatus} due to recovery ${contextData.status}`);
      }
    }
  }
  
  /**
   * Updates task progress.
   * 
   * @param {string} taskId - ID of the task
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} currentStepId - ID of the current step
   * @param {Array<string>} completedSteps - IDs of completed steps
   * @returns {Promise<void>}
   */
  async updateTaskProgress(taskId, progress, currentStepId, completedSteps) {
    // Get current progress
    const currentProgress = this.taskProgress.get(taskId) || {
      taskId,
      status: 'in_progress',
      progress: 0,
      completedSteps: [],
      remainingSteps: [],
      updatedAt: Date.now()
    };
    
    // Calculate remaining steps
    const remainingSteps = currentProgress.remainingSteps.filter(
      stepId => !completedSteps.includes(stepId)
    );
    
    // Update progress
    const updatedProgress = {
      ...currentProgress,
      progress: Math.min(100, Math.max(0, progress)),
      currentStepId,
      completedSteps,
      remainingSteps,
      updatedAt: Date.now()
    };
    
    // Calculate elapsed time if start time is available
    if (currentProgress.startTime) {
      updatedProgress.elapsedTime = Date.now() - currentProgress.startTime;
      
      // Estimate remaining time based on progress
      if (updatedProgress.progress > 0) {
        updatedProgress.remainingTime = 
          (updatedProgress.elapsedTime / updatedProgress.progress) * 
          (100 - updatedProgress.progress);
        
        updatedProgress.estimatedEndTime = 
          Date.now() + updatedProgress.remainingTime;
      }
    }
    
    // Check if task is complete
    if (updatedProgress.progress >= 100 || remainingSteps.length === 0) {
      updatedProgress.status = 'completed';
      
      // Update task status as well
      const currentStatus = this.taskStatus.get(taskId);
      if (currentStatus) {
        const updatedStatus = {
          ...currentStatus,
          status: 'completed',
          statusDetails: 'Task completed successfully',
          updatedAt: Date.now()
        };
        
        // Store updated status
        this.taskStatus.set(taskId, updatedStatus);
        
        // Provide updated status context
        await this.provideContext('task.execution.status', updatedStatus);
      }
    }
    
    // Store updated progress
    this.taskProgress.set(taskId, updatedProgress);
    
    // Provide updated progress context
    await this.provideContext('task.execution.progress', updatedProgress);
    
    this.logger.debug(`Task ${taskId} progress updated to ${updatedProgress.progress}%`);
  }
}

module.exports = { MCPExecutionMonitorProvider };
