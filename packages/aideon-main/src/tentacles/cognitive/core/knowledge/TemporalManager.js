/**
 * @fileoverview TemporalManager for the Knowledge Graph Manager.
 * Provides temporal knowledge representation and versioning capabilities.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Temporal resolution levels for time-based queries.
 * @enum {string}
 */
const TemporalResolution = {
  /**
   * Millisecond precision.
   */
  MILLISECOND: 'millisecond',
  
  /**
   * Second precision.
   */
  SECOND: 'second',
  
  /**
   * Minute precision.
   */
  MINUTE: 'minute',
  
  /**
   * Hour precision.
   */
  HOUR: 'hour',
  
  /**
   * Day precision.
   */
  DAY: 'day',
  
  /**
   * Month precision.
   */
  MONTH: 'month',
  
  /**
   * Year precision.
   */
  YEAR: 'year'
};

/**
 * Temporal relationship types between entities.
 * @enum {string}
 */
const TemporalRelationship = {
  /**
   * Entity A occurs before entity B.
   */
  BEFORE: 'before',
  
  /**
   * Entity A occurs after entity B.
   */
  AFTER: 'after',
  
  /**
   * Entity A occurs at the same time as entity B.
   */
  SIMULTANEOUS: 'simultaneous',
  
  /**
   * Entity A overlaps with entity B.
   */
  OVERLAPS: 'overlaps',
  
  /**
   * Entity A contains entity B temporally.
   */
  CONTAINS: 'contains',
  
  /**
   * Entity A is contained by entity B temporally.
   */
  CONTAINED_BY: 'contained_by',
  
  /**
   * Entity A meets entity B (ends when B starts).
   */
  MEETS: 'meets',
  
  /**
   * Entity A is met by entity B (starts when B ends).
   */
  MET_BY: 'met_by'
};

/**
 * Provides temporal knowledge representation and versioning capabilities.
 */
class TemporalManager extends EventEmitter {
  /**
   * Creates a new TemporalManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   */
  constructor(options = {}) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error('TemporalManager requires a storageAdapter instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    this.initialized = false;
  }
  
  /**
   * Initializes the temporal manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing TemporalManager');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.temporal', {
          defaultResolution: TemporalResolution.MILLISECOND,
          maxVersionsPerEntity: 1000,
          enableTemporalQueries: true,
          enableTemporalRelationships: true,
          defaultRetentionPeriod: 31536000000 // 1 year in milliseconds
        });
        
        this.config = config;
      } else {
        this.config = {
          defaultResolution: TemporalResolution.MILLISECOND,
          maxVersionsPerEntity: 1000,
          enableTemporalQueries: true,
          enableTemporalRelationships: true,
          defaultRetentionPeriod: 31536000000 // 1 year in milliseconds
        };
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('TemporalManager initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('TemporalManager initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`TemporalManager initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a temporal version of an entity.
   * 
   * @param {string} entityId - ID of the entity (node or edge)
   * @param {Object} versionData - Data for this version
   * @param {number} [timestamp=Date.now()] - Timestamp for the version
   * @param {Object} [metadata={}] - Version metadata
   * @returns {Promise<string>} - ID of the stored version
   */
  async createVersion(entityId, versionData, timestamp = Date.now(), metadata = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_createVersion');
    }
    
    try {
      // Check if entity exists
      const entityExists = await this.checkEntityExists(entityId);
      if (!entityExists) {
        throw new Error(`Entity ${entityId} does not exist`);
      }
      
      // Check version count limit
      const existingVersions = await this.getVersions(entityId);
      if (existingVersions.length >= this.config.maxVersionsPerEntity) {
        if (this.logger) {
          this.logger.warn(`Entity ${entityId} has reached maximum version count (${this.config.maxVersionsPerEntity})`);
        }
        
        // Remove oldest version if limit reached
        const oldestVersion = existingVersions.reduce((oldest, current) => 
          current.timestamp < oldest.timestamp ? current : oldest
        );
        
        await this.deleteVersion(oldestVersion.versionId);
      }
      
      // Generate unique version ID
      const versionId = uuidv4();
      
      // Prepare version data
      const version = {
        versionId,
        entityId,
        timestamp,
        data: { ...versionData },
        metadata: {
          ...metadata,
          createdAt: Date.now()
        }
      };
      
      // Store version using the adapter
      await this.storageAdapter.storeTemporalVersion(entityId, version, timestamp);
      
      if (this.logger) {
        this.logger.debug(`Created temporal version ${versionId} for entity ${entityId} at timestamp ${timestamp}`);
      }
      
      this.emit('versionCreated', { versionId, entityId, timestamp });
      
      return versionId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to create version for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves a specific version of an entity.
   * 
   * @param {string} versionId - ID of the version to retrieve
   * @returns {Promise<Object|null>} - Version data or null if not found
   */
  async getVersion(versionId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_getVersion');
    }
    
    try {
      // This would typically use a direct lookup by version ID
      // For now, we'll simulate this by searching all versions
      
      // Get all versions for all entities (inefficient, but works for demonstration)
      const allVersions = await this.storageAdapter.queryTemporalVersions({});
      
      // Find the specific version
      const version = allVersions.find(v => v.versionId === versionId);
      
      if (!version && this.logger) {
        this.logger.debug(`Version ${versionId} not found`);
      }
      
      return version || null;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get version ${versionId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves all versions of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - Array of versions
   */
  async getVersions(entityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_getVersions');
    }
    
    try {
      const timeRange = {};
      
      if (options.startTime !== undefined) {
        timeRange.start = options.startTime;
      }
      
      if (options.endTime !== undefined) {
        timeRange.end = options.endTime;
      }
      
      const versions = await this.storageAdapter.retrieveTemporalVersions(entityId, timeRange);
      
      // Sort by timestamp (newest first by default)
      const sortedVersions = [...versions].sort((a, b) => {
        const direction = options.oldestFirst ? 1 : -1;
        return direction * (a.timestamp - b.timestamp);
      });
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        return sortedVersions.slice(0, options.limit);
      }
      
      return sortedVersions;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get versions for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves the entity state at a specific point in time.
   * 
   * @param {string} entityId - ID of the entity
   * @param {number} [timestamp=Date.now()] - Target timestamp
   * @returns {Promise<Object|null>} - Entity state at the specified time or null if not found
   */
  async getEntityStateAt(entityId, timestamp = Date.now()) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_getEntityStateAt');
    }
    
    try {
      // Get all versions up to the specified timestamp
      const versions = await this.storageAdapter.retrieveTemporalVersions(entityId, {
        end: timestamp
      });
      
      if (versions.length === 0) {
        if (this.logger) {
          this.logger.debug(`No versions found for entity ${entityId} before timestamp ${timestamp}`);
        }
        return null;
      }
      
      // Find the latest version before or at the specified timestamp
      const latestVersion = versions.reduce((latest, current) => 
        current.timestamp <= timestamp && current.timestamp > latest.timestamp ? current : latest
      );
      
      // Get the current entity state
      let currentEntity;
      try {
        currentEntity = await this.storageAdapter.retrieveNode(entityId);
      } catch (e) {
        try {
          currentEntity = await this.storageAdapter.retrieveEdge(entityId);
        } catch (e2) {
          currentEntity = null;
        }
      }
      
      if (!currentEntity) {
        if (this.logger) {
          this.logger.warn(`Entity ${entityId} not found, returning historical version only`);
        }
        return latestVersion.data;
      }
      
      // Combine current entity structure with historical data
      return {
        ...currentEntity,
        ...latestVersion.data,
        metadata: {
          ...currentEntity.metadata,
          temporalVersion: {
            versionId: latestVersion.versionId,
            timestamp: latestVersion.timestamp,
            metadata: latestVersion.metadata
          }
        }
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get entity state for ${entityId} at ${timestamp}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Deletes a specific version of an entity.
   * 
   * @param {string} versionId - ID of the version to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteVersion(versionId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_deleteVersion');
    }
    
    try {
      // Get the version first to know its entity ID
      const version = await this.getVersion(versionId);
      if (!version) {
        if (this.logger) {
          this.logger.warn(`Version ${versionId} not found for deletion`);
        }
        return false;
      }
      
      // Delete the version
      const success = await this.storageAdapter.deleteTemporalVersion(version.entityId, versionId);
      
      if (success) {
        if (this.logger) {
          this.logger.debug(`Deleted version ${versionId} of entity ${version.entityId}`);
        }
        
        this.emit('versionDeleted', { versionId, entityId: version.entityId });
      }
      
      return success;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete version ${versionId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Deletes all versions of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @returns {Promise<number>} - Number of versions deleted
   */
  async deleteAllVersions(entityId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_deleteAllVersions');
    }
    
    try {
      // Get all versions
      const versions = await this.getVersions(entityId);
      
      if (versions.length === 0) {
        return 0;
      }
      
      // Delete each version
      const deletePromises = versions.map(version => 
        this.storageAdapter.deleteTemporalVersion(entityId, version.versionId)
      );
      
      const results = await Promise.all(deletePromises);
      const deletedCount = results.filter(success => success).length;
      
      if (this.logger) {
        this.logger.debug(`Deleted ${deletedCount} versions of entity ${entityId}`);
      }
      
      this.emit('allVersionsDeleted', { entityId, count: deletedCount });
      
      return deletedCount;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete all versions for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a temporal relationship between two entities.
   * 
   * @param {string} sourceEntityId - ID of the source entity
   * @param {string} targetEntityId - ID of the target entity
   * @param {TemporalRelationship} relationship - Type of temporal relationship
   * @param {Object} [properties={}] - Relationship properties
   * @param {Object} [metadata={}] - Relationship metadata
   * @returns {Promise<string>} - ID of the created relationship
   */
  async createTemporalRelationship(sourceEntityId, targetEntityId, relationship, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableTemporalRelationships) {
      throw new Error('Temporal relationships are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_createTemporalRelationship');
    }
    
    try {
      // Validate relationship type
      if (!Object.values(TemporalRelationship).includes(relationship)) {
        throw new Error(`Invalid temporal relationship: ${relationship}`);
      }
      
      // Check if entities exist
      const sourceExists = await this.checkEntityExists(sourceEntityId);
      const targetExists = await this.checkEntityExists(targetEntityId);
      
      if (!sourceExists || !targetExists) {
        throw new Error(`Source (${sourceEntityId}) or target (${targetEntityId}) entity does not exist`);
      }
      
      // Generate unique ID
      const relationshipId = uuidv4();
      
      // Prepare relationship data
      const relationshipData = {
        id: relationshipId,
        sourceEntityId,
        targetEntityId,
        relationship,
        properties: { ...properties },
        metadata: {
          ...metadata,
          isTemporal: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store as an edge using the adapter
      const storedRelationshipId = await this.storageAdapter.storeEdge(relationshipData);
      
      if (this.logger) {
        this.logger.debug(`Created temporal relationship ${storedRelationshipId} (${relationship}) from ${sourceEntityId} to ${targetEntityId}`);
      }
      
      this.emit('temporalRelationshipCreated', { 
        relationshipId: storedRelationshipId, 
        sourceEntityId, 
        targetEntityId, 
        relationship 
      });
      
      return storedRelationshipId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create temporal relationship', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds temporal relationships for an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - Temporal relationships
   */
  async findTemporalRelationships(entityId, options = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableTemporalRelationships) {
      throw new Error('Temporal relationships are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_findTemporalRelationships');
    }
    
    try {
      const criteria = {
        $or: [
          { sourceEntityId: entityId },
          { targetEntityId: entityId }
        ],
        'metadata.isTemporal': true
      };
      
      if (options.relationship) {
        criteria.relationship = options.relationship;
      }
      
      if (options.direction === 'outgoing') {
        criteria.$or = [{ sourceEntityId: entityId }];
      } else if (options.direction === 'incoming') {
        criteria.$or = [{ targetEntityId: entityId }];
      }
      
      const relationships = await this.storageAdapter.queryEdges(criteria);
      
      if (this.logger) {
        this.logger.debug(`Found ${relationships.length} temporal relationships for entity ${entityId}`);
      }
      
      return relationships;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find temporal relationships for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Compares two entities temporally.
   * 
   * @param {string} entityId1 - ID of the first entity
   * @param {string} entityId2 - ID of the second entity
   * @returns {Promise<TemporalRelationship>} - Temporal relationship between the entities
   */
  async compareEntitiesTemporally(entityId1, entityId2) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_compareEntitiesTemporally');
    }
    
    try {
      // Check if entities exist
      const entity1Exists = await this.checkEntityExists(entityId1);
      const entity2Exists = await this.checkEntityExists(entityId2);
      
      if (!entity1Exists || !entity2Exists) {
        throw new Error(`Entity ${!entity1Exists ? entityId1 : entityId2} does not exist`);
      }
      
      // Get temporal information for both entities
      const entity1 = await this.getEntityWithTemporalInfo(entityId1);
      const entity2 = await this.getEntityWithTemporalInfo(entityId2);
      
      // Determine relationship based on start and end times
      if (entity1.endTime < entity2.startTime) {
        return TemporalRelationship.BEFORE;
      } else if (entity1.startTime > entity2.endTime) {
        return TemporalRelationship.AFTER;
      } else if (entity1.startTime === entity2.startTime && entity1.endTime === entity2.endTime) {
        return TemporalRelationship.SIMULTANEOUS;
      } else if (entity1.startTime <= entity2.startTime && entity1.endTime >= entity2.endTime) {
        return TemporalRelationship.CONTAINS;
      } else if (entity1.startTime >= entity2.startTime && entity1.endTime <= entity2.endTime) {
        return TemporalRelationship.CONTAINED_BY;
      } else if (entity1.endTime === entity2.startTime) {
        return TemporalRelationship.MEETS;
      } else if (entity1.startTime === entity2.endTime) {
        return TemporalRelationship.MET_BY;
      } else {
        return TemporalRelationship.OVERLAPS;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to compare entities ${entityId1} and ${entityId2} temporally`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds entities that existed at a specific point in time.
   * 
   * @param {number} timestamp - Target timestamp
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - Entities that existed at the specified time
   */
  async findEntitiesAtTime(timestamp, options = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableTemporalQueries) {
      throw new Error('Temporal queries are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_findEntitiesAtTime');
    }
    
    try {
      // This would typically use a temporal index for efficient lookup
      // For now, we'll use a simple approach
      
      // Get all entities (inefficient, but works for demonstration)
      const entities = await this.getAllEntities(options);
      
      // Filter entities that existed at the specified time
      const results = [];
      
      for (const entity of entities) {
        try {
          const entityState = await this.getEntityStateAt(entity.id, timestamp);
          if (entityState) {
            results.push(entityState);
          }
        } catch (e) {
          // Skip entities that cause errors
          if (this.logger) {
            this.logger.warn(`Error processing entity ${entity.id}`, { error: e.message });
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Found ${results.length} entities that existed at timestamp ${timestamp}`);
      }
      
      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find entities at timestamp ${timestamp}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds entities that changed within a time range.
   * 
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - Entities that changed within the time range
   */
  async findEntitiesChangedInRange(startTime, endTime, options = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableTemporalQueries) {
      throw new Error('Temporal queries are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_findEntitiesChangedInRange');
    }
    
    try {
      // This would typically use a temporal index for efficient lookup
      // For now, we'll use a simple approach
      
      // Get all entities (inefficient, but works for demonstration)
      const entities = await this.getAllEntities(options);
      
      // Filter entities that changed within the time range
      const results = [];
      
      for (const entity of entities) {
        try {
          const versions = await this.getVersions(entity.id, {
            startTime,
            endTime
          });
          
          if (versions.length > 0) {
            results.push({
              entity,
              versions,
              changeCount: versions.length
            });
          }
        } catch (e) {
          // Skip entities that cause errors
          if (this.logger) {
            this.logger.warn(`Error processing entity ${entity.id}`, { error: e.message });
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Found ${results.length} entities that changed between ${startTime} and ${endTime}`);
      }
      
      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find entities changed between ${startTime} and ${endTime}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Computes the change history of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - Change history
   */
  async computeChangeHistory(entityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_computeChangeHistory');
    }
    
    try {
      // Check if entity exists
      const entityExists = await this.checkEntityExists(entityId);
      if (!entityExists) {
        throw new Error(`Entity ${entityId} does not exist`);
      }
      
      // Get all versions
      const versions = await this.getVersions(entityId, {
        oldestFirst: true
      });
      
      if (versions.length <= 1) {
        return versions.map(version => ({
          versionId: version.versionId,
          timestamp: version.timestamp,
          changes: {
            type: 'initial',
            properties: version.data.properties || {}
          }
        }));
      }
      
      // Compute changes between consecutive versions
      const changeHistory = [];
      
      for (let i = 0; i < versions.length; i++) {
        const currentVersion = versions[i];
        const previousVersion = i > 0 ? versions[i - 1] : null;
        
        const changes = {
          versionId: currentVersion.versionId,
          timestamp: currentVersion.timestamp,
          changes: previousVersion ? 
            this.computeChanges(previousVersion.data, currentVersion.data) : 
            { type: 'initial', properties: currentVersion.data.properties || {} }
        };
        
        changeHistory.push(changes);
      }
      
      return changeHistory;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to compute change history for entity ${entityId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Restores an entity to a previous version.
   * 
   * @param {string} entityId - ID of the entity
   * @param {string} versionId - ID of the version to restore
   * @returns {Promise<boolean>} - Success status
   */
  async restoreVersion(entityId, versionId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_restoreVersion');
    }
    
    try {
      // Check if entity exists
      const entityExists = await this.checkEntityExists(entityId);
      if (!entityExists) {
        throw new Error(`Entity ${entityId} does not exist`);
      }
      
      // Get the version to restore
      const version = await this.getVersion(versionId);
      if (!version) {
        throw new Error(`Version ${versionId} not found`);
      }
      
      if (version.entityId !== entityId) {
        throw new Error(`Version ${versionId} does not belong to entity ${entityId}`);
      }
      
      // Get current entity
      let currentEntity;
      try {
        currentEntity = await this.storageAdapter.retrieveNode(entityId);
      } catch (e) {
        try {
          currentEntity = await this.storageAdapter.retrieveEdge(entityId);
        } catch (e2) {
          throw new Error(`Failed to retrieve entity ${entityId}`);
        }
      }
      
      // Create updated entity with version data
      const updatedEntity = {
        ...currentEntity,
        ...version.data,
        metadata: {
          ...currentEntity.metadata,
          restoredFrom: {
            versionId: version.versionId,
            timestamp: version.timestamp,
            restoredAt: Date.now()
          },
          updatedAt: Date.now()
        },
        updatedAt: Date.now()
      };
      
      // Update entity
      let success;
      if (currentEntity.sourceId !== undefined) {
        // It's an edge
        success = await this.storageAdapter.updateEdgeData(entityId, updatedEntity);
      } else {
        // It's a node
        success = await this.storageAdapter.updateNodeData(entityId, updatedEntity);
      }
      
      if (success) {
        if (this.logger) {
          this.logger.debug(`Restored entity ${entityId} to version ${versionId}`);
        }
        
        this.emit('versionRestored', { entityId, versionId });
      }
      
      return success;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to restore entity ${entityId} to version ${versionId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Purges expired versions based on retention policy.
   * 
   * @param {Object} [options={}] - Purge options
   * @returns {Promise<number>} - Number of versions purged
   */
  async purgeExpiredVersions(options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('temporalManager_purgeExpiredVersions');
    }
    
    try {
      const retentionPeriod = options.retentionPeriod || this.config.defaultRetentionPeriod;
      const cutoffTime = Date.now() - retentionPeriod;
      
      // Get all versions (inefficient, but works for demonstration)
      const allVersions = await this.storageAdapter.queryTemporalVersions({
        end: cutoffTime
      });
      
      if (allVersions.length === 0) {
        return 0;
      }
      
      // Group versions by entity
      const versionsByEntity = {};
      for (const version of allVersions) {
        if (!versionsByEntity[version.entityId]) {
          versionsByEntity[version.entityId] = [];
        }
        versionsByEntity[version.entityId].push(version);
      }
      
      // For each entity, keep at least one version
      let purgedCount = 0;
      
      for (const [entityId, versions] of Object.entries(versionsByEntity)) {
        // Sort by timestamp (newest first)
        versions.sort((a, b) => b.timestamp - a.timestamp);
        
        // Keep the newest version, purge the rest
        const versionsToDelete = versions.slice(1);
        
        for (const version of versionsToDelete) {
          const success = await this.storageAdapter.deleteTemporalVersion(entityId, version.versionId);
          if (success) {
            purgedCount++;
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Purged ${purgedCount} expired versions (retention: ${retentionPeriod}ms, cutoff: ${new Date(cutoffTime).toISOString()})`);
      }
      
      this.emit('versionsPurged', { count: purgedCount, cutoffTime });
      
      return purgedCount;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to purge expired versions', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  // --- Helper Methods ---
  
  /**
   * Checks if an entity exists.
   * 
   * @private
   * @param {string} entityId - ID of the entity to check
   * @returns {Promise<boolean>} - Whether the entity exists
   */
  async checkEntityExists(entityId) {
    try {
      const node = await this.storageAdapter.retrieveNode(entityId);
      if (node) {
        return true;
      }
    } catch (e) {
      // Not a node, try edge
    }
    
    try {
      const edge = await this.storageAdapter.retrieveEdge(entityId);
      if (edge) {
        return true;
      }
    } catch (e) {
      // Not an edge either
    }
    
    return false;
  }
  
  /**
   * Gets all entities (nodes and edges).
   * 
   * @private
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>} - All entities
   */
  async getAllEntities(options = {}) {
    const nodes = await this.storageAdapter.queryNodes({});
    const edges = await this.storageAdapter.queryEdges({});
    
    return [...nodes, ...edges];
  }
  
  /**
   * Gets an entity with its temporal information.
   * 
   * @private
   * @param {string} entityId - ID of the entity
   * @returns {Promise<Object>} - Entity with temporal information
   */
  async getEntityWithTemporalInfo(entityId) {
    // Get entity
    let entity;
    try {
      entity = await this.storageAdapter.retrieveNode(entityId);
    } catch (e) {
      try {
        entity = await this.storageAdapter.retrieveEdge(entityId);
      } catch (e2) {
        throw new Error(`Failed to retrieve entity ${entityId}`);
      }
    }
    
    // Get versions
    const versions = await this.getVersions(entityId, {
      oldestFirst: true
    });
    
    // Determine start and end times
    const startTime = versions.length > 0 ? 
      versions[0].timestamp : 
      entity.createdAt;
    
    const endTime = entity.metadata.deletedAt || Date.now();
    
    return {
      ...entity,
      startTime,
      endTime,
      versions
    };
  }
  
  /**
   * Computes changes between two versions.
   * 
   * @private
   * @param {Object} oldVersion - Old version data
   * @param {Object} newVersion - New version data
   * @returns {Object} - Changes
   */
  computeChanges(oldVersion, newVersion) {
    const changes = {
      type: 'update',
      added: {},
      removed: {},
      modified: {}
    };
    
    // Check properties
    const oldProps = oldVersion.properties || {};
    const newProps = newVersion.properties || {};
    
    // Find added and modified properties
    for (const [key, value] of Object.entries(newProps)) {
      if (!(key in oldProps)) {
        changes.added[key] = value;
      } else if (JSON.stringify(oldProps[key]) !== JSON.stringify(value)) {
        changes.modified[key] = {
          old: oldProps[key],
          new: value
        };
      }
    }
    
    // Find removed properties
    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        changes.removed[key] = oldProps[key];
      }
    }
    
    return changes;
  }
  
  /**
   * Ensures the manager is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the manager is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('TemporalManager is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Shuts down the temporal manager.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down TemporalManager');
    }
    
    this.initialized = false;
    
    this.emit('shutdown');
  }
}

module.exports = { TemporalManager, TemporalResolution, TemporalRelationship };
