/**
 * @fileoverview Access Control Service - Centralized access control for tentacles
 * 
 * This service provides centralized access control functionality for tentacles,
 * including admin-only access and invite code management.
 */

const { EventEmitter } = require('../events/EventEmitter');
const { Logger } = require('../logging/Logger');

/**
 * AccessControlService class - Manages access control for tentacles
 */
class AccessControlService {
  /**
   * Create a new AccessControlService instance
   * @param {Object} options - Configuration options
   * @param {string} options.tentacleId - ID of the tentacle this service controls access for
   * @param {Object} options.config - Configuration namespace
   * @param {Object} options.auth - Authentication service reference
   * @param {Logger} options.logger - Logger instance
   * @param {EventEmitter} options.events - Event emitter instance
   */
  constructor(options = {}) {
    this.tentacleId = options.tentacleId;
    this.config = options.config || {};
    this.auth = options.auth;
    this.logger = options.logger || new Logger('AccessControlService');
    this.events = options.events || new EventEmitter();
    this.initialized = false;
    
    // Access control settings
    this.adminOnly = true;
    this.inviteEnabled = true;
    this.inviteCodes = new Map();
  }

  /**
   * Initialize the access control service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Access control service is already initialized');
      return;
    }
    
    this.logger.info(`Initializing access control for tentacle ${this.tentacleId}`);
    
    try {
      // Get access control configuration
      this.adminOnly = this.config.get('adminOnly', true);
      this.inviteEnabled = this.config.get('inviteEnabled', true);
      
      // Load saved invite codes
      const savedInviteCodes = this.config.get('inviteCodes', []);
      
      for (const invite of savedInviteCodes) {
        this.inviteCodes.set(invite.code, invite);
      }
      
      this.logger.info(`Loaded ${this.inviteCodes.size} invite codes`);
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize access control service', error);
      throw error;
    }
  }

  /**
   * Check if a user has access
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} - Whether the user has access
   */
  async hasAccess(userId) {
    this._ensureInitialized();
    
    // Check if user is admin
    const isAdmin = await this.auth.isAdmin(userId);
    if (isAdmin) {
      return true;
    }
    
    // If admin-only and user is not admin, deny access
    if (this.adminOnly && !this.inviteEnabled) {
      return false;
    }
    
    // Check if user has a valid invite code
    if (this.inviteEnabled) {
      const userInviteCode = await this.auth.getUserAttribute(userId, `${this.tentacleId}InviteCode`);
      if (userInviteCode && this.inviteCodes.has(userInviteCode)) {
        const invite = this.inviteCodes.get(userInviteCode);
        
        // Check if invite is still valid
        if (invite.expiresAt > Date.now()) {
          return true;
        }
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
    this._ensureInitialized();
    
    // Verify admin status
    const isAdmin = await this.auth.isAdmin(adminId);
    if (!isAdmin) {
      throw new Error('Only admin users can generate invite codes');
    }
    
    // Check if invite generation is enabled
    if (!this.inviteEnabled) {
      throw new Error('Invite code generation is disabled');
    }
    
    // Generate a unique code
    const prefix = this.tentacleId.substring(0, 2).toUpperCase();
    const code = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`.toUpperCase();
    
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
    
    // Emit event
    this.events.emit('invite:generated', {
      adminId,
      code,
      expiresAt,
      maxUses: options.maxUses || 1,
      timestamp: Date.now()
    });
    
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
    this._ensureInitialized();
    
    // Check if invite redemption is enabled
    if (!this.inviteEnabled) {
      throw new Error('Invite code redemption is disabled');
    }
    
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
    await this.auth.setUserAttribute(userId, `${this.tentacleId}InviteCode`, code);
    
    // Emit event
    this.events.emit('invite:redeemed', {
      userId,
      code,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Get the number of active invite codes
   * @returns {number} - Number of active invite codes
   */
  getActiveInviteCount() {
    this._ensureInitialized();
    
    // Count only non-expired invites
    let activeCount = 0;
    const now = Date.now();
    
    for (const invite of this.inviteCodes.values()) {
      if (invite.expiresAt > now) {
        activeCount++;
      }
    }
    
    return activeCount;
  }

  /**
   * Save invite codes to persistent storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveInviteCodes() {
    try {
      await this.config.set('inviteCodes', Array.from(this.inviteCodes.values()));
    } catch (error) {
      this.logger.error('Failed to save invite codes', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   * @private
   * @throws {Error} If service is not initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Access control service is not initialized');
    }
  }
}

module.exports = { AccessControlService };
