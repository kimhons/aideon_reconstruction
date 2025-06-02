/**
 * @fileoverview Unit tests for the Crop Health Monitor component.
 * 
 * @module test/tentacles/agriculture/CropHealthMonitorTest
 * @requires tentacles/agriculture/CropHealthMonitor
 */

const assert = require('assert');
const CropHealthMonitor = require('../CropHealthMonitor');

// Mock dependencies
const mockAgricultureKnowledgeManager = {
  getEntity: async (entityId) => {
    if (entityId === 'crop-tomato') {
      return {
        id: 'crop-tomato',
        entityType: 'crop',
        name: 'Tomato',
        scientificName: 'Solanum lycopersicum',
        taxonomy: {
          category: 'vegetable',
          classification: 'annual'
        }
      };
    } else if (entityId === 'disease-blight') {
      return {
        id: 'disease-blight',
        entityType: 'disease',
        name: 'Early Blight',
        scientificName: 'Alternaria solani',
        taxonomy: {
          category: 'fungal',
          classification: 'foliar'
        }
      };
    } else if (entityId === 'pest-aphid') {
      return {
        id: 'pest-aphid',
        entityType: 'pest',
        name: 'Aphid',
        scientificName: 'Aphidoidea',
        taxonomy: {
          category: 'insect',
          classification: 'sap-sucking'
        }
      };
    }
    return null;
  }
};

const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path === 'agriculture/observations/observation-123.json') {
      return JSON.stringify({
        id: 'observation-123',
        field: 'field-123',
        crop: 'crop-tomato',
        disease: 'disease-blight',
        severity: 'medium'
      });
    }
    throw new Error('File not found');
  },
  writeFile: async () => true
};

const mockWebTentacle = {
  fetchResource: async (request) => {
    if (request.type === 'weather_forecast') {
      return {
        daily: [
          { date: '2025-06-01', tempMin: 15, tempMax: 25, precipitation: 0 },
          { date: '2025-06-02', tempMin: 16, tempMax: 26, precipitation: 5 }
        ]
      };
    }
    return null;
  }
};

// Mock MIIF
global.MIIF = {
  executeModel: async (request) => {
    if (request.task === 'image_classification' && request.subtype === 'plant_disease_identification') {
      return {
        predictions: [
          {
            entityId: 'disease-blight',
            confidence: 0.88,
            boundingBox: { x: 120, y: 150, width: 100, height: 80 }
          }
        ]
      };
    } else if (request.task === 'image_classification' && request.subtype === 'pest_identification') {
      return {
        predictions: [
          {
            entityId: 'pest-aphid',
            confidence: 0.92,
            boundingBox: { x: 50, y: 100, width: 30, height: 20 }
          }
        ]
      };
    } else if (request.task === 'image_classification' && request.subtype === 'nutrient_deficiency') {
      return {
        predictions: [
          {
            entityId: 'deficiency-nitrogen',
            confidence: 0.85,
            affectedArea: { percent: 30 }
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'disease_treatment') {
      return {
        recommendations: [
          {
            type: 'organic',
            treatment: 'Neem oil spray',
            application: 'Apply every 7 days until symptoms disappear',
            effectiveness: 0.75
          },
          {
            type: 'cultural',
            treatment: 'Remove affected leaves',
            application: 'Immediately upon detection',
            effectiveness: 0.60
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'pest_control') {
      return {
        recommendations: [
          {
            type: 'biological',
            treatment: 'Ladybugs',
            application: 'Release 1500 per acre',
            effectiveness: 0.80
          },
          {
            type: 'organic',
            treatment: 'Insecticidal soap',
            application: 'Apply weekly as needed',
            effectiveness: 0.70
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'urban_disease_treatment') {
      return {
        recommendations: [
          {
            type: 'organic',
            treatment: 'Diluted hydrogen peroxide spray',
            application: 'Apply every 5 days',
            effectiveness: 0.65,
            safeForUrbanUse: true
          }
        ]
      };
    } else if (request.task === 'image_analysis' && request.subtype === 'indoor_plant_health') {
      return {
        analysis: {
          overallHealth: 'good',
          issues: [
            {
              type: 'light_deficiency',
              confidence: 0.75,
              severity: 'mild',
              affectedArea: { percent: 15 }
            }
          ],
          recommendations: [
            'Increase light exposure by 2 hours daily',
            'Move plant closer to light source'
          ]
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'indoor_environment_adjustment') {
      return {
        adjustments: {
          temperature: { target: 24, current: 22, adjustment: '+2°C' },
          humidity: { target: 65, current: 55, adjustment: '+10%' },
          light: { target: 16, current: 12, adjustment: '+4 hours' }
        }
      };
    } else if (request.task === 'image_classification' && request.subtype === 'growth_stage_identification') {
      return {
        growthStage: {
          id: 'stage-flowering',
          name: 'Flowering',
          percentComplete: 65,
          daysFromPlanting: 45,
          estimatedDaysToHarvest: 25
        }
      };
    }
    return null;
  }
};

// Mock HSTIS
global.HSTIS = {
  collectData: async (request) => {
    if (request.type === 'indoor_sensors' && request.filter.system === 'system-123') {
      return [
        {
          deviceId: 'sensor-001',
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            temperature: 22,
            humidity: 55,
            light: 600,
            co2: 750
          }
        },
        {
          deviceId: 'sensor-002',
          timestamp: Date.now() - 1800000, // 30 minutes ago
          readings: {
            ph: 6.2,
            ec: 1.8,
            waterLevel: 85,
            nutrientNitrogen: 150,
            nutrientPhosphorus: 50,
            nutrientPotassium: 200
          }
        }
      ];
    }
    return [];
  }
};

// Mock Logger
global.Logger = class Logger {
  constructor() {}
  info() {}
  debug() {}
  warn() {}
  error() {}
};

describe('CropHealthMonitor', function() {
  let healthMonitor;
  
  beforeEach(function() {
    healthMonitor = new CropHealthMonitor({
      agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle
    });
  });
  
  describe('#diseaseIdentificationSystem', function() {
    it('should identify diseases from an image', async function() {
      const results = await healthMonitor.diseaseIdentificationSystem.identifyDiseases(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].entityId, 'disease-blight');
      assert.strictEqual(results[0].confidence, 0.88);
    });
    
    it('should record a disease observation', async function() {
      const observation = await healthMonitor.diseaseIdentificationSystem.recordObservation(
        'field-123',
        {
          cropId: 'crop-tomato',
          diseaseId: 'disease-blight',
          severity: 'medium',
          affectedArea: { value: 15, unit: 'percent' }
        }
      );
      
      assert.strictEqual(observation.field, 'field-123');
      assert.strictEqual(observation.crop, 'crop-tomato');
      assert.strictEqual(observation.disease, 'disease-blight');
      assert.strictEqual(observation.severity, 'medium');
    });
    
    it('should get treatment recommendations for a disease', async function() {
      const recommendations = await healthMonitor.diseaseIdentificationSystem.getTreatmentRecommendations(
        'disease-blight',
        'crop-tomato',
        { environment: 'field' }
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].type, 'organic');
      assert.strictEqual(recommendations[0].treatment, 'Neem oil spray');
    });
  });
  
  describe('#nutrientDeficiencyAnalyzer', function() {
    it('should analyze nutrient deficiencies from an image', async function() {
      const results = await healthMonitor.nutrientDeficiencyAnalyzer.analyzeDeficiencies(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].entityId, 'deficiency-nitrogen');
      assert.strictEqual(results[0].confidence, 0.85);
    });
  });
  
  describe('#pestDetectionSystem', function() {
    it('should identify pests from an image', async function() {
      const results = await healthMonitor.pestDetectionSystem.identifyPests(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].entityId, 'pest-aphid');
      assert.strictEqual(results[0].confidence, 0.92);
    });
    
    it('should get pest control recommendations', async function() {
      const recommendations = await healthMonitor.pestDetectionSystem.getControlRecommendations(
        'pest-aphid',
        'crop-tomato',
        { environment: 'field' }
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].type, 'biological');
      assert.strictEqual(recommendations[0].treatment, 'Ladybugs');
    });
  });
  
  describe('#indoorHealthMonitor', function() {
    it('should monitor indoor growing conditions', async function() {
      const conditions = await healthMonitor.indoorHealthMonitor.monitorConditions('system-123');
      
      assert.strictEqual(conditions.system, 'system-123');
      assert.strictEqual(conditions.temperature.value, 22);
      assert.strictEqual(conditions.humidity.value, 55);
      assert.strictEqual(conditions.ph.value, 6.2);
    });
    
    it('should analyze indoor plant health from an image', async function() {
      const analysis = await healthMonitor.indoorHealthMonitor.analyzeIndoorPlantHealth(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(analysis.overallHealth, 'good');
      assert.strictEqual(analysis.issues.length, 1);
      assert.strictEqual(analysis.issues[0].type, 'light_deficiency');
    });
    
    it('should get indoor environment adjustment recommendations', async function() {
      const adjustments = await healthMonitor.indoorHealthMonitor.getEnvironmentAdjustments(
        'system-123',
        {
          temperature: { value: 22 },
          humidity: { value: 55 },
          light: { value: 12, unit: 'hours' }
        },
        ['crop-tomato']
      );
      
      assert.strictEqual(adjustments.temperature.target, 24);
      assert.strictEqual(adjustments.humidity.target, 65);
      assert.strictEqual(adjustments.light.target, 16);
    });
  });
  
  describe('#urbanFarmingHealthAdvisor', function() {
    it('should get urban-specific disease treatment recommendations', async function() {
      const recommendations = await healthMonitor.urbanFarmingHealthAdvisor.getUrbanDiseaseTreatmentRecommendations(
        'disease-blight',
        'crop-tomato',
        { containerSize: 'medium' }
      );
      
      assert.strictEqual(recommendations.length, 1);
      assert.strictEqual(recommendations[0].type, 'organic');
      assert.strictEqual(recommendations[0].safeForUrbanUse, true);
    });
  });
  
  describe('#growthStageMonitor', function() {
    it('should identify growth stage from an image', async function() {
      const growthStage = await healthMonitor.growthStageMonitor.identifyGrowthStage(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(growthStage.id, 'stage-flowering');
      assert.strictEqual(growthStage.name, 'Flowering');
      assert.strictEqual(growthStage.percentComplete, 65);
    });
  });
});
