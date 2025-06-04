/**
 * @fileoverview Integration Hub for the Aideon AI Desktop Agent's Reasoning Engine.
 * Provides standardized interfaces for tentacles to submit reasoning tasks and receive results.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Integration Hub for the Aideon AI Desktop Agent's Reasoning Engine.
 * Provides standardized interfaces for tentacles to submit reasoning tasks and receive results.
 * 
 * @extends EventEmitter
 */
class IntegrationHub extends EventEmitter {
  /**
   * Creates a new IntegrationHub instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.reasoningEngine - Reasoning Engine instance
   * @param {Object} [options.securityManager] - Security manager
   */
  constructor(options) {
    super();
    
    if (!options.reasoningEngine) {
      throw new Error("IntegrationHub requires a reasoningEngine instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.reasoningEngine = options.reasoningEngine;
    this.securityManager = options.securityManager;
    
    // Tentacle registration and context management
    this.registeredTentacles = new Map(); // Map of tentacleId -> tentacle info
    this.tentacleContexts = new Map(); // Map of tentacleId -> context data
    
    // Request tracking
    this.tentacleRequests = new Map(); // Map of tentacleId -> Set of taskIds
    
    this.initialized = false;
  }

  /**
   * Initializes the Integration Hub.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing IntegrationHub");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_initialize");
    }

    try {
      // Load configuration
      const maxConcurrentRequests = this.configService ? 
        this.configService.get('reasoning.integrationHub.maxConcurrentRequests', 100) : 100;
      
      const defaultRequestTimeout = this.configService ? 
        this.configService.get('reasoning.integrationHub.defaultRequestTimeout', 30000) : 30000;
      
      this.maxConcurrentRequests = maxConcurrentRequests;
      this.defaultRequestTimeout = defaultRequestTimeout;
      
      this.initialized = true;

      if (this.logger) {
        this.logger.info("IntegrationHub initialized successfully", {
          maxConcurrentRequests,
          defaultRequestTimeout
        });
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("IntegrationHub initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`IntegrationHub initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Ensures the hub is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the hub is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("IntegrationHub is not initialized. Call initialize() first.");
    }
  }

  /**
   * Registers a tentacle with the Integration Hub.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {Object} tentacleInfo - Information about the tentacle
   * @param {string} tentacleInfo.name - Name of the tentacle
   * @param {string} tentacleInfo.version - Version of the tentacle
   * @param {string[]} tentacleInfo.capabilities - Capabilities provided by the tentacle
   * @param {Object} [tentacleInfo.metadata] - Additional metadata about the tentacle
   * @returns {Promise<boolean>} - True if registration was successful
   */
  async registerTentacle(tentacleId, tentacleInfo) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_registerTentacle");
    }

    try {
      // Validate required fields
      if (!tentacleId) {
        throw new Error("Tentacle ID is required");
      }
      
      if (!tentacleInfo.name) {
        throw new Error("Tentacle name is required");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTentacleRegistrationPolicies) {
        await this.securityManager.applyTentacleRegistrationPolicies(tentacleId, tentacleInfo);
      }
      
      // Store tentacle information
      const registrationInfo = {
        ...tentacleInfo,
        registeredAt: Date.now(),
        lastActiveAt: Date.now()
      };
      
      this.registeredTentacles.set(tentacleId, registrationInfo);
      
      // Initialize request tracking
      if (!this.tentacleRequests.has(tentacleId)) {
        this.tentacleRequests.set(tentacleId, new Set());
      }
      
      if (this.logger) {
        this.logger.debug(`Registered tentacle: ${tentacleId}`, { 
          name: tentacleInfo.name,
          version: tentacleInfo.version,
          capabilities: tentacleInfo.capabilities
        });
      }
      
      this.emit("tentacleRegistered", { tentacleId, tentacleInfo: registrationInfo });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to register tentacle: ${error.message}`, { 
          tentacleId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Unregisters a tentacle from the Integration Hub.
   * 
   * @param {string} tentacleId - ID of the tentacle to unregister
   * @returns {Promise<boolean>} - True if unregistration was successful
   */
  async unregisterTentacle(tentacleId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_unregisterTentacle");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTentacleUnregistrationPolicies) {
        await this.securityManager.applyTentacleUnregistrationPolicies(tentacleId);
      }
      
      // Remove tentacle information
      this.registeredTentacles.delete(tentacleId);
      
      // Remove context data
      this.tentacleContexts.delete(tentacleId);
      
      // Clean up request tracking
      this.tentacleRequests.delete(tentacleId);
      
      if (this.logger) {
        this.logger.debug(`Unregistered tentacle: ${tentacleId}`);
      }
      
      this.emit("tentacleUnregistered", { tentacleId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to unregister tentacle: ${error.message}`, { 
          tentacleId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Updates the context data for a tentacle.
   * 
   * @param {string} tentacleId - ID of the tentacle
   * @param {Object} contextData - Context data to store
   * @param {boolean} [merge=true] - Whether to merge with existing context or replace it
   * @returns {Promise<boolean>} - True if context update was successful
   */
  async updateTentacleContext(tentacleId, contextData, merge = true) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_updateTentacleContext");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyContextUpdatePolicies) {
        await this.securityManager.applyContextUpdatePolicies(tentacleId, contextData);
      }
      
      // Update context data
      if (merge && this.tentacleContexts.has(tentacleId)) {
        const existingContext = this.tentacleContexts.get(tentacleId);
        this.tentacleContexts.set(tentacleId, {
          ...existingContext,
          ...contextData,
          updatedAt: Date.now()
        });
      } else {
        this.tentacleContexts.set(tentacleId, {
          ...contextData,
          updatedAt: Date.now()
        });
      }
      
      // Update last active timestamp
      const tentacleInfo = this.registeredTentacles.get(tentacleId);
      tentacleInfo.lastActiveAt = Date.now();
      
      if (this.logger) {
        this.logger.debug(`Updated context for tentacle: ${tentacleId}`, { 
          contextKeys: Object.keys(contextData)
        });
      }
      
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update tentacle context: ${error.message}`, { 
          tentacleId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves the context data for a tentacle.
   * 
   * @param {string} tentacleId - ID of the tentacle
   * @returns {Promise<Object>} - Context data for the tentacle
   */
  async getTentacleContext(tentacleId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_getTentacleContext");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyContextAccessPolicies) {
        await this.securityManager.applyContextAccessPolicies(tentacleId);
      }
      
      // Get context data
      const contextData = this.tentacleContexts.get(tentacleId) || {};
      
      return { ...contextData };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get tentacle context: ${error.message}`, { 
          tentacleId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Submits a reasoning task from a tentacle.
   * 
   * @param {string} tentacleId - ID of the tentacle submitting the task
   * @param {Object} taskData - Task data
   * @param {string} taskData.query - The reasoning query or problem statement
   * @param {Object} [taskData.context] - Context information for the reasoning task
   * @param {string[]} [taskData.preferredStrategies] - Preferred reasoning strategies to use
   * @param {Object} [taskData.constraints] - Constraints for the reasoning process
   * @param {Object} [taskData.metadata] - Additional metadata for the task
   * @param {number} [taskData.priority=5] - Task priority (1-10, higher is more important)
   * @param {number} [taskData.timeout] - Timeout in milliseconds (defaults to hub's defaultRequestTimeout)
   * @returns {Promise<string>} - ID of the submitted task
   */
  async submitTask(tentacleId, taskData) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_submitTask");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Check concurrent request limit
      const tentacleRequests = this.tentacleRequests.get(tentacleId);
      if (tentacleRequests.size >= this.maxConcurrentRequests) {
        throw new Error(`Maximum concurrent requests exceeded for tentacle: ${tentacleId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskSubmissionPolicies) {
        await this.securityManager.applyTaskSubmissionPolicies(tentacleId, taskData);
      }
      
      // Merge with tentacle context if available
      let mergedContext = { ...taskData.context };
      if (this.tentacleContexts.has(tentacleId)) {
        const tentacleContext = this.tentacleContexts.get(tentacleId);
        mergedContext = {
          ...tentacleContext,
          ...mergedContext,
          _tentacleContext: true
        };
      }
      
      // Update task data with tentacle information
      const enhancedTaskData = {
        ...taskData,
        context: mergedContext,
        tentacleId,
        metadata: {
          ...(taskData.metadata || {}),
          tentacleId,
          tentacleName: this.registeredTentacles.get(tentacleId).name
        }
      };
      
      // Submit task to reasoning engine
      const taskId = await this.reasoningEngine.submitTask(enhancedTaskData);
      
      // Track request
      tentacleRequests.add(taskId);
      
      // Update last active timestamp
      const tentacleInfo = this.registeredTentacles.get(tentacleId);
      tentacleInfo.lastActiveAt = Date.now();
      
      // Set up timeout if specified
      const timeout = taskData.timeout || this.defaultRequestTimeout;
      if (timeout > 0) {
        setTimeout(() => {
          this._checkTaskTimeout(taskId, tentacleId, timeout);
        }, timeout);
      }
      
      if (this.logger) {
        this.logger.debug(`Submitted task from tentacle: ${tentacleId}`, { 
          taskId,
          query: taskData.query,
          priority: taskData.priority || 5
        });
      }
      
      this.emit("taskSubmitted", { taskId, tentacleId, taskData: enhancedTaskData });
      return taskId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to submit task from tentacle: ${error.message}`, { 
          tentacleId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves the status and result of a task submitted by a tentacle.
   * 
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} taskId - ID of the task
   * @returns {Promise<Object>} - Task status and result
   */
  async getTaskStatus(tentacleId, taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_getTaskStatus");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Check if task belongs to tentacle
      const tentacleRequests = this.tentacleRequests.get(tentacleId);
      if (!tentacleRequests.has(taskId)) {
        throw new Error(`Task not found for tentacle: ${taskId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskAccessPolicies) {
        await this.securityManager.applyTaskAccessPolicies(tentacleId, taskId);
      }
      
      // Get task status from reasoning engine
      const taskStatus = await this.reasoningEngine.getTaskStatus(taskId);
      
      // Update last active timestamp
      const tentacleInfo = this.registeredTentacles.get(tentacleId);
      tentacleInfo.lastActiveAt = Date.now();
      
      // Clean up completed tasks
      if (taskStatus.status === 'completed' || 
          taskStatus.status === 'failed' || 
          taskStatus.status === 'canceled') {
        tentacleRequests.delete(taskId);
      }
      
      return taskStatus;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get task status for tentacle: ${error.message}`, { 
          tentacleId, 
          taskId,
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Cancels a task submitted by a tentacle.
   * 
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} taskId - ID of the task to cancel
   * @returns {Promise<boolean>} - True if the task was successfully canceled
   */
  async cancelTask(tentacleId, taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_cancelTask");
    }

    try {
      // Check if tentacle is registered
      if (!this.registeredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle not registered: ${tentacleId}`);
      }
      
      // Check if task belongs to tentacle
      const tentacleRequests = this.tentacleRequests.get(tentacleId);
      if (!tentacleRequests.has(taskId)) {
        throw new Error(`Task not found for tentacle: ${taskId}`);
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskCancelPolicies) {
        await this.securityManager.applyTaskCancelPolicies(tentacleId, taskId);
      }
      
      // Cancel task in reasoning engine
      const success = await this.reasoningEngine.cancelTask(taskId);
      
      // Update last active timestamp
      const tentacleInfo = this.registeredTentacles.get(tentacleId);
      tentacleInfo.lastActiveAt = Date.now();
      
      // Clean up if successful
      if (success) {
        tentacleRequests.delete(taskId);
      }
      
      if (this.logger) {
        this.logger.debug(`Canceled task for tentacle: ${tentacleId}`, { taskId, success });
      }
      
      return success;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to cancel task for tentacle: ${error.message}`, { 
          tentacleId, 
          taskId,
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Checks if a task has timed out and cancels it if necessary.
   * 
   * @private
   * @param {string} taskId - ID of the task
   * @param {string} tentacleId - ID of the tentacle
   * @param {number} timeout - Timeout in milliseconds
   */
  async _checkTaskTimeout(taskId, tentacleId, timeout) {
    try {
      // Check if task is still tracked
      const tentacleRequests = this.tentacleRequests.get(tentacleId);
      if (!tentacleRequests || !tentacleRequests.has(taskId)) {
        return; // Task already completed or canceled
      }
      
      // Get task status
      const taskStatus = await this.reasoningEngine.getTaskStatus(taskId);
      
      // Check if task is still in progress
      if (taskStatus.status === 'pending' || taskStatus.status === 'processing') {
        // Task has timed out, cancel it
        await this.reasoningEngine.cancelTask(taskId);
        
        // Clean up
        tentacleRequests.delete(taskId);
        
        if (this.logger) {
          this.logger.warn(`Task timed out for tentacle: ${tentacleId}`, { 
            taskId, 
            timeout 
          });
        }
        
        this.emit("taskTimedOut", { taskId, tentacleId, timeout });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Error checking task timeout: ${error.message}`, { 
          taskId, 
          tentacleId, 
          error: error.stack 
        });
      }
    }
  }

  /**
   * Gets statistics about the Integration Hub.
   * 
   * @returns {Promise<Object>} - Hub statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("integrationHub_getStatistics");
    }

    try {
      // Count active tentacles (active in last hour)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      let activeTentacles = 0;
      
      for (const tentacleInfo of this.registeredTentacles.values()) {
        if (now - tentacleInfo.lastActiveAt < oneHour) {
          activeTentacles++;
        }
      }
      
      // Count active requests
      let activeRequests = 0;
      for (const requests of this.tentacleRequests.values()) {
        activeRequests += requests.size;
      }
      
      // Compile statistics
      const statistics = {
        registeredTentacles: this.registeredTentacles.size,
        activeTentacles,
        activeRequests,
        maxConcurrentRequests: this.maxConcurrentRequests,
        defaultRequestTimeout: this.defaultRequestTimeout
      };
      
      return statistics;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get statistics: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = { IntegrationHub };
