/**
 * @fileoverview MCPTemporalManagerProvider integrates the TemporalManager
 * with the Model Context Protocol (MCP) system.
 * 
 * This provider enables the TemporalManager to share context about temporal
 * versioning, history tracking, and time-based knowledge operations with
 * other tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPKnowledgeGraphContextProvider } = require('./MCPKnowledgeGraphContextProvider');

/**
 * Provider for integrating TemporalManager with MCP.
 */
class MCPTemporalManagerProvider extends MCPKnowledgeGraphContextProvider {
  /**
   * Creates a new MCPTemporalManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.temporalManager - TemporalManager instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options || !options.temporalManager) {
      throw new Error('MCPTemporalManagerProvider requires a valid temporalManager');
    }
    
    this.temporalManager = options.temporalManager;
    this.contextTypePrefix = 'knowledge.temporal';
    
    this.logger.info('MCPTemporalManagerProvider created');
  }
  
  /**
   * Sets up event listeners for temporal manager events.
   * 
   * @private
   */
  setupEventListeners() {
    // Version created event
    this.temporalManager.on('versionCreated', async (event) => {
      try {
        await this.handleVersionCreated(event);
      } catch (error) {
        this.logger.error('Error handling versionCreated event:', error);
      }
    });
    
    // Version updated event
    this.temporalManager.on('versionUpdated', async (event) => {
      try {
        await this.handleVersionUpdated(event);
      } catch (error) {
        this.logger.error('Error handling versionUpdated event:', error);
      }
    });
    
    // Version branched event
    this.temporalManager.on('versionBranched', async (event) => {
      try {
        await this.handleVersionBranched(event);
      } catch (error) {
        this.logger.error('Error handling versionBranched event:', error);
      }
    });
    
    // Version merged event
    this.temporalManager.on('versionMerged', async (event) => {
      try {
        await this.handleVersionMerged(event);
      } catch (error) {
        this.logger.error('Error handling versionMerged event:', error);
      }
    });
    
    // History queried event
    this.temporalManager.on('historyQueried', async (event) => {
      try {
        await this.handleHistoryQueried(event);
      } catch (error) {
        this.logger.error('Error handling historyQueried event:', error);
      }
    });
    
    // Temporal snapshot created event
    this.temporalManager.on('snapshotCreated', async (event) => {
      try {
        await this.handleSnapshotCreated(event);
      } catch (error) {
        this.logger.error('Error handling snapshotCreated event:', error);
      }
    });
    
    // Temporal rollback event
    this.temporalManager.on('rollbackPerformed', async (event) => {
      try {
        await this.handleRollbackPerformed(event);
      } catch (error) {
        this.logger.error('Error handling rollbackPerformed event:', error);
      }
    });
    
    this.logger.info('TemporalManager event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.version`,
      `${this.contextTypePrefix}.history`
    ];
  }
  
  /**
   * Handles version created events.
   * 
   * @private
   * @param {Object} event - Version created event
   * @returns {Promise<string>} - Context ID
   */
  async handleVersionCreated(event) {
    const { versionId, entityId, entityType, timestamp, metadata, confidence } = event;
    
    const contextData = {
      operation: 'create',
      versionId,
      entityId,
      entityType,
      versionTimestamp: timestamp,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // New versions are moderately important
    const priority = 6;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.95,
      ['version', 'create', entityType]
    );
  }
  
  /**
   * Handles version updated events.
   * 
   * @private
   * @param {Object} event - Version updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleVersionUpdated(event) {
    const { versionId, entityId, entityType, changes, timestamp, metadata, confidence } = event;
    
    const contextData = {
      operation: 'update',
      versionId,
      entityId,
      entityType,
      changes: this.sanitizeProperties(changes),
      versionTimestamp: timestamp,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // Version updates are moderately important
    const priority = 5;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.9,
      ['version', 'update', entityType]
    );
  }
  
  /**
   * Handles version branched events.
   * 
   * @private
   * @param {Object} event - Version branched event
   * @returns {Promise<string>} - Context ID
   */
  async handleVersionBranched(event) {
    const { sourceVersionId, newVersionId, branchName, entityId, entityType, timestamp, metadata, confidence } = event;
    
    const contextData = {
      operation: 'branch',
      sourceVersionId,
      newVersionId,
      branchName,
      entityId,
      entityType,
      versionTimestamp: timestamp,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // Branching is significant as it creates alternative knowledge paths
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.9,
      ['version', 'branch', entityType]
    );
  }
  
  /**
   * Handles version merged events.
   * 
   * @private
   * @param {Object} event - Version merged event
   * @returns {Promise<string>} - Context ID
   */
  async handleVersionMerged(event) {
    const { sourceVersionId, targetVersionId, resultVersionId, entityId, entityType, conflicts, timestamp, metadata, confidence } = event;
    
    const contextData = {
      operation: 'merge',
      sourceVersionId,
      targetVersionId,
      resultVersionId,
      entityId,
      entityType,
      conflictCount: conflicts ? conflicts.length : 0,
      versionTimestamp: timestamp,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // Merging is highly significant as it consolidates knowledge
    const priority = 8;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.9,
      ['version', 'merge', entityType]
    );
  }
  
  /**
   * Handles history queried events.
   * 
   * @private
   * @param {Object} event - History queried event
   * @returns {Promise<string>} - Context ID
   */
  async handleHistoryQueried(event) {
    const { queryId, entityId, entityType, timeRange, resultCount, executionTime, confidence } = event;
    
    const contextData = {
      queryId,
      entityId,
      entityType,
      timeRange: this.sanitizeProperties(timeRange),
      resultCount,
      executionTime,
      timestamp: Date.now()
    };
    
    // History queries are generally lower priority
    const priority = 4;
    
    return this.addKnowledgeContext(
      contextData,
      'history',
      priority,
      confidence || 0.8,
      ['history', 'query', entityType]
    );
  }
  
  /**
   * Handles snapshot created events.
   * 
   * @private
   * @param {Object} event - Snapshot created event
   * @returns {Promise<string>} - Context ID
   */
  async handleSnapshotCreated(event) {
    const { snapshotId, entityIds, timestamp, description, metadata, confidence } = event;
    
    const contextData = {
      operation: 'snapshot',
      snapshotId,
      entityCount: entityIds.length,
      entityTypes: this.summarizeEntityTypes(entityIds),
      snapshotTimestamp: timestamp,
      description,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // Snapshots are important for system-wide consistency
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.95,
      ['version', 'snapshot']
    );
  }
  
  /**
   * Handles rollback performed events.
   * 
   * @private
   * @param {Object} event - Rollback performed event
   * @returns {Promise<string>} - Context ID
   */
  async handleRollbackPerformed(event) {
    const { rollbackId, targetVersionId, entityIds, timestamp, reason, metadata, confidence } = event;
    
    const contextData = {
      operation: 'rollback',
      rollbackId,
      targetVersionId,
      entityCount: entityIds.length,
      entityTypes: this.summarizeEntityTypes(entityIds),
      rollbackTimestamp: timestamp,
      reason,
      metadata: this.sanitizeProperties(metadata),
      systemTimestamp: Date.now()
    };
    
    // Rollbacks are critical operations that affect system state
    const priority = 9;
    
    return this.addKnowledgeContext(
      contextData,
      'version',
      priority,
      confidence || 0.95,
      ['version', 'rollback']
    );
  }
  
  /**
   * Summarizes entity types from a list of entity IDs.
   * 
   * @private
   * @param {string[]} entityIds - List of entity IDs
   * @returns {Object} - Summary of entity types and counts
   */
  summarizeEntityTypes(entityIds) {
    if (!entityIds || !Array.isArray(entityIds)) {
      return {};
    }
    
    // In a real implementation, this would query the knowledge graph
    // to get entity types. For now, we'll extract type from ID format
    // assuming IDs follow a pattern like "type:id" (e.g., "person:123")
    const typeCounts = {};
    
    entityIds.forEach(id => {
      const parts = id.split(':');
      if (parts.length > 1) {
        const type = parts[0];
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      } else {
        typeCounts['unknown'] = (typeCounts['unknown'] || 0) + 1;
      }
    });
    
    return typeCounts;
  }
  
  /**
   * Sanitizes properties to ensure they are suitable for context storage.
   * 
   * @private
   * @param {Object} properties - Properties to sanitize
   * @returns {Object} - Sanitized properties
   */
  sanitizeProperties(properties) {
    if (!properties) {
      return {};
    }
    
    // Create a shallow copy to avoid modifying the original
    const sanitized = { ...properties };
    
    // Remove any functions or circular references
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      
      // Remove functions
      if (typeof value === 'function') {
        delete sanitized[key];
      }
      // Handle potential circular references
      else if (typeof value === 'object' && value !== null) {
        try {
          // Test if it can be serialized
          JSON.stringify(value);
        } catch (error) {
          // If serialization fails, replace with a simple representation
          sanitized[key] = `[Complex Object: ${typeof value}]`;
        }
      }
    });
    
    return sanitized;
  }
}

module.exports = { MCPTemporalManagerProvider };
