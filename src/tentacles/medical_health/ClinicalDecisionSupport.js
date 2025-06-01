/**
 * @fileoverview ClinicalDecisionSupport provides evidence-based recommendations, identifies
 * potential medication interactions, and summarizes medical literature for healthcare professionals.
 * 
 * @module tentacles/medical_health/ClinicalDecisionSupport
 * @requires core/ml/ModelLoaderService
 * @requires core/ml/external/ExternalModelManager
 * @requires core/utils/Logger
 * @requires tentacles/medical_health/HIPAAComplianceManager
 * @requires tentacles/medical_health/MedicalKnowledgeBase
 * @requires tentacles/medical_health/HealthDataProcessor
 */

const ModelLoaderService = require('../../core/ml/ModelLoaderService');
const ExternalModelManager = require('../../core/ml/external/ExternalModelManager');
const Logger = require('../../core/utils/Logger');
const HIPAAComplianceManager = require('./HIPAAComplianceManager');
const MedicalKnowledgeBase = require('./MedicalKnowledgeBase');
const HealthDataProcessor = require('./HealthDataProcessor');

const logger = Logger.getLogger('ClinicalDecisionSupport');

/**
 * @class ClinicalDecisionSupport
 * @description Provides clinical decision support capabilities with evidence-based recommendations
 */
class ClinicalDecisionSupport {
  /**
   * Creates an instance of ClinicalDecisionSupport
   * @param {Object} options - Configuration options
   * @param {ModelLoaderService} options.modelLoaderService - Service for loading embedded models
   * @param {ExternalModelManager} options.externalModelManager - Manager for external API models
   * @param {HIPAAComplianceManager} options.hipaaComplianceManager - Manager for HIPAA compliance
   * @param {MedicalKnowledgeBase} options.medicalKnowledgeBase - Medical knowledge base
   * @param {HealthDataProcessor} options.healthDataProcessor - Health data processor
   */
  constructor(options = {}) {
    this.modelLoaderService = options.modelLoaderService || new ModelLoaderService();
    this.externalModelManager = options.externalModelManager || new ExternalModelManager();
    this.hipaaComplianceManager = options.hipaaComplianceManager || new HIPAAComplianceManager();
    this.medicalKnowledgeBase = options.medicalKnowledgeBase || new MedicalKnowledgeBase();
    this.healthDataProcessor = options.healthDataProcessor || new HealthDataProcessor();
    
    // Models for different clinical decision support tasks
    this.models = {
      recommendations: {
        embeddedModel: 'DeepSeek-V3',
        apiModel: 'Claude-3-Opus',
        fallbackModel: 'Llama-3-70B'
      },
      interactions: {
        embeddedModel: 'Llama-3-70B',
        apiModel: 'Gemini-Ultra',
        fallbackModel: 'Mixtral-8x22B'
      },
      literature: {
        embeddedModel: 'DeepSeek-V3',
        apiModel: 'Claude-3-Opus',
        fallbackModel: 'Llama-3-70B'
      },
      informationRetrieval: {
        embeddedModel: 'Llama-3-70B',
        apiModel: 'Cohere-Command-R-Plus',
        fallbackModel: 'Mixtral-8x22B'
      }
    };
    
    // Evidence levels for recommendations
    this.evidenceLevels = {
      I: 'Evidence from systematic reviews of multiple high-quality randomized controlled trials',
      II: 'Evidence from at least one high-quality randomized controlled trial',
      III: 'Evidence from well-designed controlled trials without randomization',
      IV: 'Evidence from well-designed case-control and cohort studies',
      V: 'Evidence from systematic reviews of descriptive and qualitative studies',
      VI: 'Evidence from single descriptive or qualitative studies',
      VII: 'Evidence from the opinion of authorities and/or reports of expert committees'
    };
    
    // Recommendation strength categories
    this.recommendationStrengths = {
      A: 'Strong recommendation based on high-quality evidence',
      B: 'Moderate recommendation based on moderate-quality evidence',
      C: 'Optional recommendation based on low-quality evidence',
      D: 'Recommendation against based on low to moderate-quality evidence',
      E: 'Recommendation against based on high-quality evidence'
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getRecommendations = this.getRecommendations.bind(this);
    this.checkMedicationInteractions = this.checkMedicationInteractions.bind(this);
    this.summarizeMedicalLiterature = this.summarizeMedicalLiterature.bind(this);
    this.retrieveRelevantInformation = this.retrieveRelevantInformation.bind(this);
    this.getModelForTask = this.getModelForTask.bind(this);
    this.validateRecommendation = this.validateRecommendation.bind(this);
    this.assignEvidenceLevel = this.assignEvidenceLevel.bind(this);
  }
  
  /**
   * Initializes the ClinicalDecisionSupport component
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing ClinicalDecisionSupport');
      
      // Initialize HIPAA compliance manager
      await this.hipaaComplianceManager.initialize();
      
      // Initialize medical knowledge base
      await this.medicalKnowledgeBase.initialize();
      
      // Initialize health data processor
      await this.healthDataProcessor.initialize();
      
      // Pre-load high-priority embedded models
      await this.modelLoaderService.preloadModel('DeepSeek-V3');
      
      logger.info('ClinicalDecisionSupport initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ClinicalDecisionSupport: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Gets evidence-based recommendations for a given clinical scenario
   * @async
   * @param {Object} options - Recommendation options
   * @param {Object} options.patientData - Patient health data
   * @param {Array<Object>} options.conditions - Patient conditions
   * @param {Array<Object>} options.medications - Current medications
   * @param {string} [options.clinicalQuestion] - Specific clinical question
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Evidence-based recommendations
   */
  async getRecommendations(options) {
    try {
      logger.debug('Getting evidence-based recommendations');
      
      if (!options.patientData || !options.conditions) {
        throw new Error('Patient data and conditions are required for recommendations');
      }
      
      // Log the recommendation request
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GET_RECOMMENDATIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Requesting recommendations for ${options.conditions.length} conditions`
      });
      
      // Validate data access
      const accessValidation = await this.hipaaComplianceManager.validateDataAccess({
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        purpose: 'TREATMENT',
        action: 'ACCESS'
      });
      
      if (!accessValidation.granted) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }
      
      // Get the appropriate model for recommendations
      const model = await this.getModelForTask(
        'recommendations',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the patient data summary
      const patientSummary = this.preparePatientSummary(options.patientData);
      
      // Prepare the conditions and medications lists
      const conditionsList = options.conditions.map(c => c.display || c.code).join(', ');
      const medicationsList = options.medications ? options.medications.map(m => m.display || m.code).join(', ') : 'None';
      
      // Prepare the prompt for recommendations
      const prompt = `Provide evidence-based clinical recommendations for the following patient scenario:

Patient Summary: ${patientSummary}
Current Conditions: ${conditionsList}
Current Medications: ${medicationsList}
${options.clinicalQuestion ? `Clinical Question: ${options.clinicalQuestion}` : ''}

For each recommendation, provide:
1. The specific recommendation
2. The evidence level (I-VII)
3. The strength of recommendation (A-E)
4. A brief rationale
5. Key references supporting the recommendation

Important: Recommendations must be evidence-based, non-diagnostic, and focused on supporting clinical decision-making. Include appropriate disclaimers about consulting healthcare professionals.

Format the output as a JSON array of recommendation objects with the properties: recommendation, evidenceLevel, strength, rationale, references.

Clinical Recommendations (JSON format):`;
      
      // Execute the recommendation generation using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1 // Low temperature for factual, evidence-based responses
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 2048,
          temperature: 0.1
        });
      }
      
      // Parse the JSON response
      let recommendations;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, response];
        const jsonStr = jsonMatch[1].trim();
        recommendations = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.error(`Failed to parse recommendations response: ${parseError.message}`, parseError);
        recommendations = [];
      }
      
      // Validate each recommendation
      const validatedRecommendations = [];
      for (const recommendation of recommendations) {
        const isValid = await this.validateRecommendation(recommendation);
        if (isValid) {
          // Assign evidence level if not provided or invalid
          if (!this.evidenceLevels[recommendation.evidenceLevel]) {
            recommendation.evidenceLevel = await this.assignEvidenceLevel(recommendation);
          }
          
          // Assign recommendation strength if not provided or invalid
          if (!this.recommendationStrengths[recommendation.strength]) {
            recommendation.strength = this.assignRecommendationStrength(recommendation.evidenceLevel);
          }
          
          validatedRecommendations.push(recommendation);
        }
      }
      
      // Add disclaimer
      const disclaimer = "DISCLAIMER: These recommendations are intended to support clinical decision-making and are not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with questions regarding medical conditions.";
      
      // Log the successful recommendation generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GET_RECOMMENDATIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Successfully generated ${validatedRecommendations.length} recommendations using ${model.name}`
      });
      
      return {
        recommendations: validatedRecommendations,
        disclaimer: disclaimer,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed recommendation generation
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'GET_RECOMMENDATIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Failed to generate recommendations: ${error.message}`
      });
      
      logger.error(`Failed to get recommendations: ${error.message}`, error);
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }
  
  /**
   * Checks for potential medication interactions and contraindications
   * @async
   * @param {Object} options - Interaction check options
   * @param {Array<Object>} options.medications - List of medications to check
   * @param {Array<Object>} [options.conditions] - Patient conditions to check for contraindications
   * @param {Object} [options.patientData] - Additional patient data for context
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Medication interactions and contraindications
   */
  async checkMedicationInteractions(options) {
    try {
      logger.debug('Checking medication interactions');
      
      if (!options.medications || !Array.isArray(options.medications) || options.medications.length === 0) {
        throw new Error('Medications list is required for interaction checking');
      }
      
      // Log the interaction check request
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'CHECK_INTERACTIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Checking interactions for ${options.medications.length} medications`
      });
      
      // Get the appropriate model for interaction checking
      const model = await this.getModelForTask(
        'interactions',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the medications list
      const medicationsList = options.medications.map(m => m.display || m.code).join(', ');
      
      // Prepare the conditions list if provided
      const conditionsList = options.conditions ? options.conditions.map(c => c.display || c.code).join(', ') : 'None';
      
      // Prepare patient context if provided
      const patientContext = options.patientData ? this.preparePatientSummary(options.patientData) : 'No additional patient data provided';
      
      // Prepare the prompt for interaction checking
      const prompt = `Identify potential medication interactions and contraindications for the following scenario:

Medications: ${medicationsList}
Patient Conditions: ${conditionsList}
Patient Context: ${patientContext}

For each potential interaction or contraindication, provide:
1. The specific medications or medication-condition pair involved
2. The type of interaction (drug-drug, drug-condition, drug-food, etc.)
3. The severity (minor, moderate, major, contraindicated)
4. The mechanism of interaction
5. The potential clinical consequences
6. Recommended monitoring or management strategies

Format the output as a JSON array of interaction objects with the properties: medications, type, severity, mechanism, consequences, management.

Medication Interactions (JSON format):`;
      
      // Execute the interaction checking using the selected model
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
      
      // Parse the JSON response
      let interactions;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, response];
        const jsonStr = jsonMatch[1].trim();
        interactions = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.error(`Failed to parse interactions response: ${parseError.message}`, parseError);
        interactions = [];
      }
      
      // Validate and categorize interactions by severity
      const categorizedInteractions = {
        contraindicated: [],
        major: [],
        moderate: [],
        minor: []
      };
      
      for (const interaction of interactions) {
        // Validate the interaction (in a production system, this would check against a verified database)
        // For now, we'll assume all interactions from the model are valid
        
        // Categorize by severity
        const severity = interaction.severity.toLowerCase();
        if (severity.includes('contraindicated')) {
          categorizedInteractions.contraindicated.push(interaction);
        } else if (severity.includes('major')) {
          categorizedInteractions.major.push(interaction);
        } else if (severity.includes('moderate')) {
          categorizedInteractions.moderate.push(interaction);
        } else if (severity.includes('minor')) {
          categorizedInteractions.minor.push(interaction);
        } else {
          // Default to moderate if severity is unclear
          categorizedInteractions.moderate.push(interaction);
        }
      }
      
      // Add disclaimer
      const disclaimer = "DISCLAIMER: This interaction check is intended to support clinical decision-making and is not a substitute for professional medical judgment. Always consult appropriate drug information resources and healthcare providers before making medication decisions.";
      
      // Log the successful interaction check
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'CHECK_INTERACTIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Successfully identified ${interactions.length} potential interactions using ${model.name}`
      });
      
      return {
        interactions: categorizedInteractions,
        totalInteractions: interactions.length,
        disclaimer: disclaimer,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed interaction check
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'CHECK_INTERACTIONS',
        component: 'ClinicalDecisionSupport',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        patientId: options.complianceOptions?.patientId,
        details: `Failed to check medication interactions: ${error.message}`
      });
      
      logger.error(`Failed to check medication interactions: ${error.message}`, error);
      throw new Error(`Medication interaction check failed: ${error.message}`);
    }
  }
  
  /**
   * Summarizes medical literature and research findings
   * @async
   * @param {Object} options - Literature summarization options
   * @param {string} options.query - Research query or topic
   * @param {Array<string>} [options.articles] - List of article texts or abstracts to summarize
   * @param {string} [options.focusArea] - Specific focus area within the topic
   * @param {boolean} [options.includeReferences=true] - Whether to include references
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Summarized medical literature
   */
  async summarizeMedicalLiterature(options) {
    try {
      logger.debug(`Summarizing medical literature for query: ${options.query}`);
      
      if (!options.query) {
        throw new Error('Research query is required for literature summarization');
      }
      
      // Log the literature summarization request
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'SUMMARIZE_LITERATURE',
        component: 'ClinicalDecisionSupport',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        details: `Summarizing literature for query: ${options.query}`
      });
      
      // Get the appropriate model for literature summarization
      const model = await this.getModelForTask(
        'literature',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the articles content if provided
      let articlesContent = '';
      if (options.articles && Array.isArray(options.articles) && options.articles.length > 0) {
        articlesContent = `\n\nArticles to summarize:\n\n${options.articles.map((article, index) => `Article ${index + 1}:\n${article}`).join('\n\n')}`;
      }
      
      // Prepare the prompt for literature summarization
      const prompt = `Summarize the current medical literature and research findings on the following topic:

Research Query: ${options.query}
${options.focusArea ? `Focus Area: ${options.focusArea}` : ''}${articlesContent}

Provide a comprehensive summary that includes:
1. Key findings and consensus in the current literature
2. Areas of ongoing research and controversy
3. Clinical implications of the research
4. Strength of evidence for major conclusions
5. Gaps in current knowledge
${options.includeReferences !== false ? '6. Key references with citation information' : ''}

Format the output as a structured summary with clear sections for each of the above components.`;
      
      // Execute the literature summarization using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.2
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 3072,
          temperature: 0.2
        });
      }
      
      // Process the response to ensure it's well-structured
      const processedResponse = this.processLiteratureSummary(response);
      
      // Add disclaimer
      const disclaimer = "DISCLAIMER: This literature summary is generated based on available information and may not be comprehensive. It is intended to support clinical research and decision-making but should not replace a thorough literature review by qualified professionals.";
      
      // Log the successful literature summarization
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'SUMMARIZE_LITERATURE',
        component: 'ClinicalDecisionSupport',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        details: `Successfully summarized literature for query: ${options.query} using ${model.name}`
      });
      
      return {
        query: options.query,
        focusArea: options.focusArea,
        summary: processedResponse,
        disclaimer: disclaimer,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed literature summarization
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'SUMMARIZE_LITERATURE',
        component: 'ClinicalDecisionSupport',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        details: `Failed to summarize literature: ${error.message}`
      });
      
      logger.error(`Failed to summarize medical literature: ${error.message}`, error);
      throw new Error(`Literature summarization failed: ${error.message}`);
    }
  }
  
  /**
   * Retrieves relevant information for a clinical query
   * @async
   * @param {Object} options - Information retrieval options
   * @param {string} options.query - Clinical query
   * @param {string} [options.context] - Additional context for the query
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Retrieved information
   */
  async retrieveRelevantInformation(options) {
    try {
      logger.debug(`Retrieving information for query: ${options.query}`);
      
      if (!options.query) {
        throw new Error('Clinical query is required for information retrieval');
      }
      
      // Log the information retrieval request
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE_INFORMATION',
        component: 'ClinicalDecisionSupport',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        details: `Retrieving information for query: ${options.query}`
      });
      
      // Get the appropriate model for information retrieval
      const model = await this.getModelForTask(
        'informationRetrieval',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the prompt for information retrieval
      const prompt = `Retrieve and organize relevant clinical information for the following query:

Clinical Query: ${options.query}
${options.context ? `Context: ${options.context}` : ''}

Provide comprehensive information that includes:
1. Key definitions and concepts
2. Relevant clinical guidelines and standards of care
3. Diagnostic criteria and assessment tools
4. Treatment approaches and management strategies
5. Prognosis and outcomes
6. Special considerations and precautions

Format the output as a structured response with clear sections for each of the above components.`;
      
      // Execute the information retrieval using the selected model
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
      
      // Process the response to ensure it's well-structured
      const processedResponse = this.processRetrievedInformation(response);
      
      // Add disclaimer
      const disclaimer = "DISCLAIMER: This information is intended to support clinical decision-making and is not a substitute for professional medical judgment. Always consult appropriate clinical resources and healthcare providers.";
      
      // Log the successful information retrieval
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE_INFORMATION',
        component: 'ClinicalDecisionSupport',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        details: `Successfully retrieved information for query: ${options.query} using ${model.name}`
      });
      
      return {
        query: options.query,
        context: options.context,
        information: processedResponse,
        disclaimer: disclaimer,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed information retrieval
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'RETRIEVE_INFORMATION',
        component: 'ClinicalDecisionSupport',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        details: `Failed to retrieve information: ${error.message}`
      });
      
      logger.error(`Failed to retrieve relevant information: ${error.message}`, error);
      throw new Error(`Information retrieval failed: ${error.message}`);
    }
  }
  
  /**
   * Gets the appropriate model for a specific task
   * @async
   * @param {string} task - Task name (recommendations, interactions, literature, informationRetrieval)
   * @param {boolean} [forceOnline=false] - Whether to force using online API models
   * @param {boolean} [forceOffline=false] - Whether to force using offline embedded models
   * @returns {Promise<Object>} Selected model information
   */
  async getModelForTask(task, forceOnline = false, forceOffline = false) {
    try {
      if (!this.models[task]) {
        throw new Error(`Unknown task: ${task}`);
      }
      
      const taskModels = this.models[task];
      
      // If forcing online and offline simultaneously, throw an error
      if (forceOnline && forceOffline) {
        throw new Error('Cannot force both online and offline modes simultaneously');
      }
      
      // If forcing online, use the API model
      if (forceOnline) {
        return {
          name: taskModels.apiModel,
          type: 'api'
        };
      }
      
      // If forcing offline, use the embedded model
      if (forceOffline) {
        return {
          name: taskModels.embeddedModel,
          type: 'embedded'
        };
      }
      
      // Check if we're online and the API model is available
      const isOnline = await this.externalModelManager.isOnline();
      if (isOnline) {
        // Check if the API model is available
        const apiModelAvailable = await this.externalModelManager.isModelAvailable(taskModels.apiModel);
        if (apiModelAvailable) {
          return {
            name: taskModels.apiModel,
            type: 'api'
          };
        }
      }
      
      // Check if the embedded model is available
      const embeddedModelAvailable = await this.modelLoaderService.isModelAvailable(taskModels.embeddedModel);
      if (embeddedModelAvailable) {
        return {
          name: taskModels.embeddedModel,
          type: 'embedded'
        };
      }
      
      // Fall back to the fallback model
      return {
        name: taskModels.fallbackModel,
        type: 'embedded'
      };
    } catch (error) {
      logger.error(`Failed to get model for task ${task}: ${error.message}`, error);
      throw new Error(`Model selection failed: ${error.message}`);
    }
  }
  
  /**
   * Validates a clinical recommendation
   * @async
   * @param {Object} recommendation - Recommendation to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateRecommendation(recommendation) {
    try {
      // Check if the recommendation has all required fields
      if (!recommendation.recommendation || typeof recommendation.recommendation !== 'string') {
        return false;
      }
      
      // Check if the recommendation contains inappropriate content
      const inappropriatePatterns = [
        /diagnose/i,
        /prescribe/i,
        /I recommend/i,
        /you should/i
      ];
      
      for (const pattern of inappropriatePatterns) {
        if (pattern.test(recommendation.recommendation)) {
          return false;
        }
      }
      
      // In a production system, we would perform more thorough validation
      // against established clinical guidelines and evidence databases
      
      return true;
    } catch (error) {
      logger.error(`Failed to validate recommendation: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Assigns an evidence level to a recommendation
   * @async
   * @param {Object} recommendation - Recommendation to assign evidence level to
   * @returns {Promise<string>} Assigned evidence level
   */
  async assignEvidenceLevel(recommendation) {
    try {
      // In a production system, this would analyze the recommendation and references
      // to determine the appropriate evidence level based on established criteria
      
      // For now, we'll use a simple heuristic based on the recommendation text
      const text = recommendation.recommendation.toLowerCase();
      const rationale = (recommendation.rationale || '').toLowerCase();
      const references = (recommendation.references || []).join(' ').toLowerCase();
      
      if (references.includes('systematic review') || references.includes('meta-analysis') || 
          rationale.includes('systematic review') || rationale.includes('meta-analysis')) {
        return 'I';
      } else if (references.includes('randomized') || rationale.includes('randomized trial')) {
        return 'II';
      } else if (references.includes('controlled trial') || rationale.includes('controlled trial')) {
        return 'III';
      } else if (references.includes('cohort') || references.includes('case-control') || 
                rationale.includes('cohort') || rationale.includes('case-control')) {
        return 'IV';
      } else if (references.includes('qualitative') || rationale.includes('qualitative')) {
        return 'V';
      } else if (references.includes('case report') || rationale.includes('case report')) {
        return 'VI';
      } else {
        return 'VII';
      }
    } catch (error) {
      logger.error(`Failed to assign evidence level: ${error.message}`, error);
      return 'VII'; // Default to lowest evidence level if assignment fails
    }
  }
  
  /**
   * Assigns a recommendation strength based on evidence level
   * @param {string} evidenceLevel - Evidence level (I-VII)
   * @returns {string} Recommendation strength (A-E)
   */
  assignRecommendationStrength(evidenceLevel) {
    switch (evidenceLevel) {
      case 'I':
        return 'A';
      case 'II':
        return 'B';
      case 'III':
      case 'IV':
        return 'C';
      case 'V':
      case 'VI':
        return 'D';
      case 'VII':
      default:
        return 'E';
    }
  }
  
  /**
   * Prepares a patient summary from patient data
   * @param {Object} patientData - Patient data
   * @returns {string} Patient summary
   */
  preparePatientSummary(patientData) {
    try {
      // Extract relevant information from patient data
      const age = patientData.age || patientData.demographics?.age || 'Unknown';
      const gender = patientData.gender || patientData.demographics?.gender || 'Unknown';
      const relevantHistory = patientData.history || patientData.medicalHistory || 'None provided';
      
      // Create a concise summary
      return `${age}-year-old ${gender} with relevant history: ${relevantHistory}`;
    } catch (error) {
      logger.error(`Failed to prepare patient summary: ${error.message}`, error);
      return 'Patient summary unavailable';
    }
  }
  
  /**
   * Processes a literature summary to ensure it's well-structured
   * @param {string} summary - Raw literature summary
   * @returns {Object} Processed summary with structured sections
   */
  processLiteratureSummary(summary) {
    try {
      // Define the expected sections
      const sections = [
        'Key Findings',
        'Ongoing Research',
        'Clinical Implications',
        'Strength of Evidence',
        'Knowledge Gaps',
        'References'
      ];
      
      // Initialize the processed summary
      const processedSummary = {};
      
      // Extract each section from the summary
      let currentSection = 'overview';
      processedSummary[currentSection] = '';
      
      const lines = summary.split('\n');
      for (const line of lines) {
        // Check if this line is a section header
        let foundSection = false;
        for (const section of sections) {
          if (line.toLowerCase().includes(section.toLowerCase())) {
            currentSection = section.replace(/\s+/g, '').toLowerCase();
            processedSummary[currentSection] = '';
            foundSection = true;
            break;
          }
        }
        
        // If not a section header, add to current section
        if (!foundSection) {
          processedSummary[currentSection] += line + '\n';
        }
      }
      
      // Trim whitespace from each section
      for (const section in processedSummary) {
        processedSummary[section] = processedSummary[section].trim();
      }
      
      return processedSummary;
    } catch (error) {
      logger.error(`Failed to process literature summary: ${error.message}`, error);
      return { overview: summary };
    }
  }
  
  /**
   * Processes retrieved information to ensure it's well-structured
   * @param {string} information - Raw retrieved information
   * @returns {Object} Processed information with structured sections
   */
  processRetrievedInformation(information) {
    try {
      // Define the expected sections
      const sections = [
        'Definitions',
        'Guidelines',
        'Diagnostic Criteria',
        'Treatment',
        'Prognosis',
        'Special Considerations'
      ];
      
      // Initialize the processed information
      const processedInformation = {};
      
      // Extract each section from the information
      let currentSection = 'overview';
      processedInformation[currentSection] = '';
      
      const lines = information.split('\n');
      for (const line of lines) {
        // Check if this line is a section header
        let foundSection = false;
        for (const section of sections) {
          if (line.toLowerCase().includes(section.toLowerCase())) {
            currentSection = section.replace(/\s+/g, '').toLowerCase();
            processedInformation[currentSection] = '';
            foundSection = true;
            break;
          }
        }
        
        // If not a section header, add to current section
        if (!foundSection) {
          processedInformation[currentSection] += line + '\n';
        }
      }
      
      // Trim whitespace from each section
      for (const section in processedInformation) {
        processedInformation[section] = processedInformation[section].trim();
      }
      
      return processedInformation;
    } catch (error) {
      logger.error(`Failed to process retrieved information: ${error.message}`, error);
      return { overview: information };
    }
  }
  
  /**
   * Calculates the average confidence score for a set of relationships
   * @param {Array<Object>} relationships - Relationships with confidence scores
   * @returns {number} Average confidence score
   */
  calculateAverageConfidence(relationships) {
    if (!relationships || relationships.length === 0) {
      return 0;
    }
    
    const sum = relationships.reduce((total, rel) => total + (rel.confidence || 0), 0);
    return sum / relationships.length;
  }
}

module.exports = ClinicalDecisionSupport;
