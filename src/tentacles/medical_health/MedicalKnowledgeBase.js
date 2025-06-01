/**
 * @fileoverview MedicalKnowledgeBase provides access to medical terminology, conditions, treatments,
 * and medications with support for both online and offline operation modes.
 * 
 * @module tentacles/medical_health/MedicalKnowledgeBase
 * @requires core/ml/ModelLoaderService
 * @requires core/ml/external/ExternalModelManager
 * @requires core/utils/Logger
 * @requires tentacles/medical_health/HIPAAComplianceManager
 */

const ModelLoaderService = require('../../core/ml/ModelLoaderService');
const ExternalModelManager = require('../../core/ml/external/ExternalModelManager');
const Logger = require('../../core/utils/Logger');
const HIPAAComplianceManager = require('./HIPAAComplianceManager');

const logger = Logger.getLogger('MedicalKnowledgeBase');

/**
 * @class MedicalKnowledgeBase
 * @description Provides access to medical knowledge with both online and offline capabilities
 */
class MedicalKnowledgeBase {
  /**
   * Creates an instance of MedicalKnowledgeBase
   * @param {Object} options - Configuration options
   * @param {ModelLoaderService} options.modelLoaderService - Service for loading embedded models
   * @param {ExternalModelManager} options.externalModelManager - Manager for external API models
   * @param {HIPAAComplianceManager} options.hipaaComplianceManager - Manager for HIPAA compliance
   */
  constructor(options = {}) {
    this.modelLoaderService = options.modelLoaderService || new ModelLoaderService();
    this.externalModelManager = options.externalModelManager || new ExternalModelManager();
    this.hipaaComplianceManager = options.hipaaComplianceManager || new HIPAAComplianceManager();
    
    // Knowledge domains and their corresponding models
    this.knowledgeDomains = {
      medicalTerminology: {
        embeddedModel: 'DeepSeek-V3',
        apiModel: 'Claude-3-Opus',
        fallbackModel: 'Llama-3-70B'
      },
      conditions: {
        embeddedModel: 'Llama-3-70B',
        apiModel: 'Claude-3-Opus',
        fallbackModel: 'Mixtral-8x22B'
      },
      treatments: {
        embeddedModel: 'DeepSeek-V3',
        apiModel: 'Gemini-Ultra',
        fallbackModel: 'Llama-3-70B'
      },
      medications: {
        embeddedModel: 'Llama-3-70B',
        apiModel: 'Claude-3-Opus',
        fallbackModel: 'Mixtral-8x22B'
      },
      medicalEntities: {
        embeddedModel: 'RoBERTa-XL',
        apiModel: 'Cohere-Command-R-Plus',
        fallbackModel: 'OpenHermes-3.0'
      }
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.queryKnowledge = this.queryKnowledge.bind(this);
    this.extractMedicalEntities = this.extractMedicalEntities.bind(this);
    this.identifyRelationships = this.identifyRelationships.bind(this);
    this.validateMedicalConcept = this.validateMedicalConcept.bind(this);
    this.getModelForDomain = this.getModelForDomain.bind(this);
  }
  
  /**
   * Initializes the MedicalKnowledgeBase
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      logger.info('Initializing MedicalKnowledgeBase');
      
      // Initialize HIPAA compliance manager
      await this.hipaaComplianceManager.initialize();
      
      // Pre-load high-priority embedded models
      await this.modelLoaderService.preloadModel('DeepSeek-V3');
      
      logger.info('MedicalKnowledgeBase initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize MedicalKnowledgeBase: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Queries the medical knowledge base for information
   * @async
   * @param {Object} options - Query options
   * @param {string} options.query - The medical query
   * @param {string} options.domain - Knowledge domain (medicalTerminology, conditions, treatments, medications)
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Query results
   */
  async queryKnowledge(options) {
    try {
      logger.debug(`Querying medical knowledge: ${options.query}`);
      
      if (!options.query || !options.domain) {
        throw new Error('Query and domain are required');
      }
      
      if (!this.knowledgeDomains[options.domain]) {
        throw new Error(`Unknown knowledge domain: ${options.domain}`);
      }
      
      // Log the knowledge query attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'QUERY',
        component: 'MedicalKnowledgeBase',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        details: `Querying ${options.domain} knowledge: ${options.query.substring(0, 50)}...`
      });
      
      // Get the appropriate model for this domain
      const model = await this.getModelForDomain(
        options.domain,
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the prompt with domain-specific context
      const domainContext = this.getDomainContext(options.domain);
      const prompt = `${domainContext}\n\nQuery: ${options.query}\n\nProvide a comprehensive, accurate, and evidence-based response:`;
      
      // Execute the query using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1, // Low temperature for factual responses
          topP: 0.95
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1,
          topP: 0.95
        });
      }
      
      // Sanitize the response to ensure no PHI is included
      const sanitizedResponse = this.hipaaComplianceManager.sanitizeOutput(response);
      
      // Log the successful query
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'QUERY',
        component: 'MedicalKnowledgeBase',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        details: `Successfully queried ${options.domain} knowledge using ${model.name}`
      });
      
      return {
        query: options.query,
        domain: options.domain,
        response: sanitizedResponse,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed query
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'QUERY',
        component: 'MedicalKnowledgeBase',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        details: `Failed to query ${options.domain} knowledge: ${error.message}`
      });
      
      logger.error(`Failed to query medical knowledge: ${error.message}`, error);
      throw new Error(`Medical knowledge query failed: ${error.message}`);
    }
  }
  
  /**
   * Extracts medical entities from text
   * @async
   * @param {Object} options - Extraction options
   * @param {string} options.text - Text to extract entities from
   * @param {Array<string>} [options.entityTypes] - Types of entities to extract (e.g., 'condition', 'medication', 'procedure')
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Extracted entities
   */
  async extractMedicalEntities(options) {
    try {
      logger.debug('Extracting medical entities from text');
      
      if (!options.text) {
        throw new Error('Text is required for entity extraction');
      }
      
      // Log the entity extraction attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXTRACT_ENTITIES',
        component: 'MedicalKnowledgeBase',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        details: `Extracting medical entities from text (${options.text.length} chars)`
      });
      
      // Get the appropriate model for entity extraction
      const model = await this.getModelForDomain(
        'medicalEntities',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the prompt for entity extraction
      const entityTypes = options.entityTypes || ['condition', 'medication', 'procedure', 'anatomy', 'test', 'device'];
      const entityTypesStr = entityTypes.join(', ');
      
      const prompt = `Extract all medical entities of the following types from the text: ${entityTypesStr}.
      
For each entity found, provide:
1. The entity text as it appears in the document
2. The entity type
3. The start and end character positions in the text
4. A normalized form of the entity (standard medical terminology)

Format the output as a JSON array of objects with the properties: text, type, start, end, normalized.

Text: ${options.text}

Medical Entities (JSON format):`;
      
      // Execute the entity extraction using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1
        });
      }
      
      // Parse the JSON response
      let entities;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, response];
        const jsonStr = jsonMatch[1].trim();
        entities = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.error(`Failed to parse entity extraction response: ${parseError.message}`, parseError);
        entities = [];
      }
      
      // Validate each entity against the knowledge base
      const validatedEntities = [];
      for (const entity of entities) {
        const isValid = await this.validateMedicalConcept(entity.normalized, entity.type);
        if (isValid) {
          validatedEntities.push(entity);
        }
      }
      
      // Log the successful entity extraction
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXTRACT_ENTITIES',
        component: 'MedicalKnowledgeBase',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        details: `Successfully extracted ${validatedEntities.length} medical entities using ${model.name}`
      });
      
      return {
        text: options.text,
        entities: validatedEntities,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed entity extraction
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'EXTRACT_ENTITIES',
        component: 'MedicalKnowledgeBase',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        details: `Failed to extract medical entities: ${error.message}`
      });
      
      logger.error(`Failed to extract medical entities: ${error.message}`, error);
      throw new Error(`Medical entity extraction failed: ${error.message}`);
    }
  }
  
  /**
   * Identifies relationships between medical entities
   * @async
   * @param {Object} options - Relationship identification options
   * @param {string} options.text - Text containing the entities
   * @param {Array<Object>} options.entities - Entities to identify relationships between
   * @param {boolean} [options.forceOnline=false] - Whether to force using online API models
   * @param {boolean} [options.forceOffline=false] - Whether to force using offline embedded models
   * @param {Object} [options.complianceOptions] - HIPAA compliance options
   * @returns {Promise<Object>} Identified relationships
   */
  async identifyRelationships(options) {
    try {
      logger.debug('Identifying relationships between medical entities');
      
      if (!options.text || !options.entities || !Array.isArray(options.entities)) {
        throw new Error('Text and entities array are required for relationship identification');
      }
      
      // Log the relationship identification attempt
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'IDENTIFY_RELATIONSHIPS',
        component: 'MedicalKnowledgeBase',
        outcome: 'ATTEMPT',
        userId: options.complianceOptions?.userId,
        details: `Identifying relationships between ${options.entities.length} medical entities`
      });
      
      // Get the appropriate model for relationship identification
      const model = await this.getModelForDomain(
        'medicalEntities',
        options.forceOnline,
        options.forceOffline
      );
      
      // Prepare the prompt for relationship identification
      const entitiesJson = JSON.stringify(options.entities, null, 2);
      
      const prompt = `Identify the relationships between the medical entities in the following text. Consider relationships such as:
- treats (medication treats condition)
- diagnoses (test diagnoses condition)
- prevents (medication prevents condition)
- causes (condition causes symptom)
- contraindicates (condition contraindicates medication)
- requires (condition requires procedure)
- monitors (test monitors condition)

Text: ${options.text}

Entities: ${entitiesJson}

For each relationship found, provide:
1. The source entity index (from the entities array)
2. The target entity index (from the entities array)
3. The relationship type
4. The confidence score (0.0 to 1.0)

Format the output as a JSON array of objects with the properties: source, target, relationship, confidence.

Relationships (JSON format):`;
      
      // Execute the relationship identification using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 1024,
          temperature: 0.1
        });
      }
      
      // Parse the JSON response
      let relationships;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, response];
        const jsonStr = jsonMatch[1].trim();
        relationships = JSON.parse(jsonStr);
      } catch (parseError) {
        logger.error(`Failed to parse relationship identification response: ${parseError.message}`, parseError);
        relationships = [];
      }
      
      // Filter relationships by confidence threshold
      const confidenceThreshold = 0.7;
      const highConfidenceRelationships = relationships.filter(rel => rel.confidence >= confidenceThreshold);
      
      // Log the successful relationship identification
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'IDENTIFY_RELATIONSHIPS',
        component: 'MedicalKnowledgeBase',
        outcome: 'SUCCESS',
        userId: options.complianceOptions?.userId,
        details: `Successfully identified ${highConfidenceRelationships.length} relationships using ${model.name}`
      });
      
      return {
        text: options.text,
        entities: options.entities,
        relationships: highConfidenceRelationships,
        modelUsed: model.name,
        modelType: model.type,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log the failed relationship identification
      this.hipaaComplianceManager.logAuditEvent({
        eventType: 'ACCESS',
        action: 'IDENTIFY_RELATIONSHIPS',
        component: 'MedicalKnowledgeBase',
        outcome: 'FAILURE',
        userId: options.complianceOptions?.userId,
        details: `Failed to identify relationships: ${error.message}`
      });
      
      logger.error(`Failed to identify relationships: ${error.message}`, error);
      throw new Error(`Medical relationship identification failed: ${error.message}`);
    }
  }
  
  /**
   * Validates a medical concept against the knowledge base
   * @async
   * @param {string} concept - The medical concept to validate
   * @param {string} type - The type of concept (condition, medication, procedure, etc.)
   * @returns {Promise<boolean>} Whether the concept is valid
   */
  async validateMedicalConcept(concept, type) {
    try {
      logger.debug(`Validating medical concept: ${concept} (${type})`);
      
      // Map concept types to knowledge domains
      const domainMap = {
        'condition': 'conditions',
        'medication': 'medications',
        'procedure': 'treatments',
        'anatomy': 'medicalTerminology',
        'test': 'treatments',
        'device': 'treatments'
      };
      
      const domain = domainMap[type.toLowerCase()] || 'medicalTerminology';
      
      // Get the appropriate model for this domain
      const model = await this.getModelForDomain(domain, false, true); // Prefer offline for validation
      
      // Prepare the prompt for concept validation
      const prompt = `Validate whether the following is a legitimate medical ${type}:
      
${concept}

Respond with only "VALID" or "INVALID" based on whether this is a recognized medical ${type} in standard medical terminology.`;
      
      // Execute the validation using the selected model
      let response;
      if (model.type === 'embedded') {
        response = await this.modelLoaderService.generateText(model.name, prompt, {
          maxTokens: 10,
          temperature: 0.1
        });
      } else {
        response = await this.externalModelManager.generateText(model.name, prompt, {
          maxTokens: 10,
          temperature: 0.1
        });
      }
      
      // Check if the response indicates the concept is valid
      const isValid = response.trim().toUpperCase().includes('VALID');
      
      return isValid;
    } catch (error) {
      logger.error(`Failed to validate medical concept: ${error.message}`, error);
      // Default to true in case of validation error to avoid losing potentially valid entities
      return true;
    }
  }
  
  /**
   * Gets the appropriate model for a knowledge domain
   * @async
   * @param {string} domain - The knowledge domain
   * @param {boolean} [forceOnline=false] - Whether to force using online API models
   * @param {boolean} [forceOffline=false] - Whether to force using offline embedded models
   * @returns {Promise<Object>} The selected model information
   */
  async getModelForDomain(domain, forceOnline = false, forceOffline = false) {
    try {
      const domainConfig = this.knowledgeDomains[domain];
      if (!domainConfig) {
        throw new Error(`Unknown knowledge domain: ${domain}`);
      }
      
      // Check if we should force online or offline mode
      if (forceOnline && forceOffline) {
        throw new Error('Cannot force both online and offline modes simultaneously');
      }
      
      // Check online connectivity
      const isOnline = forceOffline ? false : await this.externalModelManager.checkConnectivity();
      
      // Select the appropriate model based on connectivity and force flags
      let modelName;
      let modelType;
      
      if (forceOffline || !isOnline) {
        // Use embedded model in offline mode
        modelName = domainConfig.embeddedModel;
        modelType = 'embedded';
        
        // Check if the embedded model is available
        const isAvailable = await this.modelLoaderService.isModelAvailable(modelName);
        if (!isAvailable) {
          // Fall back to the fallback model
          modelName = domainConfig.fallbackModel;
          logger.info(`Primary embedded model not available, falling back to ${modelName}`);
        }
      } else if (forceOnline || isOnline) {
        // Use API model in online mode
        modelName = domainConfig.apiModel;
        modelType = 'api';
        
        // Check if the API model is available
        const isAvailable = await this.externalModelManager.isModelAvailable(modelName);
        if (!isAvailable) {
          // Fall back to the embedded model
          modelName = domainConfig.embeddedModel;
          modelType = 'embedded';
          logger.info(`API model not available, falling back to ${modelName}`);
        }
      }
      
      return {
        name: modelName,
        type: modelType,
        domain: domain
      };
    } catch (error) {
      logger.error(`Failed to get model for domain: ${error.message}`, error);
      
      // Default to the fallback model in case of error
      return {
        name: this.knowledgeDomains[domain].fallbackModel,
        type: 'embedded',
        domain: domain
      };
    }
  }
  
  /**
   * Gets the context for a specific knowledge domain
   * @param {string} domain - The knowledge domain
   * @returns {string} Domain-specific context
   */
  getDomainContext(domain) {
    const contexts = {
      medicalTerminology: `You are a medical terminology expert. Provide accurate definitions, explanations, and context for medical terms, anatomical structures, and healthcare concepts. Base your responses on established medical literature and terminology standards.`,
      
      conditions: `You are a medical conditions expert. Provide accurate information about diseases, disorders, and health conditions including symptoms, causes, risk factors, diagnostic criteria, and epidemiology. Base your responses on current medical understanding and evidence-based medicine.`,
      
      treatments: `You are a medical treatments expert. Provide accurate information about medical procedures, therapies, interventions, and treatment approaches. Include information about efficacy, risks, benefits, and standard protocols. Base your responses on evidence-based medicine and clinical guidelines.`,
      
      medications: `You are a medications expert. Provide accurate information about pharmaceutical products, including mechanisms of action, indications, contraindications, dosing, side effects, and drug interactions. Base your responses on pharmacological principles and current medication guidelines.`,
      
      medicalEntities: `You are a medical entity recognition expert. Identify and categorize medical terms, concepts, and relationships in text with high precision. Base your analysis on established medical terminology and classification systems.`
    };
    
    return contexts[domain] || `You are a medical knowledge expert. Provide accurate, evidence-based information about healthcare topics.`;
  }
}

module.exports = MedicalKnowledgeBase;
