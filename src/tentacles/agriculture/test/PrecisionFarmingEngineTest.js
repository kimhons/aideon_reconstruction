/**
 * @fileoverview Unit tests for the Precision Farming Engine component.
 * 
 * @module test/tentacles/agriculture/PrecisionFarmingEngineTest
 * @requires tentacles/agriculture/PrecisionFarmingEngine
 */

const assert = require('assert');
const PrecisionFarmingEngine = require('../PrecisionFarmingEngine');

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
    }
    return null;
  },
  getCompanionPlantingRecommendations: async (cropId) => {
    if (cropId === 'crop-tomato') {
      return {
        companions: [
          { cropId: 'crop-basil', benefit: 'Improves flavor and repels pests' },
          { cropId: 'crop-marigold', benefit: 'Repels nematodes' }
        ],
        antagonists: [
          { cropId: 'crop-potato', reason: 'Shared diseases' },
          { cropId: 'crop-fennel', reason: 'Growth inhibition' }
        ]
      };
    }
    return { companions: [], antagonists: [] };
  },
  regionalConditionDatabase: {
    getClimateData: async (regionId) => {
      if (regionId === 'region-northeast') {
        return {
          zone: 'Temperate',
          averageTemperature: { annual: 12.5 },
          precipitation: { annual: 1200 }
        };
      }
      return null;
    }
  }
};

const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path === 'agriculture/fields/field-123.json') {
      return JSON.stringify({
        id: 'field-123',
        name: 'Test Field',
        boundary: { type: 'Polygon', coordinates: [[]] },
        area: 10.5,
        zones: []
      });
    } else if (request.path === 'agriculture/plans/plan-456.json') {
      return JSON.stringify({
        id: 'plan-456',
        field: 'field-123',
        season: '2025',
        crops: ['crop-corn']
      });
    } else if (request.path === 'agriculture/indoor/system-789.json') {
      return JSON.stringify({
        id: 'system-789',
        name: 'Indoor Hydroponic System',
        type: 'hydroponic',
        dimensions: { length: 3, width: 2, height: 2, unit: 'meters' }
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
    if (request.task === 'image_classification' && request.subtype === 'plant_identification') {
      return {
        predictions: [
          {
            entityId: 'crop-tomato',
            confidence: 0.95,
            boundingBox: { x: 100, y: 100, width: 200, height: 300 }
          },
          {
            entityId: 'crop-pepper',
            confidence: 0.82,
            boundingBox: { x: 400, y: 200, width: 150, height: 250 }
          }
        ]
      };
    } else if (request.task === 'image_classification' && request.subtype === 'plant_disease_identification') {
      return {
        predictions: [
          {
            entityId: 'disease-blight',
            confidence: 0.88,
            boundingBox: { x: 120, y: 150, width: 100, height: 80 }
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'indoor_environment') {
      return {
        recommendations: {
          temperature: { day: 24, night: 18, unit: 'celsius' },
          humidity: { target: 65, range: [60, 70], unit: 'percent' },
          light: { intensity: 600, duration: 16, unit: 'hours' },
          co2: { level: 800, unit: 'ppm' }
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'urban_space') {
      return {
        plan: {
          layout: [
            { crop: 'crop-tomato', position: { x: 0, y: 0 }, area: 1.2 },
            { crop: 'crop-basil', position: { x: 1.2, y: 0 }, area: 0.5 }
          ],
          utilization: 0.85,
          yield: { estimate: 12, unit: 'kg' }
        }
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
    }
    return null;
  }
};

// Mock HSTIS
global.HSTIS = {
  collectData: async (request) => {
    if (request.type === 'iot_sensors' && request.filter.field === 'field-123') {
      return [
        {
          deviceId: 'sensor-001',
          timestamp: Date.now(),
          readings: {
            soilMoisture: 35.2,
            temperature: 22.5,
            humidity: 68.3
          }
        }
      ];
    }
    return [];
  },
  configureAlerts: async (config) => {
    return {
      status: 'configured',
      alertCount: config.alerts.length
    };
  }
};

// Mock SGF
global.SGF = {
  registerDevice: async (device) => {
    return {
      deviceId: device.id,
      securityToken: 'mock-token-123',
      permissions: ['read', 'write']
    };
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

describe('PrecisionFarmingEngine', function() {
  let farmingEngine;
  
  beforeEach(function() {
    farmingEngine = new PrecisionFarmingEngine({
      agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle
    });
  });
  
  describe('#fieldMappingSystem', function() {
    it('should create a new field', async function() {
      const field = await farmingEngine.fieldMappingSystem.createField({
        name: 'New Test Field',
        boundary: { type: 'Polygon', coordinates: [[]] }
      });
      
      assert.strictEqual(field.name, 'New Test Field');
      assert.ok(field.id);
      assert.ok(field.createdAt);
    });
    
    it('should get field by ID', async function() {
      const field = await farmingEngine.fieldMappingSystem.getField('field-123');
      
      assert.strictEqual(field.id, 'field-123');
      assert.strictEqual(field.name, 'Test Field');
      assert.strictEqual(field.area, 10.5);
    });
    
    it('should update field data', async function() {
      const updatedField = await farmingEngine.fieldMappingSystem.updateField('field-123', {
        name: 'Updated Field Name'
      });
      
      assert.strictEqual(updatedField.id, 'field-123');
      assert.strictEqual(updatedField.name, 'Updated Field Name');
      assert.ok(updatedField.updatedAt);
    });
  });
  
  describe('#cropPlanningSystem', function() {
    it('should create a crop plan', async function() {
      const plan = await farmingEngine.cropPlanningSystem.createPlan('field-123', {
        season: '2025',
        crops: ['crop-tomato', 'crop-basil']
      });
      
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.season, '2025');
      assert.deepStrictEqual(plan.crops, ['crop-tomato', 'crop-basil']);
    });
    
    it('should get crop plan by ID', async function() {
      const plan = await farmingEngine.cropPlanningSystem.getPlan('plan-456');
      
      assert.strictEqual(plan.id, 'plan-456');
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.season, '2025');
    });
  });
  
  describe('#indoorFarmingSystem', function() {
    it('should create an indoor growing system', async function() {
      const system = await farmingEngine.indoorFarmingSystem.createIndoorSystem({
        name: 'New Hydroponic System',
        type: 'hydroponic',
        dimensions: { length: 2, width: 1, height: 2, unit: 'meters' }
      });
      
      assert.strictEqual(system.name, 'New Hydroponic System');
      assert.strictEqual(system.type, 'hydroponic');
      assert.deepStrictEqual(system.dimensions, { length: 2, width: 1, height: 2, unit: 'meters' });
    });
    
    it('should get indoor system by ID', async function() {
      const system = await farmingEngine.indoorFarmingSystem.getIndoorSystem('system-789');
      
      assert.strictEqual(system.id, 'system-789');
      assert.strictEqual(system.name, 'Indoor Hydroponic System');
      assert.strictEqual(system.type, 'hydroponic');
    });
    
    it('should generate environmental recommendations', async function() {
      const recommendations = await farmingEngine.indoorFarmingSystem.generateEnvironmentalRecommendations('system-789', 'crop-tomato');
      
      assert.strictEqual(recommendations.temperature.day, 24);
      assert.strictEqual(recommendations.humidity.target, 65);
      assert.strictEqual(recommendations.light.duration, 16);
    });
  });
  
  describe('#urbanFarmingOptimizer', function() {
    it('should optimize space utilization', async function() {
      const plan = await farmingEngine.urbanFarmingOptimizer.optimizeSpaceUtilization(
        { dimensions: { length: 3, width: 2, height: 2, unit: 'meters' } },
        ['crop-tomato', 'crop-basil']
      );
      
      assert.strictEqual(plan.layout.length, 2);
      assert.strictEqual(plan.layout[0].crop, 'crop-tomato');
      assert.strictEqual(plan.utilization, 0.85);
    });
  });
  
  describe('#plantIdentificationSystem', function() {
    it('should identify plants from an image', async function() {
      const results = await farmingEngine.plantIdentificationSystem.identifyPlants(
        Buffer.from('mock image data')
      );
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].entityId, 'crop-tomato');
      assert.strictEqual(results[0].confidence, 0.95);
    });
    
    it('should identify plant diseases from an image', async function() {
      const results = await farmingEngine.plantIdentificationSystem.identifyPlantDiseases(
        Buffer.from('mock image data'),
        'crop-tomato'
      );
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].entityId, 'disease-blight');
      assert.strictEqual(results[0].confidence, 0.88);
    });
    
    it('should get disease treatment recommendations', async function() {
      const recommendations = await farmingEngine.plantIdentificationSystem.getDiseaseTreatmentRecommendations(
        'disease-blight',
        'crop-tomato',
        { environment: 'indoor' }
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].type, 'organic');
      assert.strictEqual(recommendations[0].treatment, 'Neem oil spray');
    });
  });
  
  describe('#iotIntegrationHub', function() {
    it('should register an IoT device', async function() {
      const device = await farmingEngine.iotIntegrationHub.registerDevice({
        name: 'Soil Moisture Sensor',
        type: 'sensor',
        capabilities: ['moisture', 'temperature']
      });
      
      assert.ok(device.id);
      assert.strictEqual(device.name, 'Soil Moisture Sensor');
      assert.strictEqual(device.type, 'sensor');
      assert.ok(device.securityProfile);
    });
    
    it('should collect sensor data', async function() {
      const sensorData = await farmingEngine.iotIntegrationHub.collectSensorData('field-123');
      
      assert.strictEqual(sensorData.length, 1);
      assert.strictEqual(sensorData[0].deviceId, 'sensor-001');
      assert.ok(sensorData[0].readings.soilMoisture);
    });
  });
});
