/**
 * @fileoverview Knowledge Context Schemas for MCP integration.
 * 
 * This module defines JSON schemas for knowledge context data structures
 * to ensure consistency and validation across all knowledge graph context providers.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base schema for all knowledge context objects.
 */
const baseKnowledgeContextSchema = {
  type: 'object',
  required: ['operation', 'timestamp'],
  properties: {
    operation: {
      type: 'string',
      description: 'The operation type that generated this context'
    },
    timestamp: {
      type: 'number',
      description: 'Unix timestamp when the context was created'
    }
  }
};

/**
 * Schema for node update contexts.
 */
const nodeUpdateContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'nodeId', 'nodeType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['add', 'update', 'remove'],
      description: 'The node operation type'
    },
    nodeId: {
      type: 'string',
      description: 'Unique identifier for the node'
    },
    nodeType: {
      type: 'string',
      description: 'Type of the node'
    },
    properties: {
      type: 'object',
      description: 'Node properties (for add/update operations)'
    },
    changes: {
      type: 'object',
      description: 'Property changes (for update operations)'
    }
  }
};

/**
 * Schema for edge update contexts.
 */
const edgeUpdateContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'edgeId', 'sourceId', 'targetId', 'edgeType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['add', 'update', 'remove'],
      description: 'The edge operation type'
    },
    edgeId: {
      type: 'string',
      description: 'Unique identifier for the edge'
    },
    sourceId: {
      type: 'string',
      description: 'Source node identifier'
    },
    targetId: {
      type: 'string',
      description: 'Target node identifier'
    },
    edgeType: {
      type: 'string',
      description: 'Type of the edge'
    },
    properties: {
      type: 'object',
      description: 'Edge properties (for add/update operations)'
    },
    changes: {
      type: 'object',
      description: 'Property changes (for update operations)'
    }
  }
};

/**
 * Schema for query contexts.
 */
const queryContextSchema = {
  type: 'object',
  required: ['queryId', 'queryType', 'timestamp'],
  properties: {
    operation: {
      type: 'string',
      description: 'The operation type that generated this context',
      default: 'query'
    },
    queryId: {
      type: 'string',
      description: 'Unique identifier for the query'
    },
    queryType: {
      type: 'string',
      description: 'Type of query performed'
    },
    parameters: {
      type: 'object',
      description: 'Query parameters'
    },
    resultCount: {
      type: 'number',
      description: 'Number of results returned'
    },
    executionTime: {
      type: 'number',
      description: 'Query execution time in milliseconds'
    },
    timestamp: {
      type: 'number',
      description: 'Unix timestamp when the context was created'
    }
  }
};

/**
 * Schema for inference contexts.
 */
const inferenceContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'inferenceId', 'inferenceType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    inferenceId: {
      type: 'string',
      description: 'Unique identifier for the inference'
    },
    inferenceType: {
      type: 'string',
      description: 'Type of inference performed'
    },
    inputs: {
      type: 'object',
      description: 'Inference inputs'
    },
    resultCount: {
      type: 'number',
      description: 'Number of inference results'
    }
  }
};

/**
 * Schema for hyperedge contexts.
 */
const hyperedgeContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'hyperedgeId', 'nodeIds', 'type'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['add', 'update', 'remove'],
      description: 'The hyperedge operation type'
    },
    hyperedgeId: {
      type: 'string',
      description: 'Unique identifier for the hyperedge'
    },
    nodeIds: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Array of node identifiers in the hyperedge'
    },
    type: {
      type: 'string',
      description: 'Type of the hyperedge'
    },
    properties: {
      type: 'object',
      description: 'Hyperedge properties'
    },
    changes: {
      type: 'object',
      description: 'Property changes (for update operations)'
    },
    nodeCount: {
      type: 'number',
      description: 'Number of nodes in the hyperedge'
    }
  }
};

/**
 * Schema for complex relation contexts.
 */
const complexRelationContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'relationId', 'entities', 'relationType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['add', 'update', 'remove'],
      description: 'The relation operation type'
    },
    relationId: {
      type: 'string',
      description: 'Unique identifier for the complex relation'
    },
    entities: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Array of entity identifiers in the relation'
    },
    relationType: {
      type: 'string',
      description: 'Type of the complex relation'
    },
    attributes: {
      type: 'object',
      description: 'Relation attributes'
    },
    changes: {
      type: 'object',
      description: 'Attribute changes (for update operations)'
    },
    entityCount: {
      type: 'number',
      description: 'Number of entities in the relation'
    }
  }
};

/**
 * Schema for version contexts.
 */
const versionContextSchema = {
  type: 'object',
  required: ['operation', 'versionId', 'entityId', 'entityType', 'systemTimestamp'],
  properties: {
    operation: {
      type: 'string',
      enum: ['create', 'update', 'branch', 'merge', 'snapshot', 'rollback'],
      description: 'The version operation type'
    },
    versionId: {
      type: 'string',
      description: 'Unique identifier for the version'
    },
    entityId: {
      type: 'string',
      description: 'Entity identifier'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    versionTimestamp: {
      type: 'number',
      description: 'Timestamp of the version'
    },
    metadata: {
      type: 'object',
      description: 'Version metadata'
    },
    changes: {
      type: 'object',
      description: 'Changes in this version'
    },
    sourceVersionId: {
      type: 'string',
      description: 'Source version identifier (for branch/merge operations)'
    },
    targetVersionId: {
      type: 'string',
      description: 'Target version identifier (for merge operations)'
    },
    resultVersionId: {
      type: 'string',
      description: 'Result version identifier (for merge operations)'
    },
    branchName: {
      type: 'string',
      description: 'Branch name (for branch operations)'
    },
    conflictCount: {
      type: 'number',
      description: 'Number of conflicts (for merge operations)'
    },
    systemTimestamp: {
      type: 'number',
      description: 'System timestamp when the operation occurred'
    }
  }
};

/**
 * Schema for history contexts.
 */
const historyContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'queryId', 'entityId', 'entityType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    queryId: {
      type: 'string',
      description: 'Unique identifier for the history query'
    },
    entityId: {
      type: 'string',
      description: 'Entity identifier'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    timeRange: {
      type: 'object',
      properties: {
        start: {
          type: 'number',
          description: 'Start timestamp'
        },
        end: {
          type: 'number',
          description: 'End timestamp'
        }
      },
      description: 'Time range for the history query'
    },
    resultCount: {
      type: 'number',
      description: 'Number of history entries returned'
    },
    executionTime: {
      type: 'number',
      description: 'Query execution time in milliseconds'
    }
  }
};

/**
 * Schema for confidence contexts.
 */
const confidenceContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'entityId', 'entityType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['update', 'bayesian_update'],
      description: 'The confidence operation type'
    },
    entityId: {
      type: 'string',
      description: 'Entity identifier'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    oldConfidence: {
      type: 'number',
      description: 'Previous confidence value'
    },
    newConfidence: {
      type: 'number',
      description: 'New confidence value'
    },
    confidenceDelta: {
      type: 'number',
      description: 'Change in confidence'
    },
    reason: {
      type: 'string',
      description: 'Reason for confidence update'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata'
    },
    distributionId: {
      type: 'string',
      description: 'Distribution identifier'
    },
    distributionType: {
      type: 'string',
      description: 'Type of probability distribution'
    },
    parameters: {
      type: 'object',
      description: 'Distribution parameters'
    },
    entropy: {
      type: 'number',
      description: 'Entropy of the distribution'
    },
    updateId: {
      type: 'string',
      description: 'Update identifier'
    },
    entityCount: {
      type: 'number',
      description: 'Number of entities affected'
    },
    entityTypes: {
      type: 'object',
      description: 'Summary of entity types affected'
    },
    priors: {
      type: 'object',
      description: 'Prior probability summary'
    },
    posteriors: {
      type: 'object',
      description: 'Posterior probability summary'
    },
    evidenceCount: {
      type: 'number',
      description: 'Number of evidence items'
    }
  }
};

/**
 * Schema for uncertainty contexts.
 */
const uncertaintyContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'uncertaintyId', 'entityId', 'entityType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['add', 'resolve', 'add_evidence'],
      description: 'The uncertainty operation type'
    },
    uncertaintyId: {
      type: 'string',
      description: 'Uncertainty identifier'
    },
    entityId: {
      type: 'string',
      description: 'Entity identifier'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    uncertaintyType: {
      type: 'string',
      description: 'Type of uncertainty'
    },
    description: {
      type: 'string',
      description: 'Description of the uncertainty'
    },
    factors: {
      type: 'object',
      description: 'Factors contributing to uncertainty'
    },
    resolution: {
      type: 'string',
      description: 'Resolution of the uncertainty'
    },
    resolutionConfidence: {
      type: 'number',
      description: 'Confidence in the resolution'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata'
    },
    evidenceId: {
      type: 'string',
      description: 'Evidence identifier'
    },
    evidenceType: {
      type: 'string',
      description: 'Type of evidence'
    },
    strength: {
      type: 'number',
      description: 'Strength of the evidence'
    },
    source: {
      type: 'string',
      description: 'Source of the evidence'
    }
  }
};

/**
 * Schema for embedding contexts.
 */
const embeddingContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'embeddingId', 'entityId', 'entityType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['generate'],
      description: 'The embedding operation type'
    },
    embeddingId: {
      type: 'string',
      description: 'Embedding identifier'
    },
    entityId: {
      type: 'string',
      description: 'Entity identifier'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    dimensions: {
      type: 'number',
      description: 'Number of dimensions in the embedding'
    },
    algorithm: {
      type: 'string',
      description: 'Algorithm used to generate the embedding'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata'
    }
  }
};

/**
 * Schema for model contexts.
 */
const modelContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'modelId', 'modelType'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['train', 'cluster'],
      description: 'The model operation type'
    },
    modelId: {
      type: 'string',
      description: 'Model identifier'
    },
    modelType: {
      type: 'string',
      description: 'Type of model'
    },
    parameters: {
      type: 'object',
      description: 'Model parameters'
    },
    metrics: {
      type: 'object',
      description: 'Performance metrics'
    },
    trainingTime: {
      type: 'number',
      description: 'Training time in milliseconds'
    },
    entityCount: {
      type: 'number',
      description: 'Number of entities used in training'
    },
    clusteringId: {
      type: 'string',
      description: 'Clustering identifier'
    },
    algorithm: {
      type: 'string',
      description: 'Clustering algorithm'
    },
    clusterCount: {
      type: 'number',
      description: 'Number of clusters'
    },
    nodeCount: {
      type: 'number',
      description: 'Number of nodes clustered'
    }
  }
};

/**
 * Schema for prediction contexts.
 */
const predictionContextSchema = {
  ...baseKnowledgeContextSchema,
  required: [...baseKnowledgeContextSchema.required, 'predictionId', 'modelId'],
  properties: {
    ...baseKnowledgeContextSchema.properties,
    operation: {
      type: 'string',
      enum: ['predict', 'classify', 'predict_link'],
      description: 'The prediction operation type'
    },
    predictionId: {
      type: 'string',
      description: 'Prediction identifier'
    },
    modelId: {
      type: 'string',
      description: 'Model identifier'
    },
    entityCount: {
      type: 'number',
      description: 'Number of entities in prediction'
    },
    entityTypes: {
      type: 'object',
      description: 'Summary of entity types'
    },
    predictionType: {
      type: 'string',
      description: 'Type of prediction'
    },
    nodeId: {
      type: 'string',
      description: 'Node identifier (for classification)'
    },
    nodeType: {
      type: 'string',
      description: 'Type of node (for classification)'
    },
    classificationId: {
      type: 'string',
      description: 'Classification identifier'
    },
    labels: {
      type: 'object',
      description: 'Classification labels'
    },
    scores: {
      type: 'object',
      description: 'Classification scores'
    },
    sourceId: {
      type: 'string',
      description: 'Source node identifier (for link prediction)'
    },
    targetId: {
      type: 'string',
      description: 'Target node identifier (for link prediction)'
    },
    relationTypes: {
      type: 'object',
      description: 'Predicted relation types'
    }
  }
};

/**
 * Map of context types to their schemas.
 */
const knowledgeContextSchemas = {
  'knowledge.graph.update.node': nodeUpdateContextSchema,
  'knowledge.graph.update.edge': edgeUpdateContextSchema,
  'knowledge.graph.query': queryContextSchema,
  'knowledge.graph.inference': inferenceContextSchema,
  'knowledge.hypergraph.relation': hyperedgeContextSchema,
  'knowledge.hypergraph.query': queryContextSchema,
  'knowledge.temporal.version': versionContextSchema,
  'knowledge.temporal.history': historyContextSchema,
  'knowledge.probabilistic.confidence': confidenceContextSchema,
  'knowledge.probabilistic.uncertainty': uncertaintyContextSchema,
  'knowledge.gnn.embedding': embeddingContextSchema,
  'knowledge.gnn.model': modelContextSchema,
  'knowledge.gnn.prediction': predictionContextSchema
};

/**
 * Validates a context object against its schema.
 * 
 * @param {string} contextType - The type of context
 * @param {Object} contextData - The context data to validate
 * @returns {Object} - Validation result with isValid flag and errors
 */
function validateKnowledgeContext(contextType, contextData) {
  const schema = knowledgeContextSchemas[contextType];
  
  if (!schema) {
    return {
      isValid: false,
      errors: [`Unknown context type: ${contextType}`]
    };
  }
  
  const errors = [];
  
  // Check required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (contextData[requiredProp] === undefined) {
        errors.push(`Missing required property: ${requiredProp}`);
      }
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (contextData[propName] !== undefined) {
        const value = contextData[propName];
        
        // Type checking
        if (propSchema.type === 'string' && typeof value !== 'string') {
          errors.push(`Property ${propName} should be a string`);
        } else if (propSchema.type === 'number' && typeof value !== 'number') {
          errors.push(`Property ${propName} should be a number`);
        } else if (propSchema.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
          errors.push(`Property ${propName} should be an object`);
        } else if (propSchema.type === 'array' && !Array.isArray(value)) {
          errors.push(`Property ${propName} should be an array`);
        }
        
        // Enum checking
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Property ${propName} should be one of: ${propSchema.enum.join(', ')}`);
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  knowledgeContextSchemas,
  validateKnowledgeContext,
  baseKnowledgeContextSchema,
  nodeUpdateContextSchema,
  edgeUpdateContextSchema,
  queryContextSchema,
  inferenceContextSchema,
  hyperedgeContextSchema,
  complexRelationContextSchema,
  versionContextSchema,
  historyContextSchema,
  confidenceContextSchema,
  uncertaintyContextSchema,
  embeddingContextSchema,
  modelContextSchema,
  predictionContextSchema
};
