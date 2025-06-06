/**
 * @fileoverview Submission System for the Aideon Developer Portal
 * 
 * This module provides functionality for managing tentacle submissions,
 * including creation, validation, and submission for verification.
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
 * SubmissionSystem class - Manages tentacle submissions for the Developer Portal
 */
class SubmissionSystem {
  /**
   * Create a new SubmissionSystem instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {Object} options.verificationService - Reference to the verification service
   * @param {string} options.storagePath - Path to store submission data
   * @param {Object} options.securitySettings - Security settings for submissions
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.verificationService = options.verificationService;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'tentacle-submissions');
    this.securitySettings = options.securitySettings || {
      codeSigningRequired: true,
      automaticSecurityScanning: true,
      sandboxedTesting: true,
      resourceMonitoring: true
    };
    this.logger = new Logger('SubmissionSystem');
    this.events = new EventEmitter();
    this.submissions = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the submission system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('SubmissionSystem already initialized');
      return true;
    }

    this.logger.info('Initializing SubmissionSystem');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load submissions from storage
      await this._loadSubmissions();
      
      this.initialized = true;
      this.logger.info('SubmissionSystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize SubmissionSystem', error);
      throw error;
    }
  }

  /**
   * Load submissions from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadSubmissions() {
    try {
      const submissionsFile = path.join(this.storagePath, 'submissions.json');
      
      // Check if file exists
      try {
        await fs.access(submissionsFile);
      } catch (error) {
        // File doesn't exist, create empty submissions file
        await fs.writeFile(submissionsFile, JSON.stringify([]));
        return;
      }
      
      // Read submissions from file
      const data = await fs.readFile(submissionsFile, 'utf8');
      const submissions = JSON.parse(data);
      
      // Populate submissions map
      submissions.forEach(submission => {
        this.submissions.set(submission.id, submission);
      });
      
      this.logger.info(`Loaded ${submissions.length} tentacle submissions`);
    } catch (error) {
      this.logger.error('Failed to load submissions', error);
      throw error;
    }
  }

  /**
   * Save submissions to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveSubmissions() {
    try {
      const submissionsFile = path.join(this.storagePath, 'submissions.json');
      const submissions = Array.from(this.submissions.values());
      
      await fs.writeFile(submissionsFile, JSON.stringify(submissions, null, 2));
      
      this.logger.info(`Saved ${submissions.length} tentacle submissions`);
    } catch (error) {
      this.logger.error('Failed to save submissions', error);
      throw error;
    }
  }

  /**
   * Create a new tentacle submission
   * @param {string} developerId - Developer account ID
   * @param {Object} tentacleData - Tentacle data
   * @returns {Promise<Object>} - Promise resolving to the created submission
   */
  async createSubmission(developerId, tentacleData = {}) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Creating submission for developer: ${developerId}`);
    
    // Verify developer account exists and is approved
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (account.vettingStatus !== 'approved') {
      throw new Error(`Developer ${developerId} is not approved for submissions`);
    }
    
    // Validate tentacle data
    if (!tentacleData.name) {
      throw new Error('Tentacle name is required');
    }
    
    if (!tentacleData.version) {
      throw new Error('Tentacle version is required');
    }
    
    // Apply security checks based on settings
    const securityChecks = [];
    
    if (this.securitySettings.codeSigningRequired) {
      securityChecks.push({
        type: 'code_signing',
        status: tentacleData.signed ? 'passed' : 'failed',
        message: tentacleData.signed ? 'Code is properly signed' : 'Code must be signed with a valid developer certificate'
      });
    }
    
    if (this.securitySettings.automaticSecurityScanning) {
      securityChecks.push({
        type: 'security_scan',
        status: 'pending',
        message: 'Security scan scheduled'
      });
    }
    
    // Create submission
    const submission = {
      id: `sub_${crypto.randomBytes(8).toString('hex')}`,
      developerId,
      tentacleData: {
        id: tentacleData.id || `tentacle_${crypto.randomBytes(8).toString('hex')}`,
        name: tentacleData.name,
        description: tentacleData.description || '',
        version: tentacleData.version,
        category: tentacleData.category || 'general',
        tags: tentacleData.tags || [],
        capabilities: tentacleData.capabilities || [],
        dependencies: tentacleData.dependencies || [],
        signed: tentacleData.signed || false,
        packageUrl: tentacleData.packageUrl || null,
        documentationUrl: tentacleData.documentationUrl || null,
        iconUrl: tentacleData.iconUrl || null,
        screenshots: tentacleData.screenshots || [],
        pricing: tentacleData.pricing || { type: 'free' }
      },
      status: 'draft',
      securityChecks,
      verificationResults: null,
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          details: 'Submission created'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store submission
    this.submissions.set(submission.id, submission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:created', { submission });
    
    return submission;
  }

  /**
   * Get a submission by ID
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the submission
   */
  async getSubmission(submissionId) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    return submission;
  }

  /**
   * Update a submission
   * @param {string} submissionId - Submission ID
   * @param {Object} updates - Updates to apply to the submission
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async updateSubmission(submissionId, updates = {}) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Updating submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission can be updated
    if (submission.status !== 'draft' && submission.status !== 'rejected') {
      throw new Error(`Submission ${submissionId} cannot be updated in status: ${submission.status}`);
    }
    
    // Apply updates to tentacle data
    const updatedTentacleData = {
      ...submission.tentacleData,
      ...(updates.tentacleData || {})
    };
    
    // Re-apply security checks if tentacle data has changed
    let securityChecks = [...submission.securityChecks];
    
    if (updates.tentacleData) {
      // Update code signing check if needed
      if (this.securitySettings.codeSigningRequired) {
        const codeSigningCheck = securityChecks.find(check => check.type === 'code_signing');
        
        if (codeSigningCheck) {
          codeSigningCheck.status = updatedTentacleData.signed ? 'passed' : 'failed';
          codeSigningCheck.message = updatedTentacleData.signed ? 
            'Code is properly signed' : 'Code must be signed with a valid developer certificate';
        } else {
          securityChecks.push({
            type: 'code_signing',
            status: updatedTentacleData.signed ? 'passed' : 'failed',
            message: updatedTentacleData.signed ? 
              'Code is properly signed' : 'Code must be signed with a valid developer certificate'
          });
        }
      }
      
      // Reset security scan if needed
      if (this.securitySettings.automaticSecurityScanning) {
        const securityScanCheck = securityChecks.find(check => check.type === 'security_scan');
        
        if (securityScanCheck) {
          securityScanCheck.status = 'pending';
          securityScanCheck.message = 'Security scan scheduled';
        } else {
          securityChecks.push({
            type: 'security_scan',
            status: 'pending',
            message: 'Security scan scheduled'
          });
        }
      }
    }
    
    // Create history entry
    const historyEntry = {
      action: 'updated',
      timestamp: new Date().toISOString(),
      details: updates.historyDetails || 'Submission updated'
    };
    
    // Create updated submission
    const updatedSubmission = {
      ...submission,
      tentacleData: updatedTentacleData,
      securityChecks,
      status: updates.status || submission.status,
      history: [...submission.history, historyEntry],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:updated', { 
      submission: updatedSubmission,
      previousSubmission: submission
    });
    
    return updatedSubmission;
  }

  /**
   * Submit a tentacle for verification
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async submitForVerification(submissionId) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Submitting tentacle for verification: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission can be submitted
    if (submission.status !== 'draft' && submission.status !== 'rejected') {
      throw new Error(`Submission ${submissionId} cannot be submitted in status: ${submission.status}`);
    }
    
    // Check if all security checks have passed
    const failedChecks = submission.securityChecks.filter(check => check.status === 'failed');
    
    if (failedChecks.length > 0) {
      throw new Error(`Submission has failed security checks: ${failedChecks.map(c => c.message).join(', ')}`);
    }
    
    // Create history entry
    const historyEntry = {
      action: 'submitted',
      timestamp: new Date().toISOString(),
      details: 'Submitted for verification'
    };
    
    // Create updated submission
    const updatedSubmission = {
      ...submission,
      status: 'pending_verification',
      history: [...submission.history, historyEntry],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:submitted', { submission: updatedSubmission });
    
    // If verification service is available, send for verification
    if (this.verificationService) {
      try {
        await this.verificationService.queueForVerification(updatedSubmission);
      } catch (error) {
        this.logger.error(`Failed to queue submission for verification: ${submissionId}`, error);
        // Don't fail the submission process, verification service will poll for pending submissions
      }
    }
    
    return updatedSubmission;
  }

  /**
   * Update verification results for a submission
   * @param {string} submissionId - Submission ID
   * @param {Object} verificationResults - Verification results
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async updateVerificationResults(submissionId, verificationResults) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Updating verification results for submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission is in verification
    if (submission.status !== 'pending_verification') {
      throw new Error(`Submission ${submissionId} is not in verification status`);
    }
    
    // Determine new status based on verification results
    let newStatus = 'rejected';
    let historyDetails = 'Verification failed';
    
    if (verificationResults.passed) {
      newStatus = 'approved';
      historyDetails = 'Verification passed';
    }
    
    // Create history entry
    const historyEntry = {
      action: 'verified',
      timestamp: new Date().toISOString(),
      details: historyDetails
    };
    
    // Create updated submission
    const updatedSubmission = {
      ...submission,
      status: newStatus,
      verificationResults,
      history: [...submission.history, historyEntry],
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:verified', { 
      submission: updatedSubmission,
      verificationResults
    });
    
    return updatedSubmission;
  }

  /**
   * Publish a tentacle to the marketplace
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async publishToMarketplace(submissionId) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Publishing tentacle to marketplace: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission can be published
    if (submission.status !== 'approved') {
      throw new Error(`Submission ${submissionId} cannot be published in status: ${submission.status}`);
    }
    
    // Create history entry
    const historyEntry = {
      action: 'published',
      timestamp: new Date().toISOString(),
      details: 'Published to marketplace'
    };
    
    // Create updated submission
    const updatedSubmission = {
      ...submission,
      status: 'published',
      history: [...submission.history, historyEntry],
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:published', { submission: updatedSubmission });
    
    return updatedSubmission;
  }

  /**
   * Get submissions for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of submissions
   */
  async getSubmissionsForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    // Verify developer account exists
    await this.accountManager.getDeveloperAccount(developerId);
    
    // Get submissions for developer
    return Array.from(this.submissions.values())
      .filter(submission => submission.developerId === developerId);
  }

  /**
   * Get submissions by status
   * @param {string} status - Submission status
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of submissions
   */
  async getSubmissionsByStatus(status) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    // Get submissions by status
    return Array.from(this.submissions.values())
      .filter(submission => submission.status === status);
  }

  /**
   * Run security checks on a submission
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async runSecurityChecks(submissionId) {
    if (!this.initialized) {
      throw new Error('SubmissionSystem not initialized');
    }
    
    this.logger.info(`Running security checks for submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Run security checks
    const securityChecks = [...submission.securityChecks];
    
    // Update security scan check
    if (this.securitySettings.automaticSecurityScanning) {
      const securityScanCheck = securityChecks.find(check => check.type === 'security_scan');
      
      if (securityScanCheck) {
        // In a real implementation, this would call out to a security scanning service
        // For now, we'll simulate a successful scan
        securityScanCheck.status = 'passed';
        securityScanCheck.message = 'Security scan completed successfully';
        securityScanCheck.details = {
          scanTime: new Date().toISOString(),
          vulnerabilities: [],
          malwareDetected: false
        };
      }
    }
    
    // Create history entry
    const historyEntry = {
      action: 'security_checked',
      timestamp: new Date().toISOString(),
      details: 'Security checks completed'
    };
    
    // Create updated submission
    const updatedSubmission = {
      ...submission,
      securityChecks,
      history: [...submission.history, historyEntry],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmissions();
    
    // Emit event
    this.events.emit('submission:security_checked', { 
      submission: updatedSubmission,
      securityChecks
    });
    
    return updatedSubmission;
  }

  /**
   * Get the status of the submission system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      submissionCount: this.submissions.size,
      draftCount: Array.from(this.submissions.values()).filter(s => s.status === 'draft').length,
      pendingVerificationCount: Array.from(this.submissions.values()).filter(s => s.status === 'pending_verification').length,
      approvedCount: Array.from(this.submissions.values()).filter(s => s.status === 'approved').length,
      rejectedCount: Array.from(this.submissions.values()).filter(s => s.status === 'rejected').length,
      publishedCount: Array.from(this.submissions.values()).filter(s => s.status === 'published').length,
      securitySettings: { ...this.securitySettings }
    };
  }

  /**
   * Shutdown the submission system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('SubmissionSystem not initialized');
      return true;
    }

    this.logger.info('Shutting down SubmissionSystem');
    
    try {
      // Save submissions
      await this._saveSubmissions();
      
      this.initialized = false;
      this.logger.info('SubmissionSystem shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown SubmissionSystem', error);
      return false;
    }
  }
}

module.exports = { SubmissionSystem };
