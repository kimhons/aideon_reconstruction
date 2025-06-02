/**
 * @fileoverview Unit tests for the Resource Optimization System component.
 * 
 * @module test/tentacles/agriculture/ResourceOptimizationSystemTest
 * @requires tentacles/agriculture/ResourceOptimizationSystem
 */

const assert = require('assert');
const ResourceOptimizationSystem = require('../ResourceOptimizationSystem');

// Mock dependencies
const mockAgricultureKnowledgeManager = {
  getEntity: async (entityId) => {
    if (entityId === 'crop-tomato') {
      return {
        id: 'crop-tomato',
        entityType: 'crop',
        name: 'Tomato',
        scientificName: 'Solanum lycopersicum',
        waterRequirements: {
          optimal: { value: 25, unit: 'mm/week' },
          minimum: { value: 15, unit: 'mm/week' },
          maximum: { value: 35, unit: 'mm/week' }
        },
        nutrientRequirements: {
          nitrogen: { value: 150, unit: 'kg/ha' },
          phosphorus: { value: 50, unit: 'kg/ha' },
          potassium: { value: 200, unit: 'kg/ha' }
        }
      };
    } else if (entityId === 'crop-lettuce') {
      return {
        id: 'crop-lettuce',
        entityType: 'crop',
        name: 'Lettuce',
        scientificName: 'Lactuca sativa',
        waterRequirements: {
          optimal: { value: 15, unit: 'mm/week' },
          minimum: { value: 10, unit: 'mm/week' },
          maximum: { value: 25, unit: 'mm/week' }
        },
        nutrientRequirements: {
          nitrogen: { value: 100, unit: 'kg/ha' },
          phosphorus: { value: 30, unit: 'kg/ha' },
          potassium: { value: 150, unit: 'kg/ha' }
        }
      };
    }
    return null;
  }
};

const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path === 'agriculture/water/irrigation-plan-123.json') {
      return JSON.stringify({
        id: 'irrigation-plan-123',
        field: 'field-123',
        crop: 'crop-tomato',
        irrigationType: 'drip',
        waterBudget: { value: 25, unit: 'mm/week' }
      });
    } else if (request.path === 'agriculture/fertilizer/fertilizer-plan-123.json') {
      return JSON.stringify({
        id: 'fertilizer-plan-123',
        field: 'field-123',
        crop: 'crop-tomato',
        totalNutrients: {
          nitrogen: { value: 150, unit: 'kg/ha' },
          phosphorus: { value: 50, unit: 'kg/ha' },
          potassium: { value: 200, unit: 'kg/ha' }
        }
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
    if (request.task === 'recommendation' && request.subtype === 'irrigation') {
      return {
        recommendations: [
          {
            type: 'schedule',
            frequency: 'daily',
            amount: { value: 5, unit: 'mm' },
            timing: 'early_morning',
            confidence: 0.85
          },
          {
            type: 'schedule',
            frequency: 'every_other_day',
            amount: { value: 10, unit: 'mm' },
            timing: 'early_morning',
            confidence: 0.75
          }
        ]
      };
    } else if (request.task === 'calculation' && request.subtype === 'water_requirements') {
      return {
        requirements: {
          daily: { value: 3.5, unit: 'mm' },
          weekly: { value: 24.5, unit: 'mm' },
          total: { value: 350, unit: 'mm' },
          adjustmentFactor: 0.85
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'fertilizer') {
      return {
        recommendations: [
          {
            nutrient: 'nitrogen',
            amount: { value: 150, unit: 'kg/ha' },
            timing: 'split',
            applications: [
              { stage: 'planting', percentage: 30 },
              { stage: 'vegetative', percentage: 40 },
              { stage: 'flowering', percentage: 30 }
            ]
          },
          {
            nutrient: 'phosphorus',
            amount: { value: 50, unit: 'kg/ha' },
            timing: 'single',
            applications: [
              { stage: 'planting', percentage: 100 }
            ]
          }
        ]
      };
    } else if (request.task === 'map_generation' && request.subtype === 'variable_rate_fertilizer') {
      return {
        maps: [
          {
            nutrient: 'nitrogen',
            zones: [
              { id: 'zone-1', rate: { value: 180, unit: 'kg/ha' }, area: { value: 5, unit: 'ha' } },
              { id: 'zone-2', rate: { value: 150, unit: 'kg/ha' }, area: { value: 10, unit: 'ha' } },
              { id: 'zone-3', rate: { value: 120, unit: 'kg/ha' }, area: { value: 5, unit: 'ha' } }
            ],
            format: 'geojson',
            url: 'https://example.com/maps/nitrogen-map-123.geojson'
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'energy_efficiency') {
      return {
        recommendations: [
          {
            type: 'operational',
            action: 'Adjust tractor gear settings',
            potentialSavings: { value: 15, unit: 'percent' },
            implementation: 'immediate',
            cost: { value: 0, currency: 'USD' }
          },
          {
            type: 'equipment',
            action: 'Replace irrigation pump',
            potentialSavings: { value: 25, unit: 'percent' },
            implementation: 'long_term',
            cost: { value: 2500, currency: 'USD' }
          }
        ]
      };
    } else if (request.task === 'optimization' && request.subtype === 'labor_scheduling') {
      return {
        schedule: {
          tasks: [
            {
              id: 'task-1',
              name: 'Planting',
              assignedResources: ['worker-1', 'worker-2'],
              startDate: '2025-06-01',
              endDate: '2025-06-03',
              status: 'scheduled'
            },
            {
              id: 'task-2',
              name: 'Fertilizer Application',
              assignedResources: ['worker-3', 'equipment-1'],
              startDate: '2025-06-05',
              endDate: '2025-06-05',
              status: 'scheduled'
            }
          ],
          conflicts: [],
          utilization: { value: 85, unit: 'percent' }
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'equipment_routing') {
      return {
        routing: {
          routes: [
            {
              equipmentId: 'tractor-1',
              tasks: ['field-1-plowing', 'field-2-plowing'],
              sequence: [
                { taskId: 'field-1-plowing', startTime: '08:00', endTime: '10:00' },
                { taskId: 'field-2-plowing', startTime: '10:30', endTime: '12:30' }
              ],
              distance: { value: 5.2, unit: 'km' },
              fuelUsage: { value: 25, unit: 'L' }
            }
          ],
          totalDistance: { value: 5.2, unit: 'km' },
          totalFuelUsage: { value: 25, unit: 'L' },
          efficiency: { value: 90, unit: 'percent' }
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'indoor_water') {
      return {
        optimization: {
          schedule: [
            {
              time: '08:00',
              duration: { value: 5, unit: 'minutes' },
              volume: { value: 2, unit: 'L' },
              zones: ['zone-1', 'zone-2']
            },
            {
              time: '18:00',
              duration: { value: 5, unit: 'minutes' },
              volume: { value: 2, unit: 'L' },
              zones: ['zone-1', 'zone-2']
            }
          ],
          totalDailyUsage: { value: 4, unit: 'L' },
          efficiency: { value: 95, unit: 'percent' },
          recommendations: [
            'Use drip irrigation for precise water delivery',
            'Install moisture sensors to trigger irrigation only when needed'
          ]
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'nutrient_recipe') {
      return {
        recipe: {
          baseNutrients: [
            { name: 'Calcium Nitrate', amount: { value: 1.0, unit: 'g/L' } },
            { name: 'Masterblend 4-18-38', amount: { value: 2.4, unit: 'g/L' } },
            { name: 'Magnesium Sulfate', amount: { value: 1.2, unit: 'g/L' } }
          ],
          supplements: [
            { name: 'Iron Chelate', amount: { value: 0.1, unit: 'g/L' } }
          ],
          targetEC: { value: 1.8, unit: 'mS/cm' },
          targetPH: { value: 6.0, unit: 'pH' },
          adjustments: [
            { condition: 'If pH > 6.5', action: 'Add pH down solution at 1ml/L' },
            { condition: 'If pH < 5.5', action: 'Add pH up solution at 1ml/L' }
          ]
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'lighting_schedule') {
      return {
        schedule: {
          dailyHours: { value: 16, unit: 'hours' },
          onPeriod: { start: '06:00', end: '22:00' },
          intensity: [
            { time: '06:00', level: { value: 60, unit: 'percent' } },
            { time: '10:00', level: { value: 100, unit: 'percent' } },
            { time: '18:00', level: { value: 80, unit: 'percent' } },
            { time: '21:00', level: { value: 40, unit: 'percent' } }
          ],
          spectrum: { red: 60, blue: 30, white: 10 },
          energyUsage: { value: 3.2, unit: 'kWh/day' },
          costEstimate: { value: 0.48, currency: 'USD', period: 'day' }
        }
      };
    } else if (request.task === 'optimization' && request.subtype === 'urban_water') {
      return {
        optimization: {
          schedule: [
            {
              time: '07:00',
              duration: { value: 3, unit: 'minutes' },
              volume: { value: 1, unit: 'L' },
              containers: ['container-1', 'container-2']
            },
            {
              time: '19:00',
              duration: { value: 3, unit: 'minutes' },
              volume: { value: 1, unit: 'L' },
              containers: ['container-1', 'container-2']
            }
          ],
          totalDailyUsage: { value: 2, unit: 'L' },
          rainwaterHarvesting: {
            potential: { value: 10, unit: 'L/week' },
            storageRecommendation: { value: 50, unit: 'L' }
          },
          recommendations: [
            'Use self-watering containers to reduce frequency',
            'Apply mulch to reduce evaporation',
            'Group plants with similar water needs'
          ]
        }
      };
    } else if (request.task === 'planning' && request.subtype === 'urban_composting') {
      return {
        plan: {
          system: {
            type: 'tumbler',
            size: { value: 80, unit: 'L' },
            location: 'balcony',
            dimensions: { width: 50, depth: 50, height: 80, unit: 'cm' }
          },
          inputs: [
            { type: 'kitchen_scraps', amount: { value: 2, unit: 'L/day' } },
            { type: 'coffee_grounds', amount: { value: 0.5, unit: 'L/day' } },
            { type: 'dry_leaves', amount: { value: 2, unit: 'L/week' } }
          ],
          process: {
            turnFrequency: 'every_3_days',
            moistureManagement: 'add_dry_material_if_too_wet',
            timeToCompletion: { value: 6, unit: 'weeks' }
          },
          output: {
            compost: { value: 15, unit: 'L/month' },
            nutrientContent: { nitrogen: 'medium', phosphorus: 'medium', potassium: 'medium' }
          },
          recommendations: [
            'Keep a small container in kitchen for daily collection',
            'Balance green and brown materials (1:2 ratio)',
            'Monitor moisture - should feel like a wrung-out sponge'
          ]
        }
      };
    }
    return null;
  }
};

// Mock HSTIS
global.HSTIS = {
  collectData: async (request) => {
    if (request.type === 'soil_moisture_sensors' && request.filter.field === 'field-123') {
      return [
        {
          deviceId: 'sensor-001',
          location: { lat: 40.123, lng: -75.456 },
          depth: { value: 10, unit: 'cm' },
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            moisture: 22.5,
            temperature: 18.2
          }
        },
        {
          deviceId: 'sensor-002',
          location: { lat: 40.124, lng: -75.457 },
          depth: { value: 10, unit: 'cm' },
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            moisture: 24.3,
            temperature: 18.0
          }
        }
      ];
    } else if (request.type === 'indoor_resource_sensors' && request.filter.system === 'system-123') {
      return [
        {
          deviceId: 'sensor-001',
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            water_level: 80,
            water_temperature: 22,
            water_ph: 6.2,
            water_ec: 1.8
          }
        },
        {
          deviceId: 'sensor-002',
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            nutrient_nitrogen: 150,
            nutrient_phosphorus: 50,
            nutrient_potassium: 200
          }
        },
        {
          deviceId: 'sensor-003',
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            energy_consumption: 2.5,
            energy_voltage: 120
          }
        },
        {
          deviceId: 'sensor-004',
          timestamp: Date.now() - 3600000, // 1 hour ago
          readings: {
            co2_level: 800
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

describe('ResourceOptimizationSystem', function() {
  let resourceOptimizer;
  
  beforeEach(function() {
    resourceOptimizer = new ResourceOptimizationSystem({
      agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle
    });
  });
  
  describe('#waterManagementSystem', function() {
    it('should create an irrigation plan', async function() {
      const plan = await resourceOptimizer.waterManagementSystem.createIrrigationPlan('field-123', {
        cropId: 'crop-tomato',
        irrigationType: 'drip',
        waterBudget: { value: 25, unit: 'mm' }
      });
      
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.crop, 'crop-tomato');
      assert.strictEqual(plan.irrigationType, 'drip');
      assert.strictEqual(plan.waterBudget.value, 25);
    });
    
    it('should get an irrigation plan', async function() {
      const plan = await resourceOptimizer.waterManagementSystem.getIrrigationPlan('irrigation-plan-123');
      
      assert.strictEqual(plan.id, 'irrigation-plan-123');
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.crop, 'crop-tomato');
    });
    
    it('should generate irrigation recommendations', async function() {
      const recommendations = await resourceOptimizer.waterManagementSystem.generateIrrigationRecommendations(
        'field-123',
        'crop-tomato',
        { soilMoisture: 22.5, temperature: 25, precipitation: 0 }
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].type, 'schedule');
      assert.strictEqual(recommendations[0].frequency, 'daily');
    });
    
    it('should calculate water requirements', async function() {
      const requirements = await resourceOptimizer.waterManagementSystem.calculateWaterRequirements(
        'crop-tomato',
        { area: { value: 10, unit: 'ha' } },
        { temperature: 25, precipitation: 0 }
      );
      
      assert.strictEqual(requirements.daily.value, 3.5);
      assert.strictEqual(requirements.weekly.value, 24.5);
    });
    
    it('should monitor soil moisture', async function() {
      const moistureData = await resourceOptimizer.waterManagementSystem.monitorSoilMoisture('field-123');
      
      assert.strictEqual(moistureData.field, 'field-123');
      assert.strictEqual(moistureData.readings.length, 2);
      assert.strictEqual(moistureData.average, 23.4);
    });
  });
  
  describe('#fertilizerOptimizer', function() {
    it('should create a fertilizer plan', async function() {
      const plan = await resourceOptimizer.fertilizerOptimizer.createFertilizerPlan('field-123', {
        cropId: 'crop-tomato',
        totalNutrients: {
          nitrogen: { value: 150, unit: 'kg/ha' },
          phosphorus: { value: 50, unit: 'kg/ha' },
          potassium: { value: 200, unit: 'kg/ha' }
        }
      });
      
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.crop, 'crop-tomato');
      assert.strictEqual(plan.totalNutrients.nitrogen.value, 150);
    });
    
    it('should get a fertilizer plan', async function() {
      const plan = await resourceOptimizer.fertilizerOptimizer.getFertilizerPlan('fertilizer-plan-123');
      
      assert.strictEqual(plan.id, 'fertilizer-plan-123');
      assert.strictEqual(plan.field, 'field-123');
      assert.strictEqual(plan.crop, 'crop-tomato');
    });
    
    it('should generate fertilizer recommendations', async function() {
      const recommendations = await resourceOptimizer.fertilizerOptimizer.generateFertilizerRecommendations(
        'field-123',
        'crop-tomato',
        {
          nitrogen: { value: 20, unit: 'ppm' },
          phosphorus: { value: 10, unit: 'ppm' },
          potassium: { value: 150, unit: 'ppm' }
        },
        { value: 10, unit: 't/ha' }
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].nutrient, 'nitrogen');
      assert.strictEqual(recommendations[0].amount.value, 150);
    });
    
    it('should generate variable rate maps', async function() {
      const maps = await resourceOptimizer.fertilizerOptimizer.generateVariableRateMaps(
        'field-123',
        'crop-tomato',
        {
          zones: [
            { id: 'zone-1', nitrogen: 20, phosphorus: 10, potassium: 150 },
            { id: 'zone-2', nitrogen: 25, phosphorus: 15, potassium: 180 }
          ]
        }
      );
      
      assert.strictEqual(maps.length, 1);
      assert.strictEqual(maps[0].nutrient, 'nitrogen');
      assert.strictEqual(maps[0].zones.length, 3);
    });
  });
  
  describe('#energyEfficiencyManager', function() {
    it('should track energy usage', async function() {
      const usage = await resourceOptimizer.energyEfficiencyManager.trackEnergyUsage('farm-123', {
        sources: [
          { type: 'electricity', amount: { value: 500, unit: 'kWh' } },
          { type: 'diesel', amount: { value: 200, unit: 'L' } }
        ],
        totalConsumption: { value: 500, unit: 'kWh' },
        cost: { value: 100, currency: 'USD' }
      });
      
      assert.strictEqual(usage.farm, 'farm-123');
      assert.strictEqual(usage.sources.length, 2);
      assert.strictEqual(usage.totalConsumption.value, 500);
    });
    
    it('should generate energy efficiency recommendations', async function() {
      const recommendations = await resourceOptimizer.energyEfficiencyManager.generateEfficiencyRecommendations(
        'farm-123',
        [
          {
            id: 'energy-usage-1',
            period: { start: '2025-05-01', end: '2025-05-31' },
            totalConsumption: { value: 5000, unit: 'kWh' }
          },
          {
            id: 'energy-usage-2',
            period: { start: '2025-04-01', end: '2025-04-30' },
            totalConsumption: { value: 4800, unit: 'kWh' }
          }
        ]
      );
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].type, 'operational');
      assert.strictEqual(recommendations[0].potentialSavings.value, 15);
    });
  });
  
  describe('#laborOptimizationSystem', function() {
    it('should create a labor plan', async function() {
      const plan = await resourceOptimizer.laborOptimizationSystem.createLaborPlan('farm-123', {
        tasks: [
          { id: 'task-1', name: 'Planting', duration: { value: 3, unit: 'days' } },
          { id: 'task-2', name: 'Fertilizer Application', duration: { value: 1, unit: 'day' } }
        ],
        resources: [
          { id: 'worker-1', name: 'John Doe', type: 'worker' },
          { id: 'worker-2', name: 'Jane Smith', type: 'worker' }
        ]
      });
      
      assert.strictEqual(plan.farm, 'farm-123');
      assert.strictEqual(plan.tasks.length, 2);
      assert.strictEqual(plan.resources.length, 2);
    });
    
    it('should optimize task scheduling', async function() {
      const schedule = await resourceOptimizer.laborOptimizationSystem.optimizeTaskScheduling(
        'farm-123',
        [
          { id: 'task-1', name: 'Planting', duration: { value: 3, unit: 'days' } },
          { id: 'task-2', name: 'Fertilizer Application', duration: { value: 1, unit: 'day' } }
        ],
        [
          { id: 'worker-1', name: 'John Doe', type: 'worker' },
          { id: 'worker-2', name: 'Jane Smith', type: 'worker' },
          { id: 'worker-3', name: 'Bob Johnson', type: 'worker' },
          { id: 'equipment-1', name: 'Tractor', type: 'equipment' }
        ],
        {
          startDate: '2025-06-01',
          endDate: '2025-06-10',
          dependencies: [
            { predecessor: 'task-1', successor: 'task-2', type: 'finish_to_start' }
          ]
        }
      );
      
      assert.strictEqual(schedule.tasks.length, 2);
      assert.strictEqual(schedule.tasks[0].name, 'Planting');
      assert.strictEqual(schedule.tasks[0].assignedResources.length, 2);
    });
  });
  
  describe('#equipmentUtilizationTracker', function() {
    it('should create an equipment schedule', async function() {
      const schedule = await resourceOptimizer.equipmentUtilizationTracker.createEquipmentSchedule('farm-123', {
        equipment: [
          { id: 'tractor-1', name: 'John Deere 5100M', type: 'tractor' },
          { id: 'sprayer-1', name: 'Boom Sprayer', type: 'sprayer' }
        ],
        assignments: [
          { equipmentId: 'tractor-1', taskId: 'field-1-plowing', startTime: '2025-06-01 08:00', endTime: '2025-06-01 12:00' },
          { equipmentId: 'sprayer-1', taskId: 'field-1-spraying', startTime: '2025-06-02 08:00', endTime: '2025-06-02 10:00' }
        ]
      });
      
      assert.strictEqual(schedule.farm, 'farm-123');
      assert.strictEqual(schedule.equipment.length, 2);
      assert.strictEqual(schedule.assignments.length, 2);
    });
    
    it('should optimize equipment routing', async function() {
      const routing = await resourceOptimizer.equipmentUtilizationTracker.optimizeEquipmentRouting(
        'farm-123',
        [
          { id: 'tractor-1', name: 'John Deere 5100M', type: 'tractor' }
        ],
        [
          { id: 'field-1-plowing', field: 'field-1', operation: 'plowing', duration: { value: 2, unit: 'hours' } },
          { id: 'field-2-plowing', field: 'field-2', operation: 'plowing', duration: { value: 2, unit: 'hours' } }
        ],
        {
          startTime: '08:00',
          endTime: '17:00',
          fieldLocations: {
            'field-1': { lat: 40.123, lng: -75.456 },
            'field-2': { lat: 40.128, lng: -75.460 }
          }
        }
      );
      
      assert.strictEqual(routing.routes.length, 1);
      assert.strictEqual(routing.routes[0].equipmentId, 'tractor-1');
      assert.strictEqual(routing.routes[0].tasks.length, 2);
    });
  });
  
  describe('#indoorResourceManager', function() {
    it('should create an indoor resource plan', async function() {
      const plan = await resourceOptimizer.indoorResourceManager.createResourcePlan('system-123', {
        name: 'Hydroponic System Resource Plan',
        water: {
          daily: { value: 10, unit: 'L' },
          ph: { target: 6.0, range: 0.5 },
          ec: { target: 1.8, range: 0.2 }
        },
        nutrients: {
          solution: 'masterblend',
          concentration: { value: 2.4, unit: 'g/L' }
        },
        energy: {
          lighting: { daily: { value: 2.5, unit: 'kWh' } },
          pumps: { daily: { value: 0.5, unit: 'kWh' } }
        }
      });
      
      assert.strictEqual(plan.system, 'system-123');
      assert.strictEqual(plan.name, 'Hydroponic System Resource Plan');
      assert.strictEqual(plan.water.daily.value, 10);
    });
    
    it('should optimize water usage for indoor system', async function() {
      const optimization = await resourceOptimizer.indoorResourceManager.optimizeWaterUsage(
        'system-123',
        ['crop-lettuce', 'crop-tomato'],
        {
          temperature: 24,
          humidity: 60,
          lightIntensity: 600
        }
      );
      
      assert.strictEqual(optimization.schedule.length, 2);
      assert.strictEqual(optimization.totalDailyUsage.value, 4);
      assert.strictEqual(optimization.efficiency.value, 95);
    });
    
    it('should generate nutrient solution recipe', async function() {
      const recipe = await resourceOptimizer.indoorResourceManager.generateNutrientRecipe(
        'system-123',
        ['crop-lettuce', 'crop-tomato'],
        {
          ph: 7.2,
          hardness: 180,
          tds: 120
        }
      );
      
      assert.strictEqual(recipe.baseNutrients.length, 3);
      assert.strictEqual(recipe.supplements.length, 1);
      assert.strictEqual(recipe.targetEC.value, 1.8);
    });
    
    it('should optimize lighting schedule', async function() {
      const schedule = await resourceOptimizer.indoorResourceManager.optimizeLightingSchedule(
        'system-123',
        ['crop-lettuce', 'crop-tomato'],
        {
          maxDailyUsage: { value: 4, unit: 'kWh' },
          costPerKwh: { value: 0.15, currency: 'USD' }
        }
      );
      
      assert.strictEqual(schedule.dailyHours.value, 16);
      assert.strictEqual(schedule.intensity.length, 4);
      assert.strictEqual(schedule.energyUsage.value, 3.2);
    });
    
    it('should monitor resource consumption', async function() {
      const consumption = await resourceOptimizer.indoorResourceManager.monitorResourceConsumption('system-123');
      
      assert.strictEqual(consumption.system, 'system-123');
      assert.strictEqual(consumption.water.level.value, 80);
      assert.strictEqual(consumption.nutrients.nitrogen.value, 150);
      assert.strictEqual(consumption.energy.consumption.value, 2.5);
    });
  });
  
  describe('#urbanResourceOptimizer', function() {
    it('should optimize water usage for urban farming', async function() {
      const optimization = await resourceOptimizer.urbanResourceOptimizer.optimizeUrbanWaterUsage(
        'space-123',
        ['crop-lettuce', 'crop-tomato'],
        {
          containerCount: 10,
          containerVolume: { value: 20, unit: 'L' },
          waterAvailability: { value: 5, unit: 'L/day' }
        }
      );
      
      assert.strictEqual(optimization.schedule.length, 2);
      assert.strictEqual(optimization.totalDailyUsage.value, 2);
      assert.strictEqual(optimization.recommendations.length, 3);
    });
    
    it('should generate urban composting plan', async function() {
      const plan = await resourceOptimizer.urbanResourceOptimizer.generateCompostingPlan(
        'space-123',
        {
          kitchenScraps: { value: 2, unit: 'L/day' },
          coffeeGrounds: { value: 0.5, unit: 'L/day' },
          dryLeaves: { value: 2, unit: 'L/week' }
        },
        {
          availableSpace: { width: 60, depth: 60, height: 100, unit: 'cm' },
          location: 'balcony',
          budget: { value: 100, currency: 'USD' }
        }
      );
      
      assert.strictEqual(plan.system.type, 'tumbler');
      assert.strictEqual(plan.inputs.length, 3);
      assert.strictEqual(plan.output.compost.value, 15);
    });
  });
});
