/**
 * @fileoverview PatientDataManager securely stores and manages patient health information
 * with comprehensive encryption, data portability, and HIPAA compliance.
 * 
 * @module tentacles/medical_health/PatientDataManager
 * @requires core/utils/Logger
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires core/security/EncryptionService
 */

const Logger = require('../../core/utils/Logger');
const HIPAAComplianceManager = require('./HIPAAComplianceManager');
const EncryptionService = require('../../core/security/EncryptionService');

const logger = Logger.getLogger('PatientDataManager');

/**
 * @class PatientDataManager
 * @description Manages secure storage and retrieval of patient health information
 */
class PatientDataManager {
  /**
   * Creates an instance of PatientDataManager
   * @param {Object} options - Configuration options
   * @param {HIPAAComplianceManager} options.hipaaComplianceManager - Manager for HIPAA compliance
   * @param {EncryptionService} options.encryptionService - Service for encrypting sensitive data
   */
  constructor(options = {}) {
    this.hipaaComplianceManager = options.hipaaComplianceManager || new HIPAAComplianceManager();
    this.encryptionService = options.encryptionService || new EncryptionService();
    
    // Storage for patient data (in a production environment, this would be a secure database)
    this.patientStore = new Map();
    
    // Data retention policies
    this.retentionPolicies = {
      clinicalData: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years in milliseconds
      billingData: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years in milliseconds
      auditLogs: 6 * 365 * 24 * 60 * 60 * 1000 // 6 years in milliseconds
    };
    
    // Supported export formats
    this.exportFormats = {
      FHIR: {
        version: 'R4',
        formatter: this.formatAsFHIR.bind(this)
      },
      CDA: {
        version: 'R2',
        formatter: this.formatAsCDA.bind(this)
      },
      JSON: {
        version: 'standard',
        formatter: this.formatAsJSON.bind(this)
      },
      CSV: {
        version: 'standard',
        formatter: this.formatAsCSV.bind(this)
      }
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.storePatientData = this.storePatientData.bind(this);
    this.retrievePatientData = this.retrievePatientData.bind(this);
    this.updatePatientData = this.updatePatientData.bind(this);
    this.deletePatientData = this.deletePatientData.bind(this);
    this.exportPatientData = this.exportPatientData.bind(this);
    this.validateConsent = this.validateConsent.bind(this);
    this.applyDataRetentionPolicy = this.applyDataRetentionPolicy.bind(this);
    this.generateAuditReport = this.generateAuditReport.bind(this);
  }
  
  /**
   * Initializes the PatientDataManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing PatientDataManager');
      
      // Initialize HIPAA compliance manager
      await this.hipaaComplianceManager.initialize();
      
      // Verify encryption service is available and properly configured
      const encryptionStatus = await this.encryptionService.verifyStatus();
      if (!encryptionStatus.available) {
        throw new Error('Encryption service is not available');
      }
      
      // Log initialization
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'INITIALIZE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        details: 'Patient Data Manager initialized'
      });
      
      logger.info('PatientDataManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize PatientDataManager: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Stores patient data securely
   * @async
   * @param {Object} options - Storage options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {Object} options.data - Patient data to store
   * @param {string} options.dataType - Type of data (demographics, clinical, billing, etc.)
   * @param {Object} options.consent - Consent information for this data
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Storage result
   */
  async storePatientData(options) {
    try {
      logger.debug(`Storing ${options.dataType} data for patient ${options.patientId}`);
      
      if (!options.patientId || !options.data || !options.dataType) {
        throw new Error('Patient ID, data, and data type are required');
      }
      
      // Validate consent
      const consentValidation = await this.validateConsent({
        patientId: options.patientId,
        dataType: options.dataType,
        action: 'STORE',
        consent: options.consent
      });
      
      if (!consentValidation.valid) {
        throw new Error(`Consent validation failed: ${consentValidation.reason}`);
      }
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        action: 'MODIFY'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the data storage attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'STORE',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Storing ${options.dataType} data for patient ${options.patientId}`
      });
      
      // Apply data minimization
      const minimizedData = this.hipaaComplianceManager.applyDataMinimization(options.data, {
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        requiredFields: options.complianceOptions?.requiredFields || Object.keys(options.data)
      });
      
      // Encrypt the data
      const encryptedData = await this.hipaaComplianceManager.encryptPHI(minimizedData, {
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId
      });
      
      // Prepare the storage object
      const storageObject = {
        patientId: options.patientId,
        dataType: options.dataType,
        data: encryptedData.data,
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: options.complianceOptions?.userId,
          encryptionMetadata: encryptedData.metadata,
          consent: options.consent,
          retentionPolicy: this.retentionPolicies[options.dataType] || this.retentionPolicies.clinicalData,
          expiresAt: new Date(Date.now() + (this.retentionPolicies[options.dataType] || this.retentionPolicies.clinicalData)).toISOString()
        }
      };
      
      // Store the data
      if (!this.patientStore.has(options.patientId)) {
        this.patientStore.set(options.patientId, new Map());
      }
      
      const patientData = this.patientStore.get(options.patientId);
      if (!patientData.has(options.dataType)) {
        patientData.set(options.dataType, []);
      }
      
      const dataTypeArray = patientData.get(options.dataType);
      dataTypeArray.push(storageObject);
      
      // Log the successful data storage
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'STORE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Successfully stored ${options.dataType} data for patient ${options.patientId}`
      });
      
      return {
        success: true,
        patientId: options.patientId,
        dataType: options.dataType,
        timestamp: storageObject.metadata.createdAt,
        expiresAt: storageObject.metadata.expiresAt
      };
    } catch (error) {
      // Log the failed data storage
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'STORE',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Failed to store data: ${error.message}`
      });
      
      logger.error(`Failed to store patient data: ${error.message}`, error);
      throw new Error(`Patient data storage failed: ${error.message}`);
    }
  }
  
  /**
   * Retrieves patient data securely
   * @async
   * @param {Object} options - Retrieval options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {string} [options.dataType] - Type of data to retrieve (if not provided, retrieves all types)
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Retrieved patient data
   */
  async retrievePatientData(options) {
    try {
      logger.debug(`Retrieving ${options.dataType || 'all'} data for patient ${options.patientId}`);
      
      if (!options.patientId) {
        throw new Error('Patient ID is required');
      }
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        action: 'ACCESS'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the data retrieval attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Retrieving ${options.dataType || 'all'} data for patient ${options.patientId}`
      });
      
      // Check if patient exists
      if (!this.patientStore.has(options.patientId)) {
        throw new Error(`Patient ${options.patientId} not found`);
      }
      
      const patientData = this.patientStore.get(options.patientId);
      let result = {};
      
      // If dataType is specified, retrieve only that type
      if (options.dataType) {
        if (!patientData.has(options.dataType)) {
          throw new Error(`Data type ${options.dataType} not found for patient ${options.patientId}`);
        }
        
        const dataTypeArray = patientData.get(options.dataType);
        const decryptedData = [];
        
        for (const item of dataTypeArray) {
          // Decrypt the data
          const decrypted = await this.hipaaComplianceManager.decryptPHI(item.data, {
            purpose: options.complianceOptions?.purpose || 'TREATMENT',
            userId: options.complianceOptions?.userId,
            patientId: options.patientId
          });
          
          // Add metadata
          decryptedData.push({
            data: decrypted,
            metadata: {
              createdAt: item.metadata.createdAt,
              createdBy: item.metadata.createdBy,
              expiresAt: item.metadata.expiresAt
            }
          });
        }
        
        result[options.dataType] = decryptedData;
      } 
      // Otherwise, retrieve all data types
      else {
        for (const [dataType, dataTypeArray] of patientData.entries()) {
          const decryptedData = [];
          
          for (const item of dataTypeArray) {
            // Decrypt the data
            const decrypted = await this.hipaaComplianceManager.decryptPHI(item.data, {
              purpose: options.complianceOptions?.purpose || 'TREATMENT',
              userId: options.complianceOptions?.userId,
              patientId: options.patientId
            });
            
            // Add metadata
            decryptedData.push({
              data: decrypted,
              metadata: {
                createdAt: item.metadata.createdAt,
                createdBy: item.metadata.createdBy,
                expiresAt: item.metadata.expiresAt
              }
            });
          }
          
          result[dataType] = decryptedData;
        }
      }
      
      // Apply data minimization and sanitization
      const sanitizedResult = this.hipaaComplianceManager.sanitizeOutput(result, {
        allowedFields: options.complianceOptions?.allowedFields
      });
      
      // Log the successful data retrieval
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Successfully retrieved ${options.dataType || 'all'} data for patient ${options.patientId}`
      });
      
      return {
        patientId: options.patientId,
        data: sanitizedResult,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed data retrieval
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Failed to retrieve data: ${error.message}`
      });
      
      logger.error(`Failed to retrieve patient data: ${error.message}`, error);
      throw new Error(`Patient data retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * Updates existing patient data
   * @async
   * @param {Object} options - Update options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {string} options.dataType - Type of data to update
   * @param {Object} options.data - Updated patient data
   * @param {string} [options.recordId] - Specific record ID to update (if not provided, updates the most recent)
   * @param {Object} options.consent - Consent information for this update
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Update result
   */
  async updatePatientData(options) {
    try {
      logger.debug(`Updating ${options.dataType} data for patient ${options.patientId}`);
      
      if (!options.patientId || !options.data || !options.dataType) {
        throw new Error('Patient ID, data, and data type are required');
      }
      
      // Validate consent
      const consentValidation = await this.validateConsent({
        patientId: options.patientId,
        dataType: options.dataType,
        action: 'UPDATE',
        consent: options.consent
      });
      
      if (!consentValidation.valid) {
        throw new Error(`Consent validation failed: ${consentValidation.reason}`);
      }
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        action: 'MODIFY'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the data update attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'UPDATE',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Updating ${options.dataType} data for patient ${options.patientId}`
      });
      
      // Check if patient exists
      if (!this.patientStore.has(options.patientId)) {
        throw new Error(`Patient ${options.patientId} not found`);
      }
      
      const patientData = this.patientStore.get(options.patientId);
      
      // Check if data type exists
      if (!patientData.has(options.dataType)) {
        throw new Error(`Data type ${options.dataType} not found for patient ${options.patientId}`);
      }
      
      const dataTypeArray = patientData.get(options.dataType);
      
      // Find the record to update
      let recordIndex = -1;
      if (options.recordId) {
        recordIndex = dataTypeArray.findIndex(item => item.id === options.recordId);
        if (recordIndex === -1) {
          throw new Error(`Record ${options.recordId} not found for patient ${options.patientId}`);
        }
      } else {
        // Update the most recent record if no record ID is provided
        recordIndex = dataTypeArray.length - 1;
      }
      
      // Get the existing record
      const existingRecord = dataTypeArray[recordIndex];
      
      // Apply data minimization
      const minimizedData = this.hipaaComplianceManager.applyDataMinimization(options.data, {
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        requiredFields: options.complianceOptions?.requiredFields || Object.keys(options.data)
      });
      
      // Encrypt the updated data
      const encryptedData = await this.hipaaComplianceManager.encryptPHI(minimizedData, {
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId
      });
      
      // Prepare the updated storage object
      const updatedRecord = {
        ...existingRecord,
        data: encryptedData.data,
        metadata: {
          ...existingRecord.metadata,
          updatedAt: new Date().toISOString(),
          updatedBy: options.complianceOptions?.userId,
          encryptionMetadata: encryptedData.metadata,
          consent: options.consent || existingRecord.metadata.consent
        }
      };
      
      // Update the record
      dataTypeArray[recordIndex] = updatedRecord;
      
      // Log the successful data update
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'UPDATE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Successfully updated ${options.dataType} data for patient ${options.patientId}`
      });
      
      return {
        success: true,
        patientId: options.patientId,
        dataType: options.dataType,
        recordId: options.recordId || `record-${recordIndex}`,
        timestamp: updatedRecord.metadata.updatedAt
      };
    } catch (error) {
      // Log the failed data update
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'UPDATE',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType,
        details: `Failed to update data: ${error.message}`
      });
      
      logger.error(`Failed to update patient data: ${error.message}`, error);
      throw new Error(`Patient data update failed: ${error.message}`);
    }
  }
  
  /**
   * Deletes patient data
   * @async
   * @param {Object} options - Deletion options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {string} [options.dataType] - Type of data to delete (if not provided, deletes all types)
   * @param {string} [options.recordId] - Specific record ID to delete (if not provided, deletes all records of the type)
   * @param {Object} options.consent - Consent information for this deletion
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Deletion result
   */
  async deletePatientData(options) {
    try {
      logger.debug(`Deleting ${options.dataType || 'all'} data for patient ${options.patientId}`);
      
      if (!options.patientId) {
        throw new Error('Patient ID is required');
      }
      
      // Validate consent
      const consentValidation = await this.validateConsent({
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        action: 'DELETE',
        consent: options.consent
      });
      
      if (!consentValidation.valid) {
        throw new Error(`Consent validation failed: ${consentValidation.reason}`);
      }
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        action: 'DELETE'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the data deletion attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'DELETE',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Deleting ${options.dataType || 'all'} data for patient ${options.patientId}`
      });
      
      // Check if patient exists
      if (!this.patientStore.has(options.patientId)) {
        throw new Error(`Patient ${options.patientId} not found`);
      }
      
      const patientData = this.patientStore.get(options.patientId);
      
      // If dataType is specified, delete only that type
      if (options.dataType) {
        if (!patientData.has(options.dataType)) {
          throw new Error(`Data type ${options.dataType} not found for patient ${options.patientId}`);
        }
        
        // If recordId is specified, delete only that record
        if (options.recordId) {
          const dataTypeArray = patientData.get(options.dataType);
          const recordIndex = dataTypeArray.findIndex(item => item.id === options.recordId);
          
          if (recordIndex === -1) {
            throw new Error(`Record ${options.recordId} not found for patient ${options.patientId}`);
          }
          
          // Remove the record
          dataTypeArray.splice(recordIndex, 1);
          
          // If no records remain, remove the data type
          if (dataTypeArray.length === 0) {
            patientData.delete(options.dataType);
          }
        } 
        // Otherwise, delete all records of the type
        else {
          patientData.delete(options.dataType);
        }
      } 
      // Otherwise, delete all data for the patient
      else {
        this.patientStore.delete(options.patientId);
      }
      
      // Log the successful data deletion
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'DELETE',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Successfully deleted ${options.dataType || 'all'} data for patient ${options.patientId}`
      });
      
      return {
        success: true,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        recordId: options.recordId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed data deletion
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'MODIFY',
        action: 'DELETE',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Failed to delete data: ${error.message}`
      });
      
      logger.error(`Failed to delete patient data: ${error.message}`, error);
      throw new Error(`Patient data deletion failed: ${error.message}`);
    }
  }
  
  /**
   * Exports patient data in a standard format
   * @async
   * @param {Object} options - Export options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {string} options.format - Export format (FHIR, CDA, JSON, CSV)
   * @param {string} [options.dataType] - Type of data to export (if not provided, exports all types)
   * @param {Object} options.consent - Consent information for this export
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Exported patient data
   */
  async exportPatientData(options) {
    try {
      logger.debug(`Exporting ${options.dataType || 'all'} data for patient ${options.patientId} in ${options.format} format`);
      
      if (!options.patientId || !options.format) {
        throw new Error('Patient ID and export format are required');
      }
      
      // Check if the format is supported
      if (!this.exportFormats[options.format]) {
        throw new Error(`Unsupported export format: ${options.format}`);
      }
      
      // Validate consent
      const consentValidation = await this.validateConsent({
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        action: 'EXPORT',
        consent: options.consent
      });
      
      if (!consentValidation.valid) {
        throw new Error(`Consent validation failed: ${consentValidation.reason}`);
      }
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        purpose: options.complianceOptions?.purpose || 'TREATMENT',
        action: 'ACCESS'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the data export attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXPORT',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Exporting ${options.dataType || 'all'} data for patient ${options.patientId} in ${options.format} format`
      });
      
      // Retrieve the patient data
      const retrievalResult = await this.retrievePatientData({
        patientId: options.patientId,
        dataType: options.dataType,
        complianceOptions: options.complianceOptions
      });
      
      // Format the data according to the requested format
      const formatter = this.exportFormats[options.format].formatter;
      const formattedData = await formatter(retrievalResult.data, options);
      
      // Log the successful data export
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXPORT',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Successfully exported ${options.dataType || 'all'} data for patient ${options.patientId} in ${options.format} format`
      });
      
      return {
        patientId: options.patientId,
        format: options.format,
        formatVersion: this.exportFormats[options.format].version,
        data: formattedData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed data export
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXPORT',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        dataType: options.dataType || 'all',
        details: `Failed to export data: ${error.message}`
      });
      
      logger.error(`Failed to export patient data: ${error.message}`, error);
      throw new Error(`Patient data export failed: ${error.message}`);
    }
  }
  
  /**
   * Validates patient consent for data operations
   * @async
   * @param {Object} options - Validation options
   * @param {string} options.patientId - Unique identifier for the patient
   * @param {string} options.dataType - Type of data
   * @param {string} options.action - Action being performed (STORE, UPDATE, DELETE, EXPORT)
   * @param {Object} options.consent - Consent information
   * @returns {Promise<Object>} Validation result
   */
  async validateConsent(options) {
    try {
      logger.debug(`Validating consent for ${options.action} action on ${options.dataType} data for patient ${options.patientId}`);
      
      // In a production system, this would validate against a consent management system
      // For now, we'll perform basic validation
      
      if (!options.consent) {
        return {
          valid: false,
          reason: 'Consent information is required'
        };
      }
      
      // Check for required consent fields
      const requiredFields = ['consentGiven', 'consentDate', 'consentPurpose'];
      for (const field of requiredFields) {
        if (!options.consent[field]) {
          return {
            valid: false,
            reason: `Required consent field missing: ${field}`
          };
        }
      }
      
      // Check if consent was given
      if (!options.consent.consentGiven) {
        return {
          valid: false,
          reason: 'Consent was not given'
        };
      }
      
      // Check if consent has expired
      if (options.consent.expirationDate) {
        const expirationDate = new Date(options.consent.expirationDate);
        if (expirationDate < new Date()) {
          return {
            valid: false,
            reason: 'Consent has expired'
          };
        }
      }
      
      // Check if the action is covered by the consent purpose
      const consentPurpose = options.consent.consentPurpose.toLowerCase();
      const action = options.action.toLowerCase();
      
      if (action === 'export' && !consentPurpose.includes('export') && !consentPurpose.includes('share')) {
        return {
          valid: false,
          reason: 'Consent does not cover data export'
        };
      }
      
      if (action === 'delete' && !consentPurpose.includes('delete')) {
        return {
          valid: false,
          reason: 'Consent does not cover data deletion'
        };
      }
      
      return {
        valid: true
      };
    } catch (error) {
      logger.error(`Failed to validate consent: ${error.message}`, error);
      return {
        valid: false,
        reason: `Consent validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Applies data retention policies to stored patient data
   * @async
   * @returns {Promise<Object>} Policy application result
   */
  async applyDataRetentionPolicy() {
    try {
      logger.debug('Applying data retention policies');
      
      // Log the policy application attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'APPLY_RETENTION_POLICY',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        details: 'Applying data retention policies to stored patient data'
      });
      
      const now = new Date();
      let expiredRecordsCount = 0;
      
      // Iterate through all patients
      for (const [patientId, patientData] of this.patientStore.entries()) {
        // Iterate through all data types for the patient
        for (const [dataType, dataTypeArray] of patientData.entries()) {
          // Filter out expired records
          const validRecords = dataTypeArray.filter(record => {
            const expirationDate = new Date(record.metadata.expiresAt);
            return expirationDate > now;
          });
          
          // Count expired records
          expiredRecordsCount += dataTypeArray.length - validRecords.length;
          
          // Update the data type array with only valid records
          if (validRecords.length === 0) {
            patientData.delete(dataType);
          } else {
            patientData.set(dataType, validRecords);
          }
        }
        
        // If no data types remain, remove the patient
        if (patientData.size === 0) {
          this.patientStore.delete(patientId);
        }
      }
      
      // Log the successful policy application
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'APPLY_RETENTION_POLICY',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        details: `Successfully applied data retention policies, removed ${expiredRecordsCount} expired records`
      });
      
      return {
        success: true,
        expiredRecordsRemoved: expiredRecordsCount,
        timestamp: now.toISOString()
      };
    } catch (error) {
      // Log the failed policy application
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'APPLY_RETENTION_POLICY',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        details: `Failed to apply data retention policies: ${error.message}`
      });
      
      logger.error(`Failed to apply data retention policies: ${error.message}`, error);
      throw new Error(`Data retention policy application failed: ${error.message}`);
    }
  }
  
  /**
   * Generates an audit report for patient data access and modifications
   * @async
   * @param {Object} options - Report options
   * @param {string} [options.patientId] - Filter by patient ID
   * @param {string} [options.userId] - Filter by user ID
   * @param {string} [options.action] - Filter by action type
   * @param {Date} [options.startDate] - Filter by start date
   * @param {Date} [options.endDate] - Filter by end date
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Audit report
   */
  async generateAuditReport(options) {
    try {
      logger.debug('Generating audit report');
      
      // Validate data access for audit report generation
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        purpose: 'HEALTHCARE_OPERATIONS',
        action: 'ACCESS'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Log the audit report generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'GENERATE_AUDIT_REPORT',
        component: 'PatientDataManager',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: 'Generating audit report'
      });
      
      // In a production system, this would query the audit log storage
      // For now, we'll simulate by returning a structured report
      
      const report = {
        reportId: `audit-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        generatedBy: options.complianceOptions?.userId,
        filters: {
          patientId: options.patientId,
          userId: options.userId,
          action: options.action,
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString()
        },
        summary: {
          totalEvents: 0,
          accessEvents: 0,
          modifyEvents: 0,
          systemEvents: 0,
          successfulEvents: 0,
          failedEvents: 0
        },
        events: []
      };
      
      // Log the successful audit report generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'GENERATE_AUDIT_REPORT',
        component: 'PatientDataManager',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: 'Successfully generated audit report'
      });
      
      return report;
    } catch (error) {
      // Log the failed audit report generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'SYSTEM',
        action: 'GENERATE_AUDIT_REPORT',
        component: 'PatientDataManager',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate audit report: ${error.message}`
      });
      
      logger.error(`Failed to generate audit report: ${error.message}`, error);
      throw new Error(`Audit report generation failed: ${error.message}`);
    }
  }
  
  /**
   * Formats patient data as FHIR
   * @async
   * @param {Object} data - Patient data
   * @param {Object} options - Formatting options
   * @returns {Promise<Object>} FHIR-formatted data
   */
  async formatAsFHIR(data, options) {
    try {
      // In a production system, this would implement a full FHIR converter
      // For now, we'll create a basic FHIR Bundle
      
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: []
      };
      
      // Add patient resource if demographics data is available
      if (data.demographics && data.demographics.length > 0) {
        const demographics = data.demographics[0].data;
        
        const patientResource = {
          resourceType: 'Patient',
          id: options.patientId,
          meta: {
            versionId: '1',
            lastUpdated: new Date().toISOString()
          },
          gender: demographics.gender || 'unknown',
          birthDate: demographics.birthDate
        };
        
        bundle.entry.push({
          fullUrl: `urn:uuid:${options.patientId}`,
          resource: patientResource
        });
      }
      
      // Add condition resources if available
      if (data.conditions) {
        for (const condition of data.conditions) {
          for (const item of condition.data) {
            const conditionResource = {
              resourceType: 'Condition',
              id: `condition-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              subject: {
                reference: `Patient/${options.patientId}`
              },
              code: {
                coding: [
                  {
                    system: item.system || 'http://snomed.info/sct',
                    code: item.code,
                    display: item.display
                  }
                ],
                text: item.display
              },
              recordedDate: condition.metadata.createdAt
            };
            
            bundle.entry.push({
              fullUrl: `urn:uuid:${conditionResource.id}`,
              resource: conditionResource
            });
          }
        }
      }
      
      // Add medication resources if available
      if (data.medications) {
        for (const medication of data.medications) {
          for (const item of medication.data) {
            const medicationResource = {
              resourceType: 'MedicationStatement',
              id: `medication-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              subject: {
                reference: `Patient/${options.patientId}`
              },
              medicationCodeableConcept: {
                coding: [
                  {
                    system: item.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
                    code: item.code,
                    display: item.display
                  }
                ],
                text: item.display
              },
              status: 'active',
              dateAsserted: medication.metadata.createdAt
            };
            
            bundle.entry.push({
              fullUrl: `urn:uuid:${medicationResource.id}`,
              resource: medicationResource
            });
          }
        }
      }
      
      return bundle;
    } catch (error) {
      logger.error(`Failed to format data as FHIR: ${error.message}`, error);
      throw new Error(`FHIR formatting failed: ${error.message}`);
    }
  }
  
  /**
   * Formats patient data as CDA
   * @async
   * @param {Object} data - Patient data
   * @param {Object} options - Formatting options
   * @returns {Promise<string>} CDA-formatted data
   */
  async formatAsCDA(data, options) {
    try {
      // In a production system, this would implement a full CDA converter
      // For now, we'll create a basic CDA XML structure
      
      const now = new Date().toISOString();
      const patientName = data.demographics && data.demographics.length > 0 ? 
        data.demographics[0].data.name || 'Unknown' : 'Unknown';
      
      const cda = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <id root="${options.patientId}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Summarization of Episode Note"/>
  <title>Patient Health Record Export</title>
  <effectiveTime value="${now.replace(/[-:]/g, '').split('.')[0]}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <recordTarget>
    <patientRole>
      <id root="${options.patientId}"/>
      <patient>
        <name>
          <given>${patientName}</given>
        </name>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <!-- Content would be added here based on available data -->
      <component>
        <section>
          <title>Health Record Export</title>
          <text>
            <paragraph>Patient data export in CDA format.</paragraph>
          </text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
      
      return cda;
    } catch (error) {
      logger.error(`Failed to format data as CDA: ${error.message}`, error);
      throw new Error(`CDA formatting failed: ${error.message}`);
    }
  }
  
  /**
   * Formats patient data as JSON
   * @async
   * @param {Object} data - Patient data
   * @param {Object} options - Formatting options
   * @returns {Promise<Object>} JSON-formatted data
   */
  async formatAsJSON(data, options) {
    try {
      // For JSON format, we'll return a structured representation of the data
      
      const formattedData = {
        patientId: options.patientId,
        exportTimestamp: new Date().toISOString(),
        exportFormat: 'JSON',
        data: data
      };
      
      return formattedData;
    } catch (error) {
      logger.error(`Failed to format data as JSON: ${error.message}`, error);
      throw new Error(`JSON formatting failed: ${error.message}`);
    }
  }
  
  /**
   * Formats patient data as CSV
   * @async
   * @param {Object} data - Patient data
   * @param {Object} options - Formatting options
   * @returns {Promise<string>} CSV-formatted data
   */
  async formatAsCSV(data, options) {
    try {
      // In a production system, this would implement a full CSV converter
      // For now, we'll create a basic CSV representation
      
      let csv = 'Data Type,Record ID,Created Date,Data\n';
      
      // Process each data type
      for (const dataType in data) {
        const records = data[dataType];
        
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          const recordId = `${dataType}-${i}`;
          const createdDate = record.metadata.createdAt;
          const recordData = JSON.stringify(record.data).replace(/"/g, '""');
          
          csv += `${dataType},"${recordId}","${createdDate}","${recordData}"\n`;
        }
      }
      
      return csv;
    } catch (error) {
      logger.error(`Failed to format data as CSV: ${error.message}`, error);
      throw new Error(`CSV formatting failed: ${error.message}`);
    }
  }
}

module.exports = PatientDataManager;
