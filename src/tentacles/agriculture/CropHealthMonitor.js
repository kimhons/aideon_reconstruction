/**
 * @fileoverview Crop Health Monitor for the Agriculture Tentacle.
 * This component provides comprehensive monitoring and analysis of crop health conditions
 * through various data sources including images, sensors, and manual observations.
 * Enhanced with specific support for indoor and urban farming environments.
 * 
 * @module tentacles/agriculture/CropHealthMonitor
 * @requires core/utils/Logger
 */

const Logger = require('../../core/utils/Logger');
const { HSTIS, MCMS, TRDS, SGF, MIIF } = require('../../core/integration');

/**
 * Class representing the Crop Health Monitor
 */
class CropHealthMonitor {
  /**
   * Create a Crop Health Monitor
   * @param {Object} options - Configuration options
   * @param {Object} options.agricultureKnowledgeManager - Reference to Agriculture Knowledge Manager
   * @param {Object} options.fileSystemTentacle - Reference to File System Tentacle for data storage
   * @param {Object} options.webTentacle - Reference to Web Tentacle for online data access
   */
  constructor(options = {}) {
    this.logger = new Logger('CropHealthMonitor');
    this.logger.info('Initializing Crop Health Monitor');
    
    this.agricultureKnowledgeManager = options.agricultureKnowledgeManager;
    this.fileSystemTentacle = options.fileSystemTentacle;
    this.webTentacle = options.webTentacle;
    
    this.diseaseIdentificationSystem = this._initializeDiseaseIdentificationSystem();
    this.nutrientDeficiencyAnalyzer = this._initializeNutrientDeficiencyAnalyzer();
    this.pestDetectionSystem = this._initializePestDetectionSystem();
    this.stressDetectionSystem = this._initializeStressDetectionSystem();
    this.growthStageMonitor = this._initializeGrowthStageMonitor();
    this.indoorHealthMonitor = this._initializeIndoorHealthMonitor();
    this.urbanFarmingHealthAdvisor = this._initializeUrbanFarmingHealthAdvisor();
    
    this.offlineCache = {
      observations: new Map(),
      analyses: new Map(),
      treatments: new Map(),
      indoorObservations: new Map()
    };
    
    this.logger.info('Crop Health Monitor initialized successfully');
  }
  
  /**
   * Initialize the disease identification system
   * @private
   * @returns {Object} The disease identification system
   */
  _initializeDiseaseIdentificationSystem() {
    this.logger.debug('Initializing disease identification system');
    
    return {
      /**
       * Identify diseases from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Array>} List of potential disease matches with confidence scores
       */
      identifyDiseases: async (image, cropId) => {
        this.logger.debug(`Identifying diseases for crop ${cropId} from image`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to select appropriate model for disease identification
          const modelResult = await MIIF.executeModel({
            task: 'image_classification',
            domain: 'agriculture',
            subtype: 'plant_disease_identification',
            input: { 
              image,
              context: { crop: cropId }
            }
          });
          
          if (!modelResult || !modelResult.predictions) {
            this.logger.warn('No predictions returned from disease identification model');
            return [];
          }
          
          // Enrich results with knowledge base information if available
          let enrichedResults = modelResult.predictions;
          
          if (this.agricultureKnowledgeManager) {
            enrichedResults = await Promise.all(
              modelResult.predictions.map(async prediction => {
                const diseaseInfo = await this.agricultureKnowledgeManager.getEntity(prediction.entityId);
                return {
                  ...prediction,
                  diseaseInfo: diseaseInfo || {}
                };
              })
            );
          }
          
          return enrichedResults;
        } catch (error) {
          this.logger.error(`Error identifying diseases from image: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Record a disease observation
       * @param {String} fieldId - Field identifier
       * @param {Object} observationData - Observation data
       * @returns {Promise<Object>} Recorded observation
       */
      recordObservation: async (fieldId, observationData) => {
        this.logger.debug(`Recording disease observation for field: ${fieldId}`);
        
        try {
          // Validate observation data
          if (!observationData.diseaseId) {
            throw new Error('Disease identifier is required');
          }
          
          // Generate unique ID if not provided
          const observationId = observationData.id || `observation-${Date.now()}`;
          
          // Create observation object
          const observation = {
            id: observationId,
            field: fieldId,
            crop: observationData.cropId,
            disease: observationData.diseaseId,
            location: observationData.location || {},
            severity: observationData.severity || 'low',
            affectedArea: observationData.affectedArea || { value: 0, unit: 'percent' },
            images: observationData.images || [],
            notes: observationData.notes || '',
            timestamp: observationData.timestamp || Date.now(),
            recordedBy: observationData.recordedBy || 'system'
          };
          
          // Store observation data
          if (this.fileSystemTentacle) {
            await this.fileSystemTentacle.writeFile({
              path: `agriculture/observations/${observationId}.json`,
              content: JSON.stringify(observation, null, 2)
            });
          }
          
          // Update cache
          this.offlineCache.observations.set(observationId, observation);
          
          return observation;
        } catch (error) {
          this.logger.error(`Error recording disease observation: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get treatment recommendations for a disease
       * @param {String} diseaseId - Disease identifier
       * @param {String} cropId - Crop identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended treatments
       */
      getTreatmentRecommendations: async (diseaseId, cropId, context = {}) => {
        this.logger.debug(`Getting treatment recommendations for disease ${diseaseId} on crop ${cropId}`);
        
        try {
          // Get disease and crop information if agriculture knowledge manager is available
          let disease = null;
          let crop = null;
          
          if (this.agricultureKnowledgeManager) {
            disease = await this.agricultureKnowledgeManager.getEntity(diseaseId);
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to get treatment recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'disease_treatment',
            input: { 
              disease: disease || { id: diseaseId },
              crop: crop || { id: cropId },
              context
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from treatment recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting treatment recommendations: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Record a treatment application
       * @param {String} observationId - Observation identifier
       * @param {Object} treatmentData - Treatment application data
       * @returns {Promise<Object>} Recorded treatment
       */
      recordTreatment: async (observationId, treatmentData) => {
        this.logger.debug(`Recording treatment for observation: ${observationId}`);
        
        try {
          // Get observation data
          let observation = null;
          
          if (this.offlineCache.observations.has(observationId)) {
            observation = this.offlineCache.observations.get(observationId);
          } else if (this.fileSystemTentacle) {
            try {
              const observationData = await this.fileSystemTentacle.readFile({
                path: `agriculture/observations/${observationId}.json`
              });
              
              if (observationData) {
                observation = JSON.parse(observationData);
                this.offlineCache.observations.set(observationId, observation);
              }
            } catch (fsError) {
              this.logger.debug(`Observation not found in file system: ${observationId}`);
            }
          }
          
          if (!observation) {
            throw new Error(`Observation not found: ${observationId}`);
          }
          
          // Generate unique ID if not provided
          const treatmentId = treatmentData.id || `treatment-${Date.now()}`;
          
          // Create treatment object
          const treatment = {
            id: treatmentId,
            observation: observationId,
            field: observation.field,
            crop: observation.crop,
            disease: observation.disease,
            type: treatmentData.type || 'chemical',
            product: treatmentData.product,
            rate: treatmentData.rate,
            method: treatmentData.method || 'spray',
            area: treatmentData.area || { value: 0, unit: 'hectares' },
            timestamp: treatmentData.timestamp || Date.now(),
            appliedBy: treatmentData.appliedBy || 'system',
            notes: treatmentData.notes || '',
            followUp: treatmentData.followUp || { required: false }
          };
          
          // Store treatment data
          if (this.fileSystemTentacle) {
            await this.fileSystemTentacle.writeFile({
              path: `agriculture/treatments/${treatmentId}.json`,
              content: JSON.stringify(treatment, null, 2)
            });
          }
          
          // Update cache
          this.offlineCache.treatments.set(treatmentId, treatment);
          
          return treatment;
        } catch (error) {
          this.logger.error(`Error recording treatment: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the nutrient deficiency analyzer
   * @private
   * @returns {Object} The nutrient deficiency analyzer
   */
  _initializeNutrientDeficiencyAnalyzer() {
    this.logger.debug('Initializing nutrient deficiency analyzer');
    
    return {
      /**
       * Analyze nutrient deficiencies from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Array>} List of potential nutrient deficiencies with confidence scores
       */
      analyzeDeficiencies: async (image, cropId) => {
        this.logger.debug(`Analyzing nutrient deficiencies for crop ${cropId} from image`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to select appropriate model for nutrient deficiency analysis
          const modelResult = await MIIF.executeModel({
            task: 'image_classification',
            domain: 'agriculture',
            subtype: 'nutrient_deficiency',
            input: { 
              image,
              context: { crop: cropId }
            }
          });
          
          if (!modelResult || !modelResult.predictions) {
            this.logger.warn('No predictions returned from nutrient deficiency model');
            return [];
          }
          
          // Enrich results with knowledge base information if available
          let enrichedResults = modelResult.predictions;
          
          if (this.agricultureKnowledgeManager) {
            enrichedResults = await Promise.all(
              modelResult.predictions.map(async prediction => {
                const nutrientInfo = await this.agricultureKnowledgeManager.getEntity(prediction.entityId);
                return {
                  ...prediction,
                  nutrientInfo: nutrientInfo || {}
                };
              })
            );
          }
          
          return enrichedResults;
        } catch (error) {
          this.logger.error(`Error analyzing nutrient deficiencies from image: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get soil test interpretation
       * @param {Object} soilTestData - Soil test data
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Object>} Soil test interpretation
       */
      interpretSoilTest: async (soilTestData, cropId) => {
        this.logger.debug(`Interpreting soil test for crop ${cropId}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to interpret soil test
          const modelResult = await MIIF.executeModel({
            task: 'analysis',
            domain: 'agriculture',
            subtype: 'soil_test_interpretation',
            input: { 
              soilTest: soilTestData,
              crop: crop || { id: cropId }
            }
          });
          
          if (!modelResult || !modelResult.interpretation) {
            this.logger.warn('No interpretation returned from soil test interpretation model');
            return null;
          }
          
          return modelResult.interpretation;
        } catch (error) {
          this.logger.error(`Error interpreting soil test: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Generate nutrient recommendations
       * @param {Object} soilTestData - Soil test data
       * @param {String} cropId - Crop identifier
       * @param {Object} yieldGoal - Yield goal
       * @returns {Promise<Object>} Nutrient recommendations
       */
      generateNutrientRecommendations: async (soilTestData, cropId, yieldGoal) => {
        this.logger.debug(`Generating nutrient recommendations for crop ${cropId}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to generate nutrient recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'nutrient_management',
            input: { 
              soilTest: soilTestData,
              crop: crop || { id: cropId },
              yieldGoal
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from nutrient recommendation model');
            return null;
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error generating nutrient recommendations: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the pest detection system
   * @private
   * @returns {Object} The pest detection system
   */
  _initializePestDetectionSystem() {
    this.logger.debug('Initializing pest detection system');
    
    return {
      /**
       * Identify pests from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Array>} List of potential pest matches with confidence scores
       */
      identifyPests: async (image, cropId) => {
        this.logger.debug(`Identifying pests for crop ${cropId} from image`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to select appropriate model for pest identification
          const modelResult = await MIIF.executeModel({
            task: 'image_classification',
            domain: 'agriculture',
            subtype: 'pest_identification',
            input: { 
              image,
              context: { crop: cropId }
            }
          });
          
          if (!modelResult || !modelResult.predictions) {
            this.logger.warn('No predictions returned from pest identification model');
            return [];
          }
          
          // Enrich results with knowledge base information if available
          let enrichedResults = modelResult.predictions;
          
          if (this.agricultureKnowledgeManager) {
            enrichedResults = await Promise.all(
              modelResult.predictions.map(async prediction => {
                const pestInfo = await this.agricultureKnowledgeManager.getEntity(prediction.entityId);
                return {
                  ...prediction,
                  pestInfo: pestInfo || {}
                };
              })
            );
          }
          
          return enrichedResults;
        } catch (error) {
          this.logger.error(`Error identifying pests from image: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Record a pest observation
       * @param {String} fieldId - Field identifier
       * @param {Object} observationData - Observation data
       * @returns {Promise<Object>} Recorded observation
       */
      recordObservation: async (fieldId, observationData) => {
        this.logger.debug(`Recording pest observation for field: ${fieldId}`);
        
        try {
          // Validate observation data
          if (!observationData.pestId) {
            throw new Error('Pest identifier is required');
          }
          
          // Generate unique ID if not provided
          const observationId = observationData.id || `pest-observation-${Date.now()}`;
          
          // Create observation object
          const observation = {
            id: observationId,
            field: fieldId,
            crop: observationData.cropId,
            pest: observationData.pestId,
            location: observationData.location || {},
            severity: observationData.severity || 'low',
            population: observationData.population || { value: 0, unit: 'per_plant' },
            images: observationData.images || [],
            notes: observationData.notes || '',
            timestamp: observationData.timestamp || Date.now(),
            recordedBy: observationData.recordedBy || 'system'
          };
          
          // Store observation data
          if (this.fileSystemTentacle) {
            await this.fileSystemTentacle.writeFile({
              path: `agriculture/observations/${observationId}.json`,
              content: JSON.stringify(observation, null, 2)
            });
          }
          
          // Update cache
          this.offlineCache.observations.set(observationId, observation);
          
          return observation;
        } catch (error) {
          this.logger.error(`Error recording pest observation: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get pest control recommendations
       * @param {String} pestId - Pest identifier
       * @param {String} cropId - Crop identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended pest control methods
       */
      getControlRecommendations: async (pestId, cropId, context = {}) => {
        this.logger.debug(`Getting control recommendations for pest ${pestId} on crop ${cropId}`);
        
        try {
          // Get pest and crop information if agriculture knowledge manager is available
          let pest = null;
          let crop = null;
          
          if (this.agricultureKnowledgeManager) {
            pest = await this.agricultureKnowledgeManager.getEntity(pestId);
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to get pest control recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'pest_control',
            input: { 
              pest: pest || { id: pestId },
              crop: crop || { id: cropId },
              context
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from pest control recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting pest control recommendations: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Generate an integrated pest management (IPM) plan
       * @param {String} fieldId - Field identifier
       * @param {Array} cropIds - Crop identifiers
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Object>} IPM plan
       */
      generateIPMPlan: async (fieldId, cropIds, context = {}) => {
        this.logger.debug(`Generating IPM plan for field ${fieldId}`);
        
        try {
          // Get crop information if agriculture knowledge manager is available
          let crops = [];
          
          if (this.agricultureKnowledgeManager && Array.isArray(cropIds)) {
            const cropPromises = cropIds.map(cropId => 
              this.agricultureKnowledgeManager.getEntity(cropId)
            );
            
            crops = await Promise.all(cropPromises);
          }
          
          // Use MIIF to generate IPM plan
          const modelResult = await MIIF.executeModel({
            task: 'planning',
            domain: 'agriculture',
            subtype: 'ipm',
            input: { 
              field: { id: fieldId },
              crops: crops.length > 0 ? crops : cropIds.map(id => ({ id })),
              context
            }
          });
          
          if (!modelResult || !modelResult.plan) {
            this.logger.warn('No IPM plan returned from IPM planning model');
            return null;
          }
          
          return modelResult.plan;
        } catch (error) {
          this.logger.error(`Error generating IPM plan: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the stress detection system
   * @private
   * @returns {Object} The stress detection system
   */
  _initializeStressDetectionSystem() {
    this.logger.debug('Initializing stress detection system');
    
    return {
      /**
       * Detect environmental stress from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Array>} List of potential stress factors with confidence scores
       */
      detectStress: async (image, cropId) => {
        this.logger.debug(`Detecting stress for crop ${cropId} from image`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to select appropriate model for stress detection
          const modelResult = await MIIF.executeModel({
            task: 'image_classification',
            domain: 'agriculture',
            subtype: 'stress_detection',
            input: { 
              image,
              context: { crop: cropId }
            }
          });
          
          if (!modelResult || !modelResult.predictions) {
            this.logger.warn('No predictions returned from stress detection model');
            return [];
          }
          
          // Enrich results with knowledge base information if available
          let enrichedResults = modelResult.predictions;
          
          if (this.agricultureKnowledgeManager) {
            enrichedResults = await Promise.all(
              modelResult.predictions.map(async prediction => {
                const stressInfo = await this.agricultureKnowledgeManager.getEntity(prediction.entityId);
                return {
                  ...prediction,
                  stressInfo: stressInfo || {}
                };
              })
            );
          }
          
          return enrichedResults;
        } catch (error) {
          this.logger.error(`Error detecting stress from image: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Analyze environmental data for stress factors
       * @param {String} fieldId - Field identifier
       * @param {String} cropId - Crop identifier
       * @param {Object} environmentalData - Environmental data
       * @returns {Promise<Object>} Stress analysis
       */
      analyzeEnvironmentalStress: async (fieldId, cropId, environmentalData) => {
        this.logger.debug(`Analyzing environmental stress for crop ${cropId} in field ${fieldId}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to analyze environmental stress
          const modelResult = await MIIF.executeModel({
            task: 'analysis',
            domain: 'agriculture',
            subtype: 'environmental_stress',
            input: { 
              field: { id: fieldId },
              crop: crop || { id: cropId },
              environmentalData
            }
          });
          
          if (!modelResult || !modelResult.analysis) {
            this.logger.warn('No analysis returned from environmental stress model');
            return null;
          }
          
          return modelResult.analysis;
        } catch (error) {
          this.logger.error(`Error analyzing environmental stress: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get stress mitigation recommendations
       * @param {String} stressId - Stress factor identifier
       * @param {String} cropId - Crop identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended mitigation strategies
       */
      getMitigationRecommendations: async (stressId, cropId, context = {}) => {
        this.logger.debug(`Getting mitigation recommendations for stress ${stressId} on crop ${cropId}`);
        
        try {
          // Get stress and crop information if agriculture knowledge manager is available
          let stress = null;
          let crop = null;
          
          if (this.agricultureKnowledgeManager) {
            stress = await this.agricultureKnowledgeManager.getEntity(stressId);
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to get stress mitigation recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'stress_mitigation',
            input: { 
              stress: stress || { id: stressId },
              crop: crop || { id: cropId },
              context
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from stress mitigation recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting stress mitigation recommendations: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the growth stage monitor
   * @private
   * @returns {Object} The growth stage monitor
   */
  _initializeGrowthStageMonitor() {
    this.logger.debug('Initializing growth stage monitor');
    
    return {
      /**
       * Identify growth stage from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} cropId - Crop identifier
       * @returns {Promise<Object>} Growth stage identification
       */
      identifyGrowthStage: async (image, cropId) => {
        this.logger.debug(`Identifying growth stage for crop ${cropId} from image`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to select appropriate model for growth stage identification
          const modelResult = await MIIF.executeModel({
            task: 'image_classification',
            domain: 'agriculture',
            subtype: 'growth_stage_identification',
            input: { 
              image,
              context: { crop: cropId }
            }
          });
          
          if (!modelResult || !modelResult.growthStage) {
            this.logger.warn('No growth stage returned from growth stage identification model');
            return null;
          }
          
          return modelResult.growthStage;
        } catch (error) {
          this.logger.error(`Error identifying growth stage from image: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Calculate growing degree days
       * @param {String} cropId - Crop identifier
       * @param {Object} weatherData - Weather data
       * @param {Date} plantingDate - Planting date
       * @returns {Promise<Object>} Growing degree days calculation
       */
      calculateGrowingDegreeDays: async (cropId, weatherData, plantingDate) => {
        this.logger.debug(`Calculating growing degree days for crop ${cropId}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to calculate growing degree days
          const modelResult = await MIIF.executeModel({
            task: 'calculation',
            domain: 'agriculture',
            subtype: 'growing_degree_days',
            input: { 
              crop: crop || { id: cropId },
              weather: weatherData,
              plantingDate: plantingDate.toISOString()
            }
          });
          
          if (!modelResult || !modelResult.gdd) {
            this.logger.warn('No GDD calculation returned from growing degree days model');
            return null;
          }
          
          return modelResult.gdd;
        } catch (error) {
          this.logger.error(`Error calculating growing degree days: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Predict crop development timeline
       * @param {String} cropId - Crop identifier
       * @param {Date} plantingDate - Planting date
       * @param {Object} environmentalData - Environmental data
       * @returns {Promise<Object>} Crop development timeline
       */
      predictDevelopmentTimeline: async (cropId, plantingDate, environmentalData) => {
        this.logger.debug(`Predicting development timeline for crop ${cropId}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to predict development timeline
          const modelResult = await MIIF.executeModel({
            task: 'prediction',
            domain: 'agriculture',
            subtype: 'crop_development',
            input: { 
              crop: crop || { id: cropId },
              plantingDate: plantingDate.toISOString(),
              environment: environmentalData
            }
          });
          
          if (!modelResult || !modelResult.timeline) {
            this.logger.warn('No timeline returned from crop development prediction model');
            return null;
          }
          
          return modelResult.timeline;
        } catch (error) {
          this.logger.error(`Error predicting development timeline: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get stage-specific management recommendations
       * @param {String} cropId - Crop identifier
       * @param {String} growthStage - Growth stage identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended management practices
       */
      getStageRecommendations: async (cropId, growthStage, context = {}) => {
        this.logger.debug(`Getting recommendations for crop ${cropId} at growth stage ${growthStage}`);
        
        try {
          // Get crop data if agriculture knowledge manager is available
          let crop = null;
          if (this.agricultureKnowledgeManager && cropId) {
            crop = await this.agricultureKnowledgeManager.getEntity(cropId);
          }
          
          // Use MIIF to get stage-specific recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'stage_management',
            input: { 
              crop: crop || { id: cropId },
              growthStage,
              context
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from stage management recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting stage-specific recommendations: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the indoor health monitor
   * @private
   * @returns {Object} The indoor health monitor
   */
  _initializeIndoorHealthMonitor() {
    this.logger.debug('Initializing indoor health monitor');
    
    return {
      /**
       * Monitor indoor growing conditions
       * @param {String} systemId - Indoor system identifier
       * @returns {Promise<Object>} Current growing conditions
       */
      monitorConditions: async (systemId) => {
        this.logger.debug(`Monitoring conditions for indoor system: ${systemId}`);
        
        try {
          // Use HSTIS to collect data from sensors
          const sensorData = await HSTIS.collectData({
            type: 'indoor_sensors',
            filter: { system: systemId }
          });
          
          if (!sensorData || sensorData.length === 0) {
            this.logger.warn(`No sensor data available for indoor system: ${systemId}`);
            return null;
          }
          
          // Process sensor data
          const processedData = {
            timestamp: Date.now(),
            system: systemId,
            temperature: this._extractLatestReading(sensorData, 'temperature'),
            humidity: this._extractLatestReading(sensorData, 'humidity'),
            light: this._extractLatestReading(sensorData, 'light'),
            co2: this._extractLatestReading(sensorData, 'co2'),
            waterLevel: this._extractLatestReading(sensorData, 'waterLevel'),
            nutrientLevels: this._extractLatestReadings(sensorData, 'nutrient'),
            ph: this._extractLatestReading(sensorData, 'ph'),
            ec: this._extractLatestReading(sensorData, 'ec')
          };
          
          return processedData;
        } catch (error) {
          this.logger.error(`Error monitoring indoor conditions: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Record an indoor plant observation
       * @param {String} systemId - Indoor system identifier
       * @param {Object} observationData - Observation data
       * @returns {Promise<Object>} Recorded observation
       */
      recordObservation: async (systemId, observationData) => {
        this.logger.debug(`Recording indoor plant observation for system: ${systemId}`);
        
        try {
          // Validate observation data
          if (!observationData.plantId) {
            throw new Error('Plant identifier is required');
          }
          
          // Generate unique ID if not provided
          const observationId = observationData.id || `indoor-observation-${Date.now()}`;
          
          // Create observation object
          const observation = {
            id: observationId,
            system: systemId,
            plant: observationData.plantId,
            location: observationData.location || {},
            condition: observationData.condition || 'healthy',
            images: observationData.images || [],
            measurements: observationData.measurements || {},
            notes: observationData.notes || '',
            timestamp: observationData.timestamp || Date.now(),
            recordedBy: observationData.recordedBy || 'system'
          };
          
          // Store observation data
          if (this.fileSystemTentacle) {
            await this.fileSystemTentacle.writeFile({
              path: `agriculture/indoor/observations/${observationId}.json`,
              content: JSON.stringify(observation, null, 2)
            });
          }
          
          // Update cache
          this.offlineCache.indoorObservations.set(observationId, observation);
          
          return observation;
        } catch (error) {
          this.logger.error(`Error recording indoor plant observation: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Analyze indoor plant health from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} plantId - Plant identifier
       * @returns {Promise<Object>} Plant health analysis
       */
      analyzeIndoorPlantHealth: async (image, plantId) => {
        this.logger.debug(`Analyzing indoor plant health for plant ${plantId} from image`);
        
        try {
          // Get plant data if agriculture knowledge manager is available
          let plant = null;
          if (this.agricultureKnowledgeManager && plantId) {
            plant = await this.agricultureKnowledgeManager.getEntity(plantId);
          }
          
          // Use MIIF to select appropriate model for indoor plant health analysis
          const modelResult = await MIIF.executeModel({
            task: 'image_analysis',
            domain: 'agriculture',
            subtype: 'indoor_plant_health',
            input: { 
              image,
              context: { plant: plantId }
            }
          });
          
          if (!modelResult || !modelResult.analysis) {
            this.logger.warn('No analysis returned from indoor plant health model');
            return null;
          }
          
          return modelResult.analysis;
        } catch (error) {
          this.logger.error(`Error analyzing indoor plant health: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get indoor environment adjustment recommendations
       * @param {String} systemId - Indoor system identifier
       * @param {Object} currentConditions - Current environmental conditions
       * @param {Array} plantIds - Plant identifiers
       * @returns {Promise<Object>} Environment adjustment recommendations
       */
      getEnvironmentAdjustments: async (systemId, currentConditions, plantIds) => {
        this.logger.debug(`Getting environment adjustments for indoor system: ${systemId}`);
        
        try {
          // Get plant data if agriculture knowledge manager is available
          let plants = [];
          
          if (this.agricultureKnowledgeManager && Array.isArray(plantIds)) {
            const plantPromises = plantIds.map(plantId => 
              this.agricultureKnowledgeManager.getEntity(plantId)
            );
            
            plants = await Promise.all(plantPromises);
          }
          
          // Use MIIF to get environment adjustment recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'indoor_environment_adjustment',
            input: { 
              system: { id: systemId },
              currentConditions,
              plants: plants.length > 0 ? plants : plantIds.map(id => ({ id }))
            }
          });
          
          if (!modelResult || !modelResult.adjustments) {
            this.logger.warn('No adjustments returned from environment adjustment recommendation model');
            return null;
          }
          
          return modelResult.adjustments;
        } catch (error) {
          this.logger.error(`Error getting environment adjustments: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Initialize the urban farming health advisor
   * @private
   * @returns {Object} The urban farming health advisor
   */
  _initializeUrbanFarmingHealthAdvisor() {
    this.logger.debug('Initializing urban farming health advisor');
    
    return {
      /**
       * Analyze urban plant health from an image
       * @param {Buffer|String} image - Image data or path to image file
       * @param {String} plantId - Plant identifier
       * @returns {Promise<Object>} Plant health analysis
       */
      analyzeUrbanPlantHealth: async (image, plantId) => {
        this.logger.debug(`Analyzing urban plant health for plant ${plantId} from image`);
        
        try {
          // Get plant data if agriculture knowledge manager is available
          let plant = null;
          if (this.agricultureKnowledgeManager && plantId) {
            plant = await this.agricultureKnowledgeManager.getEntity(plantId);
          }
          
          // Use MIIF to select appropriate model for urban plant health analysis
          const modelResult = await MIIF.executeModel({
            task: 'image_analysis',
            domain: 'agriculture',
            subtype: 'urban_plant_health',
            input: { 
              image,
              context: { plant: plantId }
            }
          });
          
          if (!modelResult || !modelResult.analysis) {
            this.logger.warn('No analysis returned from urban plant health model');
            return null;
          }
          
          return modelResult.analysis;
        } catch (error) {
          this.logger.error(`Error analyzing urban plant health: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Get urban-specific pest control recommendations
       * @param {String} pestId - Pest identifier
       * @param {String} plantId - Plant identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended pest control methods
       */
      getUrbanPestControlRecommendations: async (pestId, plantId, context = {}) => {
        this.logger.debug(`Getting urban pest control recommendations for pest ${pestId} on plant ${plantId}`);
        
        try {
          // Get pest and plant information if agriculture knowledge manager is available
          let pest = null;
          let plant = null;
          
          if (this.agricultureKnowledgeManager) {
            pest = await this.agricultureKnowledgeManager.getEntity(pestId);
            plant = await this.agricultureKnowledgeManager.getEntity(plantId);
          }
          
          // Use MIIF to get urban-specific pest control recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'urban_pest_control',
            input: { 
              pest: pest || { id: pestId },
              plant: plant || { id: plantId },
              context: { ...context, environment: 'urban' }
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from urban pest control recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting urban pest control recommendations: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Generate urban-specific disease treatment recommendations
       * @param {String} diseaseId - Disease identifier
       * @param {String} plantId - Plant identifier
       * @param {Object} context - Additional context (environment, constraints, etc.)
       * @returns {Promise<Array>} List of recommended treatments
       */
      getUrbanDiseaseTreatmentRecommendations: async (diseaseId, plantId, context = {}) => {
        this.logger.debug(`Getting urban disease treatment recommendations for disease ${diseaseId} on plant ${plantId}`);
        
        try {
          // Get disease and plant information if agriculture knowledge manager is available
          let disease = null;
          let plant = null;
          
          if (this.agricultureKnowledgeManager) {
            disease = await this.agricultureKnowledgeManager.getEntity(diseaseId);
            plant = await this.agricultureKnowledgeManager.getEntity(plantId);
          }
          
          // Use MIIF to get urban-specific disease treatment recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'urban_disease_treatment',
            input: { 
              disease: disease || { id: diseaseId },
              plant: plant || { id: plantId },
              context: { ...context, environment: 'urban' }
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from urban disease treatment recommendation model');
            return [];
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting urban disease treatment recommendations: ${error.message}`);
          throw error;
        }
      },
      
      /**
       * Generate urban-specific nutrient recommendations
       * @param {String} plantId - Plant identifier
       * @param {Object} soilData - Soil or growing medium data
       * @param {Object} context - Additional context (container size, light conditions, etc.)
       * @returns {Promise<Object>} Nutrient recommendations
       */
      getUrbanNutrientRecommendations: async (plantId, soilData, context = {}) => {
        this.logger.debug(`Getting urban nutrient recommendations for plant ${plantId}`);
        
        try {
          // Get plant information if agriculture knowledge manager is available
          let plant = null;
          
          if (this.agricultureKnowledgeManager) {
            plant = await this.agricultureKnowledgeManager.getEntity(plantId);
          }
          
          // Use MIIF to get urban-specific nutrient recommendations
          const modelResult = await MIIF.executeModel({
            task: 'recommendation',
            domain: 'agriculture',
            subtype: 'urban_nutrient_management',
            input: { 
              plant: plant || { id: plantId },
              soil: soilData,
              context: { ...context, environment: 'urban' }
            }
          });
          
          if (!modelResult || !modelResult.recommendations) {
            this.logger.warn('No recommendations returned from urban nutrient recommendation model');
            return null;
          }
          
          return modelResult.recommendations;
        } catch (error) {
          this.logger.error(`Error getting urban nutrient recommendations: ${error.message}`);
          throw error;
        }
      }
    };
  }
  
  /**
   * Extract the latest reading of a specific type from sensor data
   * @private
   * @param {Array} sensorData - Array of sensor readings
   * @param {String} readingType - Type of reading to extract
   * @returns {Object|null} Latest reading or null if not found
   */
  _extractLatestReading(sensorData, readingType) {
    if (!Array.isArray(sensorData) || sensorData.length === 0) {
      return null;
    }
    
    // Find sensors that provide the specified reading type
    const relevantSensors = sensorData.filter(sensor => 
      sensor.readings && sensor.readings[readingType] !== undefined
    );
    
    if (relevantSensors.length === 0) {
      return null;
    }
    
    // Sort by timestamp (descending) and take the first (most recent)
    relevantSensors.sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      value: relevantSensors[0].readings[readingType],
      timestamp: relevantSensors[0].timestamp,
      deviceId: relevantSensors[0].deviceId
    };
  }
  
  /**
   * Extract the latest readings of a specific type prefix from sensor data
   * @private
   * @param {Array} sensorData - Array of sensor readings
   * @param {String} prefix - Prefix of reading types to extract
   * @returns {Object|null} Object with latest readings or null if none found
   */
  _extractLatestReadings(sensorData, prefix) {
    if (!Array.isArray(sensorData) || sensorData.length === 0) {
      return null;
    }
    
    const result = {};
    
    // For each sensor
    sensorData.forEach(sensor => {
      if (!sensor.readings) {
        return;
      }
      
      // Check each reading
      Object.keys(sensor.readings).forEach(key => {
        if (key.startsWith(prefix)) {
          const nutrientName = key.substring(prefix.length);
          
          // If we don't have this nutrient yet, or this reading is newer
          if (!result[nutrientName] || sensor.timestamp > result[nutrientName].timestamp) {
            result[nutrientName] = {
              value: sensor.readings[key],
              timestamp: sensor.timestamp,
              deviceId: sensor.deviceId
            };
          }
        }
      });
    });
    
    return Object.keys(result).length > 0 ? result : null;
  }
}

module.exports = CropHealthMonitor;
