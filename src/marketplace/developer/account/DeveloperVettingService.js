/**
 * @fileoverview Developer Vetting Service for the Aideon Developer Portal
 * 
 * This module provides functionality for vetting developer accounts,
 * including identity verification, trust scoring, and risk assessment.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const crypto = require('crypto');

/**
 * DeveloperVettingService class - Manages developer vetting for the Developer Portal
 */
class DeveloperVettingService {
  /**
   * Create a new DeveloperVettingService instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {Object} options.notificationService - Reference to the notification service
   * @param {Object} options.securitySettings - Security settings for vetting
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.notificationService = options.notificationService;
    this.securitySettings = options.securitySettings || {
      vettingLevel: 'standard', // 'basic', 'standard', 'enhanced'
      identityVerificationRequired: true,
      financialVerificationRequired: false,
      autoApproveBasicAccounts: true,
      trustScoreThreshold: 70,
      riskFactorThreshold: 30
    };
    this.logger = new Logger('DeveloperVettingService');
    this.events = new EventEmitter();
    this.vettingRequests = new Map();
    this.initialized = false;
    
    // Define vetting levels and requirements
    this.vettingLevels = {
      basic: {
        name: 'Basic',
        requirements: ['email_verification'],
        autoApprove: true,
        tentacleLimit: 3
      },
      standard: {
        name: 'Standard',
        requirements: ['email_verification', 'identity_verification'],
        autoApprove: false,
        tentacleLimit: 10
      },
      enhanced: {
        name: 'Enhanced',
        requirements: ['email_verification', 'identity_verification', 'financial_verification'],
        autoApprove: false,
        tentacleLimit: null // unlimited
      }
    };
  }

  /**
   * Initialize the developer vetting service
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('DeveloperVettingService already initialized');
      return true;
    }

    this.logger.info('Initializing DeveloperVettingService');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    try {
      // Set up event listeners for account events
      this.accountManager.events.on('developer:created', this._handleDeveloperCreated.bind(this));
      
      this.initialized = true;
      this.logger.info('DeveloperVettingService initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize DeveloperVettingService', error);
      throw error;
    }
  }

  /**
   * Handle developer created event
   * @param {Object} event - Developer created event
   * @private
   */
  async _handleDeveloperCreated(event) {
    const { account } = event;
    
    this.logger.info(`New developer account created, initiating vetting: ${account.id}`);
    
    // Create initial vetting request
    await this.createVettingRequest(account.id);
  }

  /**
   * Create a vetting request for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to the created vetting request
   */
  async createVettingRequest(developerId) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Creating vetting request for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Determine vetting level based on settings
    const vettingLevel = this.securitySettings.vettingLevel;
    const levelRequirements = this.vettingLevels[vettingLevel].requirements;
    
    // Create vetting request
    const vettingRequest = {
      id: `vet_${crypto.randomBytes(8).toString('hex')}`,
      developerId,
      vettingLevel,
      status: 'pending',
      requirements: levelRequirements.map(req => ({
        type: req,
        status: req === 'email_verification' ? 'completed' : 'pending', // Assume email is verified during account creation
        verifiedAt: req === 'email_verification' ? new Date().toISOString() : null
      })),
      trustScore: 10, // Initial trust score
      riskFactors: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store vetting request
    this.vettingRequests.set(vettingRequest.id, vettingRequest);
    
    // Update account with vetting status
    await this.accountManager.updateDeveloperAccount(developerId, {
      vettingStatus: 'pending',
      securityProfile: {
        ...account.securityProfile,
        vettingRequestId: vettingRequest.id,
        trustScore: vettingRequest.trustScore,
        riskLevel: this._calculateRiskLevel(vettingRequest)
      }
    });
    
    // Emit event
    this.events.emit('vetting:request_created', { vettingRequest });
    
    // If auto-approve is enabled for this level, approve immediately
    if (this.vettingLevels[vettingLevel].autoApprove && this.securitySettings.autoApproveBasicAccounts) {
      await this.approveVettingRequest(vettingRequest.id, 'system', 'Auto-approved based on vetting level settings');
    } else {
      // Notify developer about verification requirements
      if (this.notificationService) {
        const pendingRequirements = vettingRequest.requirements
          .filter(req => req.status === 'pending')
          .map(req => this._formatRequirementName(req.type));
        
        if (pendingRequirements.length > 0) {
          await this.notificationService.sendNotification(account.userId, {
            type: 'verification',
            title: 'Developer Verification Required',
            message: `Please complete the following verification steps: ${pendingRequirements.join(', ')}`,
            action: 'complete_verification',
            priority: 'high'
          });
        }
      }
    }
    
    return vettingRequest;
  }

  /**
   * Format requirement name for display
   * @param {string} requirementType - Requirement type
   * @returns {string} - Formatted requirement name
   * @private
   */
  _formatRequirementName(requirementType) {
    switch (requirementType) {
      case 'email_verification':
        return 'Email Verification';
      case 'identity_verification':
        return 'Identity Verification';
      case 'financial_verification':
        return 'Financial Verification';
      default:
        return requirementType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  /**
   * Get a vetting request by ID
   * @param {string} vettingRequestId - Vetting request ID
   * @returns {Promise<Object>} - Promise resolving to the vetting request
   */
  async getVettingRequest(vettingRequestId) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    return vettingRequest;
  }

  /**
   * Get vetting request for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to the vetting request
   */
  async getVettingRequestForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (!account.securityProfile.vettingRequestId) {
      throw new Error(`No vetting request found for developer ${developerId}`);
    }
    
    return this.getVettingRequest(account.securityProfile.vettingRequestId);
  }

  /**
   * Submit verification document for a requirement
   * @param {string} vettingRequestId - Vetting request ID
   * @param {string} requirementType - Requirement type
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} - Promise resolving to the updated vetting request
   */
  async submitVerificationDocument(vettingRequestId, requirementType, documentData) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Submitting verification document for vetting request: ${vettingRequestId}`);
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    // Find requirement
    const requirementIndex = vettingRequest.requirements.findIndex(req => req.type === requirementType);
    
    if (requirementIndex === -1) {
      throw new Error(`Requirement ${requirementType} not found in vetting request ${vettingRequestId}`);
    }
    
    const requirement = vettingRequest.requirements[requirementIndex];
    
    // Check if requirement is already completed
    if (requirement.status === 'completed') {
      throw new Error(`Requirement ${requirementType} is already completed`);
    }
    
    // Update requirement
    const updatedRequirements = [...vettingRequest.requirements];
    updatedRequirements[requirementIndex] = {
      ...requirement,
      status: 'under_review',
      documentSubmittedAt: new Date().toISOString(),
      documentData: {
        ...documentData,
        documentId: `doc_${crypto.randomBytes(8).toString('hex')}`
      }
    };
    
    // Update vetting request
    const updatedVettingRequest = {
      ...vettingRequest,
      requirements: updatedRequirements,
      updatedAt: new Date().toISOString()
    };
    
    // Store updated vetting request
    this.vettingRequests.set(vettingRequestId, updatedVettingRequest);
    
    // Emit event
    this.events.emit('vetting:document_submitted', { 
      vettingRequest: updatedVettingRequest,
      requirementType,
      documentData: updatedRequirements[requirementIndex].documentData
    });
    
    return updatedVettingRequest;
  }

  /**
   * Verify a requirement
   * @param {string} vettingRequestId - Vetting request ID
   * @param {string} requirementType - Requirement type
   * @param {string} reviewerId - Reviewer ID
   * @param {boolean} approved - Whether the requirement is approved
   * @param {string} notes - Notes about the verification
   * @returns {Promise<Object>} - Promise resolving to the updated vetting request
   */
  async verifyRequirement(vettingRequestId, requirementType, reviewerId, approved, notes) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Verifying requirement ${requirementType} for vetting request: ${vettingRequestId}`);
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    // Find requirement
    const requirementIndex = vettingRequest.requirements.findIndex(req => req.type === requirementType);
    
    if (requirementIndex === -1) {
      throw new Error(`Requirement ${requirementType} not found in vetting request ${vettingRequestId}`);
    }
    
    const requirement = vettingRequest.requirements[requirementIndex];
    
    // Check if requirement is ready for verification
    if (requirement.status !== 'under_review') {
      throw new Error(`Requirement ${requirementType} is not under review`);
    }
    
    // Update requirement
    const updatedRequirements = [...vettingRequest.requirements];
    updatedRequirements[requirementIndex] = {
      ...requirement,
      status: approved ? 'completed' : 'rejected',
      verifiedAt: approved ? new Date().toISOString() : null,
      reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes
    };
    
    // Update trust score based on verification result
    let trustScoreAdjustment = 0;
    
    if (approved) {
      switch (requirementType) {
        case 'identity_verification':
          trustScoreAdjustment = 30;
          break;
        case 'financial_verification':
          trustScoreAdjustment = 20;
          break;
        default:
          trustScoreAdjustment = 10;
      }
    } else {
      // Failed verification reduces trust score
      trustScoreAdjustment = -20;
    }
    
    // Update vetting request
    const updatedVettingRequest = {
      ...vettingRequest,
      requirements: updatedRequirements,
      trustScore: Math.max(0, Math.min(100, vettingRequest.trustScore + trustScoreAdjustment)),
      notes: [
        ...vettingRequest.notes,
        {
          type: approved ? 'requirement_approved' : 'requirement_rejected',
          requirementType,
          reviewerId,
          notes,
          timestamp: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated vetting request
    this.vettingRequests.set(vettingRequestId, updatedVettingRequest);
    
    // Update developer account
    const account = await this.accountManager.getDeveloperAccount(vettingRequest.developerId);
    
    await this.accountManager.updateDeveloperAccount(vettingRequest.developerId, {
      securityProfile: {
        ...account.securityProfile,
        trustScore: updatedVettingRequest.trustScore,
        riskLevel: this._calculateRiskLevel(updatedVettingRequest),
        lastReviewDate: new Date().toISOString()
      }
    });
    
    // Check if all requirements are completed
    const allCompleted = updatedVettingRequest.requirements.every(req => req.status === 'completed');
    const anyRejected = updatedVettingRequest.requirements.some(req => req.status === 'rejected');
    
    if (allCompleted) {
      // Auto-approve vetting request if all requirements are completed
      await this.approveVettingRequest(vettingRequestId, reviewerId, 'All requirements completed');
    } else if (anyRejected) {
      // Auto-reject vetting request if any requirement is rejected
      await this.rejectVettingRequest(vettingRequestId, reviewerId, 'One or more requirements rejected');
    }
    
    // Emit event
    this.events.emit('vetting:requirement_verified', { 
      vettingRequest: updatedVettingRequest,
      requirementType,
      approved,
      reviewerId
    });
    
    return updatedVettingRequest;
  }

  /**
   * Approve a vetting request
   * @param {string} vettingRequestId - Vetting request ID
   * @param {string} reviewerId - Reviewer ID
   * @param {string} notes - Notes about the approval
   * @returns {Promise<Object>} - Promise resolving to the updated vetting request
   */
  async approveVettingRequest(vettingRequestId, reviewerId, notes) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Approving vetting request: ${vettingRequestId}`);
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    // Check if vetting request is already approved or rejected
    if (vettingRequest.status === 'approved' || vettingRequest.status === 'rejected') {
      throw new Error(`Vetting request ${vettingRequestId} is already ${vettingRequest.status}`);
    }
    
    // Update vetting request
    const updatedVettingRequest = {
      ...vettingRequest,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      reviewerId,
      notes: [
        ...vettingRequest.notes,
        {
          type: 'request_approved',
          reviewerId,
          notes,
          timestamp: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated vetting request
    this.vettingRequests.set(vettingRequestId, updatedVettingRequest);
    
    // Update developer account
    await this.accountManager.updateDeveloperAccount(vettingRequest.developerId, {
      vettingStatus: 'approved',
      securityProfile: {
        ...vettingRequest.securityProfile,
        vettingApprovedAt: new Date().toISOString(),
        lastReviewDate: new Date().toISOString()
      }
    });
    
    // Emit event
    this.events.emit('vetting:request_approved', { 
      vettingRequest: updatedVettingRequest,
      reviewerId
    });
    
    // Notify developer
    if (this.notificationService) {
      const account = await this.accountManager.getDeveloperAccount(vettingRequest.developerId);
      
      await this.notificationService.sendNotification(account.userId, {
        type: 'verification',
        title: 'Developer Verification Approved',
        message: 'Your developer account verification has been approved. You can now submit tentacles to the marketplace.',
        priority: 'high'
      });
    }
    
    return updatedVettingRequest;
  }

  /**
   * Reject a vetting request
   * @param {string} vettingRequestId - Vetting request ID
   * @param {string} reviewerId - Reviewer ID
   * @param {string} notes - Notes about the rejection
   * @returns {Promise<Object>} - Promise resolving to the updated vetting request
   */
  async rejectVettingRequest(vettingRequestId, reviewerId, notes) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Rejecting vetting request: ${vettingRequestId}`);
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    // Check if vetting request is already approved or rejected
    if (vettingRequest.status === 'approved' || vettingRequest.status === 'rejected') {
      throw new Error(`Vetting request ${vettingRequestId} is already ${vettingRequest.status}`);
    }
    
    // Update vetting request
    const updatedVettingRequest = {
      ...vettingRequest,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      reviewerId,
      notes: [
        ...vettingRequest.notes,
        {
          type: 'request_rejected',
          reviewerId,
          notes,
          timestamp: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated vetting request
    this.vettingRequests.set(vettingRequestId, updatedVettingRequest);
    
    // Update developer account
    await this.accountManager.updateDeveloperAccount(vettingRequest.developerId, {
      vettingStatus: 'rejected',
      securityProfile: {
        ...vettingRequest.securityProfile,
        vettingRejectedAt: new Date().toISOString(),
        lastReviewDate: new Date().toISOString()
      }
    });
    
    // Emit event
    this.events.emit('vetting:request_rejected', { 
      vettingRequest: updatedVettingRequest,
      reviewerId
    });
    
    // Notify developer
    if (this.notificationService) {
      const account = await this.accountManager.getDeveloperAccount(vettingRequest.developerId);
      
      await this.notificationService.sendNotification(account.userId, {
        type: 'verification',
        title: 'Developer Verification Rejected',
        message: `Your developer account verification has been rejected. Reason: ${notes}`,
        action: 'contact_support',
        priority: 'high'
      });
    }
    
    return updatedVettingRequest;
  }

  /**
   * Add a risk factor to a vetting request
   * @param {string} vettingRequestId - Vetting request ID
   * @param {string} riskType - Risk factor type
   * @param {string} description - Risk factor description
   * @param {number} severity - Risk factor severity (1-100)
   * @returns {Promise<Object>} - Promise resolving to the updated vetting request
   */
  async addRiskFactor(vettingRequestId, riskType, description, severity) {
    if (!this.initialized) {
      throw new Error('DeveloperVettingService not initialized');
    }
    
    this.logger.info(`Adding risk factor to vetting request: ${vettingRequestId}`);
    
    const vettingRequest = this.vettingRequests.get(vettingRequestId);
    
    if (!vettingRequest) {
      throw new Error(`Vetting request ${vettingRequestId} not found`);
    }
    
    // Create risk factor
    const riskFactor = {
      id: `risk_${crypto.randomBytes(8).toString('hex')}`,
      type: riskType,
      description,
      severity: Math.max(1, Math.min(100, severity)),
      createdAt: new Date().toISOString()
    };
    
    // Update vetting request
    const updatedVettingRequest = {
      ...vettingRequest,
      riskFactors: [...vettingRequest.riskFactors, riskFactor],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated vetting request
    this.vettingRequests.set(vettingRequestId, updatedVettingRequest);
    
    // Update developer account
    const account = await this.accountManager.getDeveloperAccount(vettingRequest.developerId);
    
    await this.accountManager.updateDeveloperAccount(vettingRequest.developerId, {
      securityProfile: {
        ...account.securityProfile,
        riskLevel: this._calculateRiskLevel(updatedVettingRequest),
        lastReviewDate: new Date().toISOString()
      }
    });
    
    // Emit event
    this.events.emit('vetting:risk_factor_added', { 
      vettingRequest: updatedVettingRequest,
      riskFactor
    });
    
    return updatedVettingRequest;
  }

  /**
   * Calculate risk level based on risk factors
   * @param {Object} vettingRequest - Vetting request
   * @returns {string} - Risk level (low, medium, high)
   * @private
   */
  _calculateRiskLevel(vettingRequest) {
    if (!vettingRequest.riskFactors || vettingRequest.riskFactors.length === 0) {
      return 'low';
    }
    
    // Calculate average risk severity
    const totalSeverity = vettingRequest.riskFactors.reduce((sum, factor) => sum + factor.severity, 0);
    const averageSeverity = totalSeverity / vettingRequest.riskFactors.length;
    
    if (averageSeverity >= 70) {
      return 'high';
    } else if (averageSeverity >= 30) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get the status of the developer vetting service
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      vettingRequestCount: this.vettingRequests.size
    };
  }

  /**
   * Shutdown the developer vetting service
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('DeveloperVettingService not initialized');
      return true;
    }
    
    this.logger.info('Shutting down DeveloperVettingService');
    
    // Remove event listeners
    if (this.accountManager) {
      this.accountManager.events.removeAllListeners('developer:created');
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { DeveloperVettingService };
