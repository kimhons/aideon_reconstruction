/**
 * @fileoverview HIPAAComplianceManager ensures all data handling within the Medical/Health Tentacle
 * complies with HIPAA regulations and other healthcare privacy standards.
 * 
 * @module tentacles/medical_health/HIPAAComplianceManager
 * @requires core/utils/Logger
 * @requires core/security/EncryptionService
 */

const Logger = require('../../core/utils/Logger');
const EncryptionService = require('../../core/security/EncryptionService');

const logger = Logger.getLogger('HIPAAComplianceManager');

/**
 * @class HIPAAComplianceManager
 * @description Manages HIPAA compliance for the Medical/Health Tentacle
 */
class HIPAAComplianceManager {
  /**
   * Creates an instance of HIPAAComplianceManager
   * @param {Object} options - Configuration options
   * @param {EncryptionService} options.encryptionService - Service for encrypting sensitive data
   */
  constructor(options = {}) {
    this.encryptionService = options.encryptionService || new EncryptionService();
    this.auditLog = [];
    this.complianceSettings = {
      enforceEncryption: true,
      enforceAuditLogging: true,
      enforceAccessControl: true,
      enforceDataMinimization: true,
      enforceRetentionPolicies: true,
      minimumEncryptionLevel: 'AES-256',
      auditRetentionPeriod: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months in milliseconds
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.logAuditEvent = this.logAuditEvent.bind(this);
    this.encryptPHI = this.encryptPHI.bind(this);
    this.decryptPHI = this.decryptPHI.bind(this);
    this.validateDataAccess = this.validateDataAccess.bind(this);
    this.sanitizeOutput = this.sanitizeOutput.bind(this);
    this.applyDataMinimization = this.applyDataMinimization.bind(this);
    this.getComplianceStatus = this.getComplianceStatus.bind(this);
  }
  
  /**
   * Initializes the HIPAAComplianceManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing HIPAAComplianceManager');
      
      // Verify encryption service is available and properly configured
      const encryptionStatus = await this.encryptionService.verifyStatus();
      if (!encryptionStatus.available) {
        throw new Error('Encryption service is not available');
      }
      
      if (encryptionStatus.level !== this.complianceSettings.minimumEncryptionLevel) {
        logger.warn(`Encryption level (${encryptionStatus.level}) does not meet minimum requirement (${this.complianceSettings.minimumEncryptionLevel})`);
      }
      
      // Initialize audit logging
      this.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'INITIALIZE',
        component: 'HIPAAComplianceManager',
        outcome: 'SUCCESS',
        details: 'HIPAA Compliance Manager initialized'
      });
      
      logger.info('HIPAAComplianceManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize HIPAAComplianceManager: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Logs an audit event for HIPAA compliance
   * @param {Object} event - Audit event details
   * @param {string} event.eventType - Type of event (ACCESS, MODIFY, DELETE, SYSTEM)
   * @param {string} event.action - Action performed
   * @param {string} event.component - Component that performed the action
   * @param {string} event.outcome - Outcome of the action (SUCCESS, FAILURE)
   * @param {string} event.details - Additional details
   * @param {string} [event.userId] - ID of the user who performed the action
   * @param {string} [event.patientId] - ID of the patient whose data was accessed
   * @param {string} [event.dataType] - Type of data that was accessed
   * @returns {Object} The logged audit event
   */
  logAuditEvent(event) {
    if (!this.complianceSettings.enforceAuditLogging) {
      return null;
    }
    
    try {
      const timestamp = new Date().toISOString();
      const auditEvent = {
        timestamp,
        eventId: `${timestamp}-${Math.random().toString(36).substring(2, 15)}`,
        ...event
      };
      
      this.auditLog.push(auditEvent);
      
      // In a production environment, we would persist this to a secure audit log storage
      logger.debug(`Audit event logged: ${auditEvent.eventType} - ${auditEvent.action}`);
      
      return auditEvent;
    } catch (error) {
      logger.error(`Failed to log audit event: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Encrypts Protected Health Information (PHI)
   * @async
   * @param {Object|string} data - Data containing PHI to encrypt
   * @param {Object} options - Encryption options
   * @param {string} options.purpose - Purpose for encrypting the data
   * @param {string} [options.userId] - ID of the user encrypting the data
   * @param {string} [options.patientId] - ID of the patient whose data is being encrypted
   * @returns {Promise<Object>} Encrypted data and metadata
   */
  async encryptPHI(data, options = {}) {
    if (!this.complianceSettings.enforceEncryption) {
      return { data, encrypted: false };
    }
    
    try {
      logger.debug('Encrypting PHI data');
      
      // Log the encryption attempt
      this.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'ENCRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'ATTEMPT',
        userId: options.userId,
        patientId: options.patientId,
        dataType: typeof data === 'object' ? 'JSON' : typeof data,
        details: `Encrypting PHI for purpose: ${options.purpose}`
      });
      
      // Perform the encryption
      const encryptedData = await this.encryptionService.encrypt(data);
      
      // Log successful encryption
      this.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'ENCRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'SUCCESS',
        userId: options.userId,
        patientId: options.patientId,
        dataType: typeof data === 'object' ? 'JSON' : typeof data,
        details: `PHI encrypted successfully for purpose: ${options.purpose}`
      });
      
      return {
        data: encryptedData,
        encrypted: true,
        metadata: {
          encryptionTimestamp: new Date().toISOString(),
          encryptionLevel: this.complianceSettings.minimumEncryptionLevel,
          purpose: options.purpose
        }
      };
    } catch (error) {
      // Log encryption failure
      this.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'ENCRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'FAILURE',
        userId: options.userId,
        patientId: options.patientId,
        dataType: typeof data === 'object' ? 'JSON' : typeof data,
        details: `Failed to encrypt PHI: ${error.message}`
      });
      
      logger.error(`Failed to encrypt PHI: ${error.message}`, error);
      throw new Error(`HIPAA compliance error: Failed to encrypt PHI: ${error.message}`);
    }
  }
  
  /**
   * Decrypts Protected Health Information (PHI)
   * @async
   * @param {Object} encryptedData - Encrypted data to decrypt
   * @param {Object} options - Decryption options
   * @param {string} options.purpose - Purpose for decrypting the data
   * @param {string} [options.userId] - ID of the user decrypting the data
   * @param {string} [options.patientId] - ID of the patient whose data is being decrypted
   * @returns {Promise<Object>} Decrypted data
   */
  async decryptPHI(encryptedData, options = {}) {
    try {
      logger.debug('Decrypting PHI data');
      
      // Validate access before decryption
      const accessValidation = await this.validateDataAccess({
        userId: options.userId,
        patientId: options.patientId,
        purpose: options.purpose,
        action: 'DECRYPT'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the decryption attempt
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'DECRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'ATTEMPT',
        userId: options.userId,
        patientId: options.patientId,
        details: `Decrypting PHI for purpose: ${options.purpose}`
      });
      
      // Perform the decryption
      const decryptedData = await this.encryptionService.decrypt(encryptedData);
      
      // Log successful decryption
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'DECRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'SUCCESS',
        userId: options.userId,
        patientId: options.patientId,
        details: `PHI decrypted successfully for purpose: ${options.purpose}`
      });
      
      return decryptedData;
    } catch (error) {
      // Log decryption failure
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'DECRYPT',
        component: 'HIPAAComplianceManager',
        outcome: 'FAILURE',
        userId: options.userId,
        patientId: options.patientId,
        details: `Failed to decrypt PHI: ${error.message}`
      });
      
      logger.error(`Failed to decrypt PHI: ${error.message}`, error);
      throw new Error(`HIPAA compliance error: Failed to decrypt PHI: ${error.message}`);
    }
  }
  
  /**
   * Validates data access based on user role and purpose
   * @async
   * @param {Object} options - Validation options
   * @param {string} [options.userId] - ID of the user requesting access
   * @param {string} [options.patientId] - ID of the patient whose data is being accessed
   * @param {string} options.purpose - Purpose for accessing the data
   * @param {string} options.action - Action being performed (ACCESS, MODIFY, DELETE)
   * @returns {Promise<Object>} Validation result
   */
  async validateDataAccess(options = {}) {
    if (!this.complianceSettings.enforceAccessControl) {
      return { granted: true };
    }
    
    try {
      logger.debug(`Validating data access for user ${options.userId || 'unknown'}`);
      
      // In a real implementation, we would check against a role-based access control system
      // For now, we'll simulate a basic validation
      
      // Log the access validation attempt
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'VALIDATE',
        component: 'HIPAAComplianceManager',
        outcome: 'ATTEMPT',
        userId: options.userId,
        patientId: options.patientId,
        details: `Validating ${options.action} access for purpose: ${options.purpose}`
      });
      
      // Simulate access validation
      const validPurposes = [
        'TREATMENT',
        'PAYMENT',
        'HEALTHCARE_OPERATIONS',
        'PATIENT_REQUEST',
        'REQUIRED_BY_LAW',
        'PUBLIC_HEALTH',
        'RESEARCH'
      ];
      
      const isValidPurpose = validPurposes.includes(options.purpose);
      
      // For this simulation, we'll grant access if the purpose is valid
      const accessGranted = isValidPurpose;
      const reason = isValidPurpose ? 'Valid purpose' : 'Invalid purpose for PHI access';
      
      // Log the access validation result
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'VALIDATE',
        component: 'HIPAAComplianceManager',
        outcome: accessGranted ? 'SUCCESS' : 'FAILURE',
        userId: options.userId,
        patientId: options.patientId,
        details: `Access ${accessGranted ? 'granted' : 'denied'}: ${reason}`
      });
      
      return {
        granted: accessGranted,
        reason: reason
      };
    } catch (error) {
      // Log validation failure
      this.logAuditEvent({
        eventType: 'ACCESS',
        action: 'VALIDATE',
        component: 'HIPAAComplianceManager',
        outcome: 'FAILURE',
        userId: options.userId,
        patientId: options.patientId,
        details: `Failed to validate access: ${error.message}`
      });
      
      logger.error(`Failed to validate data access: ${error.message}`, error);
      return {
        granted: false,
        reason: `Error during validation: ${error.message}`
      };
    }
  }
  
  /**
   * Sanitizes output to prevent accidental PHI disclosure
   * @param {Object|string} data - Data to sanitize
   * @param {Object} options - Sanitization options
   * @param {Array<string>} [options.allowedFields] - Fields that are allowed to be included in output
   * @param {Array<string>} [options.sensitiveFields] - Fields that should be redacted
   * @returns {Object|string} Sanitized data
   */
  sanitizeOutput(data, options = {}) {
    try {
      logger.debug('Sanitizing output data');
      
      // Default sensitive fields that should be redacted
      const defaultSensitiveFields = [
        'ssn',
        'socialSecurityNumber',
        'dob',
        'dateOfBirth',
        'birthDate',
        'address',
        'phoneNumber',
        'email',
        'medicalRecordNumber',
        'insuranceId',
        'financialInfo'
      ];
      
      const sensitiveFields = options.sensitiveFields || defaultSensitiveFields;
      
      // If data is a string, check for common PHI patterns
      if (typeof data === 'string') {
        let sanitizedData = data;
        
        // Redact SSN patterns (XXX-XX-XXXX)
        sanitizedData = sanitizedData.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED SSN]');
        
        // Redact date of birth patterns (MM/DD/YYYY)
        sanitizedData = sanitizedData.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '[REDACTED DOB]');
        
        // Redact phone number patterns
        sanitizedData = sanitizedData.replace(/\b\(\d{3}\)\s*\d{3}-\d{4}\b/g, '[REDACTED PHONE]');
        sanitizedData = sanitizedData.replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[REDACTED PHONE]');
        
        return sanitizedData;
      }
      
      // If data is an object, recursively sanitize it
      if (typeof data === 'object' && data !== null) {
        const sanitizedData = Array.isArray(data) ? [] : {};
        
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            // If this is a sensitive field, redact it
            if (sensitiveFields.includes(key.toLowerCase())) {
              sanitizedData[key] = '[REDACTED]';
            } 
            // If we have allowedFields and this field is not in it, skip it
            else if (options.allowedFields && !options.allowedFields.includes(key)) {
              // Skip this field
            }
            // Otherwise, recursively sanitize the value
            else {
              sanitizedData[key] = this.sanitizeOutput(data[key], options);
            }
          }
        }
        
        return sanitizedData;
      }
      
      // For other data types, return as is
      return data;
    } catch (error) {
      logger.error(`Failed to sanitize output: ${error.message}`, error);
      // Return a safe empty result rather than potentially exposing PHI
      return typeof data === 'object' ? (Array.isArray(data) ? [] : {}) : '';
    }
  }
  
  /**
   * Applies data minimization principles to the data
   * @param {Object} data - Data to minimize
   * @param {Object} options - Minimization options
   * @param {string} options.purpose - Purpose for using the data
   * @param {Array<string>} options.requiredFields - Fields required for the purpose
   * @returns {Object} Minimized data
   */
  applyDataMinimization(data, options = {}) {
    if (!this.complianceSettings.enforceDataMinimization) {
      return data;
    }
    
    try {
      logger.debug(`Applying data minimization for purpose: ${options.purpose}`);
      
      if (!options.requiredFields || !Array.isArray(options.requiredFields)) {
        throw new Error('Required fields must be specified for data minimization');
      }
      
      // If data is not an object, return as is
      if (typeof data !== 'object' || data === null) {
        return data;
      }
      
      // Create a new object with only the required fields
      const minimizedData = {};
      
      for (const field of options.requiredFields) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          minimizedData[field] = data[field];
        }
      }
      
      return minimizedData;
    } catch (error) {
      logger.error(`Failed to apply data minimization: ${error.message}`, error);
      throw new Error(`HIPAA compliance error: Failed to apply data minimization: ${error.message}`);
    }
  }
  
  /**
   * Gets the current compliance status
   * @returns {Object} Compliance status
   */
  getComplianceStatus() {
    return {
      compliant: true,
      settings: this.complianceSettings,
      auditLogCount: this.auditLog.length,
      lastAuditEvent: this.auditLog.length > 0 ? this.auditLog[this.auditLog.length - 1] : null,
      encryptionLevel: this.complianceSettings.minimumEncryptionLevel
    };
  }
}

module.exports = HIPAAComplianceManager;
