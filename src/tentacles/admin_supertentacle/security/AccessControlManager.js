/**
 * @fileoverview Access Control Manager for Admin SuperTentacle
 * Manages user access, invitations, and authentication for the exclusive Admin SuperTentacle.
 * @author Manus AI
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * Access Control Manager for Admin SuperTentacle
 * Manages user access, invitations, and authentication for the exclusive Admin SuperTentacle.
 */
class AccessControlManager {
  /**
   * Creates a new AccessControlManager instance
   * @param {Object} config - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} logger - Logger instance
   */
  constructor(config, dependencies, logger) {
    this.config = config || {};
    this.dependencies = dependencies || {};
    this.logger = logger || console;
    
    this.logger.info('Initializing Access Control Manager');
    
    // Initialize database connection
    this.db = dependencies.database;
    
    // Initialize authentication service
    this.authService = dependencies.authService;
    
    // Initialize notification service
    this.notificationService = dependencies.notificationService;
    
    // Initialize encryption service
    this.encryptionService = dependencies.encryptionService;
    
    this.logger.info('Access Control Manager initialized successfully');
  }
  
  /**
   * Verifies user access to the Admin SuperTentacle
   * @param {string} userId - User ID to verify
   * @param {Object} credentials - Authentication credentials
   * @returns {Promise<boolean>} - Whether access is granted
   */
  async verifyAccess(userId, credentials) {
    try {
      this.logger.info(`Verifying access for user: ${userId}`);
      
      // Verify authentication
      const isAuthenticated = await this.authService.verifyCredentials(userId, credentials);
      if (!isAuthenticated) {
        this.logger.warn(`Authentication failed for user: ${userId}`);
        return false;
      }
      
      // Check if user is admin
      const isAdmin = await this.isAdmin(userId);
      if (isAdmin) {
        this.logger.info(`Admin access granted for user: ${userId}`);
        return true;
      }
      
      // Check if user has invitation
      const hasInvitation = await this.hasValidInvitation(userId);
      if (hasInvitation) {
        this.logger.info(`Invitation-based access granted for user: ${userId}`);
        return true;
      }
      
      this.logger.warn(`Access denied for user: ${userId}`);
      return false;
    } catch (error) {
      this.logger.error(`Error verifying access: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Checks if a user is an admin
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - Whether user is admin
   * @private
   */
  async isAdmin(userId) {
    try {
      const user = await this.db.users.findOne({ id: userId });
      return user && user.roles && user.roles.includes('admin');
    } catch (error) {
      this.logger.error(`Error checking admin status: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Checks if a user has a valid invitation
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - Whether user has valid invitation
   * @private
   */
  async hasValidInvitation(userId) {
    try {
      const invitation = await this.db.invitations.findOne({
        inviteeId: userId,
        status: 'active'
      });
      
      return !!invitation;
    } catch (error) {
      this.logger.error(`Error checking invitation: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Creates an invitation for a new user
   * @param {string} adminId - Admin user ID
   * @param {string} inviteeId - Invitee user ID
   * @param {Object} inviteeDetails - Invitee details
   * @returns {Promise<Object>} - Invitation details
   */
  async createInvitation(adminId, inviteeId, inviteeDetails) {
    try {
      this.logger.info(`Creating invitation from admin ${adminId} to user ${inviteeId}`);
      
      // Verify admin status
      const isAdmin = await this.isAdmin(adminId);
      if (!isAdmin) {
        throw new Error('Only admins can create invitations');
      }
      
      // Check if invitee already has access
      const hasAccess = await this.hasValidInvitation(inviteeId);
      if (hasAccess) {
        throw new Error('User already has access');
      }
      
      // Generate invitation token
      const invitationToken = this.generateInvitationToken();
      
      // Create invitation record
      const invitation = {
        id: crypto.randomUUID(),
        adminId,
        inviteeId,
        inviteeDetails,
        token: invitationToken,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };
      
      // Save invitation to database
      await this.db.invitations.insertOne(invitation);
      
      // Send notification to invitee
      await this.notificationService.sendInvitation(inviteeId, invitation);
      
      this.logger.info(`Invitation created successfully for user ${inviteeId}`);
      
      // Return invitation details (without token)
      const { token, ...invitationDetails } = invitation;
      return invitationDetails;
    } catch (error) {
      this.logger.error(`Error creating invitation: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Revokes access for a user
   * @param {string} adminId - Admin user ID
   * @param {string} targetUserId - Target user ID to revoke
   * @returns {Promise<boolean>} - Whether revocation was successful
   */
  async revokeAccess(adminId, targetUserId) {
    try {
      this.logger.info(`Revoking access for user ${targetUserId} by admin ${adminId}`);
      
      // Verify admin status
      const isAdmin = await this.isAdmin(adminId);
      if (!isAdmin) {
        throw new Error('Only admins can revoke access');
      }
      
      // Check if target is also an admin
      const targetIsAdmin = await this.isAdmin(targetUserId);
      if (targetIsAdmin) {
        throw new Error('Cannot revoke access for another admin');
      }
      
      // Update invitation status
      const result = await this.db.invitations.updateOne(
        { inviteeId: targetUserId, status: 'active' },
        { $set: { status: 'revoked', revokedAt: new Date(), revokedBy: adminId } }
      );
      
      if (result.modifiedCount === 0) {
        this.logger.warn(`No active invitation found for user ${targetUserId}`);
        return false;
      }
      
      // Send notification to target user
      await this.notificationService.sendAccessRevocation(targetUserId, adminId);
      
      this.logger.info(`Access revoked successfully for user ${targetUserId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error revoking access: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates a secure invitation token
   * @returns {string} - Invitation token
   * @private
   */
  generateInvitationToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Gets system status and health information
   * @returns {Object} - System status
   */
  getStatus() {
    return {
      status: 'operational',
      invitationCount: this.db.invitations.count({ status: 'active' })
    };
  }
}

module.exports = AccessControlManager;
