/**
 * @fileoverview Modified AgricultureKnowledgeManager for testing purposes.
 * This version removes external dependencies to allow for proper testing.
 * 
 * @module test/mocks/AgricultureKnowledgeManager
 */

/**
 * Mock AgricultureKnowledgeManager for testing
 */
class MockAgricultureKnowledgeManager {
  /**
   * Create a new MockAgricultureKnowledgeManager
   * @param {Object} dependencies - Dependencies for the manager
   */
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.knowledgeBase = new Map();
    this.entityCache = new Map();
    
    // Initialize with some mock data
    this._initializeMockData();
  }
  
  /**
   * Initialize mock data for testing
   * @private
   */
  _initializeMockData() {
    // Mock crop data
    this.knowledgeBase.set('crops', new Map([
      ['corn', { id: 'corn', name: 'Corn', scientificName: 'Zea mays', growingSeasons: ['spring', 'summer'] }],
      ['wheat', { id: 'wheat', name: 'Wheat', scientificName: 'Triticum aestivum', growingSeasons: ['fall', 'winter'] }],
      ['tomato', { id: 'tomato', name: 'Tomato', scientificName: 'Solanum lycopersicum', growingSeasons: ['spring', 'summer'] }],
      ['basil', { id: 'basil', name: 'Basil', scientificName: 'Ocimum basilicum', growingSeasons: ['spring', 'summer'], indoorCompatible: true }],
      ['lettuce', { id: 'lettuce', name: 'Lettuce', scientificName: 'Lactuca sativa', growingSeasons: ['spring', 'fall'], indoorCompatible: true }]
    ]));
    
    // Mock disease data
    this.knowledgeBase.set('diseases', new Map([
      ['late_blight', { id: 'late_blight', name: 'Late Blight', scientificName: 'Phytophthora infestans', affectedCrops: ['tomato', 'potato'] }],
      ['powdery_mildew', { id: 'powdery_mildew', name: 'Powdery Mildew', scientificName: 'Erysiphales', affectedCrops: ['cucumber', 'squash', 'pumpkin'] }],
      ['root_rot', { id: 'root_rot', name: 'Root Rot', scientificName: 'Pythium spp.', affectedCrops: ['basil', 'lettuce'], indoorPrevalent: true }]
    ]));
    
    // Mock pest data
    this.knowledgeBase.set('pests', new Map([
      ['aphid', { id: 'aphid', name: 'Aphid', scientificName: 'Aphidoidea', affectedCrops: ['tomato', 'pepper', 'lettuce'] }],
      ['spider_mite', { id: 'spider_mite', name: 'Spider Mite', scientificName: 'Tetranychidae', affectedCrops: ['cucumber', 'tomato', 'basil'], indoorPrevalent: true }]
    ]));
    
    // Mock fertilizer data
    this.knowledgeBase.set('fertilizers', new Map([
      ['npk_10_10_10', { id: 'npk_10_10_10', name: 'All-Purpose NPK 10-10-10', type: 'synthetic', nutrients: { nitrogen: 10, phosphorus: 10, potassium: 10 } }],
      ['compost', { id: 'compost', name: 'Compost', type: 'organic', nutrients: { nitrogen: 2, phosphorus: 1, potassium: 1 } }],
      ['hydroponic_solution', { id: 'hydroponic_solution', name: 'Hydroponic Nutrient Solution', type: 'liquid', nutrients: { nitrogen: 5, phosphorus: 5, potassium: 5, calcium: 2, magnesium: 1 }, indoorUse: true }]
    ]));
    
    // Mock urban farming systems
    this.knowledgeBase.set('urbanSystems', new Map([
      ['vertical_garden', { id: 'vertical_garden', name: 'Vertical Garden', spaceEfficiency: 'high', crops: ['lettuce', 'basil', 'strawberry'] }],
      ['hydroponics', { id: 'hydroponics', name: 'Hydroponics System', spaceEfficiency: 'high', waterEfficiency: 'high', crops: ['lettuce', 'basil', 'tomato'] }],
      ['container_garden', { id: 'container_garden', name: 'Container Garden', spaceEfficiency: 'medium', crops: ['tomato', 'pepper', 'basil'] }]
    ]));
  }
  
  /**
   * Get an entity from the knowledge base
   * @param {String} entityId - ID of the entity to retrieve
   * @returns {Promise<Object>} The entity data
   */
  async getEntity(entityId) {
    // Check cache first
    if (this.entityCache.has(entityId)) {
      return this.entityCache.get(entityId);
    }
    
    // Search all categories
    for (const [category, entities] of this.knowledgeBase.entries()) {
      if (entities.has(entityId)) {
        const entity = entities.get(entityId);
        this.entityCache.set(entityId, entity);
        return entity;
      }
    }
    
    return null;
  }
  
  /**
   * Search the agricultural knowledge base
   * @param {String} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchKnowledge(query, options = {}) {
    const results = [];
    const queryLower = query.toLowerCase();
    const categories = options.categories || Array.from(this.knowledgeBase.keys());
    
    for (const category of categories) {
      if (!this.knowledgeBase.has(category)) continue;
      
      const entities = this.knowledgeBase.get(category);
      for (const [id, entity] of entities.entries()) {
        // Simple search implementation for testing
        if (
          entity.name.toLowerCase().includes(queryLower) ||
          (entity.scientificName && entity.scientificName.toLowerCase().includes(queryLower))
        ) {
          results.push({
            ...entity,
            category
          });
        }
      }
    }
    
    // Filter for indoor/urban if specified
    if (options.indoorOnly) {
      return results.filter(entity => entity.indoorCompatible || entity.indoorPrevalent || entity.indoorUse);
    }
    
    return results;
  }
  
  /**
   * Get plant identification from image data
   * @param {Buffer|String} imageData - Image data or base64 string
   * @param {Object} options - Identification options
   * @returns {Promise<Object>} Identification results
   */
  async identifyPlantFromImage(imageData, options = {}) {
    // Mock implementation for testing
    // In a real implementation, this would use ML models or external APIs
    
    // For testing, return a mock result based on a simple hash of the image data
    const mockResults = [
      { id: 'tomato', name: 'Tomato', confidence: 0.92 },
      { id: 'basil', name: 'Basil', confidence: 0.87 },
      { id: 'lettuce', name: 'Lettuce', confidence: 0.78 }
    ];
    
    // Simulate indoor plant detection if specified
    if (options.indoorContext) {
      return {
        results: mockResults.filter(r => r.id === 'basil' || r.id === 'lettuce'),
        context: 'indoor'
      };
    }
    
    return {
      results: mockResults,
      context: 'general'
    };
  }
  
  /**
   * Get disease identification from image data
   * @param {Buffer|String} imageData - Image data or base64 string
   * @param {Object} options - Identification options
   * @returns {Promise<Object>} Identification results
   */
  async identifyDiseaseFromImage(imageData, options = {}) {
    // Mock implementation for testing
    // In a real implementation, this would use ML models or external APIs
    
    // For testing, return a mock result
    const mockResults = [
      { id: 'powdery_mildew', name: 'Powdery Mildew', confidence: 0.85 },
      { id: 'root_rot', name: 'Root Rot', confidence: 0.72 }
    ];
    
    // Simulate indoor disease detection if specified
    if (options.indoorContext) {
      return {
        results: mockResults.filter(r => r.id === 'root_rot'),
        context: 'indoor'
      };
    }
    
    return {
      results: mockResults,
      context: 'general'
    };
  }
}

module.exports = MockAgricultureKnowledgeManager;
