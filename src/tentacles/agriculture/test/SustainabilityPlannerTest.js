/**
 * @fileoverview Unit tests for the Sustainability Planner component.
 * 
 * @module test/tentacles/agriculture/SustainabilityPlannerTest
 * @requires tentacles/agriculture/SustainabilityPlanner
 */

const assert = require('assert');
const SustainabilityPlanner = require('../SustainabilityPlanner');

// Mock dependencies
const mockAgricultureKnowledgeManager = {
  getEntity: async (entityId) => {
    if (entityId === 'practice-cover-crops') {
      return {
        id: 'practice-cover-crops',
        entityType: 'practice',
        name: 'Cover Crops',
        description: 'Growing specific plants to cover the soil rather than for harvest',
        benefits: [
          { type: 'soil_health', impact: 'high' },
          { type: 'erosion_control', impact: 'high' },
          { type: 'water_quality', impact: 'medium' },
          { type: 'carbon_sequestration', impact: 'medium' }
        ]
      };
    } else if (entityId === 'practice-no-till') {
      return {
        id: 'practice-no-till',
        entityType: 'practice',
        name: 'No-Till Farming',
        description: 'Minimal soil disturbance by planting directly into undisturbed soil',
        benefits: [
          { type: 'soil_health', impact: 'high' },
          { type: 'erosion_control', impact: 'high' },
          { type: 'carbon_sequestration', impact: 'high' },
          { type: 'fuel_reduction', impact: 'medium' }
        ]
      };
    }
    return null;
  }
};

const mockFileSystemTentacle = {
  readFile: async (request) => {
    if (request.path === 'agriculture/sustainability/assessments/sustainability-assessment-123.json') {
      return JSON.stringify({
        id: 'sustainability-assessment-123',
        farmId: 'farm-123',
        standard: 'SAFA',
        scores: {
          environmental: 0.75,
          economic: 0.80,
          social: 0.65,
          governance: 0.70
        }
      });
    } else if (request.path === 'agriculture/sustainability/carbon/carbon-footprint-123.json') {
      return JSON.stringify({
        id: 'carbon-footprint-123',
        farmId: 'farm-123',
        methodology: 'IPCC',
        totalEmissions: { value: 250, unit: 'tCO2e' },
        emissionsBySource: {
          energy: { value: 50, unit: 'tCO2e' },
          fertilizer: { value: 100, unit: 'tCO2e' },
          livestock: { value: 80, unit: 'tCO2e' },
          other: { value: 20, unit: 'tCO2e' }
        }
      });
    } else if (request.path === 'agriculture/urban/sustainability/urban-sustainability-plan-123.json') {
      return JSON.stringify({
        id: 'urban-sustainability-plan-123',
        space: 'space-123',
        name: 'Urban Rooftop Garden Sustainability Plan',
        goals: [
          { type: 'waste_reduction', target: { value: 50, unit: 'percent' } },
          { type: 'water_conservation', target: { value: 30, unit: 'percent' } }
        ]
      });
    }
    throw new Error('File not found');
  },
  writeFile: async () => true
};

const mockWebTentacle = {
  fetchResource: async (request) => {
    if (request.type === 'sustainability_standards') {
      return {
        standards: [
          { id: 'SAFA', name: 'SAFA', organization: 'FAO' },
          { id: 'GlobalGAP', name: 'GlobalG.A.P.', organization: 'GlobalG.A.P.' }
        ]
      };
    }
    return null;
  }
};

// Mock MIIF
global.MIIF = {
  executeModel: async (request) => {
    if (request.task === 'assessment' && request.subtype === 'sustainability') {
      return {
        assessment: {
          id: 'sustainability-assessment-new',
          standard: request.input.standard,
          scores: {
            environmental: 0.75,
            economic: 0.80,
            social: 0.65,
            governance: 0.70
          },
          details: {
            environmental: {
              biodiversity: { score: 0.70, findings: ['Good habitat diversity', 'Limited pesticide use'] },
              water: { score: 0.80, findings: ['Efficient irrigation', 'Good water quality management'] },
              soil: { score: 0.75, findings: ['Cover crops used', 'Limited erosion observed'] },
              atmosphere: { score: 0.75, findings: ['Reduced tillage', 'Some fossil fuel dependency'] }
            },
            economic: {
              investment: { score: 0.85, findings: ['Good equipment maintenance', 'Strategic investments'] },
              vulnerability: { score: 0.75, findings: ['Diverse income streams', 'Some market volatility risk'] }
            },
            social: {
              labor_rights: { score: 0.70, findings: ['Fair wages', 'Seasonal labor challenges'] },
              equity: { score: 0.60, findings: ['Gender balance needs improvement'] }
            },
            governance: {
              accountability: { score: 0.70, findings: ['Good record keeping', 'Limited stakeholder engagement'] }
            }
          },
          recommendations: [
            { category: 'environmental', action: 'Increase habitat corridors', priority: 'medium' },
            { category: 'social', action: 'Improve gender balance in management', priority: 'high' }
          ]
        }
      };
    } else if (request.task === 'calculation' && request.subtype === 'carbon_footprint') {
      return {
        footprint: {
          id: 'carbon-footprint-new',
          methodology: request.input.methodology,
          totalEmissions: { value: 250, unit: 'tCO2e' },
          emissionsBySource: {
            energy: { value: 50, unit: 'tCO2e' },
            fertilizer: { value: 100, unit: 'tCO2e' },
            livestock: { value: 80, unit: 'tCO2e' },
            other: { value: 20, unit: 'tCO2e' }
          },
          emissionsIntensity: { value: 2.5, unit: 'tCO2e/ha' },
          sequestration: { value: 30, unit: 'tCO2e' },
          netEmissions: { value: 220, unit: 'tCO2e' }
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'carbon_reduction') {
      return {
        strategies: [
          {
            category: 'energy',
            action: 'Convert irrigation pumps to solar power',
            potentialReduction: { value: 15, unit: 'tCO2e' },
            implementation: { difficulty: 'medium', cost: { value: 25000, currency: 'USD' } },
            cobenefits: ['Reduced operating costs', 'Energy independence']
          },
          {
            category: 'fertilizer',
            action: 'Implement precision fertilizer application',
            potentialReduction: { value: 20, unit: 'tCO2e' },
            implementation: { difficulty: 'medium', cost: { value: 15000, currency: 'USD' } },
            cobenefits: ['Reduced input costs', 'Improved water quality']
          },
          {
            category: 'soil',
            action: 'Increase cover crop usage',
            potentialReduction: { value: 25, unit: 'tCO2e' },
            implementation: { difficulty: 'low', cost: { value: 5000, currency: 'USD' } },
            cobenefits: ['Improved soil health', 'Reduced erosion']
          }
        ]
      };
    } else if (request.task === 'analysis' && request.subtype === 'biodiversity') {
      return {
        report: {
          id: 'biodiversity-report-new',
          indicators: {
            species_richness: {
              value: 45,
              benchmark: { average: 30, good: 40, excellent: 50 },
              trend: 'increasing'
            },
            habitat_diversity: {
              value: 6,
              benchmark: { average: 4, good: 6, excellent: 8 },
              trend: 'stable'
            },
            beneficial_insects: {
              value: 12,
              benchmark: { average: 8, good: 12, excellent: 15 },
              trend: 'increasing'
            },
            soil_biodiversity: {
              value: 'medium',
              trend: 'increasing'
            }
          },
          hotspots: [
            { type: 'positive', location: 'Field margins', description: 'High plant diversity supporting pollinators' },
            { type: 'concern', location: 'South field', description: 'Limited ground cover affecting soil organisms' }
          ],
          overallScore: 0.75,
          summary: 'Good biodiversity performance with positive trends in most indicators'
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'biodiversity_enhancement') {
      return {
        strategies: [
          {
            category: 'habitat',
            action: 'Install insect hotels',
            targetSpecies: ['Solitary bees', 'Beneficial wasps'],
            implementation: { difficulty: 'low', cost: { value: 500, currency: 'USD' } },
            expectedBenefits: ['Increased pollination', 'Natural pest control']
          },
          {
            category: 'corridors',
            action: 'Plant hedgerows along field boundaries',
            targetSpecies: ['Birds', 'Small mammals', 'Insects'],
            implementation: { difficulty: 'medium', cost: { value: 2000, currency: 'USD' } },
            expectedBenefits: ['Habitat connectivity', 'Wind protection', 'Erosion control']
          },
          {
            category: 'management',
            action: 'Implement rotational mowing in field margins',
            targetSpecies: ['Ground-nesting birds', 'Grassland insects'],
            implementation: { difficulty: 'low', cost: { value: 0, currency: 'USD' } },
            expectedBenefits: ['Extended flowering period', 'Undisturbed nesting sites']
          }
        ]
      };
    } else if (request.task === 'analysis' && request.subtype === 'water_quality_impact') {
      return {
        analysis: {
          runoff: {
            risk: 'medium',
            factors: ['Moderate slope', 'Good vegetation cover'],
            pollutants: [
              { type: 'sediment', risk: 'low', source: 'Field erosion' },
              { type: 'nitrogen', risk: 'medium', source: 'Fertilizer application' },
              { type: 'phosphorus', risk: 'medium', source: 'Fertilizer application' }
            ]
          },
          leaching: {
            risk: 'low',
            factors: ['Deep soil profile', 'Moderate rainfall'],
            pollutants: [
              { type: 'nitrate', risk: 'low', source: 'Fertilizer application' }
            ]
          },
          bufferZones: {
            effectiveness: 'high',
            width: { value: 10, unit: 'm' },
            vegetation: 'Mixed native grasses and shrubs'
          },
          overallRisk: 'low',
          recommendations: [
            'Maintain buffer zones',
            'Consider split fertilizer applications to reduce nitrogen runoff risk'
          ]
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'sustainable_practices') {
      return {
        recommendations: [
          {
            practice: 'cover_crops',
            suitability: 'high',
            benefits: [
              { type: 'soil_health', impact: 'high' },
              { type: 'erosion_control', impact: 'high' },
              { type: 'water_quality', impact: 'medium' }
            ],
            implementation: {
              difficulty: 'low',
              cost: { value: 100, unit: 'USD/ha' },
              timeline: 'Plant after harvest'
            }
          },
          {
            practice: 'crop_rotation',
            suitability: 'high',
            benefits: [
              { type: 'soil_health', impact: 'high' },
              { type: 'pest_management', impact: 'high' },
              { type: 'yield', impact: 'medium' }
            ],
            implementation: {
              difficulty: 'medium',
              cost: { value: 0, unit: 'USD/ha' },
              timeline: 'Plan for next growing season'
            }
          },
          {
            practice: 'precision_agriculture',
            suitability: 'medium',
            benefits: [
              { type: 'input_efficiency', impact: 'high' },
              { type: 'environmental_impact', impact: 'medium' },
              { type: 'profitability', impact: 'medium' }
            ],
            implementation: {
              difficulty: 'high',
              cost: { value: 15000, unit: 'USD' },
              timeline: 'Phased implementation over 2 years'
            }
          }
        ]
      };
    } else if (request.task === 'evaluation' && request.subtype === 'practice_impact') {
      return {
        evaluation: {
          practice: request.input.practice.id || 'unknown',
          environmentalImpact: {
            soil: { impact: 'positive', confidence: 'high' },
            water: { impact: 'positive', confidence: 'medium' },
            biodiversity: { impact: 'positive', confidence: 'medium' },
            climate: { impact: 'positive', confidence: 'high' }
          },
          economicImpact: {
            shortTerm: { impact: 'negative', confidence: 'medium' },
            longTerm: { impact: 'positive', confidence: 'high' },
            roi: { value: 2.5, timeframe: '3 years' }
          },
          socialImpact: {
            laborRequirements: { impact: 'neutral', confidence: 'high' },
            communityPerception: { impact: 'positive', confidence: 'medium' }
          },
          contextualFactors: [
            { factor: 'soil_type', influence: 'high' },
            { factor: 'climate', influence: 'medium' },
            { factor: 'farm_size', influence: 'low' }
          ],
          overallAssessment: 'Highly beneficial practice with strong long-term benefits despite short-term costs'
        }
      };
    } else if (request.task === 'recommendation' && request.subtype === 'urban_waste_reduction') {
      return {
        strategies: [
          {
            category: 'composting',
            action: 'Implement three-bin composting system',
            wasteTypes: ['Plant debris', 'Food scraps'],
            potentialReduction: { value: 80, unit: 'percent' },
            implementation: { difficulty: 'low', cost: { value: 200, currency: 'USD' } },
            benefits: ['Produces valuable soil amendment', 'Reduces landfill waste']
          },
          {
            category: 'reuse',
            action: 'Create seed starting containers from food packaging',
            wasteTypes: ['Plastic containers', 'Paper cartons'],
            potentialReduction: { value: 30, unit: 'percent' },
            implementation: { difficulty: 'low', cost: { value: 0, currency: 'USD' } },
            benefits: ['Reduces plastic waste', 'Saves money on garden supplies']
          },
          {
            category: 'water',
            action: 'Install rainwater harvesting system',
            wasteTypes: ['Runoff water'],
            potentialReduction: { value: 60, unit: 'percent' },
            implementation: { difficulty: 'medium', cost: { value: 300, currency: 'USD' } },
            benefits: ['Reduces water consumption', 'Prevents stormwater runoff']
          }
        ]
      };
    } else if (request.task === 'assessment' && request.subtype === 'community_impact') {
      return {
        assessment: {
          foodAccess: {
            impact: 'positive',
            details: 'Project provides fresh produce to 25 families in a food desert area',
            metrics: { beneficiaries: 25, produceValue: { value: 5000, currency: 'USD', period: 'year' } }
          },
          education: {
            impact: 'positive',
            details: 'Project hosts monthly workshops on urban agriculture',
            metrics: { workshopsHeld: 12, participants: 180 }
          },
          socialCohesion: {
            impact: 'positive',
            details: 'Project has created a community gathering space and volunteer opportunities',
            metrics: { volunteerHours: 520, events: 15 }
          },
          environmentalAwareness: {
            impact: 'positive',
            details: 'Project demonstrates sustainable practices to urban residents',
            metrics: { awarenessIncrease: { value: 40, unit: 'percent' } }
          },
          economicBenefits: {
            impact: 'neutral',
            details: 'Project creates limited part-time employment but significant skills development',
            metrics: { jobsCreated: 2, skillsTraining: 15 }
          },
          overallImpact: 'strongly_positive',
          recommendations: [
            'Expand educational programming to reach more community members',
            'Develop partnerships with local schools for field trips',
            'Create a formal volunteer program to increase community involvement'
          ]
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

describe('SustainabilityPlanner', function() {
  let sustainabilityPlanner;
  
  beforeEach(function() {
    sustainabilityPlanner = new SustainabilityPlanner({
      agricultureKnowledgeManager: mockAgricultureKnowledgeManager,
      fileSystemTentacle: mockFileSystemTentacle,
      webTentacle: mockWebTentacle
    });
  });
  
  describe('#assessmentSystem', function() {
    it('should conduct a sustainability assessment', async function() {
      const assessment = await sustainabilityPlanner.assessmentSystem.conductAssessment(
        'farm-123',
        {
          size: { value: 100, unit: 'ha' },
          crops: ['corn', 'soybeans', 'wheat'],
          practices: ['cover_crops', 'crop_rotation']
        },
        'SAFA'
      );
      
      assert.strictEqual(assessment.standard, 'SAFA');
      assert.strictEqual(assessment.farmId, 'farm-123');
      assert.strictEqual(assessment.scores.environmental, 0.75);
      assert.strictEqual(assessment.scores.economic, 0.80);
    });
    
    it('should get a sustainability assessment', async function() {
      const assessment = await sustainabilityPlanner.assessmentSystem.getAssessment('sustainability-assessment-123');
      
      assert.strictEqual(assessment.id, 'sustainability-assessment-123');
      assert.strictEqual(assessment.farmId, 'farm-123');
      assert.strictEqual(assessment.standard, 'SAFA');
    });
  });
  
  describe('#carbonFootprintCalculator', function() {
    it('should calculate carbon footprint', async function() {
      const footprint = await sustainabilityPlanner.carbonFootprintCalculator.calculateFootprint(
        'farm-123',
        {
          energy: {
            electricity: { value: 50000, unit: 'kWh' },
            diesel: { value: 5000, unit: 'L' }
          },
          fertilizer: {
            nitrogen: { value: 10000, unit: 'kg' }
          },
          livestock: {
            cattle: { count: 100 }
          }
        },
        'IPCC'
      );
      
      assert.strictEqual(footprint.methodology, 'IPCC');
      assert.strictEqual(footprint.farmId, 'farm-123');
      assert.strictEqual(footprint.totalEmissions.value, 250);
      assert.strictEqual(footprint.emissionsBySource.fertilizer.value, 100);
    });
    
    it('should get a carbon footprint', async function() {
      const footprint = await sustainabilityPlanner.carbonFootprintCalculator.getFootprint('carbon-footprint-123');
      
      assert.strictEqual(footprint.id, 'carbon-footprint-123');
      assert.strictEqual(footprint.farmId, 'farm-123');
      assert.strictEqual(footprint.methodology, 'IPCC');
    });
    
    it('should generate carbon reduction strategies', async function() {
      const strategies = await sustainabilityPlanner.carbonFootprintCalculator.generateReductionStrategies(
        'farm-123',
        {
          totalEmissions: { value: 250, unit: 'tCO2e' },
          emissionsBySource: {
            energy: { value: 50, unit: 'tCO2e' },
            fertilizer: { value: 100, unit: 'tCO2e' },
            livestock: { value: 80, unit: 'tCO2e' },
            other: { value: 20, unit: 'tCO2e' }
          }
        }
      );
      
      assert.strictEqual(strategies.length, 3);
      assert.strictEqual(strategies[0].category, 'energy');
      assert.strictEqual(strategies[0].action, 'Convert irrigation pumps to solar power');
      assert.strictEqual(strategies[0].potentialReduction.value, 15);
    });
  });
  
  describe('#biodiversityTracker', function() {
    it('should track biodiversity indicators', async function() {
      const report = await sustainabilityPlanner.biodiversityTracker.trackIndicators(
        'farm-123',
        {
          species: {
            plants: 25,
            birds: 12,
            insects: 30,
            mammals: 5
          },
          habitats: [
            { type: 'forest_edge', area: { value: 2, unit: 'ha' }, condition: 'good' },
            { type: 'wetland', area: { value: 1, unit: 'ha' }, condition: 'excellent' },
            { type: 'grassland', area: { value: 5, unit: 'ha' }, condition: 'good' }
          ],
          observations: [
            { type: 'beneficial_insect', species: 'Ladybug', count: 'abundant' },
            { type: 'pollinator', species: 'Honey bee', count: 'common' },
            { type: 'bird', species: 'Barn swallow', count: 'uncommon' }
          ]
        }
      );
      
      assert.strictEqual(report.farmId, 'farm-123');
      assert.strictEqual(report.indicators.species_richness.value, 45);
      assert.strictEqual(report.indicators.habitat_diversity.value, 6);
      assert.strictEqual(report.overallScore, 0.75);
    });
    
    it('should generate biodiversity enhancement strategies', async function() {
      const strategies = await sustainabilityPlanner.biodiversityTracker.generateEnhancementStrategies(
        'farm-123',
        {
          indicators: {
            species_richness: { value: 45, trend: 'increasing' },
            habitat_diversity: { value: 6, trend: 'stable' },
            beneficial_insects: { value: 12, trend: 'increasing' }
          },
          hotspots: [
            { type: 'positive', location: 'Field margins' },
            { type: 'concern', location: 'South field' }
          ]
        }
      );
      
      assert.strictEqual(strategies.length, 3);
      assert.strictEqual(strategies[0].category, 'habitat');
      assert.strictEqual(strategies[0].action, 'Install insect hotels');
      assert.strictEqual(strategies[1].category, 'corridors');
      assert.strictEqual(strategies[1].action, 'Plant hedgerows along field boundaries');
    });
  });
  
  describe('#waterStewardshipPlanner', function() {
    it('should create a water stewardship plan', async function() {
      const plan = await sustainabilityPlanner.waterStewardshipPlanner.createPlan(
        'farm-123',
        {
          watershed: 'Mississippi River Basin',
          waterSources: [
            { type: 'well', usage: { value: 50000, unit: 'm3/year' } },
            { type: 'pond', usage: { value: 20000, unit: 'm3/year' } }
          ],
          waterQualityTargets: {
            nitrate: { value: 10, unit: 'mg/L' },
            phosphate: { value: 0.1, unit: 'mg/L' }
          },
          waterConservationGoals: {
            reduction: { value: 20, unit: 'percent' },
            efficiency: { value: 85, unit: 'percent' }
          }
        }
      );
      
      assert.strictEqual(plan.farm, 'farm-123');
      assert.strictEqual(plan.watershed, 'Mississippi River Basin');
      assert.strictEqual(plan.waterSources.length, 2);
      assert.strictEqual(plan.waterConservationGoals.reduction.value, 20);
    });
    
    it('should analyze water quality impact', async function() {
      const analysis = await sustainabilityPlanner.waterStewardshipPlanner.analyzeWaterQualityImpact(
        'farm-123',
        {
          fertilizer: { application: 'split', timing: 'optimal' },
          tillage: 'reduced',
          bufferZones: { width: { value: 10, unit: 'm' }, vegetation: 'mixed' }
        },
        {
          name: 'Mississippi River Basin',
          sensitivity: 'medium',
          impairments: ['sediment', 'nutrients']
        }
      );
      
      assert.strictEqual(analysis.runoff.risk, 'medium');
      assert.strictEqual(analysis.leaching.risk, 'low');
      assert.strictEqual(analysis.bufferZones.effectiveness, 'high');
      assert.strictEqual(analysis.overallRisk, 'low');
    });
  });
  
  describe('#sustainablePracticeAdvisor', function() {
    it('should get sustainable practice recommendations', async function() {
      const recommendations = await sustainabilityPlanner.sustainablePracticeAdvisor.getRecommendations(
        'farm-123',
        {
          size: { value: 100, unit: 'ha' },
          crops: ['corn', 'soybeans', 'wheat'],
          soilType: 'loam',
          climate: 'temperate'
        },
        [
          { type: 'soil_health', priority: 'high' },
          { type: 'water_quality', priority: 'medium' },
          { type: 'profitability', priority: 'high' }
        ]
      );
      
      assert.strictEqual(recommendations.length, 3);
      assert.strictEqual(recommendations[0].practice, 'cover_crops');
      assert.strictEqual(recommendations[0].suitability, 'high');
      assert.strictEqual(recommendations[1].practice, 'crop_rotation');
      assert.strictEqual(recommendations[2].practice, 'precision_agriculture');
    });
    
    it('should evaluate practice impact', async function() {
      const evaluation = await sustainabilityPlanner.sustainablePracticeAdvisor.evaluatePracticeImpact(
        'practice-cover-crops',
        {
          farm: {
            size: { value: 100, unit: 'ha' },
            soilType: 'loam',
            climate: 'temperate'
          },
          economics: {
            laborCost: { value: 15, unit: 'USD/hour' },
            seedCost: { value: 50, unit: 'USD/ha' }
          }
        }
      );
      
      assert.strictEqual(evaluation.practice, 'practice-cover-crops');
      assert.strictEqual(evaluation.environmentalImpact.soil.impact, 'positive');
      assert.strictEqual(evaluation.economicImpact.shortTerm.impact, 'negative');
      assert.strictEqual(evaluation.economicImpact.longTerm.impact, 'positive');
    });
  });
  
  describe('#urbanSustainabilityModule', function() {
    it('should create an urban sustainability plan', async function() {
      const plan = await sustainabilityPlanner.urbanSustainabilityModule.createUrbanPlan(
        'space-123',
        {
          name: 'Urban Rooftop Garden Sustainability Plan',
          goals: [
            { type: 'waste_reduction', target: { value: 50, unit: 'percent' } },
            { type: 'water_conservation', target: { value: 30, unit: 'percent' } }
          ],
          wasteManagement: {
            composting: true,
            recycling: true
          },
          waterConservation: {
            rainwaterHarvesting: true,
            drip_irrigation: true
          }
        }
      );
      
      assert.strictEqual(plan.space, 'space-123');
      assert.strictEqual(plan.name, 'Urban Rooftop Garden Sustainability Plan');
      assert.strictEqual(plan.goals.length, 2);
      assert.strictEqual(plan.goals[0].type, 'waste_reduction');
    });
    
    it('should get an urban sustainability plan', async function() {
      const plan = await sustainabilityPlanner.urbanSustainabilityModule.getUrbanPlan('urban-sustainability-plan-123');
      
      assert.strictEqual(plan.id, 'urban-sustainability-plan-123');
      assert.strictEqual(plan.space, 'space-123');
      assert.strictEqual(plan.name, 'Urban Rooftop Garden Sustainability Plan');
    });
    
    it('should generate urban waste reduction strategies', async function() {
      const strategies = await sustainabilityPlanner.urbanSustainabilityModule.generateWasteReductionStrategies(
        'space-123',
        {
          types: [
            { type: 'plant_debris', amount: { value: 50, unit: 'kg/month' } },
            { type: 'food_scraps', amount: { value: 20, unit: 'kg/month' } },
            { type: 'packaging', amount: { value: 10, unit: 'kg/month' } }
          ],
          currentManagement: {
            composting: 'partial',
            recycling: 'yes',
            landfill: 'yes'
          }
        }
      );
      
      assert.strictEqual(strategies.length, 3);
      assert.strictEqual(strategies[0].category, 'composting');
      assert.strictEqual(strategies[0].action, 'Implement three-bin composting system');
      assert.strictEqual(strategies[1].category, 'reuse');
      assert.strictEqual(strategies[2].category, 'water');
    });
    
    it('should assess community impact of urban farming', async function() {
      const assessment = await sustainabilityPlanner.urbanSustainabilityModule.assessCommunityImpact(
        'space-123',
        {
          type: 'community_garden',
          size: { value: 0.5, unit: 'ha' },
          participants: 30,
          activities: ['food_production', 'education', 'community_events'],
          location: {
            neighborhood: 'downtown',
            foodAccessStatus: 'low_access'
          }
        }
      );
      
      assert.strictEqual(assessment.foodAccess.impact, 'positive');
      assert.strictEqual(assessment.education.impact, 'positive');
      assert.strictEqual(assessment.socialCohesion.impact, 'positive');
      assert.strictEqual(assessment.overallImpact, 'strongly_positive');
    });
  });
});
