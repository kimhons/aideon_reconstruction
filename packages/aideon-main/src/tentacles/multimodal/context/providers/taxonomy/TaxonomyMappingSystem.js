/**
 * @fileoverview Taxonomy Mapping System for enterprise context connector.
 * 
 * This module provides a system for mapping between enterprise taxonomies/ontologies
 * and Aideon's internal knowledge representation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * TaxonomyMappingSystem maps between enterprise taxonomies and internal representation.
 */
class TaxonomyMappingSystem {
  /**
   * Constructor for TaxonomyMappingSystem.
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.configService Configuration Service instance
   */
  constructor(dependencies) {
    // Validate dependencies
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    
    const { logger, performanceMonitor, configService } = dependencies;
    
    if (!logger) {
      throw new Error('Logger is required');
    }
    
    if (!performanceMonitor) {
      throw new Error('Performance Monitor is required');
    }
    
    if (!configService) {
      throw new Error('Configuration Service is required');
    }
    
    // Store dependencies
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.configService = configService;
    
    // Initialize state
    this.mappings = new Map(); // Source type -> mapping rules
    this.cachedMappings = new Map(); // Source ID -> cached mapped taxonomy
    
    // Configure from service
    this.config = this.configService.getConfig('taxonomyMappingSystem') || {
      cacheTTLSeconds: 3600,
      enableFuzzyMatching: true,
      fuzzyMatchThreshold: 0.8,
      enableHierarchyPreservation: true,
      maxMappingDepth: 5
    };
    
    // Register default mappings
    this._registerDefaultMappings();
    
    this.logger.info('TaxonomyMappingSystem created');
  }
  
  /**
   * Map enterprise taxonomy to internal representation.
   * @param {string} sourceId Source ID
   * @param {string} sourceType Source type
   * @param {Object} enterpriseTaxonomy Enterprise taxonomy to map
   * @param {Object} options Mapping options
   * @returns {Promise<Object>} Mapped internal taxonomy
   */
  async mapTaxonomy(sourceId, sourceType, enterpriseTaxonomy, options = {}) {
    try {
      this.logger.debug('Mapping taxonomy', { sourceId, sourceType });
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('mapTaxonomy');
      
      // Validate inputs
      if (!sourceId) {
        throw new Error('Source ID is required');
      }
      
      if (!sourceType) {
        throw new Error('Source type is required');
      }
      
      if (!enterpriseTaxonomy) {
        throw new Error('Enterprise taxonomy is required');
      }
      
      // Check cache if enabled
      if (options.useCache !== false && this.config.cacheTTLSeconds > 0) {
        const cachedMapping = this.cachedMappings.get(sourceId);
        
        if (cachedMapping && (Date.now() - cachedMapping.timestamp) / 1000 < this.config.cacheTTLSeconds) {
          this.logger.debug('Using cached taxonomy mapping', { sourceId });
          return cachedMapping.mapping;
        }
      }
      
      // Get mapping rules for source type
      const mappingRules = this.mappings.get(sourceType) || this.mappings.get('default');
      
      if (!mappingRules) {
        throw new Error(`No mapping rules found for source type: ${sourceType}`);
      }
      
      // Apply mapping rules
      const mappedTaxonomy = await this._applyMappingRules(enterpriseTaxonomy, mappingRules, options);
      
      // Cache mapping if enabled
      if (this.config.cacheTTLSeconds > 0) {
        this.cachedMappings.set(sourceId, {
          mapping: mappedTaxonomy,
          timestamp: Date.now()
        });
      }
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfTimer);
      
      return mappedTaxonomy;
    } catch (error) {
      this.logger.error(`Failed to map taxonomy: ${error.message}`, { error, sourceId, sourceType });
      throw error;
    }
  }
  
  /**
   * Register mapping rules for a source type.
   * @param {string} sourceType Source type
   * @param {Object} mappingRules Mapping rules
   * @returns {boolean} True if registration was successful
   */
  registerMapping(sourceType, mappingRules) {
    try {
      if (!sourceType) {
        throw new Error('Source type is required');
      }
      
      if (!mappingRules) {
        throw new Error('Mapping rules are required');
      }
      
      this.mappings.set(sourceType, mappingRules);
      this.logger.debug(`Registered taxonomy mapping for source type: ${sourceType}`);
      
      // Clear cached mappings for this source type
      for (const [sourceId, cachedMapping] of this.cachedMappings.entries()) {
        if (cachedMapping.sourceType === sourceType) {
          this.cachedMappings.delete(sourceId);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register taxonomy mapping: ${error.message}`, { error, sourceType });
      throw error;
    }
  }
  
  /**
   * Clear cached mappings.
   * @param {string} sourceId Optional source ID to clear specific cache
   * @returns {boolean} True if clearing was successful
   */
  clearCache(sourceId = null) {
    try {
      if (sourceId) {
        // Clear specific cache
        this.cachedMappings.delete(sourceId);
        this.logger.debug(`Cleared taxonomy mapping cache for source: ${sourceId}`);
      } else {
        // Clear all caches
        this.cachedMappings.clear();
        this.logger.debug('Cleared all taxonomy mapping caches');
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear taxonomy mapping cache: ${error.message}`, { error, sourceId });
      throw error;
    }
  }
  
  /**
   * Apply mapping rules to enterprise taxonomy.
   * @private
   * @param {Object} enterpriseTaxonomy Enterprise taxonomy
   * @param {Object} mappingRules Mapping rules
   * @param {Object} options Mapping options
   * @returns {Promise<Object>} Mapped internal taxonomy
   */
  async _applyMappingRules(enterpriseTaxonomy, mappingRules, options) {
    // Create base structure for internal taxonomy
    const internalTaxonomy = {
      id: enterpriseTaxonomy.id || 'mapped-taxonomy',
      name: enterpriseTaxonomy.name || 'Mapped Taxonomy',
      source: {
        id: options.sourceId,
        type: options.sourceType
      },
      categories: [],
      concepts: [],
      relationships: [],
      metadata: {
        mappedAt: Date.now(),
        originalStructure: options.preserveOriginal ? enterpriseTaxonomy : undefined
      }
    };
    
    // Apply field mappings
    if (mappingRules.fieldMappings) {
      for (const [internalField, enterpriseField] of Object.entries(mappingRules.fieldMappings)) {
        if (enterpriseTaxonomy[enterpriseField] !== undefined) {
          internalTaxonomy[internalField] = enterpriseTaxonomy[enterpriseField];
        }
      }
    }
    
    // Map categories
    if (mappingRules.categoryMapping && enterpriseTaxonomy[mappingRules.categoryMapping.sourceField]) {
      internalTaxonomy.categories = await this._mapCategories(
        enterpriseTaxonomy[mappingRules.categoryMapping.sourceField],
        mappingRules.categoryMapping,
        options
      );
    }
    
    // Map concepts
    if (mappingRules.conceptMapping && enterpriseTaxonomy[mappingRules.conceptMapping.sourceField]) {
      internalTaxonomy.concepts = await this._mapConcepts(
        enterpriseTaxonomy[mappingRules.conceptMapping.sourceField],
        mappingRules.conceptMapping,
        options
      );
    }
    
    // Map relationships
    if (mappingRules.relationshipMapping && enterpriseTaxonomy[mappingRules.relationshipMapping.sourceField]) {
      internalTaxonomy.relationships = await this._mapRelationships(
        enterpriseTaxonomy[mappingRules.relationshipMapping.sourceField],
        mappingRules.relationshipMapping,
        options
      );
    }
    
    // Apply custom transformations if provided
    if (mappingRules.customTransform && typeof mappingRules.customTransform === 'function') {
      await mappingRules.customTransform(internalTaxonomy, enterpriseTaxonomy, options);
    }
    
    return internalTaxonomy;
  }
  
  /**
   * Map enterprise categories to internal categories.
   * @private
   * @param {Array<Object>} enterpriseCategories Enterprise categories
   * @param {Object} mappingRules Category mapping rules
   * @param {Object} options Mapping options
   * @returns {Promise<Array<Object>>} Mapped internal categories
   */
  async _mapCategories(enterpriseCategories, mappingRules, options) {
    const internalCategories = [];
    
    // Ensure enterpriseCategories is an array
    const categories = Array.isArray(enterpriseCategories) ? enterpriseCategories : [enterpriseCategories];
    
    for (const category of categories) {
      try {
        // Create internal category
        const internalCategory = {
          id: category[mappingRules.idField] || `category-${Math.random().toString(36).substring(2, 9)}`,
          name: category[mappingRules.nameField] || 'Unnamed Category',
          description: category[mappingRules.descriptionField],
          parentId: category[mappingRules.parentIdField],
          metadata: {}
        };
        
        // Add additional fields from mapping
        if (mappingRules.additionalFields) {
          for (const [internalField, enterpriseField] of Object.entries(mappingRules.additionalFields)) {
            if (category[enterpriseField] !== undefined) {
              internalCategory.metadata[internalField] = category[enterpriseField];
            }
          }
        }
        
        // Map children if present and hierarchy preservation is enabled
        if (this.config.enableHierarchyPreservation && 
            mappingRules.childrenField && 
            category[mappingRules.childrenField] && 
            Array.isArray(category[mappingRules.childrenField])) {
          
          internalCategory.children = await this._mapCategories(
            category[mappingRules.childrenField],
            mappingRules,
            { ...options, depth: (options.depth || 0) + 1 }
          );
        }
        
        // Add to result
        internalCategories.push(internalCategory);
      } catch (error) {
        this.logger.error(`Failed to map category: ${error.message}`, { error, category });
        // Continue with next category
      }
    }
    
    return internalCategories;
  }
  
  /**
   * Map enterprise concepts to internal concepts.
   * @private
   * @param {Array<Object>} enterpriseConcepts Enterprise concepts
   * @param {Object} mappingRules Concept mapping rules
   * @param {Object} options Mapping options
   * @returns {Promise<Array<Object>>} Mapped internal concepts
   */
  async _mapConcepts(enterpriseConcepts, mappingRules, options) {
    const internalConcepts = [];
    
    // Ensure enterpriseConcepts is an array
    const concepts = Array.isArray(enterpriseConcepts) ? enterpriseConcepts : [enterpriseConcepts];
    
    for (const concept of concepts) {
      try {
        // Create internal concept
        const internalConcept = {
          id: concept[mappingRules.idField] || `concept-${Math.random().toString(36).substring(2, 9)}`,
          name: concept[mappingRules.nameField] || 'Unnamed Concept',
          description: concept[mappingRules.descriptionField],
          categoryIds: concept[mappingRules.categoryIdsField] || [],
          aliases: concept[mappingRules.aliasesField] || [],
          metadata: {}
        };
        
        // Add additional fields from mapping
        if (mappingRules.additionalFields) {
          for (const [internalField, enterpriseField] of Object.entries(mappingRules.additionalFields)) {
            if (concept[enterpriseField] !== undefined) {
              internalConcept.metadata[internalField] = concept[enterpriseField];
            }
          }
        }
        
        // Add to result
        internalConcepts.push(internalConcept);
      } catch (error) {
        this.logger.error(`Failed to map concept: ${error.message}`, { error, concept });
        // Continue with next concept
      }
    }
    
    return internalConcepts;
  }
  
  /**
   * Map enterprise relationships to internal relationships.
   * @private
   * @param {Array<Object>} enterpriseRelationships Enterprise relationships
   * @param {Object} mappingRules Relationship mapping rules
   * @param {Object} options Mapping options
   * @returns {Promise<Array<Object>>} Mapped internal relationships
   */
  async _mapRelationships(enterpriseRelationships, mappingRules, options) {
    const internalRelationships = [];
    
    // Ensure enterpriseRelationships is an array
    const relationships = Array.isArray(enterpriseRelationships) ? enterpriseRelationships : [enterpriseRelationships];
    
    for (const relationship of relationships) {
      try {
        // Create internal relationship
        const internalRelationship = {
          id: relationship[mappingRules.idField] || `relationship-${Math.random().toString(36).substring(2, 9)}`,
          type: relationship[mappingRules.typeField] || 'related',
          sourceId: relationship[mappingRules.sourceIdField],
          targetId: relationship[mappingRules.targetIdField],
          strength: relationship[mappingRules.strengthField] || 1.0,
          metadata: {}
        };
        
        // Add additional fields from mapping
        if (mappingRules.additionalFields) {
          for (const [internalField, enterpriseField] of Object.entries(mappingRules.additionalFields)) {
            if (relationship[enterpriseField] !== undefined) {
              internalRelationship.metadata[internalField] = relationship[enterpriseField];
            }
          }
        }
        
        // Add to result
        internalRelationships.push(internalRelationship);
      } catch (error) {
        this.logger.error(`Failed to map relationship: ${error.message}`, { error, relationship });
        // Continue with next relationship
      }
    }
    
    return internalRelationships;
  }
  
  /**
   * Register default mappings.
   * @private
   */
  _registerDefaultMappings() {
    // Default mapping
    this.registerMapping('default', {
      fieldMappings: {
        id: 'id',
        name: 'name',
        description: 'description'
      },
      categoryMapping: {
        sourceField: 'categories',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        parentIdField: 'parentId',
        childrenField: 'children',
        additionalFields: {
          count: 'count',
          path: 'path'
        }
      },
      conceptMapping: {
        sourceField: 'terms',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        categoryIdsField: 'categoryIds',
        aliasesField: 'synonyms',
        additionalFields: {
          usage: 'usage',
          weight: 'weight'
        }
      },
      relationshipMapping: {
        sourceField: 'relationships',
        idField: 'id',
        typeField: 'type',
        sourceIdField: 'sourceId',
        targetIdField: 'targetId',
        strengthField: 'weight',
        additionalFields: {
          direction: 'direction',
          created: 'created'
        }
      }
    });
    
    // SharePoint mapping
    this.registerMapping('sharepoint', {
      fieldMappings: {
        id: 'id',
        name: 'name',
        description: 'description'
      },
      categoryMapping: {
        sourceField: 'terms',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        parentIdField: 'parentId',
        childrenField: 'children',
        additionalFields: {
          termSetId: 'termSetId',
          isAvailableForTagging: 'isAvailableForTagging'
        }
      },
      conceptMapping: {
        sourceField: 'terms',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        categoryIdsField: 'termSetIds',
        aliasesField: 'labels',
        additionalFields: {
          isDeprecated: 'isDeprecated',
          customSortOrder: 'customSortOrder'
        }
      },
      relationshipMapping: {
        sourceField: 'relationships',
        idField: 'id',
        typeField: 'relationType',
        sourceIdField: 'fromTermId',
        targetIdField: 'toTermId',
        strengthField: 'weight',
        additionalFields: {
          isPinned: 'isPinned',
          isActive: 'isActive'
        }
      },
      customTransform: (internalTaxonomy, enterpriseTaxonomy) => {
        // SharePoint-specific transformations
        if (enterpriseTaxonomy.termSets && Array.isArray(enterpriseTaxonomy.termSets)) {
          // Map term sets as top-level categories
          const termSetCategories = enterpriseTaxonomy.termSets.map(termSet => ({
            id: termSet.id,
            name: termSet.name,
            description: termSet.description,
            isTermSet: true,
            metadata: {
              isOpen: termSet.isOpen,
              isAvailableForTagging: termSet.isAvailableForTagging,
              owner: termSet.owner
            }
          }));
          
          internalTaxonomy.categories = [...internalTaxonomy.categories, ...termSetCategories];
        }
      }
    });
    
    // Confluence mapping
    this.registerMapping('confluence', {
      fieldMappings: {
        id: 'id',
        name: 'name',
        description: 'description'
      },
      categoryMapping: {
        sourceField: 'categories',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        parentIdField: 'parentId',
        childrenField: 'children',
        additionalFields: {
          count: 'count',
          spaceKey: 'spaceKey'
        }
      },
      conceptMapping: {
        sourceField: 'labels',
        idField: 'id',
        nameField: 'name',
        descriptionField: 'description',
        categoryIdsField: 'categoryIds',
        aliasesField: 'aliases',
        additionalFields: {
          count: 'count',
          popular: 'popular'
        }
      },
      relationshipMapping: {
        sourceField: 'relationships',
        idField: 'id',
        typeField: 'type',
        sourceIdField: 'sourceId',
        targetIdField: 'targetId',
        strengthField: 'weight',
        additionalFields: {
          created: 'created',
          creator: 'creator'
        }
      },
      customTransform: (internalTaxonomy, enterpriseTaxonomy) => {
        // Confluence-specific transformations
        if (enterpriseTaxonomy.pageHierarchy) {
          // Extract concepts from page hierarchy
          const extractConcepts = (node, parentId = null) => {
            const concepts = [];
            
            if (node.type === 'page') {
              concepts.push({
                id: node.id,
                name: node.name,
                description: node.description || '',
                categoryIds: parentId ? [parentId] : [],
                metadata: {
                  type: 'page',
                  parentId
                }
              });
            }
            
            if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) {
                concepts.push(...extractConcepts(child, node.id));
              }
            }
            
            return concepts;
          };
          
          const pageHierarchyConcepts = extractConcepts(enterpriseTaxonomy.pageHierarchy);
          internalTaxonomy.concepts = [...internalTaxonomy.concepts, ...pageHierarchyConcepts];
        }
      }
    });
  }
}

module.exports = TaxonomyMappingSystem;
