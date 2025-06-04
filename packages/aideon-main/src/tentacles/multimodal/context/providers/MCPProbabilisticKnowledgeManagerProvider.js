/**
 * @fileoverview MCPProbabilisticKnowledgeManagerProvider integrates the ProbabilisticKnowledgeManager
 * with the Model Context Protocol (MCP) system.
 * 
 * This provider enables the ProbabilisticKnowledgeManager to share context about uncertainty
 * handling, confidence scoring, and probabilistic inference with other tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPKnowledgeGraphContextProvider } = require('./MCPKnowledgeGraphContextProvider');

/**
 * Provider for integrating ProbabilisticKnowledgeManager with MCP.
 */
class MCPProbabilisticKnowledgeManagerProvider extends MCPKnowledgeGraphContextProvider {
  /**
   * Creates a new MCPProbabilisticKnowledgeManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.probabilisticKnowledgeManager - ProbabilisticKnowledgeManager instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options || !options.probabilisticKnowledgeManager) {
      throw new Error('MCPProbabilisticKnowledgeManagerProvider requires a valid probabilisticKnowledgeManager');
    }
    
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
    this.contextTypePrefix = 'knowledge.probabilistic';
    
    this.logger.info('MCPProbabilisticKnowledgeManagerProvider created');
  }
  
  /**
   * Sets up event listeners for probabilistic knowledge manager events.
   * 
   * @private
   */
  setupEventListeners() {
    // Confidence updated event
    this.probabilisticKnowledgeManager.on('confidenceUpdated', async (event) => {
      try {
        await this.handleConfidenceUpdated(event);
      } catch (error) {
        this.logger.error('Error handling confidenceUpdated event:', error);
      }
    });
    
    // Uncertainty added event
    this.probabilisticKnowledgeManager.on('uncertaintyAdded', async (event) => {
      try {
        await this.handleUncertaintyAdded(event);
      } catch (error) {
        this.logger.error('Error handling uncertaintyAdded event:', error);
      }
    });
    
    // Uncertainty resolved event
    this.probabilisticKnowledgeManager.on('uncertaintyResolved', async (event) => {
      try {
        await this.handleUncertaintyResolved(event);
      } catch (error) {
        this.logger.error('Error handling uncertaintyResolved event:', error);
      }
    });
    
    // Probability distribution updated event
    this.probabilisticKnowledgeManager.on('distributionUpdated', async (event) => {
      try {
        await this.handleDistributionUpdated(event);
      } catch (error) {
        this.logger.error('Error handling distributionUpdated event:', error);
      }
    });
    
    // Bayesian update event
    this.probabilisticKnowledgeManager.on('bayesianUpdate', async (event) => {
      try {
        await this.handleBayesianUpdate(event);
      } catch (error) {
        this.logger.error('Error handling bayesianUpdate event:', error);
      }
    });
    
    // Evidence added event
    this.probabilisticKnowledgeManager.on('evidenceAdded', async (event) => {
      try {
        await this.handleEvidenceAdded(event);
      } catch (error) {
        this.logger.error('Error handling evidenceAdded event:', error);
      }
    });
    
    this.logger.info('ProbabilisticKnowledgeManager event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.confidence`,
      `${this.contextTypePrefix}.uncertainty`
    ];
  }
  
  /**
   * Handles confidence updated events.
   * 
   * @private
   * @param {Object} event - Confidence updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleConfidenceUpdated(event) {
    const { entityId, entityType, oldConfidence, newConfidence, reason, metadata, confidence } = event;
    
    const contextData = {
      operation: 'update',
      entityId,
      entityType,
      oldConfidence,
      newConfidence,
      confidenceDelta: newConfidence - oldConfidence,
      reason,
      metadata: this.sanitizeProperties(metadata),
      timestamp: Date.now()
    };
    
    // Priority based on confidence change magnitude
    const priority = this.calculateConfidencePriority(oldConfidence, newConfidence);
    
    return this.addKnowledgeContext(
      contextData,
      'confidence',
      priority,
      confidence || 0.9,
      ['confidence', 'update', entityType]
    );
  }
  
  /**
   * Handles uncertainty added events.
   * 
   * @private
   * @param {Object} event - Uncertainty added event
   * @returns {Promise<string>} - Context ID
   */
  async handleUncertaintyAdded(event) {
    const { uncertaintyId, entityId, entityType, uncertaintyType, description, factors, confidence } = event;
    
    const contextData = {
      operation: 'add',
      uncertaintyId,
      entityId,
      entityType,
      uncertaintyType,
      description,
      factors: this.sanitizeProperties(factors),
      timestamp: Date.now()
    };
    
    // New uncertainties are important to track
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'uncertainty',
      priority,
      confidence || 0.9,
      ['uncertainty', 'add', uncertaintyType]
    );
  }
  
  /**
   * Handles uncertainty resolved events.
   * 
   * @private
   * @param {Object} event - Uncertainty resolved event
   * @returns {Promise<string>} - Context ID
   */
  async handleUncertaintyResolved(event) {
    const { uncertaintyId, entityId, entityType, resolution, resolutionConfidence, metadata, confidence } = event;
    
    const contextData = {
      operation: 'resolve',
      uncertaintyId,
      entityId,
      entityType,
      resolution,
      resolutionConfidence,
      metadata: this.sanitizeProperties(metadata),
      timestamp: Date.now()
    };
    
    // Resolving uncertainties is high priority
    const priority = 8;
    
    return this.addKnowledgeContext(
      contextData,
      'uncertainty',
      priority,
      confidence || 0.9,
      ['uncertainty', 'resolve', entityType]
    );
  }
  
  /**
   * Handles probability distribution updated events.
   * 
   * @private
   * @param {Object} event - Distribution updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleDistributionUpdated(event) {
    const { distributionId, entityId, entityType, distributionType, parameters, entropy, confidence } = event;
    
    const contextData = {
      operation: 'update',
      distributionId,
      entityId,
      entityType,
      distributionType,
      parameters: this.sanitizeProperties(parameters),
      entropy,
      timestamp: Date.now()
    };
    
    // Priority based on entropy (higher entropy = more uncertainty = higher priority)
    const priority = this.calculateEntropyPriority(entropy);
    
    return this.addKnowledgeContext(
      contextData,
      'confidence',
      priority,
      confidence || 0.85,
      ['distribution', distributionType, entityType]
    );
  }
  
  /**
   * Handles Bayesian update events.
   * 
   * @private
   * @param {Object} event - Bayesian update event
   * @returns {Promise<string>} - Context ID
   */
  async handleBayesianUpdate(event) {
    const { updateId, entityIds, priors, posteriors, evidence, confidence } = event;
    
    const contextData = {
      operation: 'bayesian_update',
      updateId,
      entityCount: entityIds.length,
      entityTypes: this.summarizeEntityTypes(entityIds),
      priors: this.summarizeProbabilities(priors),
      posteriors: this.summarizeProbabilities(posteriors),
      evidenceCount: evidence ? evidence.length : 0,
      timestamp: Date.now()
    };
    
    // Bayesian updates are significant for reasoning
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'confidence',
      priority,
      confidence || 0.9,
      ['bayesian', 'update']
    );
  }
  
  /**
   * Handles evidence added events.
   * 
   * @private
   * @param {Object} event - Evidence added event
   * @returns {Promise<string>} - Context ID
   */
  async handleEvidenceAdded(event) {
    const { evidenceId, entityId, entityType, evidenceType, strength, source, metadata, confidence } = event;
    
    const contextData = {
      operation: 'add_evidence',
      evidenceId,
      entityId,
      entityType,
      evidenceType,
      strength,
      source,
      metadata: this.sanitizeProperties(metadata),
      timestamp: Date.now()
    };
    
    // Priority based on evidence strength
    const priority = this.calculateEvidencePriority(strength);
    
    return this.addKnowledgeContext(
      contextData,
      'uncertainty',
      priority,
      confidence || 0.85,
      ['evidence', evidenceType, entityType]
    );
  }
  
  /**
   * Calculates priority for confidence updates based on change magnitude.
   * 
   * @private
   * @param {number} oldConfidence - Previous confidence value
   * @param {number} newConfidence - New confidence value
   * @returns {number} - Priority value (1-10)
   */
  calculateConfidencePriority(oldConfidence, newConfidence) {
    const delta = Math.abs(newConfidence - oldConfidence);
    
    // Large confidence changes are more significant
    if (delta > 0.5) {
      return 8;
    } else if (delta > 0.3) {
      return 7;
    } else if (delta > 0.1) {
      return 6;
    }
    
    return 5; // Default priority for small changes
  }
  
  /**
   * Calculates priority based on entropy value.
   * 
   * @private
   * @param {number} entropy - Entropy value
   * @returns {number} - Priority value (1-10)
   */
  calculateEntropyPriority(entropy) {
    if (!entropy && entropy !== 0) {
      return 5; // Default priority
    }
    
    // Higher entropy means more uncertainty, which may be more important to track
    if (entropy > 2.0) {
      return 7;
    } else if (entropy > 1.0) {
      return 6;
    }
    
    return 5; // Default priority for low entropy
  }
  
  /**
   * Calculates priority based on evidence strength.
   * 
   * @private
   * @param {number} strength - Evidence strength
   * @returns {number} - Priority value (1-10)
   */
  calculateEvidencePriority(strength) {
    if (!strength && strength !== 0) {
      return 5; // Default priority
    }
    
    // Stronger evidence is more significant
    if (strength > 0.8) {
      return 8;
    } else if (strength > 0.6) {
      return 7;
    } else if (strength > 0.4) {
      return 6;
    }
    
    return 5; // Default priority for weak evidence
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
   * Summarizes probability distributions.
   * 
   * @private
   * @param {Object} probabilities - Map of probabilities
   * @returns {Object} - Summary statistics
   */
  summarizeProbabilities(probabilities) {
    if (!probabilities || typeof probabilities !== 'object') {
      return {};
    }
    
    const values = Object.values(probabilities).filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return { count: 0 };
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      count: values.length,
      mean,
      min,
      max,
      sum
    };
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

module.exports = { MCPProbabilisticKnowledgeManagerProvider };
