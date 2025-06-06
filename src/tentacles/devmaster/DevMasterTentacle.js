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
    
    // Access control
    this.adminOnly = true;
    this.inviteEnabled = true;
    this.inviteCodes = new Map();
    
    // Initialize sub-components
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
    this.logger.info('Initializing DevMaster Tentacle');
    
    try {
      // Get configuration namespace
      const config = this.aideon.config.getNamespace('tentacles.devmaster');
      
      // Initialize access control
      await this._initializeAccessControl(config);
      
      // Initialize sub-components
      await this._initializeSubComponents(config);
      
      // Register API endpoints
      this._registerApiEndpoints();
      
      // Register with metrics system
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
    // Check if user is admin
    const isAdmin = await this.aideon.auth.isAdmin(userId);
    if (isAdmin) {
      return true;
    }
    
    // Check if user has a valid invite code
    const userInviteCode = await this.aideon.auth.getUserAttribute(userId, 'devmasterInviteCode');
    if (userInviteCode && this.inviteCodes.has(userInviteCode)) {
      const invite = this.inviteCodes.get(userInviteCode);
      
      // Check if invite is still valid
      if (invite.expiresAt > Date.now()) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate an invite code for a user
   * @param {string} adminId - Admin user ID generating the invite
   * @param {Object} options - Invite options
   * @returns {Promise<Object>} - Generated invite code
   */
  async generateInviteCode(adminId, options = {}) {
    // Verify admin status
    const isAdmin = await this.aideon.auth.isAdmin(adminId);
    if (!isAdmin) {
      throw new Error('Only admin users can generate invite codes');
    }
    
    // Generate a unique code
    const code = `DM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
    
    // Set expiration (default: 7 days)
    const expiresIn = options.expiresIn || 7 * 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + expiresIn;
    
    // Store the invite code
    this.inviteCodes.set(code, {
      code,
      createdBy: adminId,
      createdAt: Date.now(),
      expiresAt,
      maxUses: options.maxUses || 1,
      uses: 0,
      metadata: options.metadata || {}
    });
    
    // Save to persistent storage
    await this._saveInviteCodes();
    
    return {
      code,
      expiresAt,
      maxUses: options.maxUses || 1
    };
  }

  /**
   * Redeem an invite code for a user
   * @param {string} userId - User ID redeeming the invite
   * @param {string} code - Invite code to redeem
   * @returns {Promise<boolean>} - Whether redemption was successful
   */
  async redeemInviteCode(userId, code) {
    // Check if code exists
    if (!this.inviteCodes.has(code)) {
      return false;
    }
    
    const invite = this.inviteCodes.get(code);
    
    // Check if code is expired
    if (invite.expiresAt <= Date.now()) {
      return false;
    }
    
    // Check if code has reached max uses
    if (invite.maxUses !== -1 && invite.uses >= invite.maxUses) {
      return false;
    }
    
    // Increment usage count
    invite.uses += 1;
    
    // Save to persistent storage
    await this._saveInviteCodes();
    
    // Set user attribute
    await this.aideon.auth.setUserAttribute(userId, 'devmasterInviteCode', code);
    
    // Emit event
    this.events.emit('invite:redeemed', {
      userId,
      code,
      timestamp: Date.now()
    });
    
    return true;
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
      adminOnly: this.adminOnly,
      inviteEnabled: this.inviteEnabled,
      activeInvites: this.inviteCodes.size,
      components: {}
    };
    
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
    this.logger.info('Shutting down DevMaster Tentacle');
    
    try {
      // Shutdown sub-components
      if (this.codeBrain) {
        await this.codeBrain.shutdown();
      }
      
      if (this.visualMind) {
        await this.visualMind.shutdown();
      }
      
      if (this.deployHand) {
        await this.deployHand.shutdown();
      }
      
      if (this.collabInterface) {
        await this.collabInterface.shutdown();
      }
      
      if (this.lifecycleManager) {
        await this.lifecycleManager.shutdown();
      }
      
      this.initialized = false;
      this.logger.info('DevMaster Tentacle shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', {
        tentacleId: this.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Error during DevMaster Tentacle shutdown', error);
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
    
    // Get access control configuration
    this.adminOnly = config.get('adminOnly', true);
    this.inviteEnabled = config.get('inviteEnabled', true);
    
    // Load saved invite codes
    const savedInviteCodes = config.get('inviteCodes', []);
    
    for (const invite of savedInviteCodes) {
      this.inviteCodes.set(invite.code, invite);
    }
    
    this.logger.info(`Loaded ${this.inviteCodes.size} invite codes`);
  }

  /**
   * Initialize sub-components
   * @param {Object} config - Configuration namespace
   * @returns {Promise<void>}
   * @private
   */
  async _initializeSubComponents(config) {
    this.logger.info('Initializing sub-components');
    
    // Initialize Code Brain
    this.codeBrain = new CodeBrainManager({
      tentacle: this,
      config: config.getNamespace('codeBrain'),
      events: this.events
    });
    await this.codeBrain.initialize();
    
    // Initialize Visual Mind
    this.visualMind = new VisualMindManager({
      tentacle: this,
      config: config.getNamespace('visualMind'),
      events: this.events
    });
    await this.visualMind.initialize();
    
    // Initialize Deploy Hand
    this.deployHand = new DeployHandManager({
      tentacle: this,
      config: config.getNamespace('deployHand'),
      events: this.events
    });
    await this.deployHand.initialize();
    
    // Initialize Collab Interface
    this.collabInterface = new CollabInterfaceManager({
      tentacle: this,
      config: config.getNamespace('collabInterface'),
      events: this.events
    });
    await this.collabInterface.initialize();
    
    // Initialize Lifecycle Manager
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
  }

  /**
   * Save invite codes to persistent storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveInviteCodes() {
    try {
      const config = this.aideon.config.getNamespace('tentacles.devmaster');
      await config.set('inviteCodes', Array.from(this.inviteCodes.values()));
    } catch (error) {
      this.logger.error('Failed to save invite codes', error);
      throw error;
    }
  }

  /**
   * Ensure the tentacle is initialized
   * @private
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
      
      // Emit event
      this.events.emit('invite:generated', {
        adminId: userId,
        code: invite.code,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        timestamp: Date.now()
      });
      
      return {
        status: 'success',
        data: invite
      };
    } catch (error) {
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
