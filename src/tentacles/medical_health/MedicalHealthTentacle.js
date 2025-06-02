/**
 * @fileoverview Main entry point for the Medical/Health Tentacle, integrating all components
 * for comprehensive healthcare functionality with HIPAA compliance.
 * 
 * @module tentacles/medical_health/MedicalHealthTentacle
 * @requires core/tentacle/BaseTentacle
 * @requires core/utils/Logger
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires tentacles/medical_health/MedicalKnowledgeBase
 * @requires tentacles/medical_health/HealthDataProcessor
 * @requires tentacles/medical_health/ClinicalDecisionSupport
 * @requires tentacles/medical_health/PatientDataManager
 * @requires tentacles/medical_health/MedicalDocumentGenerator
 */

const BaseTentacle = require('../../core/tentacle/BaseTentacle');
const Logger = require('../../core/utils/Logger');
const HIPAAComplianceManager = require('./HIPAAComplianceManager');
const MedicalKnowledgeBase = require('./MedicalKnowledgeBase');
const HealthDataProcessor = require('./HealthDataProcessor');
const ClinicalDecisionSupport = require('./ClinicalDecisionSupport');
const PatientDataManager = require('./PatientDataManager');
const MedicalDocumentGenerator = require('./MedicalDocumentGenerator');

const logger = Logger.getLogger('MedicalHealthTentacle');

/**
 * @class MedicalHealthTentacle
 * @extends BaseTentacle
 * @description Specialized tentacle for medical and healthcare functionality with HIPAA compliance
 */
class MedicalHealthTentacle extends BaseTentacle {
  /**
   * Creates an instance of MedicalHealthTentacle
   * @param {Object} options - Configuration options
   * @param {Object} options.modelServices - Model services for AI capabilities
   * @param {Object} options.securityServices - Security services for encryption and authentication
   * @param {Object} options.storageServices - Storage services for data persistence
   * @param {Object} options.networkServices - Network services for connectivity
   */
  constructor(options = {}) {
    super({
      id: 'medical_health',
      name: 'Medical/Health',
      description: 'Specialized tentacle for medical and healthcare functionality with HIPAA compliance',
      version: '1.0.0',
      ...options
    });
    
    // Initialize component services
    this.hipaaComplianceManager = new HIPAAComplianceManager({
      encryptionService: options.securityServices?.encryptionService,
      authenticationService: options.securityServices?.authenticationService
    });
    
    this.medicalKnowledgeBase = new MedicalKnowledgeBase({
      modelLoaderService: options.modelServices?.modelLoaderService,
      externalModelManager: options.modelServices?.externalModelManager,
      hipaaComplianceManager: this.hipaaComplianceManager
    });
    
    this.healthDataProcessor = new HealthDataProcessor({
      modelLoaderService: options.modelServices?.modelLoaderService,
      externalModelManager: options.modelServices?.externalModelManager,
      hipaaComplianceManager: this.hipaaComplianceManager,
      medicalKnowledgeBase: this.medicalKnowledgeBase
    });
    
    this.clinicalDecisionSupport = new ClinicalDecisionSupport({
      modelLoaderService: options.modelServices?.modelLoaderService,
      externalModelManager: options.modelServices?.externalModelManager,
      hipaaComplianceManager: this.hipaaComplianceManager,
      medicalKnowledgeBase: this.medicalKnowledgeBase,
      healthDataProcessor: this.healthDataProcessor
    });
    
    this.patientDataManager = new PatientDataManager({
      hipaaComplianceManager: this.hipaaComplianceManager,
      encryptionService: options.securityServices?.encryptionService
    });
    
    this.medicalDocumentGenerator = new MedicalDocumentGenerator({
      modelLoaderService: options.modelServices?.modelLoaderService,
      externalModelManager: options.modelServices?.externalModelManager,
      hipaaComplianceManager: this.hipaaComplianceManager,
      medicalKnowledgeBase: this.medicalKnowledgeBase,
      patientDataManager: this.patientDataManager
    });
    
    // Register capabilities
    this.registerCapabilities();
  }
  
  /**
   * Initializes the Medical/Health Tentacle
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing Medical/Health Tentacle');
      
      // Initialize base tentacle
      await super.initialize();
      
      // Initialize all components
      await this.hipaaComplianceManager.initialize();
      await this.medicalKnowledgeBase.initialize();
      await this.healthDataProcessor.initialize();
      await this.clinicalDecisionSupport.initialize();
      await this.patientDataManager.initialize();
      await this.medicalDocumentGenerator.initialize();
      
      logger.info('Medical/Health Tentacle initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Medical/Health Tentacle: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Registers the capabilities of the Medical/Health Tentacle
   * @private
   */
  registerCapabilities() {
    // Health Data Processing capabilities
    this.registerCapability('processHealthData', this.processHealthData.bind(this));
    this.registerCapability('extractMedicalEntities', this.extractMedicalEntities.bind(this));
    this.registerCapability('analyzeMedicalImage', this.analyzeMedicalImage.bind(this));
    this.registerCapability('visualizeHealthData', this.visualizeHealthData.bind(this));
    
    // Clinical Decision Support capabilities
    this.registerCapability('getRecommendations', this.getRecommendations.bind(this));
    this.registerCapability('checkMedicationInteractions', this.checkMedicationInteractions.bind(this));
    this.registerCapability('summarizeMedicalLiterature', this.summarizeMedicalLiterature.bind(this));
    this.registerCapability('retrieveRelevantInformation', this.retrieveRelevantInformation.bind(this));
    
    // Patient Data Management capabilities
    this.registerCapability('storePatientData', this.storePatientData.bind(this));
    this.registerCapability('retrievePatientData', this.retrievePatientData.bind(this));
    this.registerCapability('updatePatientData', this.updatePatientData.bind(this));
    this.registerCapability('deletePatientData', this.deletePatientData.bind(this));
    this.registerCapability('exportPatientData', this.exportPatientData.bind(this));
    this.registerCapability('generateAuditReport', this.generateAuditReport.bind(this));
    
    // Medical Document Generation capabilities
    this.registerCapability('generateClinicalSummary', this.generateClinicalSummary.bind(this));
    this.registerCapability('generatePatientEducation', this.generatePatientEducation.bind(this));
    this.registerCapability('generateDischargeInstructions', this.generateDischargeInstructions.bind(this));
    this.registerCapability('generateReferralLetter', this.generateReferralLetter.bind(this));
    this.registerCapability('generateCustomDocument', this.generateCustomDocument.bind(this));
    
    // Medical Knowledge Base capabilities
    this.registerCapability('queryKnowledge', this.queryKnowledge.bind(this));
    this.registerCapability('updateKnowledge', this.updateKnowledge.bind(this));
  }
  
  /**
   * Processes health data from various formats
   * @async
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed health data
   */
  async processHealthData(options) {
    try {
      logger.debug('Processing health data');
      return await this.healthDataProcessor.processHealthData(options);
    } catch (error) {
      logger.error(`Failed to process health data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Extracts medical entities from text
   * @async
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extracted medical entities
   */
  async extractMedicalEntities(options) {
    try {
      logger.debug('Extracting medical entities');
      return await this.healthDataProcessor.extractMedicalEntities(options);
    } catch (error) {
      logger.error(`Failed to extract medical entities: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Analyzes medical images
   * @async
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeMedicalImage(options) {
    try {
      logger.debug('Analyzing medical image');
      return await this.healthDataProcessor.analyzeMedicalImage(options);
    } catch (error) {
      logger.error(`Failed to analyze medical image: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Visualizes health data
   * @async
   * @param {Object} options - Visualization options
   * @returns {Promise<Object>} Visualization results
   */
  async visualizeHealthData(options) {
    try {
      logger.debug('Visualizing health data');
      return await this.healthDataProcessor.visualizeHealthData(options);
    } catch (error) {
      logger.error(`Failed to visualize health data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets clinical recommendations
   * @async
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Clinical recommendations
   */
  async getRecommendations(options) {
    try {
      logger.debug('Getting clinical recommendations');
      return await this.clinicalDecisionSupport.getRecommendations(options);
    } catch (error) {
      logger.error(`Failed to get recommendations: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Checks medication interactions
   * @async
   * @param {Object} options - Interaction check options
   * @returns {Promise<Object>} Medication interactions
   */
  async checkMedicationInteractions(options) {
    try {
      logger.debug('Checking medication interactions');
      return await this.clinicalDecisionSupport.checkMedicationInteractions(options);
    } catch (error) {
      logger.error(`Failed to check medication interactions: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Summarizes medical literature
   * @async
   * @param {Object} options - Summary options
   * @returns {Promise<Object>} Literature summary
   */
  async summarizeMedicalLiterature(options) {
    try {
      logger.debug('Summarizing medical literature');
      return await this.clinicalDecisionSupport.summarizeMedicalLiterature(options);
    } catch (error) {
      logger.error(`Failed to summarize medical literature: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Retrieves relevant clinical information
   * @async
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Relevant information
   */
  async retrieveRelevantInformation(options) {
    try {
      logger.debug('Retrieving relevant information');
      return await this.clinicalDecisionSupport.retrieveRelevantInformation(options);
    } catch (error) {
      logger.error(`Failed to retrieve relevant information: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Stores patient data
   * @async
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result
   */
  async storePatientData(options) {
    try {
      logger.debug('Storing patient data');
      return await this.patientDataManager.storePatientData(options);
    } catch (error) {
      logger.error(`Failed to store patient data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Retrieves patient data
   * @async
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Retrieved patient data
   */
  async retrievePatientData(options) {
    try {
      logger.debug('Retrieving patient data');
      return await this.patientDataManager.retrievePatientData(options);
    } catch (error) {
      logger.error(`Failed to retrieve patient data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Updates patient data
   * @async
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updatePatientData(options) {
    try {
      logger.debug('Updating patient data');
      return await this.patientDataManager.updatePatientData(options);
    } catch (error) {
      logger.error(`Failed to update patient data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Deletes patient data
   * @async
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deletePatientData(options) {
    try {
      logger.debug('Deleting patient data');
      return await this.patientDataManager.deletePatientData(options);
    } catch (error) {
      logger.error(`Failed to delete patient data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Exports patient data
   * @async
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Exported patient data
   */
  async exportPatientData(options) {
    try {
      logger.debug('Exporting patient data');
      return await this.patientDataManager.exportPatientData(options);
    } catch (error) {
      logger.error(`Failed to export patient data: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates an audit report
   * @async
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Audit report
   */
  async generateAuditReport(options) {
    try {
      logger.debug('Generating audit report');
      return await this.patientDataManager.generateAuditReport(options);
    } catch (error) {
      logger.error(`Failed to generate audit report: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates a clinical summary
   * @async
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated clinical summary
   */
  async generateClinicalSummary(options) {
    try {
      logger.debug('Generating clinical summary');
      return await this.medicalDocumentGenerator.generateClinicalSummary(options);
    } catch (error) {
      logger.error(`Failed to generate clinical summary: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates patient education materials
   * @async
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated patient education materials
   */
  async generatePatientEducation(options) {
    try {
      logger.debug('Generating patient education materials');
      return await this.medicalDocumentGenerator.generatePatientEducation(options);
    } catch (error) {
      logger.error(`Failed to generate patient education materials: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates discharge instructions
   * @async
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated discharge instructions
   */
  async generateDischargeInstructions(options) {
    try {
      logger.debug('Generating discharge instructions');
      return await this.medicalDocumentGenerator.generateDischargeInstructions(options);
    } catch (error) {
      logger.error(`Failed to generate discharge instructions: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates a referral letter
   * @async
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated referral letter
   */
  async generateReferralLetter(options) {
    try {
      logger.debug('Generating referral letter');
      return await this.medicalDocumentGenerator.generateReferralLetter(options);
    } catch (error) {
      logger.error(`Failed to generate referral letter: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates a custom medical document
   * @async
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated custom document
   */
  async generateCustomDocument(options) {
    try {
      logger.debug('Generating custom document');
      return await this.medicalDocumentGenerator.generateCustomDocument(options);
    } catch (error) {
      logger.error(`Failed to generate custom document: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Queries the medical knowledge base
   * @async
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async queryKnowledge(options) {
    try {
      logger.debug('Querying medical knowledge base');
      return await this.medicalKnowledgeBase.queryKnowledge(options);
    } catch (error) {
      logger.error(`Failed to query knowledge base: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Updates the medical knowledge base
   * @async
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateKnowledge(options) {
    try {
      logger.debug('Updating medical knowledge base');
      return await this.medicalKnowledgeBase.updateKnowledge(options);
    } catch (error) {
      logger.error(`Failed to update knowledge base: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Validates HIPAA compliance for an operation
   * @async
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateHIPAACompliance(options) {
    try {
      logger.debug('Validating HIPAA compliance');
      return await this.hipaaComplianceManager.validateDataAccess(options);
    } catch (error) {
      logger.error(`Failed to validate HIPAA compliance: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Handles shutdown of the Medical/Health Tentacle
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    try {
      logger.info('Shutting down Medical/Health Tentacle');
      
      // Apply data retention policies before shutdown
      await this.patientDataManager.applyDataRetentionPolicy();
      
      // Shutdown base tentacle
      await super.shutdown();
      
      logger.info('Medical/Health Tentacle shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to shut down Medical/Health Tentacle: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = MedicalHealthTentacle;
