/**
 * @fileoverview DevMaster Tentacle - Main entry point
 * 
 * The DevMaster Tentacle is a specialized autonomous development system that transforms
 * Aideon into a world-class software architect, developer, and deployment specialist.
 * This tentacle is designed for admin access with invite-only extensions for special users.
 */

const { TentacleBase } = require('../../core/tentacle/TentacleBase');
const { PermissionManager } = require('../../core/security/PermissionManager');
const { ConfigurationManager } = require('../../core/config/enhanced/EnhancedConfigurationManager');
const { EventEmitter } = require('../../core/events/EventEmitter');

// Import sub-tentacle managers
const { CodeBrainManager } = require('./code_brain/CodeBrainManager');
const { VisualMindManager } = require('./visual_mind/VisualMindManager');
const { DeployHandManager } = require('./deploy_hand/DeployHandManager');
const { CollabInterfaceManager } = require('./collab_interface/CollabInterfaceManager');
const { LifecycleManager } = require('./lifecycle_manager/LifecycleManager');

/**
 * DevMasterTentacle class - Main controller for the DevMaster tentacle
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
      description: 'Autonomous software development specialist',
      version: '1.0.0',
      ...options
    });

    // Initialize configuration
    this.config = new ConfigurationManager('tentacles.devmaster');
    
    // Initialize event system
    this.events = new EventEmitter();
    
    // Initialize permission system
    this.permissionManager = new PermissionManager({
      tentacleId: this.id,
      adminOnly: true,
      inviteEnabled: true
    });

    // Initialize sub-tentacles
    this.codeBrain = new CodeBrainManager({
      tentacle: this,
      config: this.config.getNamespace('codeBrain'),
      events: this.events
    });

    this.visualMind = new VisualMindManager({
      tentacle: this,
      config: this.config.getNamespace('visualMind'),
      events: this.events
    });

    this.deployHand = new DeployHandManager({
      tentacle: this,
      config: this.config.getNamespace('deployHand'),
      events: this.events
    });

    this.collabInterface = new CollabInterfaceManager({
      tentacle: this,
      config: this.config.getNamespace('collabInterface'),
      events: this.events
    });

    this.lifecycleManager = new LifecycleManager({
      tentacle: this,
      config: this.config.getNamespace('lifecycleManager'),
      events: this.events
    });

    // Register event handlers
    this._registerEventHandlers();
  }

  /**
   * Initialize the DevMaster tentacle
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing DevMaster Tentacle');
    
    try {
      // Initialize permission system
      await this.permissionManager.initialize();
      
      // Initialize sub-tentacles
      await Promise.all([
        this.codeBrain.initialize(),
        this.visualMind.initialize(),
        this.deployHand.initialize(),
        this.collabInterface.initialize(),
        this.lifecycleManager.initialize()
      ]);
      
      // Register API endpoints
      this._registerApiEndpoints();
      
      this.logger.info('DevMaster Tentacle initialized successfully');
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize DevMaster Tentacle', error);
      throw error;
    }
  }

  /**
   * Check if a user has access to the DevMaster tentacle
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - True if user has access
   */
  async hasAccess(userId) {
    return this.permissionManager.hasAccess(userId);
  }

  /**
   * Generate an invite code for a user
   * @param {string} adminId - Admin user ID
   * @param {string} targetUserId - Target user ID
   * @param {Object} permissions - Permission settings
   * @returns {Promise<string>} - Invite code
   */
  async generateInviteCode(adminId, targetUserId, permissions) {
    if (!await this.permissionManager.isAdmin(adminId)) {
      throw new Error('Only admins can generate invite codes');
    }
    
    return this.permissionManager.generateInviteCode(targetUserId, permissions);
  }

  /**
   * Redeem an invite code
   * @param {string} userId - User ID
   * @param {string} inviteCode - Invite code
   * @returns {Promise<boolean>} - True if successful
   */
  async redeemInviteCode(userId, inviteCode) {
    return this.permissionManager.redeemInviteCode(userId, inviteCode);
  }

  /**
   * Register event handlers
   * @private
   */
  _registerEventHandlers() {
    // Handle system events
    this.events.on('system:shutdown', this._handleSystemShutdown.bind(this));
    
    // Handle user events
    this.events.on('user:login', this._handleUserLogin.bind(this));
    this.events.on('user:logout', this._handleUserLogout.bind(this));
    
    // Handle project events
    this.events.on('project:created', this._handleProjectCreated.bind(this));
    this.events.on('project:updated', this._handleProjectUpdated.bind(this));
    this.events.on('project:deleted', this._handleProjectDeleted.bind(this));
  }

  /**
   * Register API endpoints
   * @private
   */
  _registerApiEndpoints() {
    // Register main DevMaster API endpoints
    this.api.register('devmaster/status', this._handleStatusRequest.bind(this));
    this.api.register('devmaster/access', this._handleAccessRequest.bind(this));
    this.api.register('devmaster/invite', this._handleInviteRequest.bind(this));
    
    // Register sub-tentacle API endpoints
    this.codeBrain.registerApiEndpoints();
    this.visualMind.registerApiEndpoints();
    this.deployHand.registerApiEndpoints();
    this.collabInterface.registerApiEndpoints();
    this.lifecycleManager.registerApiEndpoints();
  }

  /**
   * Handle system shutdown event
   * @private
   */
  async _handleSystemShutdown() {
    this.logger.info('Shutting down DevMaster Tentacle');
    
    try {
      // Shutdown sub-tentacles
      await Promise.all([
        this.codeBrain.shutdown(),
        this.visualMind.shutdown(),
        this.deployHand.shutdown(),
        this.collabInterface.shutdown(),
        this.lifecycleManager.shutdown()
      ]);
      
      this.logger.info('DevMaster Tentacle shutdown complete');
    } catch (error) {
      this.logger.error('Error during DevMaster Tentacle shutdown', error);
    }
  }

  /**
   * Handle user login event
   * @param {Object} data - Event data
   * @private
   */
  async _handleUserLogin(data) {
    const { userId } = data;
    const hasAccess = await this.hasAccess(userId);
    
    if (hasAccess) {
      this.logger.info(`User ${userId} logged in with DevMaster access`);
      this.events.emit('devmaster:user:login', { userId });
    }
  }

  /**
   * Handle user logout event
   * @param {Object} data - Event data
   * @private
   */
  async _handleUserLogout(data) {
    const { userId } = data;
    const hasAccess = await this.hasAccess(userId);
    
    if (hasAccess) {
      this.logger.info(`User ${userId} with DevMaster access logged out`);
      this.events.emit('devmaster:user:logout', { userId });
    }
  }

  /**
   * Handle project created event
   * @param {Object} data - Event data
   * @private
   */
  async _handleProjectCreated(data) {
    const { projectId, userId } = data;
    const hasAccess = await this.hasAccess(userId);
    
    if (hasAccess) {
      this.logger.info(`Project ${projectId} created by user ${userId} with DevMaster access`);
      this.events.emit('devmaster:project:created', data);
    }
  }

  /**
   * Handle project updated event
   * @param {Object} data - Event data
   * @private
   */
  async _handleProjectUpdated(data) {
    const { projectId, userId } = data;
    const hasAccess = await this.hasAccess(userId);
    
    if (hasAccess) {
      this.logger.info(`Project ${projectId} updated by user ${userId} with DevMaster access`);
      this.events.emit('devmaster:project:updated', data);
    }
  }

  /**
   * Handle project deleted event
   * @param {Object} data - Event data
   * @private
   */
  async _handleProjectDeleted(data) {
    const { projectId, userId } = data;
    const hasAccess = await this.hasAccess(userId);
    
    if (hasAccess) {
      this.logger.info(`Project ${projectId} deleted by user ${userId} with DevMaster access`);
      this.events.emit('devmaster:project:deleted', data);
    }
  }

  /**
   * Handle status request
   * @param {Object} request - API request
   * @returns {Object} - Status response
   * @private
   */
  async _handleStatusRequest(request) {
    const { userId } = request;
    
    if (!await this.hasAccess(userId)) {
      return {
        status: 'error',
        message: 'Access denied'
      };
    }
    
    return {
      status: 'success',
      data: {
        initialized: this.initialized,
        version: this.version,
        subTentacles: {
          codeBrain: this.codeBrain.getStatus(),
          visualMind: this.visualMind.getStatus(),
          deployHand: this.deployHand.getStatus(),
          collabInterface: this.collabInterface.getStatus(),
          lifecycleManager: this.lifecycleManager.getStatus()
        }
      }
    };
  }

  /**
   * Handle access request
   * @param {Object} request - API request
   * @returns {Object} - Access response
   * @private
   */
  async _handleAccessRequest(request) {
    const { userId } = request;
    const hasAccess = await this.hasAccess(userId);
    
    return {
      status: 'success',
      data: {
        hasAccess,
        isAdmin: hasAccess ? await this.permissionManager.isAdmin(userId) : false,
        permissions: hasAccess ? await this.permissionManager.getUserPermissions(userId) : {}
      }
    };
  }

  /**
   * Handle invite request
   * @param {Object} request - API request
   * @returns {Object} - Invite response
   * @private
   */
  async _handleInviteRequest(request) {
    const { userId, targetUserId, permissions } = request;
    
    try {
      if (!await this.permissionManager.isAdmin(userId)) {
        return {
          status: 'error',
          message: 'Only admins can generate invite codes'
        };
      }
      
      const inviteCode = await this.generateInviteCode(userId, targetUserId, permissions);
      
      return {
        status: 'success',
        data: {
          inviteCode,
          targetUserId,
          permissions
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = { DevMasterTentacle };
