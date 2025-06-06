/**
 * @fileoverview DevMaster Tentacle - Main integration module
 * 
 * The DevMaster Tentacle transforms Aideon into a world-class software architect,
 * developer, and deployment specialist. This tentacle is only available to admin
 * users and those with special invite codes.
 */

const { EventEmitter } = require('../../core/events/EventEmitter');
const { Logger } = require('../../core/logging/Logger');
const { TentacleBase } = require('../../core/tentacles/TentacleBase');
const { AccessControlService } = require('../../core/security/AccessControlService');
const { CodeBrainManager } = require('./code_brain/CodeBrainManager');
const { VisualMindManager } = require('./visual_mind/VisualMindManager');
const { DeployHandManager } = require('./deploy_hand/DeployHandManager');
const { CollabInterfaceManager } = require('./collab_interface/CollabInterfaceManager');
const { LifecycleManager } = require('./lifecycle_manager/LifecycleManager');

/**
 * DevMasterTentacle class - Main tentacle implementation
 * @extends TentacleBase
 */
class DevMasterTentacle extends TentacleBase {
  /**
   * Create a new DevMasterTentacle instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super({
      id: 'devmaster',
      name: 'DevMaster',
      description: 'Autonomous Software Development Specialist',
      version: '1.0.0',
      ...options
    });

    this.logger = new Logger('DevMasterTentacle');
    this.events = new EventEmitter();
    
    // Initialize component references (actual initialization happens in initialize())
    this.accessControl = null;
    this.codeBrain = null;
    this.visualMind = null;
    this.deployHand = null;
    this.collabInterface = null;
    this.lifecycleManager = null;
    
    // Register event handlers
    this._registerEventHandlers();
  }

  /**
   * Initialize the tentacle
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('DevMaster Tentacle is already initialized');
      return;
    }
    
    this.logger.info('Initializing DevMaster Tentacle');
    
    try {
      // Get configuration namespace
      const config = this.aideon.config.getNamespace('tentacles.devmaster');
      
      // Initialize components in sequence with proper dependency management
      await this._initializeAccessControl(config);
      await this._initializeSubComponents(config);
      
      // Register API endpoints and metrics after components are initialized
      this._registerApiEndpoints();
      this._registerWithMetrics();
      
      this.logger.info('DevMaster Tentacle initialized successfully');
      this.initialized = true;
      
      // Emit initialization event
      this.events.emit('initialized', {
        tentacleId: this.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Failed to initialize DevMaster Tentacle', error);
      throw error;
    }
  }

  /**
   * Check if a user has access to this tentacle
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - Whether the user has access
   */
  async hasAccess(userId) {
    this._ensureInitialized();
    return this.accessControl.hasAccess(userId);
  }

  /**
   * Generate an invite code for a user
   * @param {string} adminId - Admin user ID generating the invite
   * @param {Object} options - Invite options
   * @returns {Promise<Object>} - Generated invite code
   */
  async generateInviteCode(adminId, options = {}) {
    this._ensureInitialized();
    return this.accessControl.generateInviteCode(adminId, options);
  }

  /**
   * Redeem an invite code for a user
   * @param {string} userId - User ID redeeming the invite
   * @param {string} code - Invite code to redeem
   * @returns {Promise<boolean>} - Whether redemption was successful
   */
  async redeemInviteCode(userId, code) {
    this._ensureInitialized();
    return this.accessControl.redeemInviteCode(userId, code);
  }

  /**
   * Execute a development task
   * @param {Object} task - Task to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Task result
   */
  async executeTask(task, context) {
    this._ensureInitialized();
    
    // Verify user access
    if (!await this.hasAccess(context.userId)) {
      throw new Error('Access denied to DevMaster Tentacle');
    }
    
    this.logger.info(`Executing task: ${task.type}`);
    
    try {
      // Create execution context
      const executionContext = {
        ...context,
        tentacle: this,
        task,
        startTime: Date.now()
      };
      
      // Emit task start event
      this.events.emit('task:start', {
        taskId: task.id,
        taskType: task.type,
        userId: context.userId,
        timestamp: executionContext.startTime
      });
      
      // Route task to appropriate component
      let result;
      
      switch (task.type) {
        case 'code':
          result = await this.codeBrain.executeTask(task, executionContext);
          break;
        case 'ui':
          result = await this.visualMind.designUI(task, executionContext);
          break;
        case 'deploy':
          result = await this.deployHand.deployApplication(task, executionContext);
          break;
        case 'collab':
          result = await this.collabInterface.createCollaborationSession(task, executionContext);
          break;
        case 'lifecycle':
          result = await this.lifecycleManager.manageLifecycle(task, executionContext);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - executionContext.startTime;
      
      // Emit task complete event
      this.events.emit('task:complete', {
        taskId: task.id,
        taskType: task.type,
        userId: context.userId,
        executionTime,
        success: true,
        timestamp: Date.now()
      });
      
      // Track metrics
      this.aideon.metrics.trackEvent('devmaster:task:complete', {
        taskId: task.id,
        taskType: task.type,
        executionTime,
        success: true
      });
      
      return {
        success: true,
        executionTime,
        result
      };
    } catch (error) {
      this.logger.error(`Task execution failed: ${error.message}`, error);
      
      // Emit task error event
      this.events.emit('task:error', {
        taskId: task.id,
        taskType: task.type,
        userId: context.userId,
        error: error.message,
        timestamp: Date.now()
      });
      
      // Track metrics
      this.aideon.metrics.trackEvent('devmaster:task:error', {
        taskId: task.id,
        taskType: task.type,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get the status of the tentacle
   * @returns {Object} - Status object
   */
  getStatus() {
    const status = {
      id: this.id,
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      components: {}
    };
    
    // Add access control status
    if (this.accessControl) {
      status.adminOnly = this.accessControl.adminOnly;
      status.inviteEnabled = this.accessControl.inviteEnabled;
      status.activeInvites = this.accessControl.getActiveInviteCount();
    }
    
    // Add component statuses if initialized
    if (this.initialized) {
      if (this.codeBrain) {
        status.components.codeBrain = this.codeBrain.getStatus();
      }
      
      if (this.visualMind) {
        status.components.visualMind = this.visualMind.getStatus();
      }
      
      if (this.deployHand) {
        status.components.deployHand = this.deployHand.getStatus();
      }
      
      if (this.collabInterface) {
        status.components.collabInterface = this.collabInterface.getStatus();
      }
      
      if (this.lifecycleManager) {
        status.components.lifecycleManager = this.lifecycleManager.getStatus();
      }
    }
    
    return status;
  }

  /**
   * Shutdown the tentacle
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('DevMaster Tentacle is not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down DevMaster Tentacle');
    
    try {
      // Shutdown sub-components in reverse initialization order
      const shutdownPromises = [];
      
      if (this.lifecycleManager) {
        shutdownPromises.push(this.lifecycleManager.shutdown());
      }
      
      if (this.collabInterface) {
        shutdownPromises.push(this.collabInterface.shutdown());
      }
      
      if (this.deployHand) {
        shutdownPromises.push(this.deployHand.shutdown());
      }
      
      if (this.visualMind) {
        shutdownPromises.push(this.visualMind.shutdown());
      }
      
      if (this.codeBrain) {
        shutdownPromises.push(this.codeBrain.shutdown());
      }
      
      // Wait for all components to shut down
      await Promise.all(shutdownPromises);
      
      // Clean up resources
      this.initialized = false;
      
      this.logger.info('DevMaster Tentacle shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', {
        tentacleId: this.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Error during DevMaster Tentacle shutdown', error);
      throw error;
    }
  }

  /**
   * Initialize access control
   * @param {Object} config - Configuration namespace
   * @returns {Promise<void>}
   * @private
   */
  async _initializeAccessControl(config) {
    this.logger.info('Initializing access control');
    
    // Create access control service
    this.accessControl = new AccessControlService({
      tentacleId: this.id,
      config: config.getNamespace('accessControl'),
      auth: this.aideon.auth,
      logger: new Logger('DevMaster:AccessControl'),
      events: this.events
    });
    
    // Initialize access control
    await this.accessControl.initialize();
    
    this.logger.info('Access control initialized successfully');
  }

  /**
   * Initialize sub-components
   * @param {Object} config - Configuration namespace
   * @returns {Promise<void>}
   * @private
   */
  async _initializeSubComponents(config) {
    this.logger.info('Initializing sub-components');
    
    // Create component instances
    this.codeBrain = new CodeBrainManager({
      tentacle: this,
      config: config.getNamespace('codeBrain'),
      events: this.events
    });
    
    this.visualMind = new VisualMindManager({
      tentacle: this,
      config: config.getNamespace('visualMind'),
      events: this.events
    });
    
    this.deployHand = new DeployHandManager({
      tentacle: this,
      config: config.getNamespace('deployHand'),
      events: this.events
    });
    
    this.collabInterface = new CollabInterfaceManager({
      tentacle: this,
      config: config.getNamespace('collabInterface'),
      events: this.events
    });
    
    // Initialize components in parallel for efficiency
    await Promise.all([
      this.codeBrain.initialize(),
      this.visualMind.initialize(),
      this.deployHand.initialize(),
      this.collabInterface.initialize()
    ]);
    
    // Initialize lifecycle manager after other components
    // since it depends on them
    this.lifecycleManager = new LifecycleManager({
      tentacle: this,
      config: config.getNamespace('lifecycleManager'),
      events: this.events,
      components: {
        codeBrain: this.codeBrain,
        visualMind: this.visualMind,
        deployHand: this.deployHand,
        collabInterface: this.collabInterface
      }
    });
    
    await this.lifecycleManager.initialize();
    
    this.logger.info('All sub-components initialized successfully');
  }

  /**
   * Register API endpoints
   * @private
   */
  _registerApiEndpoints() {
    this.logger.info('Registering API endpoints');
    
    // Register tentacle-level endpoints
    this.api.register('devmaster/status', this._handleStatusRequest.bind(this));
    this.api.register('devmaster/invite/generate', this._handleGenerateInviteRequest.bind(this));
    this.api.register('devmaster/invite/redeem', this._handleRedeemInviteRequest.bind(this));
    this.api.register('devmaster/task/execute', this._handleExecuteTaskRequest.bind(this));
    
    // Register component endpoints
    this.codeBrain.registerApiEndpoints();
    this.visualMind.registerApiEndpoints();
    this.deployHand.registerApiEndpoints();
    this.collabInterface.registerApiEndpoints();
    this.lifecycleManager.registerApiEndpoints();
    
    this.logger.info('API endpoints registered successfully');
  }

  /**
   * Register with metrics system
   * @private
   */
  _registerWithMetrics() {
    this.logger.info('Registering with metrics system');
    
    // Register tentacle metrics
    this.aideon.metrics.registerTentacle(this.id, {
      name: this.name,
      version: this.version,
      type: 'development',
      metrics: [
        {
          id: 'task_execution_time',
          name: 'Task Execution Time',
          description: 'Time taken to execute development tasks',
          unit: 'ms',
          aggregation: 'average'
        },
        {
          id: 'task_success_rate',
          name: 'Task Success Rate',
          description: 'Percentage of successfully completed tasks',
          unit: 'percent',
          aggregation: 'average'
        },
        {
          id: 'active_users',
          name: 'Active Users',
          description: 'Number of users actively using the DevMaster tentacle',
          unit: 'count',
          aggregation: 'max'
        }
      ]
    });
    
    this.logger.info('Metrics registration complete');
  }

  /**
   * Register event handlers
   * @private
   */
  _registerEventHandlers() {
    // Task events
    this.events.on('task:start', this._onTaskStart.bind(this));
    this.events.on('task:complete', this._onTaskComplete.bind(this));
    this.events.on('task:error', this._onTaskError.bind(this));
    
    // Invite events
    this.events.on('invite:generated', this._onInviteGenerated.bind(this));
    this.events.on('invite:redeemed', this._onInviteRedeemed.bind(this));
    
    // System events
    this.events.on('system:shutdown', this.shutdown.bind(this));
  }

  /**
   * Ensure the tentacle is initialized
   * @private
   * @throws {Error} If tentacle is not initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('DevMaster Tentacle is not initialized');
    }
  }

  /**
   * Handle status request
   * @param {Object} request - API request
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _handleStatusRequest(request) {
    try {
      const { userId } = request;
      
      // Check access for detailed status
      const hasAccess = await this.hasAccess(userId);
      
      // Get status (filtered if no access)
      const status = this.getStatus();
      
      if (!hasAccess) {
        // Return limited status for non-authorized users
        return {
          status: 'success',
          data: {
            id: status.id,
            name: status.name,
            version: status.version,
            adminOnly: status.adminOnly,
            inviteEnabled: status.inviteEnabled
          }
        };
      }
      
      return {
        status: 'success',
        data: status
      };
    } catch (error) {
      this.logger.error('Error handling status request', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Handle generate invite request
   * @param {Object} request - API request
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _handleGenerateInviteRequest(request) {
    try {
      const { userId, options } = request;
      
      // Generate invite code
      const invite = await this.generateInviteCode(userId, options);
      
      return {
        status: 'success',
        data: invite
      };
    } catch (error) {
      this.logger.error('Error handling generate invite request', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Handle redeem invite request
   * @param {Object} request - API request
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _handleRedeemInviteRequest(request) {
    try {
      const { userId, code } = request;
      
      // Redeem invite code
      const success = await this.redeemInviteCode(userId, code);
      
      return {
        status: success ? 'success' : 'error',
        message: success ? 'Invite code redeemed successfully' : 'Invalid or expired invite code'
      };
    } catch (error) {
      this.logger.error('Error handling redeem invite request', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Handle execute task request
   * @param {Object} request - API request
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _handleExecuteTaskRequest(request) {
    try {
      const { userId, task } = request;
      
      // Execute task
      const result = await this.executeTask(task, { userId });
      
      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      this.logger.error('Error handling execute task request', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Handle task start event
   * @param {Object} event - Event data
   * @private
   */
  _onTaskStart(event) {
    // Update active users metric
    this.aideon.metrics.trackMetric('devmaster:active_users', 1, {
      userId: event.userId,
      taskType: event.taskType
    });
  }

  /**
   * Handle task complete event
   * @param {Object} event - Event data
   * @private
   */
  _onTaskComplete(event) {
    // Track execution time metric
    this.aideon.metrics.trackMetric('devmaster:task_execution_time', event.executionTime, {
      taskType: event.taskType,
      userId: event.userId
    });
    
    // Track success rate metric
    this.aideon.metrics.trackMetric('devmaster:task_success_rate', 100, {
      taskType: event.taskType,
      userId: event.userId
    });
  }

  /**
   * Handle task error event
   * @param {Object} event - Event data
   * @private
   */
  _onTaskError(event) {
    // Track success rate metric (0% for error)
    this.aideon.metrics.trackMetric('devmaster:task_success_rate', 0, {
      taskType: event.taskType,
      userId: event.userId,
      error: event.error
    });
  }

  /**
   * Handle invite generated event
   * @param {Object} event - Event data
   * @private
   */
  _onInviteGenerated(event) {
    // Track invite generation
    this.aideon.metrics.trackEvent('devmaster:invite:generated', {
      adminId: event.adminId,
      expiresAt: event.expiresAt,
      maxUses: event.maxUses
    });
  }

  /**
   * Handle invite redeemed event
   * @param {Object} event - Event data
   * @private
   */
  _onInviteRedeemed(event) {
    // Track invite redemption
    this.aideon.metrics.trackEvent('devmaster:invite:redeemed', {
      userId: event.userId
    });
  }
}

module.exports = { DevMasterTentacle };
