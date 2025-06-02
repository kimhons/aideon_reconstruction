/**
 * @fileoverview Integration tests for the Agriculture Tentacle.
 * Tests the integration of all core components: Knowledge Manager, Precision Farming Engine,
 * Crop Health Monitor, Resource Optimization System, Sustainability Planner,
 * and Market Intelligence System.
 * 
 * @module test/tentacles/agriculture/AgricultureTentacleIntegrationTest
 * @requires ../../src/tentacles/agriculture/AgricultureTentacle
 */

const assert = require('assert');
const path = require('path');

// Import the modified AgricultureTentacle for testing
const AgricultureTentacle = require('../../../test/tentacles/agriculture/AgricultureTentacleForTest');

// Mock dependencies
const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path.includes('knowledge/crops/corn.json')) {
      return JSON.stringify({
        id: 'crop-corn',
        name: 'Corn',
        scientificName: 'Zea mays',
        type: 'grain',
        growingConditions: {
          soilType: ['loamy', 'sandy loam'],
          phRange: { min: 5.8, max: 7.0 },
          temperature: { min: 10, max: 32, unit: 'celsius' },
          waterRequirements: { amount: 500, unit: 'mm/season' }
        },
        growingCycle: {
          germination: { days: 7 },
          vegetative: { days: 60 },
          reproductive: { days: 25 },
          maturity: { days: 30 }
        },
        varieties: [
          { id: 'var-field-corn', name: 'Field Corn', usages: ['animal feed', 'ethanol'] },
          { id: 'var-sweet-corn', name: 'Sweet Corn', usages: ['human consumption'] }
        ],
        commonDiseases: [
          { id: 'disease-corn-rust', name: 'Corn Rust' },
          { id: 'disease-corn-smut', name: 'Corn Smut' }
        ],
        commonPests: [
          { id: 'pest-corn-borer', name: 'Corn Borer' },
          { id: 'pest-armyworm', name: 'Armyworm' }
        ],
        nutritionalProfile: {
          calories: 365,
          protein: 9.4,
          carbohydrates: 74.3,
          fat: 4.7,
          unit: 'per 100g'
        }
      });
    } else if (request.path.includes('knowledge/diseases/corn-rust.json')) {
      return JSON.stringify({
        id: 'disease-corn-rust',
        name: 'Corn Rust',
        scientificName: 'Puccinia sorghi',
        affectedCrops: ['corn', 'maize'],
        symptoms: [
          'Orange to reddish-brown pustules on leaves',
          'Circular to elongated pustules',
          'Pustules on both upper and lower leaf surfaces',
          'Severe infections may cause leaf death'
        ],
        conditions: {
          temperature: { optimal: 16, range: { min: 8, max: 25 }, unit: 'celsius' },
          humidity: { optimal: 100, range: { min: 95, max: 100 }, unit: 'percent' },
          leafWetness: { required: true, duration: { min: 6, unit: 'hours' } }
        },
        management: {
          cultural: [
            'Plant resistant varieties',
            'Crop rotation',
            'Proper plant spacing for air circulation'
          ],
          chemical: [
            'Triazole fungicides',
            'Strobilurin fungicides'
          ],
          biological: [
            'Limited biological control options'
          ]
        },
        images: [
          { url: 'agriculture/diseases/corn-rust-1.jpg', caption: 'Early symptoms on leaf' },
          { url: 'agriculture/diseases/corn-rust-2.jpg', caption: 'Advanced infection' }
        ]
      });
    } else if (request.path.includes('knowledge/indoor/basil.json')) {
      return JSON.stringify({
        id: 'indoor-basil',
        name: 'Basil',
        scientificName: 'Ocimum basilicum',
        type: 'herb',
        indoorGrowingConditions: {
          light: { intensity: 'high', duration: { hours: 14 } },
          temperature: { optimal: 24, range: { min: 18, max: 30 }, unit: 'celsius' },
          humidity: { optimal: 60, range: { min: 40, max: 70 }, unit: 'percent' },
          growingMedium: ['soilless mix', 'hydroponic solution'],
          spacing: { value: 15, unit: 'cm' }
        },
        growingCycle: {
          germination: { days: 5 },
          vegetative: { days: 28 },
          harvest: { days: 35, continuous: true }
        },
        varieties: [
          { id: 'var-genovese', name: 'Genovese Basil', characteristics: ['large leaves', 'classic flavor'] },
          { id: 'var-thai', name: 'Thai Basil', characteristics: ['anise flavor', 'purple stems'] }
        ],
        commonIssues: [
          { id: 'issue-basil-downy-mildew', name: 'Downy Mildew' },
          { id: 'issue-basil-aphids', name: 'Aphids' }
        ],
        nutritionalProfile: {
          vitamins: ['A', 'K', 'C'],
          minerals: ['calcium', 'iron', 'manganese'],
          antioxidants: true
        },
        harvestingTips: [
          'Harvest outer leaves first',
          'Pinch off flower buds to extend vegetative growth',
          'Harvest in morning for best flavor'
        ]
      });
    } else if (request.path.includes('fields/field-123.json')) {
      return JSON.stringify({
        id: 'field-123',
        name: 'North Field',
        location: {
          latitude: 41.8781,
          longitude: -87.6298,
          elevation: 180
        },
        area: { value: 50, unit: 'hectares' },
        soil: {
          type: 'loamy',
          ph: 6.5,
          organicMatter: 3.2,
          nutrients: {
            nitrogen: { value: 45, unit: 'ppm' },
            phosphorus: { value: 32, unit: 'ppm' },
            potassium: { value: 120, unit: 'ppm' }
          }
        },
        currentCrop: {
          id: 'crop-corn',
          variety: 'var-field-corn',
          plantingDate: '2025-04-15',
          expectedHarvestDate: '2025-09-20'
        },
        history: [
          { year: 2024, crop: 'soybeans', yield: { value: 3.5, unit: 'tons/hectare' } },
          { year: 2023, crop: 'corn', yield: { value: 9.8, unit: 'tons/hectare' } }
        ]
      });
    } else if (request.path.includes('indoor/system-456.json')) {
      return JSON.stringify({
        id: 'system-456',
        name: 'Urban Vertical Farm',
        type: 'vertical_hydroponic',
        location: {
          type: 'indoor',
          building: 'Warehouse',
          address: '123 Urban St, New York, NY'
        },
        dimensions: {
          area: { value: 500, unit: 'sq_meters' },
          height: { value: 6, unit: 'meters' }
        },
        systems: {
          growing: {
            type: 'nft_hydroponic',
            levels: 5,
            growingPositions: 2000
          },
          lighting: {
            type: 'led',
            spectrum: 'full',
            control: 'automated'
          },
          irrigation: {
            type: 'recirculating',
            capacity: { value: 2000, unit: 'liters' }
          },
          climate: {
            temperatureControl: true,
            humidityControl: true,
            co2Enrichment: true
          }
        },
        crops: [
          { id: 'indoor-basil', positions: 500, plantingDate: '2025-05-01' },
          { id: 'indoor-lettuce', positions: 1000, plantingDate: '2025-05-01' },
          { id: 'indoor-kale', positions: 500, plantingDate: '2025-05-01' }
        ],
        operationalStatus: 'active'
      });
    } else if (request.path.includes('urban/space-789.json')) {
      return JSON.stringify({
        id: 'space-789',
        name: 'Rooftop Garden',
        type: 'urban_garden',
        location: {
          type: 'rooftop',
          building: 'Apartment Complex',
          address: '456 City Ave, Chicago, IL'
        },
        dimensions: {
          area: { value: 200, unit: 'sq_meters' },
          sunExposure: 'full'
        },
        infrastructure: {
          containers: true,
          raisedBeds: true,
          irrigation: 'drip',
          composting: true
        },
        constraints: {
          weightLimit: { value: 150, unit: 'kg/sq_meter' },
          waterAccess: 'limited',
          accessHours: 'unrestricted'
        },
        crops: [
          { id: 'urban-tomatoes', area: { value: 50, unit: 'sq_meters' }, plantingDate: '2025-05-15' },
          { id: 'urban-peppers', area: { value: 30, unit: 'sq_meters' }, plantingDate: '2025-05-15' },
          { id: 'urban-herbs', area: { value: 20, unit: 'sq_meters' }, plantingDate: '2025-05-01' }
        ],
        status: 'active'
      });
    }
    throw new Error('File not found');
  },
  writeFile: async () => true,
  listFiles: async (directory) => {
    if (directory.path.includes('knowledge/crops')) {
      return ['corn.json', 'wheat.json', 'soybeans.json'];
    } else if (directory.path.includes('knowledge/diseases')) {
      return ['corn-rust.json', 'corn-smut.json', 'wheat-rust.json'];
    } else if (directory.path.includes('knowledge/indoor')) {
      return ['basil.json', 'lettuce.json', 'kale.json'];
    }
    return [];
  }
};

const mockWebTentacle = {
  fetchResource: async (request) => {
    if (request.url.includes('api.weather.com')) {
      return {
        location: {
          latitude: 41.8781,
          longitude: -87.6298
        },
        current: {
          temperature: 22,
          humidity: 65,
          precipitation: 0,
          windSpeed: 10,
          windDirection: 'NW'
        },
        forecast: [
          {
            date: '2025-06-02',
            high: 24,
            low: 18,
            precipitation: { chance: 20, amount: 0 }
          },
          {
            date: '2025-06-03',
            high: 26,
            low: 19,
            precipitation: { chance: 60, amount: 5 }
          }
        ]
      };
    } else if (request.url.includes('api.market.com')) {
      return {
        commodity: 'corn',
        price: { value: 4.25, unit: 'USD/bushel' },
        trend: 'stable',
        lastUpdated: '2025-06-02T00:00:00Z'
      };
    } else if (request.url.includes('api.plantid.com')) {
      return {
        identified: true,
        plant: {
          name: 'Basil',
          scientificName: 'Ocimum basilicum',
          confidence: 0.95
        },
        alternatives: [
          {
            name: 'Thai Basil',
            scientificName: 'Ocimum basilicum var. thyrsiflora',
            confidence: 0.85
          }
        ]
      };
    } else if (request.url.includes('api.diseaseid.com')) {
      return {
        identified: true,
        disease: {
          name: 'Downy Mildew',
          scientificName: 'Peronospora belbahrii',
          confidence: 0.92
        },
        host: 'Basil',
        severity: 'moderate',
        treatment: [
          'Improve air circulation',
          'Reduce leaf wetness',
          'Apply copper-based fungicide'
        ]
      };
    }
    return null;
  }
};

const mockIotTentacle = {
  getSensorData: async (request) => {
    if (request.sensorId.includes('field-123')) {
      return {
        sensorId: request.sensorId,
        timestamp: Date.now(),
        readings: {
          soilMoisture: { value: 35, unit: 'percent' },
          soilTemperature: { value: 18, unit: 'celsius' },
          airTemperature: { value: 22, unit: 'celsius' },
          humidity: { value: 65, unit: 'percent' },
          lightIntensity: { value: 85000, unit: 'lux' }
        }
      };
    } else if (request.sensorId.includes('system-456')) {
      return {
        sensorId: request.sensorId,
        timestamp: Date.now(),
        readings: {
          waterTemperature: { value: 21, unit: 'celsius' },
          ph: { value: 6.2, unit: 'pH' },
          ec: { value: 1.8, unit: 'mS/cm' },
          dissolvedOxygen: { value: 8.5, unit: 'mg/L' },
          airTemperature: { value: 24, unit: 'celsius' },
          humidity: { value: 60, unit: 'percent' },
          co2: { value: 800, unit: 'ppm' },
          lightIntensity: { value: 50000, unit: 'lux' }
        }
      };
    }
    return null;
  },
  controlActuator: async () => ({ success: true, message: 'Actuator controlled successfully' })
};

const mockFinancialAnalysisTentacle = {
  analyzeFinancialData: async () => ({
    summary: {
      profitability: 'high',
      risk: 'medium',
      roi: { value: 0.15, timeframe: '1y' }
    },
    details: {
      revenue: { value: 100000, trend: 'increasing' },
      costs: { value: 70000, trend: 'stable' },
      profit: { value: 30000, trend: 'increasing' }
    }
  })
};

// Mock HSTIS, MCMS, TRDS, SGF, MIIF
global.HSTIS = {
  executeTask: async (request) => {
    if (request.task === 'image_analysis' && request.subtype === 'plant_identification') {
      return {
        identified: true,
        plant: {
          name: 'Basil',
          scientificName: 'Ocimum basilicum',
          confidence: 0.95
        },
        alternatives: [
          {
            name: 'Thai Basil',
            scientificName: 'Ocimum basilicum var. thyrsiflora',
            confidence: 0.85
          }
        ]
      };
    } else if (request.task === 'image_analysis' && request.subtype === 'disease_identification') {
      return {
        identified: true,
        disease: {
          name: 'Downy Mildew',
          scientificName: 'Peronospora belbahrii',
          confidence: 0.92
        },
        host: 'Basil',
        severity: 'moderate',
        treatment: [
          'Improve air circulation',
          'Reduce leaf wetness',
          'Apply copper-based fungicide'
        ]
      };
    }
    return null;
  }
};

global.MCMS = {
  executeTask: async (request) => {
    if (request.task === 'knowledge_retrieval') {
      return {
        entities: [
          {
            id: 'crop-corn',
            name: 'Corn',
            scientificName: 'Zea mays',
            type: 'grain'
          }
        ]
      };
    }
    return null;
  }
};

global.TRDS = {
  executeTask: async (request) => {
    if (request.task === 'data_processing' && request.subtype === 'sensor_data_analysis') {
      return {
        analysis: {
          anomalies: [],
          trends: [
            { parameter: 'soilMoisture', trend: 'decreasing', significance: 'medium' }
          ],
          recommendations: [
            { action: 'increase_irrigation', priority: 'medium', reason: 'Decreasing soil moisture' }
          ]
        }
      };
    }
    return null;
  }
};

global.SGF = {
  executeTask: async (request) => {
    if (request.task === 'planning' && request.subtype === 'irrigation_scheduling') {
      return {
        schedule: {
          id: 'irr-schedule-123',
          field: 'field-123',
          events: [
            { date: '2025-06-03', amount: { value: 15, unit: 'mm' }, duration: { value: 2, unit: 'hours' } },
            { date: '2025-06-06', amount: { value: 20, unit: 'mm' }, duration: { value: 2.5, unit: 'hours' } }
          ]
        }
      };
    }
    return null;
  }
};

global.MIIF = {
  executeModel: async (request) => {
    if (request.task === 'prediction' && request.subtype === 'yield_prediction') {
      return {
        prediction: {
          yield: { value: 9.5, unit: 'tons/hectare' },
          confidence: 0.85,
          factors: [
            { name: 'rainfall', impact: 'positive', significance: 'high' },
            { name: 'temperature', impact: 'neutral', significance: 'medium' }
          ]
        }
      };
    } else if (request.task === 'analysis' && request.subtype === 'market_trends') {
      return {
        trends: {
          overall: {
            direction: 'upward',
            strength: 'moderate',
            confidence: 'high'
          },
          seasonal: {
            pattern: 'typical',
            currentPhase: 'rising',
            nextPhase: { direction: 'plateau', expectedStart: '2025-08-01' }
          }
        }
      };
    }
    return null;
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

describe('AgricultureTentacle Integration Tests', function() {
  let agricultureTentacle;
  
  beforeEach(function() {
    agricultureTentacle = new AgricultureTentacle({}, {
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle,
      iotTentacle: mockIotTentacle,
      financialAnalysisTentacle: mockFinancialAnalysisTentacle
    });
  });
  
  describe('Knowledge Management Integration', function() {
    it('should retrieve agricultural entity information', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'get_agricultural_entity',
        payload: { entityId: 'crop-corn' }
      });
      
      assert.strictEqual(result.id, 'crop-corn');
      assert.strictEqual(result.name, 'Corn');
      assert.strictEqual(result.scientificName, 'Zea mays');
    });
    
    it('should search agricultural knowledge', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'search_agricultural_knowledge',
        payload: {
          query: 'corn disease',
          options: { limit: 5 }
        }
      });
      
      assert(Array.isArray(result.results));
      assert(result.results.length > 0);
      assert(result.results.some(item => item.id === 'disease-corn-rust'));
    });
  });
  
  describe('Precision Farming Integration', function() {
    it('should identify plants from images', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'identify_plant_from_image',
        payload: {
          imageData: 'base64encodedimage',
          options: { includeAlternatives: true }
        }
      });
      
      assert.strictEqual(result.identified, true);
      assert.strictEqual(result.plant.name, 'Basil');
      assert.strictEqual(result.plant.scientificName, 'Ocimum basilicum');
      assert(result.alternatives.length > 0);
    });
    
    it('should analyze field data', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'analyze_field_data',
        payload: {
          fieldId: 'field-123',
          sensorData: {
            soilMoisture: [
              { timestamp: Date.now() - 86400000, value: 40 },
              { timestamp: Date.now(), value: 35 }
            ]
          },
          imageryData: {
            ndvi: {
              timestamp: Date.now(),
              url: 'imagery/field-123/ndvi-2025-06-01.tif'
            }
          }
        }
      });
      
      assert(result.analysis);
      assert(result.analysis.soilMoisture);
      assert(result.analysis.vegetation);
      assert(result.recommendations);
    });
    
    it('should manage indoor farming systems', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'manage_indoor_system',
        payload: {
          systemId: 'system-456',
          action: 'adjust_environment',
          parameters: {
            temperature: { value: 23, unit: 'celsius' },
            humidity: { value: 65, unit: 'percent' },
            lightCycle: { on: 16, off: 8, unit: 'hours' }
          }
        }
      });
      
      assert.strictEqual(result.success, true);
      assert(result.adjustments);
      assert(result.status);
    });
    
    it('should optimize urban farming spaces', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'optimize_urban_space',
        payload: {
          spaceId: 'space-789',
          constraints: {
            weightLimit: { value: 150, unit: 'kg/sq_meter' },
            waterAvailability: 'limited',
            sunExposure: 'full'
          },
          goals: {
            production: 'maximize',
            waterUse: 'minimize',
            maintenance: 'minimize'
          }
        }
      });
      
      assert(result.layout);
      assert(result.cropPlan);
      assert(result.resourceRequirements);
      assert(result.expectedYield);
    });
  });
  
  describe('Crop Health Integration', function() {
    it('should identify diseases from images', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'identify_disease_from_image',
        payload: {
          imageData: 'base64encodedimage',
          options: { cropType: 'basil' }
        }
      });
      
      assert.strictEqual(result.identified, true);
      assert.strictEqual(result.disease.name, 'Downy Mildew');
      assert(result.treatment.length > 0);
    });
    
    it('should monitor crop health', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'monitor_crop_health',
        payload: {
          fieldId: 'field-123',
          monitoringData: {
            visualObservations: [
              { timestamp: Date.now(), type: 'leaf_discoloration', severity: 'low', coverage: 5 }
            ],
            sensorData: {
              timestamp: Date.now(),
              soilMoisture: 35,
              temperature: 22
            },
            imageryData: {
              timestamp: Date.now(),
              url: 'imagery/field-123/rgb-2025-06-01.jpg'
            }
          }
        }
      });
      
      assert(result.status);
      assert(result.issues);
      assert(result.recommendations);
    });
    
    it('should generate treatment plans', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'generate_treatment_plan',
        payload: {
          fieldId: 'field-123',
          diagnosis: {
            disease: 'corn-rust',
            severity: 'moderate',
            coverage: 15
          },
          options: {
            approach: 'integrated',
            constraints: {
              organic: true
            }
          }
        }
      });
      
      assert(result.plan);
      assert(result.plan.treatments);
      assert(result.plan.schedule);
      assert(result.plan.expectedOutcomes);
    });
    
    it('should manage indoor plant health', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'manage_indoor_plant_health',
        payload: {
          systemId: 'system-456',
          plantId: 'indoor-basil',
          healthData: {
            visualObservations: [
              { timestamp: Date.now(), type: 'leaf_spots', severity: 'low', coverage: 5 }
            ],
            sensorData: {
              timestamp: Date.now(),
              ec: 1.8,
              ph: 6.2
            }
          }
        }
      });
      
      assert(result.status);
      assert(result.issues);
      assert(result.adjustments);
      assert(result.recommendations);
    });
    
    it('should provide urban plant health advisories', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'get_urban_plant_advisory',
        payload: {
          plantId: 'urban-tomatoes',
          locationData: {
            type: 'rooftop',
            sunExposure: 'full',
            city: 'Chicago'
          },
          environmentalData: {
            temperature: 28,
            humidity: 65,
            forecast: {
              heatwave: true,
              duration: 3
            }
          }
        }
      });
      
      assert(result.advisory);
      assert(result.risks);
      assert(result.recommendations);
      assert(result.careSchedule);
    });
  });
  
  describe('Resource Optimization Integration', function() {
    it('should optimize water usage', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'optimize_water_usage',
        payload: {
          fieldId: 'field-123',
          usageData: {
            currentMoisture: 35,
            irrigationSystem: 'drip',
            efficiency: 0.9
          },
          weatherData: {
            forecast: [
              { date: '2025-06-02', precipitation: 0, evapotranspiration: 5 },
              { date: '2025-06-03', precipitation: 5, evapotranspiration: 4 }
            ]
          }
        }
      });
      
      assert(result.schedule);
      assert(result.waterSavings);
      assert(result.recommendations);
    });
    
    it('should optimize fertilizer usage', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'optimize_fertilizer_usage',
        payload: {
          fieldId: 'field-123',
          soilData: {
            nutrients: {
              nitrogen: 45,
              phosphorus: 32,
              potassium: 120
            },
            organicMatter: 3.2,
            ph: 6.5
          },
          cropData: {
            type: 'corn',
            growthStage: 'vegetative',
            expectedYield: 10
          }
        }
      });
      
      assert(result.recommendations);
      assert(result.applicationMap);
      assert(result.expectedBenefits);
    });
    
    it('should manage indoor resources', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'manage_indoor_resources',
        payload: {
          systemId: 'system-456',
          resourceType: 'nutrient_solution',
          action: 'adjust',
          parameters: {
            ec: { target: 1.8, tolerance: 0.1 },
            ph: { target: 6.0, tolerance: 0.2 },
            nutrients: {
              nitrogen: { increase: 10 },
              calcium: { decrease: 5 }
            }
          }
        }
      });
      
      assert.strictEqual(result.success, true);
      assert(result.adjustments);
      assert(result.newLevels);
      assert(result.recommendations);
    });
    
    it('should optimize urban resources', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'optimize_urban_resources',
        payload: {
          spaceId: 'space-789',
          resourceData: {
            water: {
              availability: 'limited',
              rainwaterHarvesting: true,
              storage: { capacity: 500, unit: 'liters' }
            },
            soil: {
              type: 'container_mix',
              volume: { value: 2000, unit: 'liters' }
            },
            compost: {
              available: true,
              capacity: { value: 100, unit: 'liters' }
            }
          },
          constraints: {
            budget: { value: 500, unit: 'USD' },
            labor: { hours: 10, frequency: 'weekly' }
          }
        }
      });
      
      assert(result.waterPlan);
      assert(result.soilManagementPlan);
      assert(result.compostingPlan);
      assert(result.resourceSavings);
    });
  });
  
  describe('Sustainability Integration', function() {
    it('should conduct sustainability assessments', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'conduct_sustainability_assessment',
        payload: {
          farmId: 'farm-123',
          farmData: {
            practices: {
              tillage: 'reduced',
              coverCrops: true,
              pestManagement: 'integrated',
              irrigation: 'drip'
            },
            inputs: {
              fertilizers: { synthetic: true, organic: true },
              pesticides: { synthetic: true, biological: true },
              energy: { sources: ['grid', 'solar'] }
            },
            outputs: {
              yield: { value: 9.8, unit: 'tons/hectare' },
              waste: { value: 5, unit: 'percent' }
            }
          },
          standard: 'general'
        }
      });
      
      assert(result.overallScore);
      assert(result.categories);
      assert(result.strengths);
      assert(result.improvementAreas);
      assert(result.recommendations);
    });
    
    it('should create urban sustainability plans', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'create_urban_sustainability_plan',
        payload: {
          spaceId: 'space-789',
          planData: {
            goals: {
              waterConservation: 'high',
              biodiversity: 'medium',
              wasteReduction: 'high'
            },
            constraints: {
              space: 'limited',
              budget: 'medium',
              expertise: 'beginner'
            },
            preferences: {
              aesthetics: 'important',
              maintenance: 'low',
              productivity: 'medium'
            }
          }
        }
      });
      
      assert(result.plan);
      assert(result.plan.waterConservation);
      assert(result.plan.biodiversityEnhancement);
      assert(result.plan.wasteManagement);
      assert(result.plan.implementation);
      assert(result.plan.monitoring);
    });
  });
  
  describe('Market Intelligence Integration', function() {
    it('should get market data', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'get_market_data',
        payload: {
          commodityId: 'corn',
          options: {
            region: 'global',
            timeframe: 'daily'
          }
        }
      });
      
      assert.strictEqual(result.commodity, 'corn');
      assert(result.price);
      assert(result.trend);
    });
    
    it('should generate price forecasts', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'generate_price_forecast',
        payload: {
          commodityId: 'corn',
          options: {
            region: 'global',
            horizon: '3m',
            interval: 'weekly'
          }
        }
      });
      
      assert.strictEqual(result.commodity, 'corn');
      assert(result.forecast);
      assert(result.factors);
    });
    
    it('should analyze urban markets', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'analyze_urban_market',
        payload: {
          productId: 'microgreens',
          urbanMarketData: {
            city: {
              name: 'New York',
              population: 8500000,
              demographics: {
                income: { median: 65000 },
                education: { college: 0.35 }
              }
            },
            market: {
              current: { size: 25000000 },
              growth: 0.12
            },
            competition: [
              { name: 'Urban Greens', share: 0.15 },
              { name: 'City Sprouts', share: 0.12 }
            ]
          }
        }
      });
      
      assert.strictEqual(result.product, 'microgreens');
      assert(result.marketSize);
      assert(result.segments);
      assert(result.opportunities);
    });
    
    it('should generate urban farming business plans', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'generate_urban_farming_business_plan',
        payload: {
          productId: 'microgreens',
          businessData: {
            concept: {
              type: 'vertical_farm',
              products: ['microgreens', 'herbs', 'edible_flowers'],
              scale: { size: 5000, unit: 'sq ft' }
            },
            location: {
              city: 'New York',
              area: 'Warehouse district'
            },
            market: {
              target: ['restaurants', 'specialty_retailers', 'direct_to_consumer'],
              size: 15000000
            }
          }
        }
      });
      
      assert(result.businessPlan);
      assert(result.businessPlan.executive_summary);
      assert(result.businessPlan.market_analysis);
      assert(result.businessPlan.operations);
      assert(result.businessPlan.marketing);
      assert(result.businessPlan.financials);
    });
  });
  
  describe('Cross-Component Integration', function() {
    it('should integrate crop health monitoring with resource optimization', async function() {
      // First, identify a disease
      const diseaseResult = await agricultureTentacle.handleRequest({
        command: 'identify_disease_from_image',
        payload: {
          imageData: 'base64encodedimage',
          options: { cropType: 'basil' }
        }
      });
      
      assert.strictEqual(diseaseResult.identified, true);
      
      // Then, generate a treatment plan
      const treatmentResult = await agricultureTentacle.handleRequest({
        command: 'generate_treatment_plan',
        payload: {
          fieldId: 'field-123',
          diagnosis: {
            disease: diseaseResult.disease.name,
            severity: 'moderate',
            coverage: 15
          },
          options: {
            approach: 'integrated',
            constraints: {
              organic: true
            }
          }
        }
      });
      
      assert(treatmentResult.plan);
      
      // Finally, optimize resource usage based on the treatment plan
      const resourceResult = await agricultureTentacle.handleRequest({
        command: 'optimize_water_usage',
        payload: {
          fieldId: 'field-123',
          usageData: {
            currentMoisture: 35,
            irrigationSystem: 'drip',
            efficiency: 0.9,
            treatmentPlan: treatmentResult.plan.id
          },
          weatherData: {
            forecast: [
              { date: '2025-06-02', precipitation: 0, evapotranspiration: 5 },
              { date: '2025-06-03', precipitation: 5, evapotranspiration: 4 }
            ]
          }
        }
      });
      
      assert(resourceResult.schedule);
      assert(resourceResult.adjustedForTreatment);
    });
    
    it('should integrate plant identification with urban farming optimization', async function() {
      // First, identify a plant
      const plantResult = await agricultureTentacle.handleRequest({
        command: 'identify_plant_from_image',
        payload: {
          imageData: 'base64encodedimage',
          options: { includeAlternatives: true }
        }
      });
      
      assert.strictEqual(plantResult.identified, true);
      assert.strictEqual(plantResult.plant.name, 'Basil');
      
      // Then, optimize urban space for this plant
      const optimizationResult = await agricultureTentacle.handleRequest({
        command: 'optimize_urban_space',
        payload: {
          spaceId: 'space-789',
          constraints: {
            weightLimit: { value: 150, unit: 'kg/sq_meter' },
            waterAvailability: 'limited',
            sunExposure: 'full'
          },
          goals: {
            production: 'maximize',
            waterUse: 'minimize',
            maintenance: 'minimize'
          },
          preferredCrops: [plantResult.plant.name]
        }
      });
      
      assert(optimizationResult.layout);
      assert(optimizationResult.cropPlan);
      assert(optimizationResult.cropPlan.crops.some(crop => crop.name === plantResult.plant.name));
    });
    
    it('should integrate market intelligence with sustainability planning', async function() {
      // First, get market trends
      const marketResult = await agricultureTentacle.handleRequest({
        command: 'get_market_trends',
        payload: {
          commodityId: 'corn',
          options: {
            region: 'global',
            period: '1y'
          }
        }
      });
      
      assert(marketResult.overall);
      
      // Then, create a sustainability plan that considers market trends
      const sustainabilityResult = await agricultureTentacle.handleRequest({
        command: 'conduct_sustainability_assessment',
        payload: {
          farmId: 'farm-123',
          farmData: {
            practices: {
              tillage: 'reduced',
              coverCrops: true,
              pestManagement: 'integrated',
              irrigation: 'drip'
            },
            inputs: {
              fertilizers: { synthetic: true, organic: true },
              pesticides: { synthetic: true, biological: true },
              energy: { sources: ['grid', 'solar'] }
            },
            outputs: {
              yield: { value: 9.8, unit: 'tons/hectare' },
              waste: { value: 5, unit: 'percent' }
            }
          },
          standard: 'general',
          marketTrends: marketResult
        }
      });
      
      assert(sustainabilityResult.overallScore);
      assert(sustainabilityResult.marketAligned);
      assert(sustainabilityResult.economicSustainability);
    });
  });
  
  describe('Error Handling', function() {
    it('should handle unknown commands gracefully', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'unknown_command',
        payload: {}
      });
      
      assert(result.error);
      assert(result.error.includes('Unknown command'));
    });
    
    it('should handle missing payload data gracefully', async function() {
      const result = await agricultureTentacle.handleRequest({
        command: 'get_agricultural_entity',
        payload: {}
      });
      
      assert(result.error);
    });
  });
  
  describe('Status Reporting', function() {
    it('should report tentacle status correctly', async function() {
      const status = await agricultureTentacle.getStatus();
      
      assert.strictEqual(status.name, 'AgricultureTentacle');
      assert.strictEqual(status.status, 'active');
      assert.strictEqual(status.components.length, 6);
      assert(status.timestamp);
    });
  });
});
