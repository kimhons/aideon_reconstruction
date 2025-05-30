/**
 * @fileoverview TeamContextSharingManager for secure context sharing between team members.
 * 
 * This module provides a comprehensive system for secure and controlled sharing of context
 * between team members in enterprise environments. It implements role-based access control,
 * real-time context updates, conflict resolution, audit logging, and granular permissions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * TeamContextSharingManager enables secure and controlled sharing of context between team members.
 */
class TeamContextSharingManager extends EventEmitter {
  /**
   * Constructor for TeamContextSharingManager.
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.mcpContextManager MCP Context Manager instance
   * @param {Object} dependencies.contextSecurityManager Context Security Manager instance
   * @param {Object} dependencies.contextFusionEngine Context Fusion Engine instance
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.configService Configuration Service instance
   * @param {Object} dependencies.lockAdapter Lock Adapter for thread safety
   */
  constructor(dependencies) {
    super();
    
    // Validate dependencies
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    
    const {
      mcpContextManager,
      contextSecurityManager,
      contextFusionEngine,
      logger,
      performanceMonitor,
      configService,
      lockAdapter
    } = dependencies;
    
    if (!mcpContextManager) {
      throw new Error('MCP Context Manager is required');
    }
    
    if (!contextSecurityManager) {
      throw new Error('Context Security Manager is required');
    }
    
    if (!contextFusionEngine) {
      throw new Error('Context Fusion Engine is required');
    }
    
    if (!logger) {
      throw new Error('Logger is required');
    }
    
    if (!performanceMonitor) {
      throw new Error('Performance Monitor is required');
    }
    
    if (!configService) {
      throw new Error('Configuration Service is required');
    }
    
    if (!lockAdapter) {
      throw new Error('Lock Adapter is required');
    }
    
    // Store dependencies
    this.mcpContextManager = mcpContextManager;
    this.contextSecurityManager = contextSecurityManager;
    this.contextFusionEngine = contextFusionEngine;
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.configService = configService;
    
    // Initialize locks for thread safety
    this.locks = {
      sharing: lockAdapter.createLock('teamContextSharing'),
      workspace: lockAdapter.createLock('teamWorkspace'),
      permissions: lockAdapter.createLock('teamPermissions'),
      audit: lockAdapter.createLock('teamAudit')
    };
    
    // Initialize state
    this.initialized = false;
    this.teamWorkspaces = new Map();
    this.sharedContexts = new Map();
    this.userRoles = new Map();
    this.permissionSets = new Map();
    this.auditLog = [];
    this.activeShares = new Map();
    this.conflictResolutionStrategies = new Map();
    
    // Configure from service
    this.config = this.configService.getConfig('teamContextSharing') || {
      maxWorkspaces: 100,
      maxSharedContextsPerWorkspace: 1000,
      auditLogRetentionDays: 90,
      enableRealTimeUpdates: true,
      conflictResolutionStrategy: 'last-write-wins',
      maxAuditLogSize: 10000,
      shareExpirationEnabled: true,
      defaultShareExpirationHours: 24
    };
    
    this.logger.info('TeamContextSharingManager created');
  }
  
  /**
   * Initialize the team context sharing manager.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        this.logger.warn('TeamContextSharingManager already initialized');
        return true;
      }
      
      this.logger.info('Initializing TeamContextSharingManager');
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('teamContextSharingInit');
      
      // Register with MCP Context Manager
      await this.mcpContextManager.registerContextProvider('team.sharing', this);
      
      // Initialize conflict resolution strategies
      this._initializeConflictResolutionStrategies();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Load existing workspaces if any
      await this._loadExistingWorkspaces();
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfTimer);
      
      this.initialized = true;
      this.logger.info('TeamContextSharingManager initialized successfully');
      
      // Emit initialization event
      this.emit('initialized', {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize TeamContextSharingManager: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Create a new team workspace.
   * @param {string} workspaceId Unique identifier for the workspace
   * @param {Object} options Workspace options
   * @param {string} options.name Workspace name
   * @param {string} options.description Workspace description
   * @param {string} options.owner Workspace owner user ID
   * @param {Array<Object>} options.members Initial workspace members with roles
   * @returns {Promise<Object>} Created workspace
   */
  async createWorkspace(workspaceId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      
      this.logger.debug(`Creating team workspace: ${workspaceId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('createTeamWorkspace');
      
      // Use lock to ensure thread safety
      return await this.locks.workspace('createWorkspace', async () => {
        // Check if workspace already exists
        if (this.teamWorkspaces.has(workspaceId)) {
          throw new Error(`Workspace already exists: ${workspaceId}`);
        }
        
        // Check workspace limit
        if (this.teamWorkspaces.size >= this.config.maxWorkspaces) {
          throw new Error(`Maximum number of workspaces reached: ${this.config.maxWorkspaces}`);
        }
        
        // Create workspace
        const workspace = {
          id: workspaceId,
          name: options.name || workspaceId,
          description: options.description || '',
          owner: options.owner,
          created: Date.now(),
          updated: Date.now(),
          members: new Map(),
          sharedContexts: new Map()
        };
        
        // Add initial members if provided
        if (Array.isArray(options.members)) {
          for (const member of options.members) {
            if (member.userId && member.role) {
              workspace.members.set(member.userId, {
                role: member.role,
                added: Date.now(),
                addedBy: options.owner
              });
            }
          }
        }
        
        // Always add owner as admin if not already added
        if (options.owner && !workspace.members.has(options.owner)) {
          workspace.members.set(options.owner, {
            role: 'admin',
            added: Date.now(),
            addedBy: 'system'
          });
        }
        
        // Store workspace
        this.teamWorkspaces.set(workspaceId, workspace);
        
        // Log audit event
        await this._addAuditLog({
          action: 'workspace_created',
          workspaceId,
          userId: options.owner,
          timestamp: Date.now(),
          details: {
            name: workspace.name,
            description: workspace.description
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('workspaceCreated', {
          workspaceId,
          owner: options.owner,
          timestamp: Date.now()
        });
        
        this.logger.info(`Team workspace created: ${workspaceId}`);
        
        // Return workspace (without internal maps)
        return {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          owner: workspace.owner,
          created: workspace.created,
          updated: workspace.updated,
          members: Array.from(workspace.members.entries()).map(([userId, data]) => ({
            userId,
            role: data.role,
            added: data.added,
            addedBy: data.addedBy
          })),
          sharedContextCount: workspace.sharedContexts.size
        };
      });
    } catch (error) {
      this.logger.error(`Failed to create team workspace: ${error.message}`, { error, workspaceId });
      throw error;
    }
  }
  
  /**
   * Share context with a team workspace.
   * @param {string} workspaceId Workspace ID to share with
   * @param {string} contextType Type of context to share
   * @param {Object} contextData Context data to share
   * @param {Object} options Sharing options
   * @param {string} options.userId User ID of the sharer
   * @param {Array<string>} options.allowedOperations Operations allowed on shared context
   * @param {number} options.expirationTime Timestamp when sharing expires (optional)
   * @returns {Promise<Object>} Shared context information
   */
  async shareContext(workspaceId, contextType, contextData, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      
      if (!contextType) {
        throw new Error('Context type is required');
      }
      
      if (!contextData) {
        throw new Error('Context data is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      this.logger.debug(`Sharing context with workspace: ${workspaceId}, type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('shareContext');
      
      // Use lock to ensure thread safety
      return await this.locks.sharing('shareContext', async () => {
        // Check if workspace exists
        const workspace = this.teamWorkspaces.get(workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`);
        }
        
        // Check if user is a member of the workspace
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to share
        const canShare = await this._checkPermission(options.userId, workspaceId, 'share');
        if (!canShare) {
          throw new Error(`User does not have permission to share context: ${options.userId}`);
        }
        
        // Generate share ID
        const shareId = `${workspaceId}_${contextType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Set default allowed operations if not provided
        const allowedOperations = options.allowedOperations || ['read'];
        
        // Set expiration time if enabled
        let expirationTime = options.expirationTime;
        if (this.config.shareExpirationEnabled && !expirationTime) {
          expirationTime = Date.now() + (this.config.defaultShareExpirationHours * 60 * 60 * 1000);
        }
        
        // Create shared context
        const sharedContext = {
          id: shareId,
          workspaceId,
          contextType,
          contextData,
          sharedBy: options.userId,
          sharedAt: Date.now(),
          expirationTime,
          allowedOperations,
          version: 1,
          accessCount: 0,
          lastAccessed: null,
          updateHistory: []
        };
        
        // Store in workspace
        workspace.sharedContexts.set(shareId, sharedContext);
        
        // Store in global map
        this.sharedContexts.set(shareId, sharedContext);
        
        // Log audit event
        await this._addAuditLog({
          action: 'context_shared',
          workspaceId,
          userId: options.userId,
          contextType,
          shareId,
          timestamp: Date.now(),
          details: {
            allowedOperations,
            expirationTime
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextShared', {
          shareId,
          workspaceId,
          contextType,
          sharedBy: options.userId,
          timestamp: Date.now()
        });
        
        this.logger.info(`Context shared with workspace: ${workspaceId}, type: ${contextType}, shareId: ${shareId}`);
        
        // Return share information (without actual context data for security)
        return {
          shareId,
          workspaceId,
          contextType,
          sharedBy: options.userId,
          sharedAt: sharedContext.sharedAt,
          expirationTime: sharedContext.expirationTime,
          allowedOperations: sharedContext.allowedOperations,
          version: sharedContext.version
        };
      });
    } catch (error) {
      this.logger.error(`Failed to share context: ${error.message}`, { error, workspaceId, contextType });
      throw error;
    }
  }
  
  /**
   * Get shared context from a workspace.
   * @param {string} shareId Shared context ID
   * @param {Object} options Access options
   * @param {string} options.userId User ID requesting access
   * @returns {Promise<Object>} Shared context data
   */
  async getSharedContext(shareId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      this.logger.debug(`Getting shared context: ${shareId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('getSharedContext');
      
      // Use lock to ensure thread safety
      return await this.locks.sharing('getSharedContext', async () => {
        // Check if shared context exists
        const sharedContext = this.sharedContexts.get(shareId);
        if (!sharedContext) {
          throw new Error(`Shared context not found: ${shareId}`);
        }
        
        // Check if expired
        if (sharedContext.expirationTime && Date.now() > sharedContext.expirationTime) {
          throw new Error(`Shared context has expired: ${shareId}`);
        }
        
        // Check if user is a member of the workspace
        const workspace = this.teamWorkspaces.get(sharedContext.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${sharedContext.workspaceId}`);
        }
        
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to read
        const canRead = sharedContext.allowedOperations.includes('read') && 
                        await this._checkPermission(options.userId, sharedContext.workspaceId, 'read');
        if (!canRead) {
          throw new Error(`User does not have permission to read shared context: ${options.userId}`);
        }
        
        // Update access stats
        sharedContext.accessCount += 1;
        sharedContext.lastAccessed = Date.now();
        
        // Log audit event
        await this._addAuditLog({
          action: 'context_accessed',
          workspaceId: sharedContext.workspaceId,
          userId: options.userId,
          contextType: sharedContext.contextType,
          shareId,
          timestamp: Date.now()
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextAccessed', {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          accessedBy: options.userId,
          timestamp: Date.now()
        });
        
        this.logger.debug(`Shared context accessed: ${shareId} by user: ${options.userId}`);
        
        // Return context data and metadata
        return {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          contextData: sharedContext.contextData,
          sharedBy: sharedContext.sharedBy,
          sharedAt: sharedContext.sharedAt,
          version: sharedContext.version,
          allowedOperations: sharedContext.allowedOperations,
          expirationTime: sharedContext.expirationTime
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get shared context: ${error.message}`, { error, shareId });
      throw error;
    }
  }
  
  /**
   * Update shared context.
   * @param {string} shareId Shared context ID
   * @param {Object} contextData Updated context data
   * @param {Object} options Update options
   * @param {string} options.userId User ID performing the update
   * @returns {Promise<Object>} Updated shared context information
   */
  async updateSharedContext(shareId, contextData, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      
      if (!contextData) {
        throw new Error('Context data is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      this.logger.debug(`Updating shared context: ${shareId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('updateSharedContext');
      
      // Use lock to ensure thread safety
      return await this.locks.sharing('updateSharedContext', async () => {
        // Check if shared context exists
        const sharedContext = this.sharedContexts.get(shareId);
        if (!sharedContext) {
          throw new Error(`Shared context not found: ${shareId}`);
        }
        
        // Check if expired
        if (sharedContext.expirationTime && Date.now() > sharedContext.expirationTime) {
          throw new Error(`Shared context has expired: ${shareId}`);
        }
        
        // Check if user is a member of the workspace
        const workspace = this.teamWorkspaces.get(sharedContext.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${sharedContext.workspaceId}`);
        }
        
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to update
        const canUpdate = sharedContext.allowedOperations.includes('update') && 
                          await this._checkPermission(options.userId, sharedContext.workspaceId, 'update');
        if (!canUpdate) {
          throw new Error(`User does not have permission to update shared context: ${options.userId}`);
        }
        
        // Store previous version in history
        sharedContext.updateHistory.push({
          version: sharedContext.version,
          contextData: sharedContext.contextData,
          updatedBy: sharedContext.lastUpdatedBy,
          updatedAt: sharedContext.lastUpdated
        });
        
        // Update context
        sharedContext.contextData = contextData;
        sharedContext.version += 1;
        sharedContext.lastUpdated = Date.now();
        sharedContext.lastUpdatedBy = options.userId;
        
        // Log audit event
        await this._addAuditLog({
          action: 'context_updated',
          workspaceId: sharedContext.workspaceId,
          userId: options.userId,
          contextType: sharedContext.contextType,
          shareId,
          timestamp: Date.now(),
          details: {
            version: sharedContext.version
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextUpdated', {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          updatedBy: options.userId,
          version: sharedContext.version,
          timestamp: Date.now()
        });
        
        this.logger.info(`Shared context updated: ${shareId} by user: ${options.userId}, new version: ${sharedContext.version}`);
        
        // Return update information (without actual context data for security)
        return {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          updatedBy: options.userId,
          updatedAt: sharedContext.lastUpdated,
          version: sharedContext.version
        };
      });
    } catch (error) {
      this.logger.error(`Failed to update shared context: ${error.message}`, { error, shareId });
      throw error;
    }
  }
  
  /**
   * Revoke shared context.
   * @param {string} shareId Shared context ID
   * @param {Object} options Revocation options
   * @param {string} options.userId User ID performing the revocation
   * @returns {Promise<boolean>} True if revocation was successful
   */
  async revokeSharedContext(shareId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      this.logger.debug(`Revoking shared context: ${shareId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('revokeSharedContext');
      
      // Use lock to ensure thread safety
      return await this.locks.sharing('revokeSharedContext', async () => {
        // Check if shared context exists
        const sharedContext = this.sharedContexts.get(shareId);
        if (!sharedContext) {
          throw new Error(`Shared context not found: ${shareId}`);
        }
        
        // Check if user is a member of the workspace
        const workspace = this.teamWorkspaces.get(sharedContext.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${sharedContext.workspaceId}`);
        }
        
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to revoke
        // Original sharer can always revoke, admins can revoke, others need revoke permission
        const isOriginalSharer = options.userId === sharedContext.sharedBy;
        const isAdmin = memberInfo.role === 'admin';
        const hasRevokePermission = await this._checkPermission(options.userId, sharedContext.workspaceId, 'revoke');
        
        if (!isOriginalSharer && !isAdmin && !hasRevokePermission) {
          throw new Error(`User does not have permission to revoke shared context: ${options.userId}`);
        }
        
        // Remove from workspace
        workspace.sharedContexts.delete(shareId);
        
        // Remove from global map
        this.sharedContexts.delete(shareId);
        
        // Log audit event
        await this._addAuditLog({
          action: 'context_revoked',
          workspaceId: sharedContext.workspaceId,
          userId: options.userId,
          contextType: sharedContext.contextType,
          shareId,
          timestamp: Date.now(),
          details: {
            originalSharer: sharedContext.sharedBy,
            wasAdmin: isAdmin
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextRevoked', {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          revokedBy: options.userId,
          timestamp: Date.now()
        });
        
        this.logger.info(`Shared context revoked: ${shareId} by user: ${options.userId}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to revoke shared context: ${error.message}`, { error, shareId });
      throw error;
    }
  }
  
  /**
   * Add a member to a workspace.
   * @param {string} workspaceId Workspace ID
   * @param {string} userId User ID to add
   * @param {Object} options Member options
   * @param {string} options.role Role to assign to the user
   * @param {string} options.addedBy User ID who is adding the member
   * @returns {Promise<Object>} Added member information
   */
  async addWorkspaceMember(workspaceId, userId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!options.role) {
        throw new Error('Role is required');
      }
      
      if (!options.addedBy) {
        throw new Error('Added by user ID is required');
      }
      
      this.logger.debug(`Adding member to workspace: ${workspaceId}, user: ${userId}, role: ${options.role}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('addWorkspaceMember');
      
      // Use lock to ensure thread safety
      return await this.locks.workspace('addWorkspaceMember', async () => {
        // Check if workspace exists
        const workspace = this.teamWorkspaces.get(workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`);
        }
        
        // Check if adding user has permission
        const addingMemberInfo = workspace.members.get(options.addedBy);
        if (!addingMemberInfo) {
          throw new Error(`Adding user is not a member of workspace: ${options.addedBy}`);
        }
        
        if (addingMemberInfo.role !== 'admin' && workspace.owner !== options.addedBy) {
          throw new Error(`User does not have permission to add members: ${options.addedBy}`);
        }
        
        // Check if user is already a member
        if (workspace.members.has(userId)) {
          throw new Error(`User is already a member of workspace: ${userId}`);
        }
        
        // Add member
        const memberInfo = {
          role: options.role,
          added: Date.now(),
          addedBy: options.addedBy
        };
        
        workspace.members.set(userId, memberInfo);
        
        // Log audit event
        await this._addAuditLog({
          action: 'member_added',
          workspaceId,
          userId: options.addedBy,
          targetUserId: userId,
          timestamp: Date.now(),
          details: {
            role: options.role
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('memberAdded', {
          workspaceId,
          userId,
          role: options.role,
          addedBy: options.addedBy,
          timestamp: Date.now()
        });
        
        this.logger.info(`Member added to workspace: ${workspaceId}, user: ${userId}, role: ${options.role}`);
        
        // Return member information
        return {
          workspaceId,
          userId,
          role: memberInfo.role,
          added: memberInfo.added,
          addedBy: memberInfo.addedBy
        };
      });
    } catch (error) {
      this.logger.error(`Failed to add workspace member: ${error.message}`, { error, workspaceId, userId });
      throw error;
    }
  }
  
  /**
   * Remove a member from a workspace.
   * @param {string} workspaceId Workspace ID
   * @param {string} userId User ID to remove
   * @param {Object} options Removal options
   * @param {string} options.removedBy User ID who is removing the member
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeWorkspaceMember(workspaceId, userId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!options.removedBy) {
        throw new Error('Removed by user ID is required');
      }
      
      this.logger.debug(`Removing member from workspace: ${workspaceId}, user: ${userId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('removeWorkspaceMember');
      
      // Use lock to ensure thread safety
      return await this.locks.workspace('removeWorkspaceMember', async () => {
        // Check if workspace exists
        const workspace = this.teamWorkspaces.get(workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`);
        }
        
        // Check if removing user has permission
        const removingMemberInfo = workspace.members.get(options.removedBy);
        if (!removingMemberInfo) {
          throw new Error(`Removing user is not a member of workspace: ${options.removedBy}`);
        }
        
        if (removingMemberInfo.role !== 'admin' && workspace.owner !== options.removedBy && options.removedBy !== userId) {
          throw new Error(`User does not have permission to remove members: ${options.removedBy}`);
        }
        
        // Check if user is a member
        if (!workspace.members.has(userId)) {
          throw new Error(`User is not a member of workspace: ${userId}`);
        }
        
        // Cannot remove workspace owner
        if (userId === workspace.owner) {
          throw new Error(`Cannot remove workspace owner: ${userId}`);
        }
        
        // Remove member
        workspace.members.delete(userId);
        
        // Log audit event
        await this._addAuditLog({
          action: 'member_removed',
          workspaceId,
          userId: options.removedBy,
          targetUserId: userId,
          timestamp: Date.now()
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('memberRemoved', {
          workspaceId,
          userId,
          removedBy: options.removedBy,
          timestamp: Date.now()
        });
        
        this.logger.info(`Member removed from workspace: ${workspaceId}, user: ${userId}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to remove workspace member: ${error.message}`, { error, workspaceId, userId });
      throw error;
    }
  }
  
  /**
   * Get audit log for a workspace.
   * @param {string} workspaceId Workspace ID
   * @param {Object} options Query options
   * @param {string} options.userId User ID requesting the audit log
   * @param {number} options.limit Maximum number of entries to return
   * @param {number} options.offset Offset for pagination
   * @param {string} options.action Filter by action type
   * @param {string} options.targetUserId Filter by target user ID
   * @returns {Promise<Array<Object>>} Audit log entries
   */
  async getAuditLog(workspaceId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      this.logger.debug(`Getting audit log for workspace: ${workspaceId}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('getAuditLog');
      
      // Use lock to ensure thread safety
      return await this.locks.audit('getAuditLog', async () => {
        // Check if workspace exists
        const workspace = this.teamWorkspaces.get(workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`);
        }
        
        // Check if user is a member of the workspace
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to view audit log
        // Only admins and workspace owner can view audit log
        if (memberInfo.role !== 'admin' && workspace.owner !== options.userId) {
          throw new Error(`User does not have permission to view audit log: ${options.userId}`);
        }
        
        // Filter audit log entries for this workspace
        let entries = this.auditLog.filter(entry => entry.workspaceId === workspaceId);
        
        // Apply additional filters if provided
        if (options.action) {
          entries = entries.filter(entry => entry.action === options.action);
        }
        
        if (options.targetUserId) {
          entries = entries.filter(entry => entry.targetUserId === options.targetUserId);
        }
        
        // Sort by timestamp (newest first)
        entries.sort((a, b) => b.timestamp - a.timestamp);
        
        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        entries = entries.slice(offset, offset + limit);
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        this.logger.debug(`Retrieved ${entries.length} audit log entries for workspace: ${workspaceId}`);
        
        return entries;
      });
    } catch (error) {
      this.logger.error(`Failed to get audit log: ${error.message}`, { error, workspaceId });
      throw error;
    }
  }
  
  /**
   * Resolve a conflict between different versions of shared context.
   * @param {string} shareId Shared context ID
   * @param {Object} options Resolution options
   * @param {string} options.userId User ID performing the resolution
   * @param {string} options.strategy Conflict resolution strategy
   * @param {Object} options.manualResolution Manual resolution data (if strategy is 'manual')
   * @returns {Promise<Object>} Resolved context information
   */
  async resolveConflict(shareId, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('TeamContextSharingManager not initialized');
      }
      
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      
      if (!options.userId) {
        throw new Error('User ID is required');
      }
      
      if (!options.strategy) {
        throw new Error('Resolution strategy is required');
      }
      
      this.logger.debug(`Resolving conflict for shared context: ${shareId}, strategy: ${options.strategy}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('resolveConflict');
      
      // Use lock to ensure thread safety
      return await this.locks.sharing('resolveConflict', async () => {
        // Check if shared context exists
        const sharedContext = this.sharedContexts.get(shareId);
        if (!sharedContext) {
          throw new Error(`Shared context not found: ${shareId}`);
        }
        
        // Check if user is a member of the workspace
        const workspace = this.teamWorkspaces.get(sharedContext.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${sharedContext.workspaceId}`);
        }
        
        const memberInfo = workspace.members.get(options.userId);
        if (!memberInfo) {
          throw new Error(`User is not a member of workspace: ${options.userId}`);
        }
        
        // Check if user has permission to resolve conflicts
        const canResolve = sharedContext.allowedOperations.includes('update') && 
                           await this._checkPermission(options.userId, sharedContext.workspaceId, 'resolve_conflicts');
        if (!canResolve) {
          throw new Error(`User does not have permission to resolve conflicts: ${options.userId}`);
        }
        
        // Get resolution strategy
        const strategyFn = this.conflictResolutionStrategies.get(options.strategy);
        if (!strategyFn) {
          throw new Error(`Unknown conflict resolution strategy: ${options.strategy}`);
        }
        
        // Apply resolution strategy
        const resolvedData = await strategyFn(sharedContext, options);
        
        // Update context with resolved data
        sharedContext.contextData = resolvedData;
        sharedContext.version += 1;
        sharedContext.lastUpdated = Date.now();
        sharedContext.lastUpdatedBy = options.userId;
        sharedContext.conflictResolved = {
          timestamp: Date.now(),
          resolvedBy: options.userId,
          strategy: options.strategy
        };
        
        // Log audit event
        await this._addAuditLog({
          action: 'conflict_resolved',
          workspaceId: sharedContext.workspaceId,
          userId: options.userId,
          contextType: sharedContext.contextType,
          shareId,
          timestamp: Date.now(),
          details: {
            strategy: options.strategy,
            newVersion: sharedContext.version
          }
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('conflictResolved', {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          resolvedBy: options.userId,
          strategy: options.strategy,
          version: sharedContext.version,
          timestamp: Date.now()
        });
        
        this.logger.info(`Conflict resolved for shared context: ${shareId}, strategy: ${options.strategy}, new version: ${sharedContext.version}`);
        
        // Return resolution information (without actual context data for security)
        return {
          shareId,
          workspaceId: sharedContext.workspaceId,
          contextType: sharedContext.contextType,
          resolvedBy: options.userId,
          resolvedAt: sharedContext.conflictResolved.timestamp,
          strategy: options.strategy,
          version: sharedContext.version
        };
      });
    } catch (error) {
      this.logger.error(`Failed to resolve conflict: ${error.message}`, { error, shareId });
      throw error;
    }
  }
  
  /**
   * Check if a user has a specific permission in a workspace.
   * @private
   * @param {string} userId User ID
   * @param {string} workspaceId Workspace ID
   * @param {string} permission Permission to check
   * @returns {Promise<boolean>} True if user has permission
   */
  async _checkPermission(userId, workspaceId, permission) {
    try {
      // Use lock to ensure thread safety
      return await this.locks.permissions('checkPermission', async () => {
        // Check if workspace exists
        const workspace = this.teamWorkspaces.get(workspaceId);
        if (!workspace) {
          return false;
        }
        
        // Check if user is a member of the workspace
        const memberInfo = workspace.members.get(userId);
        if (!memberInfo) {
          return false;
        }
        
        // Workspace owner and admins have all permissions
        if (workspace.owner === userId || memberInfo.role === 'admin') {
          return true;
        }
        
        // Check role-based permissions
        const rolePermissions = this._getRolePermissions(memberInfo.role);
        return rolePermissions.includes(permission);
      });
    } catch (error) {
      this.logger.error(`Failed to check permission: ${error.message}`, { error, userId, workspaceId, permission });
      return false;
    }
  }
  
  /**
   * Get permissions for a specific role.
   * @private
   * @param {string} role Role name
   * @returns {Array<string>} List of permissions
   */
  _getRolePermissions(role) {
    switch (role) {
      case 'admin':
        return [
          'read', 'update', 'share', 'revoke', 'delete',
          'add_member', 'remove_member', 'update_member',
          'view_audit', 'resolve_conflicts'
        ];
      case 'editor':
        return [
          'read', 'update', 'share', 'revoke',
          'resolve_conflicts'
        ];
      case 'contributor':
        return [
          'read', 'update', 'share'
        ];
      case 'viewer':
        return [
          'read'
        ];
      default:
        return [];
    }
  }
  
  /**
   * Add entry to audit log.
   * @private
   * @param {Object} entry Audit log entry
   * @returns {Promise<boolean>} True if entry was added successfully
   */
  async _addAuditLog(entry) {
    try {
      // Use lock to ensure thread safety
      return await this.locks.audit('addAuditLog', async () => {
        // Add entry to audit log
        this.auditLog.push(entry);
        
        // Trim audit log if it exceeds maximum size
        if (this.auditLog.length > this.config.maxAuditLogSize) {
          // Remove oldest entries
          this.auditLog = this.auditLog.sort((a, b) => b.timestamp - a.timestamp)
                                      .slice(0, this.config.maxAuditLogSize);
        }
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to add audit log entry: ${error.message}`, { error, entry });
      return false;
    }
  }
  
  /**
   * Initialize conflict resolution strategies.
   * @private
   */
  _initializeConflictResolutionStrategies() {
    // Last write wins strategy
    this.conflictResolutionStrategies.set('last-write-wins', async (sharedContext) => {
      return sharedContext.contextData;
    });
    
    // First write wins strategy
    this.conflictResolutionStrategies.set('first-write-wins', async (sharedContext) => {
      if (sharedContext.updateHistory.length > 0) {
        return sharedContext.updateHistory[0].contextData;
      }
      return sharedContext.contextData;
    });
    
    // Owner preference strategy
    this.conflictResolutionStrategies.set('owner-preference', async (sharedContext) => {
      // Find the last update by the original sharer
      const ownerUpdate = [...sharedContext.updateHistory, { 
        contextData: sharedContext.contextData,
        updatedBy: sharedContext.lastUpdatedBy
      }].find(update => update.updatedBy === sharedContext.sharedBy);
      
      if (ownerUpdate) {
        return ownerUpdate.contextData;
      }
      return sharedContext.contextData;
    });
    
    // Manual resolution strategy
    this.conflictResolutionStrategies.set('manual', async (sharedContext, options) => {
      if (!options.manualResolution) {
        throw new Error('Manual resolution data is required');
      }
      return options.manualResolution;
    });
    
    // Merge strategy using fusion engine
    this.conflictResolutionStrategies.set('merge', async (sharedContext) => {
      // Get all versions of the context
      const versions = [
        ...sharedContext.updateHistory.map(update => update.contextData),
        sharedContext.contextData
      ];
      
      // Use fusion engine to merge contexts
      return await this.contextFusionEngine.fuseContext(sharedContext.contextType, versions);
    });
  }
  
  /**
   * Set up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates from MCP Context Manager
    this.mcpContextManager.on('contextUpdated', this._handleContextUpdate.bind(this));
    
    // Listen for context access events from MCP Context Manager
    this.mcpContextManager.on('contextAccessed', this._handleContextAccess.bind(this));
    
    // Listen for security policy changes
    this.contextSecurityManager.on('securityPolicyChanged', this._handleSecurityPolicyChange.bind(this));
  }
  
  /**
   * Handle context update events.
   * @private
   * @param {Object} event Context update event
   */
  async _handleContextUpdate(event) {
    try {
      // Check if this is a team context update
      if (event.contextType.startsWith('team.')) {
        this.logger.debug(`Handling team context update: ${event.contextType}`);
        
        // Process team context update
        // Implementation depends on specific team context types
      }
    } catch (error) {
      this.logger.error(`Failed to handle context update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context access events.
   * @private
   * @param {Object} event Context access event
   */
  async _handleContextAccess(event) {
    try {
      // Check if this is a team context access
      if (event.contextType.startsWith('team.')) {
        this.logger.debug(`Handling team context access: ${event.contextType}`);
        
        // Process team context access
        // Implementation depends on specific team context types
      }
    } catch (error) {
      this.logger.error(`Failed to handle context access: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle security policy changes.
   * @private
   * @param {Object} event Security policy change event
   */
  async _handleSecurityPolicyChange(event) {
    try {
      this.logger.debug(`Handling security policy change: ${event.policyType}`);
      
      // Update relevant security settings based on policy change
      if (event.policyType === 'team_sharing') {
        // Update team sharing security settings
      }
    } catch (error) {
      this.logger.error(`Failed to handle security policy change: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Load existing workspaces.
   * @private
   * @returns {Promise<boolean>} True if loading was successful
   */
  async _loadExistingWorkspaces() {
    try {
      this.logger.debug('Loading existing workspaces');
      
      // In a real implementation, this would load from persistent storage
      // For now, just initialize with empty state
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to load existing workspaces: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Clean up resources and prepare for shutdown.
   * @returns {Promise<boolean>} True if cleanup was successful
   */
  async cleanup() {
    try {
      if (!this.initialized) {
        return true;
      }
      
      this.logger.info('Cleaning up TeamContextSharingManager');
      
      // Unregister from MCP Context Manager
      await this.mcpContextManager.unregisterContextProvider('team.sharing');
      
      // Remove event listeners
      this.mcpContextManager.removeAllListeners();
      this.contextSecurityManager.removeAllListeners();
      
      this.initialized = false;
      this.logger.info('TeamContextSharingManager cleaned up successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to clean up TeamContextSharingManager: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = TeamContextSharingManager;
