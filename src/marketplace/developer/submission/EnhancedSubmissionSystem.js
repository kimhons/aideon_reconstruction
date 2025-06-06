/**
 * @fileoverview Enhanced Submission System for the Aideon Developer Portal
 * 
 * This module provides enhanced functionality for managing tentacle submissions,
 * including comprehensive validation, testing, and publishing workflows.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const semver = require('semver');

/**
 * EnhancedSubmissionSystem class - Manages tentacle submissions with advanced features
 */
class EnhancedSubmissionSystem {
  /**
   * Create a new EnhancedSubmissionSystem instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {Object} options.verificationService - Reference to the verification service
   * @param {Object} options.monetizationService - Reference to the monetization service
   * @param {string} options.storagePath - Path to store submission data
   * @param {Object} options.securitySettings - Security settings for submissions
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.verificationService = options.verificationService;
    this.monetizationService = options.monetizationService;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'tentacle-submissions');
    this.securitySettings = options.securitySettings || {
      codeSigningRequired: true,
      automaticSecurityScanning: true,
      sandboxedTesting: true,
      resourceMonitoring: true,
      dependencyAnalysis: true,
      compatibilityChecking: true
    };
    this.logger = new Logger('EnhancedSubmissionSystem');
    this.events = new EventEmitter();
    this.submissions = new Map();
    this.versions = new Map();
    this.betaPrograms = new Map();
    this.initialized = false;
    
    // Define submission statuses and their allowed transitions
    this.statusTransitions = {
      draft: ['pending_verification', 'deleted'],
      pending_verification: ['verification_failed', 'approved', 'rejected'],
      verification_failed: ['draft', 'pending_verification', 'deleted'],
      approved: ['published', 'rejected', 'archived'],
      rejected: ['draft', 'deleted'],
      published: ['unpublished', 'archived'],
      unpublished: ['published', 'archived', 'deleted'],
      archived: ['deleted'],
      deleted: []
    };
    
    // Define pricing models
    this.pricingModels = {
      free: {
        name: 'Free',
        requiresPayment: false
      },
      one_time: {
        name: 'One-Time Purchase',
        requiresPayment: true,
        requiresRenewal: true
      },
      subscription: {
        name: 'Subscription',
        requiresPayment: true,
        billingCycles: ['monthly', 'quarterly', 'annual']
      },
      usage_based: {
        name: 'Usage-Based',
        requiresPayment: true,
        metricTypes: ['api_calls', 'compute_time', 'data_processed']
      }
    };
  }

  /**
   * Initialize the submission system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('EnhancedSubmissionSystem already initialized');
      return true;
    }

    this.logger.info('Initializing EnhancedSubmissionSystem');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'submissions'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'versions'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'beta'), { recursive: true });
      
      // Load submissions from storage
      await this._loadSubmissions();
      
      // Load versions from storage
      await this._loadVersions();
      
      // Load beta programs from storage
      await this._loadBetaPrograms();
      
      this.initialized = true;
      this.logger.info('EnhancedSubmissionSystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize EnhancedSubmissionSystem', error);
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
      const submissionsDir = path.join(this.storagePath, 'submissions');
      const files = await fs.readdir(submissionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(submissionsDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const submission = JSON.parse(data);
          
          this.submissions.set(submission.id, submission);
        }
      }
      
      this.logger.info(`Loaded ${this.submissions.size} tentacle submissions`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.info('No submissions directory found, will be created when needed');
        return;
      }
      
      this.logger.error('Failed to load submissions', error);
      throw error;
    }
  }

  /**
   * Save a submission to storage
   * @param {Object} submission - Submission to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveSubmission(submission) {
    try {
      const submissionsDir = path.join(this.storagePath, 'submissions');
      const filePath = path.join(submissionsDir, `${submission.id}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(submission, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save submission ${submission.id}`, error);
      throw error;
    }
  }

  /**
   * Load versions from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadVersions() {
    try {
      const versionsDir = path.join(this.storagePath, 'versions');
      const files = await fs.readdir(versionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(versionsDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const version = JSON.parse(data);
          
          this.versions.set(version.id, version);
        }
      }
      
      this.logger.info(`Loaded ${this.versions.size} tentacle versions`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.info('No versions directory found, will be created when needed');
        return;
      }
      
      this.logger.error('Failed to load versions', error);
      throw error;
    }
  }

  /**
   * Save a version to storage
   * @param {Object} version - Version to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveVersion(version) {
    try {
      const versionsDir = path.join(this.storagePath, 'versions');
      const filePath = path.join(versionsDir, `${version.id}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(version, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save version ${version.id}`, error);
      throw error;
    }
  }

  /**
   * Load beta programs from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadBetaPrograms() {
    try {
      const betaDir = path.join(this.storagePath, 'beta');
      const files = await fs.readdir(betaDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(betaDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const betaProgram = JSON.parse(data);
          
          this.betaPrograms.set(betaProgram.id, betaProgram);
        }
      }
      
      this.logger.info(`Loaded ${this.betaPrograms.size} beta programs`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.info('No beta directory found, will be created when needed');
        return;
      }
      
      this.logger.error('Failed to load beta programs', error);
      throw error;
    }
  }

  /**
   * Save a beta program to storage
   * @param {Object} betaProgram - Beta program to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveBetaProgram(betaProgram) {
    try {
      const betaDir = path.join(this.storagePath, 'beta');
      const filePath = path.join(betaDir, `${betaProgram.id}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(betaProgram, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save beta program ${betaProgram.id}`, error);
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
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Creating submission for developer: ${developerId}`);
    
    // Verify developer account exists and is approved
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (account.vettingStatus !== 'approved') {
      throw new Error(`Developer ${developerId} is not approved for submissions`);
    }
    
    // Validate tentacle data
    this._validateTentacleData(tentacleData);
    
    // Check for existing tentacle with same name
    const existingTentacle = Array.from(this.submissions.values())
      .find(sub => 
        sub.tentacleData.name.toLowerCase() === tentacleData.name.toLowerCase() &&
        sub.status !== 'deleted'
      );
    
    if (existingTentacle) {
      throw new Error(`A tentacle with name "${tentacleData.name}" already exists`);
    }
    
    // Apply security checks based on settings
    const securityChecks = this._createInitialSecurityChecks(tentacleData);
    
    // Create submission
    const submissionId = `sub_${crypto.randomBytes(8).toString('hex')}`;
    const tentacleId = tentacleData.id || `tentacle_${crypto.randomBytes(8).toString('hex')}`;
    
    const submission = {
      id: submissionId,
      developerId,
      tentacleData: {
        id: tentacleId,
        name: tentacleData.name,
        description: tentacleData.description || '',
        version: tentacleData.version || '0.1.0',
        category: tentacleData.category || 'general',
        tags: tentacleData.tags || [],
        capabilities: tentacleData.capabilities || [],
        dependencies: tentacleData.dependencies || [],
        compatibilityInfo: tentacleData.compatibilityInfo || {
          minAideonVersion: '1.0.0',
          maxAideonVersion: null,
          platforms: ['windows', 'macos', 'linux']
        },
        resources: tentacleData.resources || {
          memory: 'low',
          cpu: 'low',
          storage: 'low',
          network: 'low'
        },
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
      validationResults: null,
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          details: 'Submission created'
        }
      ],
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store submission
    this.submissions.set(submission.id, submission);
    await this._saveSubmission(submission);
    
    // Emit event
    this.events.emit('submission:created', { submission });
    
    return submission;
  }

  /**
   * Validate tentacle data
   * @param {Object} tentacleData - Tentacle data to validate
   * @throws {Error} If validation fails
   * @private
   */
  _validateTentacleData(tentacleData) {
    if (!tentacleData.name) {
      throw new Error('Tentacle name is required');
    }
    
    if (tentacleData.name.length < 3 || tentacleData.name.length > 50) {
      throw new Error('Tentacle name must be between 3 and 50 characters');
    }
    
    if (tentacleData.version && !semver.valid(tentacleData.version)) {
      throw new Error('Tentacle version must be a valid semantic version');
    }
    
    if (tentacleData.pricing) {
      const pricingType = tentacleData.pricing.type;
      
      if (!this.pricingModels[pricingType]) {
        throw new Error(`Invalid pricing type: ${pricingType}`);
      }
      
      if (this.pricingModels[pricingType].requiresPayment) {
        if (!tentacleData.pricing.price) {
          throw new Error(`Price is required for ${pricingType} pricing model`);
        }
        
        if (typeof tentacleData.pricing.price !== 'number' || tentacleData.pricing.price < 0) {
          throw new Error('Price must be a non-negative number');
        }
        
        if (pricingType === 'subscription' && !tentacleData.pricing.billingCycle) {
          throw new Error('Billing cycle is required for subscription pricing model');
        }
        
        if (pricingType === 'subscription' && 
            !this.pricingModels.subscription.billingCycles.includes(tentacleData.pricing.billingCycle)) {
          throw new Error(`Invalid billing cycle: ${tentacleData.pricing.billingCycle}`);
        }
        
        if (pricingType === 'usage_based' && !tentacleData.pricing.metricType) {
          throw new Error('Metric type is required for usage-based pricing model');
        }
        
        if (pricingType === 'usage_based' && 
            !this.pricingModels.usage_based.metricTypes.includes(tentacleData.pricing.metricType)) {
          throw new Error(`Invalid metric type: ${tentacleData.pricing.metricType}`);
        }
      }
    }
  }

  /**
   * Create initial security checks for a tentacle
   * @param {Object} tentacleData - Tentacle data
   * @returns {Array<Object>} - Array of security checks
   * @private
   */
  _createInitialSecurityChecks(tentacleData) {
    const securityChecks = [];
    
    if (this.securitySettings.codeSigningRequired) {
      securityChecks.push({
        type: 'code_signing',
        status: tentacleData.signed ? 'passed' : 'failed',
        message: tentacleData.signed ? 
          'Code is properly signed' : 
          'Code must be signed with a valid developer certificate'
      });
    }
    
    if (this.securitySettings.automaticSecurityScanning) {
      securityChecks.push({
        type: 'security_scan',
        status: 'pending',
        message: 'Security scan scheduled'
      });
    }
    
    if (this.securitySettings.dependencyAnalysis) {
      securityChecks.push({
        type: 'dependency_analysis',
        status: 'pending',
        message: 'Dependency analysis scheduled'
      });
    }
    
    if (this.securitySettings.compatibilityChecking) {
      securityChecks.push({
        type: 'compatibility_check',
        status: 'pending',
        message: 'Compatibility check scheduled'
      });
    }
    
    return securityChecks;
  }

  /**
   * Get a submission by ID
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the submission
   */
  async getSubmission(submissionId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
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
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Updating submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission can be updated
    if (!['draft', 'verification_failed', 'rejected'].includes(submission.status)) {
      throw new Error(`Submission ${submissionId} cannot be updated in status: ${submission.status}`);
    }
    
    // Validate tentacle data updates
    if (updates.tentacleData) {
      // Merge with existing data for validation
      const mergedTentacleData = {
        ...submission.tentacleData,
        ...updates.tentacleData
      };
      
      this._validateTentacleData(mergedTentacleData);
    }
    
    // Apply updates to tentacle data
    const updatedTentacleData = {
      ...submission.tentacleData,
      ...(updates.tentacleData || {})
    };
    
    // Re-apply security checks if tentacle data has changed
    let securityChecks = [...submission.securityChecks];
    
    if (updates.tentacleData) {
      securityChecks = this._updateSecurityChecks(securityChecks, updatedTentacleData);
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
      history: [...submission.history, historyEntry],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmission(updatedSubmission);
    
    // Emit event
    this.events.emit('submission:updated', { 
      submission: updatedSubmission,
      previousSubmission: submission
    });
    
    return updatedSubmission;
  }

  /**
   * Update security checks based on tentacle data
   * @param {Array<Object>} securityChecks - Existing security checks
   * @param {Object} tentacleData - Updated tentacle data
   * @returns {Array<Object>} - Updated security checks
   * @private
   */
  _updateSecurityChecks(securityChecks, tentacleData) {
    const updatedChecks = [...securityChecks];
    
    // Update code signing check if needed
    if (this.securitySettings.codeSigningRequired) {
      const codeSigningCheck = updatedChecks.find(check => check.type === 'code_signing');
      
      if (codeSigningCheck) {
        codeSigningCheck.status = tentacleData.signed ? 'passed' : 'failed';
        codeSigningCheck.message = tentacleData.signed ? 
          'Code is properly signed' : 
          'Code must be signed with a valid developer certificate';
      } else {
        updatedChecks.push({
          type: 'code_signing',
          status: tentacleData.signed ? 'passed' : 'failed',
          message: tentacleData.signed ? 
            'Code is properly signed' : 
            'Code must be signed with a valid developer certificate'
        });
      }
    }
    
    // Reset security scan if needed
    if (this.securitySettings.automaticSecurityScanning) {
      const securityScanCheck = updatedChecks.find(check => check.type === 'security_scan');
      
      if (securityScanCheck) {
        securityScanCheck.status = 'pending';
        securityScanCheck.message = 'Security scan scheduled';
      } else {
        updatedChecks.push({
          type: 'security_scan',
          status: 'pending',
          message: 'Security scan scheduled'
        });
      }
    }
    
    // Reset dependency analysis if needed
    if (this.securitySettings.dependencyAnalysis) {
      const dependencyCheck = updatedChecks.find(check => check.type === 'dependency_analysis');
      
      if (dependencyCheck) {
        dependencyCheck.status = 'pending';
        dependencyCheck.message = 'Dependency analysis scheduled';
      } else {
        updatedChecks.push({
          type: 'dependency_analysis',
          status: 'pending',
          message: 'Dependency analysis scheduled'
        });
      }
    }
    
    // Reset compatibility check if needed
    if (this.securitySettings.compatibilityChecking) {
      const compatibilityCheck = updatedChecks.find(check => check.type === 'compatibility_check');
      
      if (compatibilityCheck) {
        compatibilityCheck.status = 'pending';
        compatibilityCheck.message = 'Compatibility check scheduled';
      } else {
        updatedChecks.push({
          type: 'compatibility_check',
          status: 'pending',
          message: 'Compatibility check scheduled'
        });
      }
    }
    
    return updatedChecks;
  }

  /**
   * Submit a tentacle for verification
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async submitForVerification(submissionId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Submitting tentacle for verification: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission can be submitted
    if (!['draft', 'verification_failed', 'rejected'].includes(submission.status)) {
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
    await this._saveSubmission(updatedSubmission);
    
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
      throw new Error('EnhancedSubmissionSystem not initialized');
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
    let newStatus = 'verification_failed';
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
    await this._saveSubmission(updatedSubmission);
    
    // Emit event
    this.events.emit('submission:verified', { 
      submission: updatedSubmission,
      verificationResults
    });
    
    return updatedSubmission;
  }

  /**
   * Create a new version for a tentacle
   * @param {string} submissionId - Submission ID
   * @param {Object} versionData - Version data
   * @returns {Promise<Object>} - Promise resolving to the created version
   */
  async createVersion(submissionId, versionData = {}) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Creating new version for submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission is published
    if (submission.status !== 'published' && submission.status !== 'approved') {
      throw new Error(`Cannot create version for submission in status: ${submission.status}`);
    }
    
    // Validate version
    if (!versionData.version) {
      throw new Error('Version number is required');
    }
    
    if (!semver.valid(versionData.version)) {
      throw new Error('Version must be a valid semantic version');
    }
    
    // Check if version already exists
    const existingVersion = submission.versions.find(v => v.version === versionData.version);
    
    if (existingVersion) {
      throw new Error(`Version ${versionData.version} already exists for this tentacle`);
    }
    
    // Check if version is greater than current version
    if (semver.lte(versionData.version, submission.tentacleData.version)) {
      throw new Error(`New version must be greater than current version: ${submission.tentacleData.version}`);
    }
    
    // Create version
    const versionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
    
    const version = {
      id: versionId,
      submissionId,
      tentacleId: submission.tentacleData.id,
      version: versionData.version,
      releaseNotes: versionData.releaseNotes || '',
      packageUrl: versionData.packageUrl || submission.tentacleData.packageUrl,
      documentationUrl: versionData.documentationUrl || submission.tentacleData.documentationUrl,
      compatibilityInfo: versionData.compatibilityInfo || submission.tentacleData.compatibilityInfo,
      dependencies: versionData.dependencies || submission.tentacleData.dependencies,
      signed: versionData.signed || submission.tentacleData.signed,
      status: 'draft',
      securityChecks: this._createInitialSecurityChecks({
        ...submission.tentacleData,
        ...versionData
      }),
      verificationResults: null,
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          details: 'Version created'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store version
    this.versions.set(versionId, version);
    await this._saveVersion(version);
    
    // Update submission with version reference
    const updatedSubmission = {
      ...submission,
      versions: [...submission.versions, {
        id: versionId,
        version: versionData.version,
        status: 'draft',
        createdAt: new Date().toISOString()
      }],
      updatedAt: new Date().toISOString()
    };
    
    // Store updated submission
    this.submissions.set(submissionId, updatedSubmission);
    await this._saveSubmission(updatedSubmission);
    
    // Emit event
    this.events.emit('version:created', { version, submission: updatedSubmission });
    
    return version;
  }

  /**
   * Get a version by ID
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} - Promise resolving to the version
   */
  async getVersion(versionId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    const version = this.versions.get(versionId);
    
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    return version;
  }

  /**
   * Submit a version for verification
   * @param {string} versionId - Version ID
   * @returns {Promise<Object>} - Promise resolving to the updated version
   */
  async submitVersionForVerification(versionId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Submitting version for verification: ${versionId}`);
    
    const version = this.versions.get(versionId);
    
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    // Check if version can be submitted
    if (version.status !== 'draft' && version.status !== 'verification_failed') {
      throw new Error(`Version ${versionId} cannot be submitted in status: ${version.status}`);
    }
    
    // Check if all security checks have passed
    const failedChecks = version.securityChecks.filter(check => check.status === 'failed');
    
    if (failedChecks.length > 0) {
      throw new Error(`Version has failed security checks: ${failedChecks.map(c => c.message).join(', ')}`);
    }
    
    // Create history entry
    const historyEntry = {
      action: 'submitted',
      timestamp: new Date().toISOString(),
      details: 'Submitted for verification'
    };
    
    // Create updated version
    const updatedVersion = {
      ...version,
      status: 'pending_verification',
      history: [...version.history, historyEntry],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store updated version
    this.versions.set(versionId, updatedVersion);
    await this._saveVersion(updatedVersion);
    
    // Update submission version reference
    const submission = this.submissions.get(version.submissionId);
    
    if (submission) {
      const updatedVersions = submission.versions.map(v => {
        if (v.id === versionId) {
          return {
            ...v,
            status: 'pending_verification'
          };
        }
        return v;
      });
      
      const updatedSubmission = {
        ...submission,
        versions: updatedVersions,
        updatedAt: new Date().toISOString()
      };
      
      this.submissions.set(submission.id, updatedSubmission);
      await this._saveSubmission(updatedSubmission);
    }
    
    // Emit event
    this.events.emit('version:submitted', { version: updatedVersion });
    
    // If verification service is available, send for verification
    if (this.verificationService) {
      try {
        await this.verificationService.queueVersionForVerification(updatedVersion);
      } catch (error) {
        this.logger.error(`Failed to queue version for verification: ${versionId}`, error);
        // Don't fail the submission process, verification service will poll for pending versions
      }
    }
    
    return updatedVersion;
  }

  /**
   * Publish a tentacle to the marketplace
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} - Promise resolving to the updated submission
   */
  async publishToMarketplace(submissionId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
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
    
    // If monetization service is available and tentacle is paid, set up monetization
    if (this.monetizationService && 
        submission.tentacleData.pricing && 
        submission.tentacleData.pricing.type !== 'free') {
      try {
        await this.monetizationService.setupTentacleMonetization(
          submission.tentacleData.id,
          submission.developerId,
          submission.tentacleData.pricing
        );
      } catch (error) {
        this.logger.error(`Failed to set up monetization for tentacle: ${submissionId}`, error);
        throw new Error(`Failed to set up monetization: ${error.message}`);
      }
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
    await this._saveSubmission(updatedSubmission);
    
    // Emit event
    this.events.emit('submission:published', { submission: updatedSubmission });
    
    return updatedSubmission;
  }

  /**
   * Create a beta program for a tentacle
   * @param {string} submissionId - Submission ID
   * @param {Object} betaData - Beta program data
   * @returns {Promise<Object>} - Promise resolving to the created beta program
   */
  async createBetaProgram(submissionId, betaData = {}) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    this.logger.info(`Creating beta program for submission: ${submissionId}`);
    
    const submission = this.submissions.get(submissionId);
    
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Check if submission is in a valid state for beta
    if (!['approved', 'published'].includes(submission.status)) {
      throw new Error(`Cannot create beta program for submission in status: ${submission.status}`);
    }
    
    // Check if beta program already exists
    const existingBeta = Array.from(this.betaPrograms.values())
      .find(beta => beta.submissionId === submissionId && beta.status === 'active');
    
    if (existingBeta) {
      throw new Error(`Active beta program already exists for submission ${submissionId}`);
    }
    
    // Validate beta data
    if (!betaData.version) {
      throw new Error('Beta version is required');
    }
    
    if (!semver.valid(betaData.version)) {
      throw new Error('Beta version must be a valid semantic version');
    }
    
    // Create beta program
    const betaProgramId = `beta_${crypto.randomBytes(8).toString('hex')}`;
    
    const betaProgram = {
      id: betaProgramId,
      submissionId,
      tentacleId: submission.tentacleData.id,
      version: betaData.version,
      name: betaData.name || `${submission.tentacleData.name} Beta`,
      description: betaData.description || `Beta test for ${submission.tentacleData.name}`,
      maxParticipants: betaData.maxParticipants || 100,
      participants: [],
      feedbackRequired: betaData.feedbackRequired !== false,
      packageUrl: betaData.packageUrl || null,
      startDate: betaData.startDate || new Date().toISOString(),
      endDate: betaData.endDate || null,
      status: 'active',
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          details: 'Beta program created'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store beta program
    this.betaPrograms.set(betaProgramId, betaProgram);
    await this._saveBetaProgram(betaProgram);
    
    // Emit event
    this.events.emit('beta:created', { betaProgram, submission });
    
    return betaProgram;
  }

  /**
   * Get submissions for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of submissions
   */
  async getSubmissionsForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('EnhancedSubmissionSystem not initialized');
    }
    
    return Array.from(this.submissions.values())
      .filter(sub => sub.developerId === developerId);
  }

  /**
   * Get the status of the submission system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      submissionCount: this.submissions.size,
      versionCount: this.versions.size,
      betaProgramCount: this.betaPrograms.size
    };
  }

  /**
   * Shutdown the submission system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('EnhancedSubmissionSystem not initialized');
      return true;
    }
    
    this.logger.info('Shutting down EnhancedSubmissionSystem');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { EnhancedSubmissionSystem };
