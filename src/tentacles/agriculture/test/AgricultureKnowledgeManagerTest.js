/**
 * @fileoverview Unit tests for the Agricultural Knowledge Manager component.
 * 
 * @module test/tentacles/agriculture/AgricultureKnowledgeManagerTest
 * @requires tentacles/agriculture/AgricultureKnowledgeManager
 */

const assert = require('assert');
const AgricultureKnowledgeManager = require('../AgricultureKnowledgeManager');

// Mock dependencies
const mockMemoryTentacle = {
  retrieveKnowledge: async (query) => {
    if (query.type === 'agriculture_entity' && query.id === 'crop-corn') {
      return {
        id: 'crop-corn',
        entityType: 'crop',
        name: 'Corn',
        scientificName: 'Zea mays',
        taxonomy: {
          category: 'grain',
          classification: 'annual'
        },
        properties: {
          daysToMaturity: { min: 60, max: 100 },
          planting_depth: { value: 1.5, unit: 'inches' }
        },
        lastUpdated: new Date('2025-05-15').getTime()
      };
    } else if (query.type === 'agriculture_region' && query.id === 'region-midwest') {
      return {
        id: 'region-midwest',
        name: 'Midwest',
        climate: {
          zone: 'Continental',
          averageTemperature: {
            annual: 10.5,
            monthly: [
              -5.5, -3.8, 2.2, 9.4, 15.6, 21.1, 
              23.3, 22.2, 17.8, 11.1, 3.3, -2.8
            ]
          },
          precipitation: {
            annual: 915,
            monthly: [
              45, 48, 65, 85, 110, 115,
              100, 95, 80, 70, 60, 50
            ]
          },
          growingDays: 180,
          firstFrostDate: { mean: '2025-10-15', stdDev: 12 },
          lastFrostDate: { mean: '2025-04-15', stdDev: 10 }
        },
        soil: {
          types: ['silt loam', 'clay loam'],
          properties: {
            ph: { min: 5.8, max: 7.2 },
            organicMatter: { min: 2.5, max: 4.0 }
          }
        }
      };
    }
    return null;
  },
  storeKnowledge: async () => true,
  searchKnowledge: async (query) => {
    if (query.type === 'agriculture_entity' && query.query.type === 'crop') {
      return [
        {
          id: 'crop-corn',
          entityType: 'crop',
          name: 'Corn',
          scientificName: 'Zea mays'
        },
        {
          id: 'crop-soybean',
          entityType: 'crop',
          name: 'Soybean',
          scientificName: 'Glycine max'
        }
      ];
    }
    return [];
  }
};

const mockWebTentacle = {
  fetchResource: async (request) => {
    if (request.type === 'agriculture_entity' && request.params.id === 'crop-wheat') {
      return {
        id: 'crop-wheat',
        entityType: 'crop',
        name: 'Wheat',
        scientificName: 'Triticum aestivum',
        taxonomy: {
          category: 'grain',
          classification: 'annual'
        },
        lastUpdated: new Date('2025-05-20').getTime()
      };
    } else if (request.type === 'climate_data' && request.params.region === 'region-southwest') {
      return {
        zone: 'Arid',
        averageTemperature: {
          annual: 18.5,
          monthly: [
            10.5, 12.8, 15.2, 19.4, 24.6, 29.1, 
            31.3, 30.2, 27.8, 22.1, 15.3, 11.8
          ]
        },
        precipitation: {
          annual: 255,
          monthly: [
            15, 18, 20, 15, 10, 5,
            20, 30, 25, 20, 15, 15
          ]
        },
        growingDays: 250,
        firstFrostDate: { mean: '2025-11-30', stdDev: 14 },
        lastFrostDate: { mean: '2025-02-15', stdDev: 10 }
      };
    }
    return null;
  },
  searchResource: async (request) => {
    if (request.type === 'agriculture_entity' && request.params.type === 'pest') {
      return [
        {
          id: 'pest-aphid',
          entityType: 'pest',
          name: 'Aphid',
          scientificName: 'Aphidoidea',
          taxonomy: {
            category: 'insect',
            classification: 'sucking'
          }
        },
        {
          id: 'pest-corn-borer',
          entityType: 'pest',
          name: 'European Corn Borer',
          scientificName: 'Ostrinia nubilalis',
          taxonomy: {
            category: 'insect',
            classification: 'boring'
          }
        }
      ];
    }
    return [];
  }
};

const mockOracleTentacle = {
  analyzeData: async () => ({ result: 'analysis' }),
  validateClaim: async () => ({ valid: true, confidence: 0.95 })
};

// Mock MIIF
global.MIIF = {
  executeModel: async (request) => {
    if (request.task === 'image_classification' && request.subtype === 'pest_disease_identification') {
      return {
        predictions: [
          {
            entityId: 'disease-rust',
            confidence: 0.92,
            boundingBox: { x: 120, y: 80, width: 60, height: 40 }
          },
          {
            entityId: 'disease-blight',
            confidence: 0.78,
            boundingBox: { x: 200, y: 150, width: 50, height: 30 }
          }
        ]
      };
    } else if (request.task === 'recommendation' && request.subtype === 'crop_recommendation') {
      return {
        recommendations: [
          {
            cropId: 'crop-corn',
            suitability: 0.95,
            reasons: ['Suitable climate', 'Optimal soil pH']
          },
          {
            cropId: 'crop-soybean',
            suitability: 0.88,
            reasons: ['Good rotation crop', 'Nitrogen fixing']
          }
        ]
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

describe('AgricultureKnowledgeManager', function() {
  let knowledgeManager;
  
  beforeEach(function() {
    knowledgeManager = new AgricultureKnowledgeManager({
      memoryTentacle: mockMemoryTentacle,
      webTentacle: mockWebTentacle,
      oracleTentacle: mockOracleTentacle
    });
  });
  
  describe('#getEntity()', function() {
    it('should retrieve entity from memory tentacle', async function() {
      const entity = await knowledgeManager.getEntity('crop-corn');
      assert.strictEqual(entity.id, 'crop-corn');
      assert.strictEqual(entity.name, 'Corn');
      assert.strictEqual(entity.scientificName, 'Zea mays');
    });
    
    it('should retrieve entity from web tentacle if not in memory', async function() {
      const entity = await knowledgeManager.getEntity('crop-wheat');
      assert.strictEqual(entity.id, 'crop-wheat');
      assert.strictEqual(entity.name, 'Wheat');
      assert.strictEqual(entity.scientificName, 'Triticum aestivum');
    });
    
    it('should return null for non-existent entity', async function() {
      const entity = await knowledgeManager.getEntity('crop-nonexistent');
      assert.strictEqual(entity, null);
    });
    
    it('should use cache for subsequent requests', async function() {
      // First request should go to memory tentacle
      await knowledgeManager.getEntity('crop-corn');
      
      // Modify mock to verify cache usage
      const originalRetrieve = mockMemoryTentacle.retrieveKnowledge;
      mockMemoryTentacle.retrieveKnowledge = async () => {
        throw new Error('Should use cache instead of calling memory tentacle');
      };
      
      try {
        // Second request should use cache
        const entity = await knowledgeManager.getEntity('crop-corn');
        assert.strictEqual(entity.id, 'crop-corn');
        assert.strictEqual(entity.name, 'Corn');
      } finally {
        // Restore original mock
        mockMemoryTentacle.retrieveKnowledge = originalRetrieve;
      }
    });
  });
  
  describe('#searchEntities()', function() {
    it('should search entities from memory tentacle', async function() {
      const results = await knowledgeManager.searchEntities({
        type: 'crop',
        term: 'corn'
      });
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].id, 'crop-corn');
      assert.strictEqual(results[1].id, 'crop-soybean');
    });
    
    it('should search entities from web tentacle if not in memory', async function() {
      // Modify mock to return empty results from memory
      const originalSearch = mockMemoryTentacle.searchKnowledge;
      mockMemoryTentacle.searchKnowledge = async () => [];
      
      try {
        const results = await knowledgeManager.searchEntities({
          type: 'pest',
          term: 'insect'
        });
        
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0].id, 'pest-aphid');
        assert.strictEqual(results[1].id, 'pest-corn-borer');
      } finally {
        // Restore original mock
        mockMemoryTentacle.searchKnowledge = originalSearch;
      }
    });
    
    it('should return empty array for no matches', async function() {
      // Modify mocks to return empty results
      const originalMemorySearch = mockMemoryTentacle.searchKnowledge;
      const originalWebSearch = mockWebTentacle.searchResource;
      
      mockMemoryTentacle.searchKnowledge = async () => [];
      mockWebTentacle.searchResource = async () => [];
      
      try {
        const results = await knowledgeManager.searchEntities({
          type: 'nonexistent',
          term: 'nothing'
        });
        
        assert.strictEqual(results.length, 0);
      } finally {
        // Restore original mocks
        mockMemoryTentacle.searchKnowledge = originalMemorySearch;
        mockWebTentacle.searchResource = originalWebSearch;
      }
    });
  });
  
  describe('#regionalConditionDatabase', function() {
    it('should get climate data for a region from memory', async function() {
      const climate = await knowledgeManager.regionalConditionDatabase.getClimateData('region-midwest');
      assert.strictEqual(climate.zone, 'Continental');
      assert.strictEqual(climate.growingDays, 180);
    });
    
    it('should get climate data for a region from web if not in memory', async function() {
      const climate = await knowledgeManager.regionalConditionDatabase.getClimateData('region-southwest');
      assert.strictEqual(climate.zone, 'Arid');
      assert.strictEqual(climate.growingDays, 250);
    });
    
    it('should get soil data for a region', async function() {
      const soil = await knowledgeManager.regionalConditionDatabase.getSoilData('region-midwest');
      assert.deepStrictEqual(soil.types, ['silt loam', 'clay loam']);
      assert.strictEqual(soil.properties.ph.min, 5.8);
    });
  });
  
  describe('#pestDiseaseIdentificationSystem', function() {
    it('should identify diseases from an image', async function() {
      const results = await knowledgeManager.pestDiseaseIdentificationSystem.identifyFromImage(
        Buffer.from('mock image data'),
        'crop-wheat'
      );
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].entityId, 'disease-rust');
      assert.strictEqual(results[0].confidence, 0.92);
    });
  });
  
  describe('#getCropRecommendations()', function() {
    it('should get crop recommendations for a region', async function() {
      const recommendations = await knowledgeManager.getCropRecommendations('region-midwest');
      
      assert.strictEqual(recommendations.length, 2);
      assert.strictEqual(recommendations[0].cropId, 'crop-corn');
      assert.strictEqual(recommendations[0].suitability, 0.95);
      assert.strictEqual(recommendations[1].cropId, 'crop-soybean');
      assert.strictEqual(recommendations[1].suitability, 0.88);
    });
  });
  
  describe('#preloadOfflineKnowledge()', function() {
    it('should preload knowledge for offline use', async function() {
      const stats = await knowledgeManager.preloadOfflineKnowledge({
        regions: ['region-midwest', 'region-southwest'],
        crops: ['crop-corn', 'crop-wheat']
      });
      
      assert.strictEqual(stats.regions, 2);
      assert.strictEqual(stats.entities, 2);
    });
  });
});
