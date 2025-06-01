/**
 * @fileoverview MedicalDocumentGenerator creates medical summaries, reports, patient education
 * materials, and structured medical documentation with HIPAA compliance.
 * 
 * @module tentacles/medical_health/MedicalDocumentGenerator
 * @requires core/ml/ModelLoaderService
 * @requires core/ml/external/ExternalModelManager
 * @requires core/utils/Logger
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires tentacles/medical_health/MedicalKnowledgeBase
 * @requires tentacles/medical_health/PatientDataManager
 */

const ModelLoaderService = require('../../core/ml/ModelLoaderService');
const ExternalModelManager = require('../../core/ml/external/ExternalModelManager');
const Logger = require('../../core/utils/Logger');
const HIPAAComplianceManager = require('./HIPAAComplianceManager');
const MedicalKnowledgeBase = require('./MedicalKnowledgeBase');
const PatientDataManager = require('./PatientDataManager');

const logger = Logger.getLogger('MedicalDocumentGenerator');

/**
 * @class MedicalDocumentGenerator
 * @description Generates medical documents, summaries, and patient education materials
 */
class MedicalDocumentGenerator {
  /**
   * Creates an instance of MedicalDocumentGenerator
   * @param {Object} options - Configuration options
   * @param {ModelLoaderService} options.modelLoaderService - Service for loading embedded models
   * @param {ExternalModelManager} options.externalModelManager - Manager for external API models
   * @param {HIPAAComplianceManager} options.hipaaComplianceManager - Manager for HIPAA compliance
   * @param {MedicalKnowledgeBase} options.medicalKnowledgeBase - Medical knowledge base
   * @param {PatientDataManager} options.patientDataManager - Patient data manager
   */
  constructor(options = {}) {
    this.modelLoaderService = options.modelLoaderService || new ModelLoaderService();
    this.externalModelManager = options.externalModelManager || new ExternalModelManager();
    this.hipaaComplianceManager = options.hipaaComplianceManager || new HIPAAComplianceManager();
    this.medicalKnowledgeBase = options.medicalKnowledgeBase || new MedicalKnowledgeBase();
    this.patientDataManager = options.patientDataManager || new PatientDataManager();
    
    // Document templates
    this.templates = {
      clinicalSummary: {
        sections: ['Demographics', 'Chief Complaint', 'History of Present Illness', 'Past Medical History', 
                  'Medications', 'Allergies', 'Review of Systems', 'Physical Examination', 
                  'Assessment', 'Plan'],
        model: 'DeepSeek-V3'
      },
      patientEducation: {
        sections: ['Condition Overview', 'Causes', 'Symptoms', 'Treatment Options', 
                  'Self-Care Instructions', 'When to Seek Help', 'Resources'],
        model: 'Llama-3-70B'
      },
      dischargeInstructions: {
        sections: ['Diagnosis', 'Medications', 'Activity Restrictions', 'Diet', 
                  'Follow-up Instructions', 'Warning Signs', 'Contact Information'],
        model: 'DeepSeek-V3'
      },
      referralLetter: {
        sections: ['Patient Information', 'Referring Provider', 'Reason for Referral', 
                  'Clinical History', 'Current Medications', 'Diagnostic Results', 
                  'Treatment to Date', 'Questions for Consultant'],
        model: 'Llama-3-70B'
      }
    };
    
    // Document formats
    this.formats = {
      PDF: {
        mimeType: 'application/pdf',
        extension: '.pdf'
      },
      HTML: {
        mimeType: 'text/html',
        extension: '.html'
      },
      MARKDOWN: {
        mimeType: 'text/markdown',
        extension: '.md'
      },
      PLAIN_TEXT: {
        mimeType: 'text/plain',
        extension: '.txt'
      }
    };
    
    // Supported languages
    this.languages = [
      'en', // English
      'es', // Spanish
      'fr', // French
      'de', // German
      'zh', // Chinese
      'ar', // Arabic
      'ru', // Russian
      'hi', // Hindi
      'pt', // Portuguese
      'ja'  // Japanese
    ];
    
    // Health literacy levels
    this.literacyLevels = {
      PROFESSIONAL: 'Professional medical terminology',
      ADVANCED: 'College level (Grade 13-16)',
      INTERMEDIATE: 'High school level (Grade 9-12)',
      BASIC: 'Elementary school level (Grade 5-8)',
      SIMPLIFIED: 'Simple language (Grade 1-4)'
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.generateClinicalSummary = this.generateClinicalSummary.bind(this);
    this.generatePatientEducation = this.generatePatientEducation.bind(this);
    this.generateDischargeInstructions = this.generateDischargeInstructions.bind(this);
    this.generateReferralLetter = this.generateReferralLetter.bind(this);
    this.generateCustomDocument = this.generateCustomDocument.bind(this);
    this.getModelForTemplate = this.getModelForTemplate.bind(this);
    this.formatDocument = this.formatDocument.bind(this);
    this.translateDocument = this.translateDocument.bind(this);
    this.adjustLiteracyLevel = this.adjustLiteracyLevel.bind(this);
  }
  
  /**
   * Initializes the MedicalDocumentGenerator
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing MedicalDocumentGenerator');
      
      // Initialize HIPAA compliance manager
      await this.hipaaComplianceManager.initialize();
      
      // Initialize medical knowledge base
      await this.medicalKnowledgeBase.initialize();
      
      // Initialize patient data manager
      await this.patientDataManager.initialize();
      
      // Pre-load high-priority embedded models
      await this.modelLoaderService.preloadModel('DeepSeek-V3');
      
      logger.info('MedicalDocumentGenerator initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize MedicalDocumentGenerator: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Generates a clinical summary document
   * @async
   * @param {Object} options - Generation options
   * @param {string} options.patientId - Patient ID
   * @param {Object} [options.encounterData] - Encounter data
   * @param {string} [options.format='MARKDOWN'] - Output format
   * @param {string} [options.language='en'] - Output language
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Generated clinical summary
   */
  async generateClinicalSummary(options) {
    try {
      logger.debug(`Generating clinical summary for patient ${options.patientId}`);
      
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
      
      // Log the document generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: 'Generating clinical summary document'
      });
      
      // Get patient data
      const patientDataResult = await this.patientDataManager.retrievePatientData({
        patientId: options.patientId,
        complianceOptions: options.complianceOptions
      });
      
      // Get the appropriate model for clinical summary generation
      const model = await this.getModelForTemplate(
        'clinicalSummary',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the document content
      const documentContent = await this.prepareClinicalSummaryContent(
        patientDataResult.data,
        options.encounterData,
        model
      );
      
      // Format the document
      const format = options.format || 'MARKDOWN';
      const formattedDocument = await this.formatDocument(documentContent, format);
      
      // Translate if needed
      let finalDocument = formattedDocument;
      if (options.language && options.language !== 'en') {
        finalDocument = await this.translateDocument(formattedDocument, 'en', options.language);
      }
      
      // Log the successful document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Successfully generated clinical summary document using ${model.name}`
      });
      
      return {
        documentType: 'Clinical Summary',
        patientId: options.patientId,
        content: finalDocument,
        format: format,
        language: options.language || 'en',
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate clinical summary document: ${error.message}`
      });
      
      logger.error(`Failed to generate clinical summary: ${error.message}`, error);
      throw new Error(`Clinical summary generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generates patient education materials
   * @async
   * @param {Object} options - Generation options
   * @param {string} options.condition - Medical condition
   * @param {string} [options.patientId] - Patient ID for personalization
   * @param {string} [options.format='MARKDOWN'] - Output format
   * @param {string} [options.language='en'] - Output language
   * @param {string} [options.literacyLevel='INTERMEDIATE'] - Health literacy level
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Generated patient education materials
   */
  async generatePatientEducation(options) {
    try {
      logger.debug(`Generating patient education materials for ${options.condition}`);
      
      if (!options.condition) {
        throw new Error('Medical condition is required');
      }
      
      // If patient ID is provided, validate data access
      if (options.patientId) {
        const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
          userId: options.complianceOptions?.userId,
          patientId: options.patientId,
          purpose: options.complianceOptions?.purpose || 'TREATMENT',
          action: 'ACCESS'
        });
        
        if (!accessValidation.granted) {
          throw new Error(`Access denied: ${accessValidation.reason}`);
        }
      }
      
      // Log the document generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Generating patient education materials for ${options.condition}`
      });
      
      // Get patient data if patient ID is provided
      let patientData = null;
      if (options.patientId) {
        const patientDataResult = await this.patientDataManager.retrievePatientData({
          patientId: options.patientId,
          complianceOptions: options.complianceOptions
        });
        patientData = patientDataResult.data;
      }
      
      // Get the appropriate model for patient education generation
      const model = await this.getModelForTemplate(
        'patientEducation',
        options.forceOnline,
        options.forceOffline
      );
      
      // Get condition information from the medical knowledge base
      const conditionInfo = await this.medicalKnowledgeBase.queryKnowledge({
        query: options.condition,
        domain: 'conditions',
        complianceOptions: options.complianceOptions
      });
      
      // Prepare the document content
      const documentContent = await this.preparePatientEducationContent(
        options.condition,
        conditionInfo.response,
        patientData,
        model
      );
      
      // Format the document
      const format = options.format || 'MARKDOWN';
      const formattedDocument = await this.formatDocument(documentContent, format);
      
      // Translate if needed
      let translatedDocument = formattedDocument;
      if (options.language && options.language !== 'en') {
        translatedDocument = await this.translateDocument(formattedDocument, 'en', options.language);
      }
      
      // Adjust literacy level if needed
      const literacyLevel = options.literacyLevel || 'INTERMEDIATE';
      const finalDocument = await this.adjustLiteracyLevel(translatedDocument, literacyLevel);
      
      // Log the successful document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Successfully generated patient education materials for ${options.condition} using ${model.name}`
      });
      
      return {
        documentType: 'Patient Education',
        condition: options.condition,
        patientId: options.patientId,
        content: finalDocument,
        format: format,
        language: options.language || 'en',
        literacyLevel: literacyLevel,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate patient education materials: ${error.message}`
      });
      
      logger.error(`Failed to generate patient education materials: ${error.message}`, error);
      throw new Error(`Patient education materials generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generates discharge instructions
   * @async
   * @param {Object} options - Generation options
   * @param {string} options.patientId - Patient ID
   * @param {Object} options.dischargeData - Discharge data
   * @param {string} [options.format='MARKDOWN'] - Output format
   * @param {string} [options.language='en'] - Output language
   * @param {string} [options.literacyLevel='INTERMEDIATE'] - Health literacy level
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Generated discharge instructions
   */
  async generateDischargeInstructions(options) {
    try {
      logger.debug(`Generating discharge instructions for patient ${options.patientId}`);
      
      if (!options.patientId || !options.dischargeData) {
        throw new Error('Patient ID and discharge data are required');
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
      
      // Log the document generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: 'Generating discharge instructions'
      });
      
      // Get patient data
      const patientDataResult = await this.patientDataManager.retrievePatientData({
        patientId: options.patientId,
        complianceOptions: options.complianceOptions
      });
      
      // Get the appropriate model for discharge instructions generation
      const model = await this.getModelForTemplate(
        'dischargeInstructions',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the document content
      const documentContent = await this.prepareDischargeInstructionsContent(
        patientDataResult.data,
        options.dischargeData,
        model
      );
      
      // Format the document
      const format = options.format || 'MARKDOWN';
      const formattedDocument = await this.formatDocument(documentContent, format);
      
      // Translate if needed
      let translatedDocument = formattedDocument;
      if (options.language && options.language !== 'en') {
        translatedDocument = await this.translateDocument(formattedDocument, 'en', options.language);
      }
      
      // Adjust literacy level if needed
      const literacyLevel = options.literacyLevel || 'INTERMEDIATE';
      const finalDocument = await this.adjustLiteracyLevel(translatedDocument, literacyLevel);
      
      // Log the successful document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Successfully generated discharge instructions using ${model.name}`
      });
      
      return {
        documentType: 'Discharge Instructions',
        patientId: options.patientId,
        content: finalDocument,
        format: format,
        language: options.language || 'en',
        literacyLevel: literacyLevel,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate discharge instructions: ${error.message}`
      });
      
      logger.error(`Failed to generate discharge instructions: ${error.message}`, error);
      throw new Error(`Discharge instructions generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generates a referral letter
   * @async
   * @param {Object} options - Generation options
   * @param {string} options.patientId - Patient ID
   * @param {Object} options.referralData - Referral data
   * @param {string} [options.format='MARKDOWN'] - Output format
   * @param {string} [options.language='en'] - Output language
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Generated referral letter
   */
  async generateReferralLetter(options) {
    try {
      logger.debug(`Generating referral letter for patient ${options.patientId}`);
      
      if (!options.patientId || !options.referralData) {
        throw new Error('Patient ID and referral data are required');
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
      
      // Log the document generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: 'Generating referral letter'
      });
      
      // Get patient data
      const patientDataResult = await this.patientDataManager.retrievePatientData({
        patientId: options.patientId,
        complianceOptions: options.complianceOptions
      });
      
      // Get the appropriate model for referral letter generation
      const model = await this.getModelForTemplate(
        'referralLetter',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the document content
      const documentContent = await this.prepareReferralLetterContent(
        patientDataResult.data,
        options.referralData,
        model
      );
      
      // Format the document
      const format = options.format || 'MARKDOWN';
      const formattedDocument = await this.formatDocument(documentContent, format);
      
      // Translate if needed
      let finalDocument = formattedDocument;
      if (options.language && options.language !== 'en') {
        finalDocument = await this.translateDocument(formattedDocument, 'en', options.language);
      }
      
      // Log the successful document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Successfully generated referral letter using ${model.name}`
      });
      
      return {
        documentType: 'Referral Letter',
        patientId: options.patientId,
        content: finalDocument,
        format: format,
        language: options.language || 'en',
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate referral letter: ${error.message}`
      });
      
      logger.error(`Failed to generate referral letter: ${error.message}`, error);
      throw new Error(`Referral letter generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generates a custom medical document
   * @async
   * @param {Object} options - Generation options
   * @param {string} options.documentType - Type of document
   * @param {Array<string>} options.sections - Document sections
   * @param {Object} options.data - Document data
   * @param {string} [options.patientId] - Patient ID
   * @param {string} [options.format='MARKDOWN'] - Output format
   * @param {string} [options.language='en'] - Output language
   * @param {string} [options.literacyLevel] - Health literacy level
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} options.complianceOptions - HIPAA compliance options
   * @returns {Promise<Object>} Generated custom document
   */
  async generateCustomDocument(options) {
    try {
      logger.debug(`Generating custom ${options.documentType} document`);
      
      if (!options.documentType || !options.sections || !options.data) {
        throw new Error('Document type, sections, and data are required');
      }
      
      // If patient ID is provided, validate data access
      if (options.patientId) {
        const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
          userId: options.complianceOptions?.userId,
          patientId: options.patientId,
          purpose: options.complianceOptions?.purpose || 'TREATMENT',
          action: 'ACCESS'
        });
        
        if (!accessValidation.granted) {
          throw new Error(`Access denied: ${accessValidation.reason}`);
        }
      }
      
      // Log the document generation attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Generating custom ${options.documentType} document`
      });
      
      // Get patient data if patient ID is provided
      let patientData = null;
      if (options.patientId) {
        const patientDataResult = await this.patientDataManager.retrievePatientData({
          patientId: options.patientId,
          complianceOptions: options.complianceOptions
        });
        patientData = patientDataResult.data;
      }
      
      // Get the appropriate model
      const model = await this.getModelForTask(
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the document content
      const documentContent = await this.prepareCustomDocumentContent(
        options.documentType,
        options.sections,
        options.data,
        patientData,
        model
      );
      
      // Format the document
      const format = options.format || 'MARKDOWN';
      const formattedDocument = await this.formatDocument(documentContent, format);
      
      // Translate if needed
      let translatedDocument = formattedDocument;
      if (options.language && options.language !== 'en') {
        translatedDocument = await this.translateDocument(formattedDocument, 'en', options.language);
      }
      
      // Adjust literacy level if needed
      let finalDocument = translatedDocument;
      if (options.literacyLevel) {
        finalDocument = await this.adjustLiteracyLevel(translatedDocument, options.literacyLevel);
      }
      
      // Log the successful document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Successfully generated custom ${options.documentType} document using ${model.name}`
      });
      
      return {
        documentType: options.documentType,
        patientId: options.patientId,
        content: finalDocument,
        format: format,
        language: options.language || 'en',
        literacyLevel: options.literacyLevel,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed document generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GENERATE_DOCUMENT',
        component: 'MedicalDocumentGenerator',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.patientId,
        details: `Failed to generate custom document: ${error.message}`
      });
      
      logger.error(`Failed to generate custom document: ${error.message}`, error);
      throw new Error(`Custom document generation failed: ${error.message}`);
    }
  }
  
  /**
   * Gets the appropriate model for a document template
   * @async
   * @param {string} templateName - Template name
   * @param {boolean} [forceOnline=false] - Whether to force using online API models
   * @param {boolean} [forceOffline=false] - Whether to force using offline embedded models
   * @returns {Promise<Object>} Selected model information
   */
  async getModelForTemplate(templateName, forceOnline = false, forceOffline = false) {
    try {
      if (!this.templates[templateName]) {
        throw new Error(`Unknown template: ${templateName}`);
      }
      
      const modelName = this.templates[templateName].model;
      
      // If forcing online and offline simultaneously, throw an error
      if (forceOnline && forceOffline) {
        throw new Error('Cannot force both online and offline modes simultaneously');
      }
      
      // If forcing online, use an API model
      if (forceOnline) {
        return {
          name: modelName === 'DeepSeek-V3' ? 'Claude-3-Opus' : 'Gemini-Ultra',
          type: 'api'
        };
      }
      
      // If forcing offline, use the embedded model
      if (forceOffline) {
        return {
          name: modelName,
          type: 'embedded'
        };
      }
      
      // Check if we're online and API models are available
      const isOnline = await this.externalModelManager.isOnline();
      if (isOnline) {
        // Use the appropriate API model
        const apiModelName = modelName === 'DeepSeek-V3' ? 'Claude-3-Opus' : 'Gemini-Ultra';
        const apiModelAvailable = await this.externalModelManager.isModelAvailable(apiModelName);
        
        if (apiModelAvailable) {
          return {
            name: apiModelName,
            type: 'api'
          };
        }
      }
      
      // Check if the embedded model is available
      const embeddedModelAvailable = await this.modelLoaderService.isModelAvailable(modelName);
      if (embeddedModelAvailable) {
        return {
          name: modelName,
          type: 'embedded'
        };
      }
      
      // Fall back to an alternative embedded model
      return {
        name: modelName === 'DeepSeek-V3' ? 'Llama-3-70B' : 'Mixtral-8x22B',
        type: 'embedded'
      };
    } catch (error) {
      logger.error(`Failed to get model for template ${templateName}: ${error.message}`, error);
      throw new Error(`Model selection failed: ${error.message}`);
    }
  }
  
  /**
   * Gets the appropriate model for a general document task
   * @async
   * @param {boolean} [forceOnline=false] - Whether to force using online API models
   * @param {boolean} [forceOffline=false] - Whether to force using offline embedded models
   * @returns {Promise<Object>} Selected model information
   */
  async getModelForTask(forceOnline = false, forceOffline = false) {
    try {
      // If forcing online and offline simultaneously, throw an error
      if (forceOnline && forceOffline) {
        throw new Error('Cannot force both online and offline modes simultaneously');
      }
      
      // If forcing online, use an API model
      if (forceOnline) {
        return {
          name: 'Claude-3-Opus',
          type: 'api'
        };
      }
      
      // If forcing offline, use the embedded model
      if (forceOffline) {
        return {
          name: 'DeepSeek-V3',
          type: 'embedded'
        };
      }
      
      // Check if we're online and API models are available
      const isOnline = await this.externalModelManager.isOnline();
      if (isOnline) {
        const apiModelAvailable = await this.externalModelManager.isModelAvailable('Claude-3-Opus');
        
        if (apiModelAvailable) {
          return {
            name: 'Claude-3-Opus',
            type: 'api'
          };
        }
      }
      
      // Check if the primary embedded model is available
      const primaryModelAvailable = await this.modelLoaderService.isModelAvailable('DeepSeek-V3');
      if (primaryModelAvailable) {
        return {
          name: 'DeepSeek-V3',
          type: 'embedded'
        };
      }
      
      // Fall back to an alternative embedded model
      return {
        name: 'Llama-3-70B',
        type: 'embedded'
      };
    } catch (error) {
      logger.error(`Failed to get model for task: ${error.message}`, error);
      throw new Error(`Model selection failed: ${error.message}`);
    }
  }
  
  /**
   * Prepares content for a clinical summary
   * @async
   * @param {Object} patientData - Patient data
   * @param {Object} encounterData - Encounter data
   * @param {Object} model - Model to use
   * @returns {Promise<Object>} Prepared document content
   */
  async prepareClinicalSummaryContent(patientData, encounterData, model) {
    try {
      // Extract relevant patient information
      const demographics = patientData.demographics && patientData.demographics.length > 0 ? 
        patientData.demographics[0].data : {};
      
      const conditions = patientData.conditions ? 
        patientData.conditions.map(c => c.data).flat() : [];
      
      const medications = patientData.medications ? 
        patientData.medications.map(m => m.data).flat() : [];
      
      const allergies = patientData.allergies ? 
        patientData.allergies.map(a => a.data).flat() : [];
      
      // Prepare the prompt for clinical summary generation
      const prompt = `Generate a comprehensive clinical summary with the following sections:

1. Demographics
2. Chief Complaint
3. History of Present Illness
4. Past Medical History
5. Medications
6. Allergies
7. Review of Systems
8. Physical Examination
9. Assessment
10. Plan

Use the following patient information:

Demographics:
${JSON.stringify(demographics, null, 2)}

Medical Conditions:
${JSON.stringify(conditions, null, 2)}

Medications:
${JSON.stringify(medications, null, 2)}

Allergies:
${JSON.stringify(allergies, null, 2)}

Encounter Information:
${encounterData ? JSON.stringify(encounterData, null, 2) : 'No encounter data provided'}

Format the output as a structured clinical document with clear section headings. Use professional medical terminology appropriate for healthcare providers. Include all relevant clinical information from the provided data.`;
      
      // Generate the document content using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1 // Low temperature for factual, structured content
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1
        });
      }
      
      // Parse the response into sections
      const sections = this.parseSectionsFromText(response, this.templates.clinicalSummary.sections);
      
      return {
        title: 'Clinical Summary',
        sections: sections,
        rawContent: response
      };
    } catch (error) {
      logger.error(`Failed to prepare clinical summary content: ${error.message}`, error);
      throw new Error(`Clinical summary content preparation failed: ${error.message}`);
    }
  }
  
  /**
   * Prepares content for patient education materials
   * @async
   * @param {string} condition - Medical condition
   * @param {string} conditionInfo - Condition information
   * @param {Object} patientData - Patient data (optional)
   * @param {Object} model - Model to use
   * @returns {Promise<Object>} Prepared document content
   */
  async preparePatientEducationContent(condition, conditionInfo, patientData, model) {
    try {
      // Prepare personalization information if patient data is available
      let personalization = '';
      if (patientData) {
        const demographics = patientData.demographics && patientData.demographics.length > 0 ? 
          patientData.demographics[0].data : {};
        
        const medications = patientData.medications ? 
          patientData.medications.map(m => m.data).flat() : [];
        
        personalization = `
Patient Information for Personalization:
${JSON.stringify(demographics, null, 2)}

Current Medications:
${JSON.stringify(medications, null, 2)}`;
      }
      
      // Prepare the prompt for patient education generation
      const prompt = `Generate comprehensive patient education materials about ${condition} with the following sections:

1. Condition Overview
2. Causes
3. Symptoms
4. Treatment Options
5. Self-Care Instructions
6. When to Seek Help
7. Resources

Use the following condition information:
${conditionInfo}
${personalization}

Format the output as a patient-friendly educational document with clear section headings. Use plain language that is easy to understand for non-medical professionals. Focus on practical information that will help patients understand and manage their condition. Include specific self-care instructions and clear guidance on when to seek medical help.`;
      
      // Generate the document content using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.3 // Slightly higher temperature for more natural language
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.3
        });
      }
      
      // Parse the response into sections
      const sections = this.parseSectionsFromText(response, this.templates.patientEducation.sections);
      
      return {
        title: `Understanding ${condition}`,
        sections: sections,
        rawContent: response
      };
    } catch (error) {
      logger.error(`Failed to prepare patient education content: ${error.message}`, error);
      throw new Error(`Patient education content preparation failed: ${error.message}`);
    }
  }
  
  /**
   * Prepares content for discharge instructions
   * @async
   * @param {Object} patientData - Patient data
   * @param {Object} dischargeData - Discharge data
   * @param {Object} model - Model to use
   * @returns {Promise<Object>} Prepared document content
   */
  async prepareDischargeInstructionsContent(patientData, dischargeData, model) {
    try {
      // Extract relevant patient information
      const demographics = patientData.demographics && patientData.demographics.length > 0 ? 
        patientData.demographics[0].data : {};
      
      const conditions = patientData.conditions ? 
        patientData.conditions.map(c => c.data).flat() : [];
      
      const medications = patientData.medications ? 
        patientData.medications.map(m => m.data).flat() : [];
      
      // Prepare the prompt for discharge instructions generation
      const prompt = `Generate comprehensive discharge instructions with the following sections:

1. Diagnosis
2. Medications
3. Activity Restrictions
4. Diet
5. Follow-up Instructions
6. Warning Signs
7. Contact Information

Use the following patient information:

Demographics:
${JSON.stringify(demographics, null, 2)}

Medical Conditions:
${JSON.stringify(conditions, null, 2)}

Medications:
${JSON.stringify(medications, null, 2)}

Discharge Information:
${JSON.stringify(dischargeData, null, 2)}

Format the output as clear discharge instructions with section headings. Use plain language that is easy to understand. Include specific instructions for medications, activity restrictions, diet, and follow-up care. Clearly explain warning signs that require immediate medical attention. Include contact information for follow-up care.`;
      
      // Generate the document content using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.2
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.2
        });
      }
      
      // Parse the response into sections
      const sections = this.parseSectionsFromText(response, this.templates.dischargeInstructions.sections);
      
      return {
        title: 'Discharge Instructions',
        sections: sections,
        rawContent: response
      };
    } catch (error) {
      logger.error(`Failed to prepare discharge instructions content: ${error.message}`, error);
      throw new Error(`Discharge instructions content preparation failed: ${error.message}`);
    }
  }
  
  /**
   * Prepares content for a referral letter
   * @async
   * @param {Object} patientData - Patient data
   * @param {Object} referralData - Referral data
   * @param {Object} model - Model to use
   * @returns {Promise<Object>} Prepared document content
   */
  async prepareReferralLetterContent(patientData, referralData, model) {
    try {
      // Extract relevant patient information
      const demographics = patientData.demographics && patientData.demographics.length > 0 ? 
        patientData.demographics[0].data : {};
      
      const conditions = patientData.conditions ? 
        patientData.conditions.map(c => c.data).flat() : [];
      
      const medications = patientData.medications ? 
        patientData.medications.map(m => m.data).flat() : [];
      
      // Prepare the prompt for referral letter generation
      const prompt = `Generate a professional medical referral letter with the following sections:

1. Patient Information
2. Referring Provider
3. Reason for Referral
4. Clinical History
5. Current Medications
6. Diagnostic Results
7. Treatment to Date
8. Questions for Consultant

Use the following information:

Patient Demographics:
${JSON.stringify(demographics, null, 2)}

Medical Conditions:
${JSON.stringify(conditions, null, 2)}

Medications:
${JSON.stringify(medications, null, 2)}

Referral Information:
${JSON.stringify(referralData, null, 2)}

Format the output as a formal medical referral letter with clear section headings. Use professional medical terminology appropriate for healthcare providers. Include all relevant clinical information and specific questions for the consultant. The letter should be comprehensive but concise.`;
      
      // Generate the document content using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1
        });
      }
      
      // Parse the response into sections
      const sections = this.parseSectionsFromText(response, this.templates.referralLetter.sections);
      
      return {
        title: 'Medical Referral',
        sections: sections,
        rawContent: response
      };
    } catch (error) {
      logger.error(`Failed to prepare referral letter content: ${error.message}`, error);
      throw new Error(`Referral letter content preparation failed: ${error.message}`);
    }
  }
  
  /**
   * Prepares content for a custom document
   * @async
   * @param {string} documentType - Document type
   * @param {Array<string>} sections - Document sections
   * @param {Object} data - Document data
   * @param {Object} patientData - Patient data (optional)
   * @param {Object} model - Model to use
   * @returns {Promise<Object>} Prepared document content
   */
  async prepareCustomDocumentContent(documentType, sections, data, patientData, model) {
    try {
      // Prepare patient information if available
      let patientInfo = '';
      if (patientData) {
        patientInfo = `
Patient Information:
${JSON.stringify(patientData, null, 2)}`;
      }
      
      // Prepare the prompt for custom document generation
      const prompt = `Generate a ${documentType} document with the following sections:

${sections.map((section, index) => `${index + 1}. ${section}`).join('\n')}

Use the following information:
${JSON.stringify(data, null, 2)}
${patientInfo}

Format the output as a structured document with clear section headings. Use appropriate terminology and style for a ${documentType} document. Include all relevant information from the provided data.`;
      
      // Generate the document content using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.2
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.2
        });
      }
      
      // Parse the response into sections
      const parsedSections = this.parseSectionsFromText(response, sections);
      
      return {
        title: documentType,
        sections: parsedSections,
        rawContent: response
      };
    } catch (error) {
      logger.error(`Failed to prepare custom document content: ${error.message}`, error);
      throw new Error(`Custom document content preparation failed: ${error.message}`);
    }
  }
  
  /**
   * Formats a document in the specified format
   * @async
   * @param {Object} documentContent - Document content
   * @param {string} format - Output format
   * @returns {Promise<string>} Formatted document
   */
  async formatDocument(documentContent, format) {
    try {
      if (!this.formats[format]) {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      // For now, we'll just return the raw content
      // In a production system, this would convert to the appropriate format
      
      let formattedContent = '';
      
      switch (format) {
        case 'MARKDOWN':
          formattedContent = `# ${documentContent.title}\n\n`;
          
          for (const [sectionName, sectionContent] of Object.entries(documentContent.sections)) {
            formattedContent += `## ${sectionName}\n\n${sectionContent}\n\n`;
          }
          break;
          
        case 'HTML':
          formattedContent = `<!DOCTYPE html>
<html>
<head>
  <title>${documentContent.title}</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; margin-top: 30px; }
  </style>
</head>
<body>
  <h1>${documentContent.title}</h1>
`;
          
          for (const [sectionName, sectionContent] of Object.entries(documentContent.sections)) {
            formattedContent += `  <h2>${sectionName}</h2>\n  <div>${sectionContent.replace(/\n/g, '<br>')}</div>\n\n`;
          }
          
          formattedContent += `</body>\n</html>`;
          break;
          
        case 'PLAIN_TEXT':
          formattedContent = `${documentContent.title.toUpperCase()}\n\n`;
          
          for (const [sectionName, sectionContent] of Object.entries(documentContent.sections)) {
            formattedContent += `${sectionName.toUpperCase()}\n${'-'.repeat(sectionName.length)}\n\n${sectionContent}\n\n`;
          }
          break;
          
        case 'PDF':
          // In a production system, this would generate a PDF
          // For now, we'll return the content in Markdown format
          formattedContent = `# ${documentContent.title}\n\n`;
          
          for (const [sectionName, sectionContent] of Object.entries(documentContent.sections)) {
            formattedContent += `## ${sectionName}\n\n${sectionContent}\n\n`;
          }
          
          formattedContent += '\n\n[This document would be formatted as a PDF in production]';
          break;
          
        default:
          formattedContent = documentContent.rawContent;
      }
      
      return formattedContent;
    } catch (error) {
      logger.error(`Failed to format document: ${error.message}`, error);
      throw new Error(`Document formatting failed: ${error.message}`);
    }
  }
  
  /**
   * Translates a document to the specified language
   * @async
   * @param {string} document - Document to translate
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<string>} Translated document
   */
  async translateDocument(document, sourceLanguage, targetLanguage) {
    try {
      if (!this.languages.includes(targetLanguage)) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }
      
      // In a production system, this would use a translation service or model
      // For now, we'll simulate translation by adding a note
      
      // Get a model for translation
      const model = await this.getModelForTask(false, false);
      
      // Prepare the prompt for translation
      const prompt = `Translate the following document from ${sourceLanguage} to ${targetLanguage}. Maintain the original formatting, including headings, paragraphs, and any special formatting.

Document to translate:
${document}

Translated document:`;
      
      // Generate the translation using the selected model
      let translatedDocument;
      if (model.type === 'embedded') {
        translatedDocument = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.1
        });
      } else {
        translatedDocument = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.1
        });
      }
      
      return translatedDocument;
    } catch (error) {
      logger.error(`Failed to translate document: ${error.message}`, error);
      throw new Error(`Document translation failed: ${error.message}`);
    }
  }
  
  /**
   * Adjusts the literacy level of a document
   * @async
   * @param {string} document - Document to adjust
   * @param {string} targetLevel - Target literacy level
   * @returns {Promise<string>} Adjusted document
   */
  async adjustLiteracyLevel(document, targetLevel) {
    try {
      if (!this.literacyLevels[targetLevel]) {
        throw new Error(`Unsupported literacy level: ${targetLevel}`);
      }
      
      // Get a model for literacy adjustment
      const model = await this.getModelForTask(false, false);
      
      // Prepare the prompt for literacy adjustment
      const prompt = `Rewrite the following document to match a ${this.literacyLevels[targetLevel]} literacy level. Maintain the original content, meaning, and formatting, including headings and paragraphs, but adjust the language complexity to be appropriate for the target literacy level.

Document to adjust:
${document}

Adjusted document:`;
      
      // Generate the adjusted document using the selected model
      let adjustedDocument;
      if (model.type === 'embedded') {
        adjustedDocument = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.2
        });
      } else {
        adjustedDocument = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.2
        });
      }
      
      return adjustedDocument;
    } catch (error) {
      logger.error(`Failed to adjust document literacy level: ${error.message}`, error);
      throw new Error(`Literacy level adjustment failed: ${error.message}`);
    }
  }
  
  /**
   * Parses sections from generated text
   * @param {string} text - Generated text
   * @param {Array<string>} expectedSections - Expected section names
   * @returns {Object} Parsed sections
   */
  parseSectionsFromText(text, expectedSections) {
    try {
      const sections = {};
      
      // Initialize with empty sections
      for (const section of expectedSections) {
        sections[section] = '';
      }
      
      let currentSection = null;
      const lines = text.split('\n');
      
      for (const line of lines) {
        // Check if this line is a section header
        let foundSection = false;
        for (const section of expectedSections) {
          // Match section headers with various formats (e.g., "## Section Name", "Section Name:", etc.)
          const sectionRegex = new RegExp(`(?:^#{1,3}\\s*${section}|^${section}:)`, 'i');
          if (sectionRegex.test(line.trim())) {
            currentSection = section;
            foundSection = true;
            break;
          }
        }
        
        // If not a section header and we have a current section, add to that section
        if (!foundSection && currentSection) {
          sections[currentSection] += line + '\n';
        }
      }
      
      // Trim whitespace from each section
      for (const section in sections) {
        sections[section] = sections[section].trim();
      }
      
      return sections;
    } catch (error) {
      logger.error(`Failed to parse sections from text: ${error.message}`, error);
      
      // Return the text as a single section if parsing fails
      return {
        'Content': text
      };
    }
  }
}

module.exports = MedicalDocumentGenerator;
