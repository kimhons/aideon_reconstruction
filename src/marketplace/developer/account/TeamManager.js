/**
 * @fileoverview Team Manager for the Aideon Developer Portal
 * 
 * This module provides functionality for managing developer teams,
 * including team creation, member management, and role-based permissions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * TeamManager class - Manages developer teams for the Developer Portal
 */
class TeamManager {
  /**
   * Create a new TeamManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {string} options.storagePath - Path to store team data
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'developer-teams');
    this.logger = new Logger('TeamManager');
    this.events = new EventEmitter();
    this.teams = new Map();
    this.invitations = new Map();
    this.initialized = false;
    
    // Define available roles and their permissions
    this.roles = {
      owner: {
        name: 'Owner',
        description: 'Full control over team and tentacles',
        permissions: [
          'manage_team', 'manage_members', 'manage_roles',
          'create_tentacle', 'edit_tentacle', 'delete_tentacle',
          'submit_tentacle', 'publish_tentacle', 'view_analytics',
          'manage_billing', 'manage_api_keys'
        ]
      },
      admin: {
        name: 'Administrator',
        description: 'Manage team and tentacles',
        permissions: [
          'manage_members', 'create_tentacle', 'edit_tentacle',
          'delete_tentacle', 'submit_tentacle', 'publish_tentacle',
          'view_analytics'
        ]
      },
      developer: {
        name: 'Developer',
        description: 'Create and manage tentacles',
        permissions: [
          'create_tentacle', 'edit_tentacle', 'submit_tentacle',
          'view_analytics'
        ]
      },
      viewer: {
        name: 'Viewer',
        description: 'View-only access to team tentacles',
        permissions: [
          'view_analytics'
        ]
      }
    };
  }

  /**
   * Initialize the team manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('TeamManager already initialized');
      return true;
    }

    this.logger.info('Initializing TeamManager');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load teams from storage
      await this._loadTeams();
      
      // Load invitations from storage
      await this._loadInvitations();
      
      this.initialized = true;
      this.logger.info('TeamManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize TeamManager', error);
      throw error;
    }
  }

  /**
   * Load teams from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadTeams() {
    try {
      const teamsFile = path.join(this.storagePath, 'teams.json');
      
      // Check if file exists
      try {
        await fs.access(teamsFile);
      } catch (error) {
        // File doesn't exist, create empty teams file
        await fs.writeFile(teamsFile, JSON.stringify([]));
        return;
      }
      
      // Read teams from file
      const data = await fs.readFile(teamsFile, 'utf8');
      const teams = JSON.parse(data);
      
      // Populate teams map
      teams.forEach(team => {
        this.teams.set(team.id, team);
      });
      
      this.logger.info(`Loaded ${teams.length} developer teams`);
    } catch (error) {
      this.logger.error('Failed to load teams', error);
      throw error;
    }
  }

  /**
   * Save teams to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveTeams() {
    try {
      const teamsFile = path.join(this.storagePath, 'teams.json');
      const teams = Array.from(this.teams.values());
      
      await fs.writeFile(teamsFile, JSON.stringify(teams, null, 2));
      
      this.logger.info(`Saved ${teams.length} developer teams`);
    } catch (error) {
      this.logger.error('Failed to save teams', error);
      throw error;
    }
  }

  /**
   * Load invitations from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadInvitations() {
    try {
      const invitationsFile = path.join(this.storagePath, 'invitations.json');
      
      // Check if file exists
      try {
        await fs.access(invitationsFile);
      } catch (error) {
        // File doesn't exist, create empty invitations file
        await fs.writeFile(invitationsFile, JSON.stringify([]));
        return;
      }
      
      // Read invitations from file
      const data = await fs.readFile(invitationsFile, 'utf8');
      const invitations = JSON.parse(data);
      
      // Populate invitations map
      invitations.forEach(invitation => {
        this.invitations.set(invitation.id, invitation);
      });
      
      this.logger.info(`Loaded ${invitations.length} team invitations`);
    } catch (error) {
      this.logger.error('Failed to load invitations', error);
      throw error;
    }
  }

  /**
   * Save invitations to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveInvitations() {
    try {
      const invitationsFile = path.join(this.storagePath, 'invitations.json');
      const invitations = Array.from(this.invitations.values());
      
      await fs.writeFile(invitationsFile, JSON.stringify(invitations, null, 2));
      
      this.logger.info(`Saved ${invitations.length} team invitations`);
    } catch (error) {
      this.logger.error('Failed to save invitations', error);
      throw error;
    }
  }

  /**
   * Create a new developer team
   * @param {string} developerId - Developer account ID of the team owner
   * @param {Object} teamData - Team data
   * @returns {Promise<Object>} - Promise resolving to the created team
   */
  async createTeam(developerId, teamData = {}) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Creating team for developer: ${developerId}`);
    
    // Verify developer account exists
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Validate team data
    if (!teamData.name) {
      throw new Error('Team name is required');
    }
    
    // Check if developer already owns a team
    const existingTeams = Array.from(this.teams.values())
      .filter(team => {
        const ownerMember = team.members.find(member => 
          member.developerId === developerId && member.role === 'owner'
        );
        return !!ownerMember;
      });
    
    if (existingTeams.length >= 5) {
      throw new Error(`Developer ${developerId} has reached the maximum number of owned teams`);
    }
    
    // Create team
    const team = {
      id: `team_${crypto.randomBytes(8).toString('hex')}`,
      name: teamData.name,
      description: teamData.description || '',
      avatarUrl: teamData.avatarUrl || null,
      website: teamData.website || null,
      members: [
        {
          developerId,
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      ],
      tentacles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store team
    this.teams.set(team.id, team);
    await this._saveTeams();
    
    // Emit event
    this.events.emit('team:created', { team });
    
    return team;
  }

  /**
   * Get a team by ID
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} - Promise resolving to the team
   */
  async getTeam(teamId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    return team;
  }

  /**
   * Update a team
   * @param {string} teamId - Team ID
   * @param {string} developerId - Developer account ID making the update
   * @param {Object} updates - Updates to apply to the team
   * @returns {Promise<Object>} - Promise resolving to the updated team
   */
  async updateTeam(teamId, developerId, updates = {}) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Updating team: ${teamId}`);
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Check if developer has permission to update team
    await this._checkPermission(teamId, developerId, 'manage_team');
    
    // Apply updates
    const updatedTeam = {
      ...team,
      name: updates.name || team.name,
      description: updates.description !== undefined ? updates.description : team.description,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : team.avatarUrl,
      website: updates.website !== undefined ? updates.website : team.website,
      updatedAt: new Date().toISOString()
    };
    
    // Store updated team
    this.teams.set(teamId, updatedTeam);
    await this._saveTeams();
    
    // Emit event
    this.events.emit('team:updated', { 
      team: updatedTeam,
      previousTeam: team
    });
    
    return updatedTeam;
  }

  /**
   * Delete a team
   * @param {string} teamId - Team ID
   * @param {string} developerId - Developer account ID making the deletion
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteTeam(teamId, developerId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Deleting team: ${teamId}`);
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Check if developer is the team owner
    const member = team.members.find(m => m.developerId === developerId);
    
    if (!member || member.role !== 'owner') {
      throw new Error(`Developer ${developerId} is not the owner of team ${teamId}`);
    }
    
    // Delete team
    this.teams.delete(teamId);
    await this._saveTeams();
    
    // Delete any pending invitations for this team
    const teamInvitations = Array.from(this.invitations.values())
      .filter(invitation => invitation.teamId === teamId);
    
    for (const invitation of teamInvitations) {
      this.invitations.delete(invitation.id);
    }
    
    await this._saveInvitations();
    
    // Emit event
    this.events.emit('team:deleted', { team });
    
    return true;
  }

  /**
   * Invite a developer to join a team
   * @param {string} teamId - Team ID
   * @param {string} inviterDeveloperId - Developer account ID sending the invitation
   * @param {string} email - Email address of the developer to invite
   * @param {string} role - Role to assign to the invited developer
   * @returns {Promise<Object>} - Promise resolving to the created invitation
   */
  async inviteDeveloper(teamId, inviterDeveloperId, email, role) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Inviting developer to team: ${teamId}`);
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Check if developer has permission to manage members
    await this._checkPermission(teamId, inviterDeveloperId, 'manage_members');
    
    // Validate role
    if (!this.roles[role]) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    // Check if role is allowed (cannot invite owners)
    if (role === 'owner') {
      throw new Error('Cannot invite developers as owners');
    }
    
    // Check if email is already a member
    try {
      const inviteeDeveloper = await this.accountManager.getDeveloperAccountByEmail(email);
      
      if (inviteeDeveloper) {
        const existingMember = team.members.find(m => m.developerId === inviteeDeveloper.id);
        
        if (existingMember) {
          throw new Error(`Developer ${email} is already a member of team ${teamId}`);
        }
      }
    } catch (error) {
      // Developer not found, which is fine for invitation
    }
    
    // Check for existing invitation
    const existingInvitation = Array.from(this.invitations.values())
      .find(inv => inv.teamId === teamId && inv.email === email && !inv.accepted && !inv.declined);
    
    if (existingInvitation) {
      throw new Error(`Developer ${email} already has a pending invitation to team ${teamId}`);
    }
    
    // Create invitation
    const invitation = {
      id: `inv_${crypto.randomBytes(8).toString('hex')}`,
      teamId,
      teamName: team.name,
      inviterDeveloperId,
      email,
      role,
      token: crypto.randomBytes(32).toString('hex'),
      accepted: false,
      declined: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    // Store invitation
    this.invitations.set(invitation.id, invitation);
    await this._saveInvitations();
    
    // Emit event
    this.events.emit('team:invitation_created', { invitation, team });
    
    return invitation;
  }

  /**
   * Accept a team invitation
   * @param {string} token - Invitation token
   * @param {string} developerId - Developer account ID accepting the invitation
   * @returns {Promise<Object>} - Promise resolving to the updated team
   */
  async acceptInvitation(token, developerId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Accepting team invitation for developer: ${developerId}`);
    
    // Find invitation by token
    const invitation = Array.from(this.invitations.values())
      .find(inv => inv.token === token);
    
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }
    
    // Check if invitation has expired
    if (new Date() > new Date(invitation.expiresAt)) {
      throw new Error('Invitation has expired');
    }
    
    // Check if invitation has already been accepted or declined
    if (invitation.accepted || invitation.declined) {
      throw new Error('Invitation has already been processed');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Verify email matches
    if (account.metadata.email !== invitation.email) {
      throw new Error('Email address does not match invitation');
    }
    
    // Get team
    const team = this.teams.get(invitation.teamId);
    
    if (!team) {
      throw new Error(`Team ${invitation.teamId} not found`);
    }
    
    // Check if developer is already a member
    const existingMember = team.members.find(m => m.developerId === developerId);
    
    if (existingMember) {
      throw new Error(`Developer ${developerId} is already a member of team ${invitation.teamId}`);
    }
    
    // Add developer to team
    const updatedTeam = {
      ...team,
      members: [
        ...team.members,
        {
          developerId,
          role: invitation.role,
          joinedAt: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    };
    
    // Update invitation
    const updatedInvitation = {
      ...invitation,
      accepted: true,
      acceptedAt: new Date().toISOString()
    };
    
    // Store updated team and invitation
    this.teams.set(team.id, updatedTeam);
    this.invitations.set(invitation.id, updatedInvitation);
    
    await this._saveTeams();
    await this._saveInvitations();
    
    // Emit events
    this.events.emit('team:member_added', { 
      team: updatedTeam,
      developerId,
      role: invitation.role
    });
    
    this.events.emit('team:invitation_accepted', { invitation: updatedInvitation });
    
    return updatedTeam;
  }

  /**
   * Decline a team invitation
   * @param {string} token - Invitation token
   * @param {string} developerId - Developer account ID declining the invitation
   * @returns {Promise<boolean>} - Promise resolving to true if decline was successful
   */
  async declineInvitation(token, developerId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Declining team invitation for developer: ${developerId}`);
    
    // Find invitation by token
    const invitation = Array.from(this.invitations.values())
      .find(inv => inv.token === token);
    
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }
    
    // Check if invitation has already been accepted or declined
    if (invitation.accepted || invitation.declined) {
      throw new Error('Invitation has already been processed');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Verify email matches
    if (account.metadata.email !== invitation.email) {
      throw new Error('Email address does not match invitation');
    }
    
    // Update invitation
    const updatedInvitation = {
      ...invitation,
      declined: true,
      declinedAt: new Date().toISOString()
    };
    
    // Store updated invitation
    this.invitations.set(invitation.id, updatedInvitation);
    await this._saveInvitations();
    
    // Emit event
    this.events.emit('team:invitation_declined', { invitation: updatedInvitation });
    
    return true;
  }

  /**
   * Remove a member from a team
   * @param {string} teamId - Team ID
   * @param {string} removingDeveloperId - Developer account ID performing the removal
   * @param {string} targetDeveloperId - Developer account ID to remove
   * @returns {Promise<Object>} - Promise resolving to the updated team
   */
  async removeMember(teamId, removingDeveloperId, targetDeveloperId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Removing member ${targetDeveloperId} from team: ${teamId}`);
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Check if target developer is a member
    const targetMember = team.members.find(m => m.developerId === targetDeveloperId);
    
    if (!targetMember) {
      throw new Error(`Developer ${targetDeveloperId} is not a member of team ${teamId}`);
    }
    
    // Check if removing self or has permission
    if (removingDeveloperId !== targetDeveloperId) {
      await this._checkPermission(teamId, removingDeveloperId, 'manage_members');
      
      // Cannot remove owner unless you are also an owner
      if (targetMember.role === 'owner') {
        const removingMember = team.members.find(m => m.developerId === removingDeveloperId);
        
        if (!removingMember || removingMember.role !== 'owner') {
          throw new Error('Only owners can remove other owners from a team');
        }
      }
    }
    
    // Check if removing the last owner
    if (targetMember.role === 'owner') {
      const ownerCount = team.members.filter(m => m.role === 'owner').length;
      
      if (ownerCount === 1) {
        throw new Error('Cannot remove the last owner from a team');
      }
    }
    
    // Remove member
    const updatedTeam = {
      ...team,
      members: team.members.filter(m => m.developerId !== targetDeveloperId),
      updatedAt: new Date().toISOString()
    };
    
    // Store updated team
    this.teams.set(teamId, updatedTeam);
    await this._saveTeams();
    
    // Emit event
    this.events.emit('team:member_removed', { 
      team: updatedTeam,
      developerId: targetDeveloperId,
      role: targetMember.role
    });
    
    return updatedTeam;
  }

  /**
   * Update a member's role in a team
   * @param {string} teamId - Team ID
   * @param {string} updatingDeveloperId - Developer account ID performing the update
   * @param {string} targetDeveloperId - Developer account ID to update
   * @param {string} newRole - New role to assign
   * @returns {Promise<Object>} - Promise resolving to the updated team
   */
  async updateMemberRole(teamId, updatingDeveloperId, targetDeveloperId, newRole) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    this.logger.info(`Updating role for member ${targetDeveloperId} in team: ${teamId}`);
    
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Validate role
    if (!this.roles[newRole]) {
      throw new Error(`Invalid role: ${newRole}`);
    }
    
    // Check if target developer is a member
    const targetMemberIndex = team.members.findIndex(m => m.developerId === targetDeveloperId);
    
    if (targetMemberIndex === -1) {
      throw new Error(`Developer ${targetDeveloperId} is not a member of team ${teamId}`);
    }
    
    const targetMember = team.members[targetMemberIndex];
    
    // Check if updating to the same role
    if (targetMember.role === newRole) {
      return team;
    }
    
    // Check if has permission to manage roles
    await this._checkPermission(teamId, updatingDeveloperId, 'manage_roles');
    
    // Special checks for owner role changes
    if (targetMember.role === 'owner' || newRole === 'owner') {
      // Only owners can change owner status
      const updatingMember = team.members.find(m => m.developerId === updatingDeveloperId);
      
      if (!updatingMember || updatingMember.role !== 'owner') {
        throw new Error('Only owners can change owner status');
      }
      
      // Check if removing the last owner
      if (targetMember.role === 'owner' && newRole !== 'owner') {
        const ownerCount = team.members.filter(m => m.role === 'owner').length;
        
        if (ownerCount === 1) {
          throw new Error('Cannot remove the last owner from a team');
        }
      }
    }
    
    // Update member role
    const updatedMembers = [...team.members];
    updatedMembers[targetMemberIndex] = {
      ...targetMember,
      role: newRole,
      roleUpdatedAt: new Date().toISOString()
    };
    
    const updatedTeam = {
      ...team,
      members: updatedMembers,
      updatedAt: new Date().toISOString()
    };
    
    // Store updated team
    this.teams.set(teamId, updatedTeam);
    await this._saveTeams();
    
    // Emit event
    this.events.emit('team:member_role_updated', { 
      team: updatedTeam,
      developerId: targetDeveloperId,
      previousRole: targetMember.role,
      newRole
    });
    
    return updatedTeam;
  }

  /**
   * Get teams for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of teams
   */
  async getTeamsForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    // Find teams where developer is a member
    const developerTeams = Array.from(this.teams.values())
      .filter(team => team.members.some(m => m.developerId === developerId));
    
    return developerTeams;
  }

  /**
   * Get pending invitations for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of invitations
   */
  async getPendingInvitationsForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('TeamManager not initialized');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Find invitations for developer's email
    const pendingInvitations = Array.from(this.invitations.values())
      .filter(inv => 
        inv.email === account.metadata.email && 
        !inv.accepted && 
        !inv.declined &&
        new Date() < new Date(inv.expiresAt)
      );
    
    return pendingInvitations;
  }

  /**
   * Check if a developer has a specific permission in a team
   * @param {string} teamId - Team ID
   * @param {string} developerId - Developer account ID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} - Promise resolving to true if developer has permission
   * @private
   */
  async _checkPermission(teamId, developerId, permission) {
    const team = this.teams.get(teamId);
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Find member
    const member = team.members.find(m => m.developerId === developerId);
    
    if (!member) {
      throw new Error(`Developer ${developerId} is not a member of team ${teamId}`);
    }
    
    // Get role permissions
    const role = this.roles[member.role];
    
    if (!role) {
      throw new Error(`Invalid role: ${member.role}`);
    }
    
    // Check if role has permission
    if (!role.permissions.includes(permission)) {
      throw new Error(`Developer ${developerId} does not have permission: ${permission}`);
    }
    
    return true;
  }

  /**
   * Get the status of the team manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      teamCount: this.teams.size,
      invitationCount: this.invitations.size
    };
  }

  /**
   * Shutdown the team manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('TeamManager not initialized');
      return true;
    }
    
    this.logger.info('Shutting down TeamManager');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { TeamManager };
