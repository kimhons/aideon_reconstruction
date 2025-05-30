/**
 * @fileoverview Reasoning Context Schemas for MCP integration.
 * 
 * This module defines JSON schemas for reasoning context data structures
 * to ensure consistency and validation across all reasoning engine context providers.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base schema for all reasoning context objects.
 */
const baseReasoningContextSchema = {
  type: 'object',
  required: ['taskId', 'timestamp'],
  properties: {
    taskId: {
      type: 'string',
      description: 'The task identifier associated with this reasoning context'
    },
    timestamp: {
      type: 'number',
      description: 'Unix timestamp when the context was created'
    }
  }
};

/**
 * Schema for strategy selection contexts.
 */
const strategySelectionContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'strategyId', 'strategyType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    strategyId: {
      type: 'string',
      description: 'Unique identifier for the selected strategy'
    },
    strategyType: {
      type: 'string',
      description: 'Type of the selected strategy'
    },
    selectionReason: {
      type: 'string',
      description: 'Reason for selecting this strategy'
    },
    alternativeStrategies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          strategyId: {
            type: 'string',
            description: 'Strategy identifier'
          },
          strategyType: {
            type: 'string',
            description: 'Strategy type'
          },
          score: {
            type: 'number',
            description: 'Selection score'
          }
        }
      },
      description: 'Alternative strategies that were considered'
    },
    parameters: {
      type: 'object',
      description: 'Strategy parameters'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the strategy selection'
    }
  }
};

/**
 * Schema for strategy execution contexts.
 */
const strategyExecutionContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'strategyId', 'executionId'],
  properties: {
    ...baseReasoningContextSchema.properties,
    strategyId: {
      type: 'string',
      description: 'Strategy identifier'
    },
    executionId: {
      type: 'string',
      description: 'Unique identifier for this execution'
    },
    duration: {
      type: 'number',
      description: 'Execution duration in milliseconds'
    },
    resourceUsage: {
      type: 'object',
      properties: {
        cpu: {
          type: 'number',
          description: 'CPU usage percentage'
        },
        memory: {
          type: 'number',
          description: 'Memory usage in bytes'
        },
        network: {
          type: 'number',
          description: 'Network usage in bytes'
        }
      },
      description: 'Resource usage during execution'
    },
    resultSummary: {
      type: 'object',
      description: 'Summary of execution results'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the execution results'
    }
  }
};

/**
 * Schema for strategy failure contexts.
 */
const strategyFailureContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'strategyId', 'executionId', 'errorType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    strategyId: {
      type: 'string',
      description: 'Strategy identifier'
    },
    executionId: {
      type: 'string',
      description: 'Execution identifier'
    },
    errorType: {
      type: 'string',
      description: 'Type of error that occurred'
    },
    errorMessage: {
      type: 'string',
      description: 'Error message'
    },
    stackTrace: {
      type: 'string',
      description: 'Error stack trace'
    },
    recoveryAttempted: {
      type: 'boolean',
      description: 'Whether recovery was attempted'
    },
    recoverySuccessful: {
      type: 'boolean',
      description: 'Whether recovery was successful'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the error assessment'
    }
  }
};

/**
 * Schema for model selection contexts.
 */
const modelSelectionContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'strategyId', 'modelId', 'modelType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    strategyId: {
      type: 'string',
      description: 'Strategy identifier'
    },
    modelId: {
      type: 'string',
      description: 'Unique identifier for the selected model'
    },
    modelType: {
      type: 'string',
      description: 'Type of the selected model'
    },
    selectionReason: {
      type: 'string',
      description: 'Reason for selecting this model'
    },
    alternativeModels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          modelId: {
            type: 'string',
            description: 'Model identifier'
          },
          modelType: {
            type: 'string',
            description: 'Model type'
          },
          score: {
            type: 'number',
            description: 'Selection score'
          }
        }
      },
      description: 'Alternative models that were considered'
    },
    parameters: {
      type: 'object',
      description: 'Model parameters'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the model selection'
    }
  }
};

/**
 * Schema for deductive rule application contexts.
 */
const deductiveRuleContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'ruleId', 'ruleName', 'conclusion'],
  properties: {
    ...baseReasoningContextSchema.properties,
    ruleId: {
      type: 'string',
      description: 'Unique identifier for the rule'
    },
    ruleName: {
      type: 'string',
      description: 'Name of the rule'
    },
    premises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Premise identifier'
          },
          statement: {
            type: 'string',
            description: 'Premise statement'
          }
        }
      },
      description: 'Premises used in the rule application'
    },
    conclusion: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Conclusion identifier'
        },
        statement: {
          type: 'string',
          description: 'Conclusion statement'
        }
      },
      description: 'Conclusion derived from the rule application'
    },
    justification: {
      type: 'string',
      description: 'Justification for the rule application'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the rule application'
    }
  }
};

/**
 * Schema for deductive inference contexts.
 */
const deductiveInferenceContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'inferenceId', 'statement'],
  properties: {
    ...baseReasoningContextSchema.properties,
    inferenceId: {
      type: 'string',
      description: 'Unique identifier for the inference'
    },
    statement: {
      type: 'string',
      description: 'Inference statement'
    },
    derivedFrom: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Identifiers of statements this inference was derived from'
    },
    rulesApplied: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Identifiers of rules applied to derive this inference'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the inference'
    }
  }
};

/**
 * Schema for deductive contradiction contexts.
 */
const deductiveContradictionContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'contradictionId', 'statements'],
  properties: {
    ...baseReasoningContextSchema.properties,
    contradictionId: {
      type: 'string',
      description: 'Unique identifier for the contradiction'
    },
    statements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Statement identifier'
          },
          statement: {
            type: 'string',
            description: 'Statement content'
          }
        }
      },
      description: 'Contradictory statements'
    },
    explanation: {
      type: 'string',
      description: 'Explanation of the contradiction'
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Severity of the contradiction'
    },
    resolutionStrategy: {
      type: 'string',
      description: 'Strategy for resolving the contradiction'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the contradiction detection'
    }
  }
};

/**
 * Schema for deductive proof contexts.
 */
const deductiveProofContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'proofId', 'goal'],
  properties: {
    ...baseReasoningContextSchema.properties,
    proofId: {
      type: 'string',
      description: 'Unique identifier for the proof'
    },
    goal: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Goal identifier'
        },
        statement: {
          type: 'string',
          description: 'Goal statement'
        }
      },
      description: 'Goal of the proof'
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            description: 'Step identifier'
          },
          type: {
            type: 'string',
            description: 'Step type'
          },
          statement: {
            type: 'string',
            description: 'Step statement'
          },
          justification: {
            type: 'string',
            description: 'Step justification'
          }
        }
      },
      description: 'Steps in the proof'
    },
    isComplete: {
      type: 'boolean',
      description: 'Whether the proof is complete'
    },
    isValid: {
      type: 'boolean',
      description: 'Whether the proof is valid'
    },
    duration: {
      type: 'number',
      description: 'Proof duration in milliseconds'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the proof'
    }
  }
};

/**
 * Schema for inductive pattern contexts.
 */
const inductivePatternContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'patternId', 'patternType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    patternId: {
      type: 'string',
      description: 'Unique identifier for the pattern'
    },
    patternType: {
      type: 'string',
      description: 'Type of pattern detected'
    },
    dataPoints: {
      type: 'array',
      items: {
        type: 'object'
      },
      description: 'Data points exhibiting the pattern'
    },
    description: {
      type: 'string',
      description: 'Description of the pattern'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the pattern detection'
    }
  }
};

/**
 * Schema for inductive hypothesis contexts.
 */
const inductiveHypothesisContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'hypothesisId', 'statement'],
  properties: {
    ...baseReasoningContextSchema.properties,
    hypothesisId: {
      type: 'string',
      description: 'Unique identifier for the hypothesis'
    },
    statement: {
      type: 'string',
      description: 'Hypothesis statement'
    },
    basedOnPatterns: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Patterns this hypothesis is based on'
    },
    alternativeHypotheses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Hypothesis identifier'
          },
          statement: {
            type: 'string',
            description: 'Hypothesis statement'
          },
          score: {
            type: 'number',
            description: 'Hypothesis score'
          }
        }
      },
      description: 'Alternative hypotheses that were considered'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the hypothesis'
    }
  }
};

/**
 * Schema for inductive test contexts.
 */
const inductiveTestContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'hypothesisId', 'testId', 'testMethod', 'result', 'passed'],
  properties: {
    ...baseReasoningContextSchema.properties,
    hypothesisId: {
      type: 'string',
      description: 'Hypothesis identifier'
    },
    testId: {
      type: 'string',
      description: 'Unique identifier for the test'
    },
    testMethod: {
      type: 'string',
      description: 'Method used for testing'
    },
    testData: {
      type: 'array',
      items: {
        type: 'object'
      },
      description: 'Data used in the test'
    },
    result: {
      type: 'object',
      description: 'Test result details'
    },
    passed: {
      type: 'boolean',
      description: 'Whether the test passed'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the test result'
    }
  }
};

/**
 * Schema for inductive generalization contexts.
 */
const inductiveGeneralizationContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'generalizationId', 'statement', 'scope'],
  properties: {
    ...baseReasoningContextSchema.properties,
    generalizationId: {
      type: 'string',
      description: 'Unique identifier for the generalization'
    },
    statement: {
      type: 'string',
      description: 'Generalization statement'
    },
    scope: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain of applicability'
        },
        constraints: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Constraints on applicability'
        }
      },
      description: 'Scope of the generalization'
    },
    supportingEvidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Evidence identifier'
          },
          type: {
            type: 'string',
            description: 'Evidence type'
          },
          description: {
            type: 'string',
            description: 'Evidence description'
          }
        }
      },
      description: 'Evidence supporting the generalization'
    },
    counterExamples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Counter-example identifier'
          },
          description: {
            type: 'string',
            description: 'Counter-example description'
          }
        }
      },
      description: 'Counter-examples to the generalization'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the generalization'
    }
  }
};

/**
 * Schema for task execution contexts.
 */
const taskExecutionContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'executionId', 'status'],
  properties: {
    ...baseReasoningContextSchema.properties,
    executionId: {
      type: 'string',
      description: 'Unique identifier for the task execution'
    },
    status: {
      type: 'string',
      enum: ['started', 'in_progress', 'completed', 'failed', 'cancelled'],
      description: 'Status of the task execution'
    },
    progress: {
      type: 'number',
      description: 'Progress percentage (0-100)'
    },
    startTime: {
      type: 'number',
      description: 'Task start timestamp'
    },
    endTime: {
      type: 'number',
      description: 'Task end timestamp'
    },
    duration: {
      type: 'number',
      description: 'Task duration in milliseconds'
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            description: 'Step identifier'
          },
          description: {
            type: 'string',
            description: 'Step description'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
            description: 'Step status'
          }
        }
      },
      description: 'Steps in the task execution'
    },
    result: {
      type: 'object',
      description: 'Task execution result'
    },
    error: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Error type'
        },
        message: {
          type: 'string',
          description: 'Error message'
        },
        details: {
          type: 'object',
          description: 'Error details'
        }
      },
      description: 'Error information (if failed)'
    }
  }
};

/**
 * Schema for result generation contexts.
 */
const resultGenerationContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'resultId', 'resultType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    resultId: {
      type: 'string',
      description: 'Unique identifier for the result'
    },
    resultType: {
      type: 'string',
      description: 'Type of result generated'
    },
    content: {
      type: 'object',
      description: 'Result content'
    },
    format: {
      type: 'string',
      description: 'Result format'
    },
    metadata: {
      type: 'object',
      description: 'Result metadata'
    },
    generationTime: {
      type: 'number',
      description: 'Generation time in milliseconds'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the result'
    }
  }
};

/**
 * Schema for explanation trace contexts.
 */
const explanationTraceContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'traceId', 'targetId', 'targetType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    traceId: {
      type: 'string',
      description: 'Unique identifier for the explanation trace'
    },
    targetId: {
      type: 'string',
      description: 'Identifier of the target being explained'
    },
    targetType: {
      type: 'string',
      description: 'Type of the target being explained'
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            description: 'Step identifier'
          },
          type: {
            type: 'string',
            description: 'Step type'
          },
          description: {
            type: 'string',
            description: 'Step description'
          },
          inputs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Input identifiers'
          },
          outputs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Output identifiers'
          }
        }
      },
      description: 'Steps in the explanation trace'
    },
    format: {
      type: 'string',
      description: 'Explanation format'
    },
    audience: {
      type: 'string',
      description: 'Target audience for the explanation'
    },
    complexity: {
      type: 'string',
      enum: ['simple', 'detailed', 'technical'],
      description: 'Explanation complexity level'
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the explanation'
    }
  }
};

/**
 * Schema for uncertainty assessment contexts.
 */
const uncertaintyAssessmentContextSchema = {
  ...baseReasoningContextSchema,
  required: [...baseReasoningContextSchema.required, 'assessmentId', 'targetId', 'targetType'],
  properties: {
    ...baseReasoningContextSchema.properties,
    assessmentId: {
      type: 'string',
      description: 'Unique identifier for the uncertainty assessment'
    },
    targetId: {
      type: 'string',
      description: 'Identifier of the target being assessed'
    },
    targetType: {
      type: 'string',
      description: 'Type of the target being assessed'
    },
    uncertaintyType: {
      type: 'string',
      enum: ['epistemic', 'aleatoric', 'ontological'],
      description: 'Type of uncertainty'
    },
    confidenceScore: {
      type: 'number',
      description: 'Confidence score (0-1)'
    },
    confidenceInterval: {
      type: 'object',
      properties: {
        lower: {
          type: 'number',
          description: 'Lower bound'
        },
        upper: {
          type: 'number',
          description: 'Upper bound'
        }
      },
      description: 'Confidence interval'
    },
    factors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factor: {
            type: 'string',
            description: 'Uncertainty factor'
          },
          impact: {
            type: 'number',
            description: 'Factor impact (0-1)'
          }
        }
      },
      description: 'Factors contributing to uncertainty'
    },
    mitigationStrategies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            description: 'Mitigation strategy'
          },
          potentialImpact: {
            type: 'number',
            description: 'Potential impact of the strategy (0-1)'
          }
        }
      },
      description: 'Strategies for mitigating uncertainty'
    }
  }
};

/**
 * Map of context types to their schemas.
 */
const reasoningContextSchemas = {
  'reasoning.strategy.selection': strategySelectionContextSchema,
  'reasoning.strategy.execution': strategyExecutionContextSchema,
  'reasoning.strategy.failure': strategyFailureContextSchema,
  'reasoning.model.selection': modelSelectionContextSchema,
  'reasoning.deductive.rule': deductiveRuleContextSchema,
  'reasoning.deductive.inference': deductiveInferenceContextSchema,
  'reasoning.deductive.contradiction': deductiveContradictionContextSchema,
  'reasoning.deductive.proof': deductiveProofContextSchema,
  'reasoning.inductive.pattern': inductivePatternContextSchema,
  'reasoning.inductive.hypothesis': inductiveHypothesisContextSchema,
  'reasoning.inductive.test': inductiveTestContextSchema,
  'reasoning.inductive.generalization': inductiveGeneralizationContextSchema,
  'reasoning.task.execution': taskExecutionContextSchema,
  'reasoning.result.generation': resultGenerationContextSchema,
  'reasoning.explanation.trace': explanationTraceContextSchema,
  'reasoning.uncertainty.assessment': uncertaintyAssessmentContextSchema
};

/**
 * Validates a context object against its schema.
 * 
 * @param {string} contextType - The type of context
 * @param {Object} contextData - The context data to validate
 * @returns {Object} Validation result with isValid and errors properties
 */
function validateReasoningContext(contextType, contextData) {
  const schema = reasoningContextSchemas[contextType];
  
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
        const propValue = contextData[propName];
        
        // Type checking
        if (propSchema.type === 'string' && typeof propValue !== 'string') {
          errors.push(`Property ${propName} should be a string`);
        } else if (propSchema.type === 'number' && typeof propValue !== 'number') {
          errors.push(`Property ${propName} should be a number`);
        } else if (propSchema.type === 'boolean' && typeof propValue !== 'boolean') {
          errors.push(`Property ${propName} should be a boolean`);
        } else if (propSchema.type === 'object' && (typeof propValue !== 'object' || propValue === null || Array.isArray(propValue))) {
          errors.push(`Property ${propName} should be an object`);
        } else if (propSchema.type === 'array' && !Array.isArray(propValue)) {
          errors.push(`Property ${propName} should be an array`);
        }
        
        // Enum validation
        if (propSchema.enum && !propSchema.enum.includes(propValue)) {
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
  reasoningContextSchemas,
  validateReasoningContext,
  
  // Export individual schemas for direct use
  baseReasoningContextSchema,
  strategySelectionContextSchema,
  strategyExecutionContextSchema,
  strategyFailureContextSchema,
  modelSelectionContextSchema,
  deductiveRuleContextSchema,
  deductiveInferenceContextSchema,
  deductiveContradictionContextSchema,
  deductiveProofContextSchema,
  inductivePatternContextSchema,
  inductiveHypothesisContextSchema,
  inductiveTestContextSchema,
  inductiveGeneralizationContextSchema,
  taskExecutionContextSchema,
  resultGenerationContextSchema,
  explanationTraceContextSchema,
  uncertaintyAssessmentContextSchema
};
