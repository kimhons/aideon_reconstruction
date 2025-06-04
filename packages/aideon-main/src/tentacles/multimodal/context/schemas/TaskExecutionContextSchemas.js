/**
 * @fileoverview Task Execution context schemas for MCP integration.
 * Defines schemas for all task execution context types.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Schema for task.planning.plan context type.
 * Represents a task execution plan with steps, dependencies, and metadata.
 */
const taskPlanningPlanSchema = {
  type: 'object',
  required: ['planId', 'name', 'steps', 'createdAt'],
  properties: {
    planId: {
      type: 'string',
      description: 'Unique identifier for the plan'
    },
    name: {
      type: 'string',
      description: 'Human-readable name for the plan'
    },
    description: {
      type: 'string',
      description: 'Detailed description of the plan'
    },
    steps: {
      type: 'array',
      description: 'Ordered steps in the plan',
      items: {
        type: 'object',
        required: ['stepId', 'action', 'status'],
        properties: {
          stepId: {
            type: 'string',
            description: 'Unique identifier for the step'
          },
          action: {
            type: 'string',
            description: 'Action to perform in this step'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the step'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
            description: 'Current status of the step'
          },
          dependencies: {
            type: 'array',
            description: 'Step IDs that must be completed before this step',
            items: {
              type: 'string'
            }
          },
          estimatedDuration: {
            type: 'number',
            description: 'Estimated duration in milliseconds'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the action'
          },
          result: {
            type: 'object',
            description: 'Result of the step execution'
          }
        }
      }
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Priority level of the plan'
    },
    deadline: {
      type: 'number',
      description: 'Deadline timestamp in milliseconds since epoch'
    },
    tags: {
      type: 'array',
      description: 'Tags for categorization',
      items: {
        type: 'string'
      }
    },
    createdAt: {
      type: 'number',
      description: 'Creation timestamp in milliseconds since epoch'
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the plan'
    }
  }
};

/**
 * Schema for task.planning.goal context type.
 * Represents a goal for task execution with success criteria and constraints.
 */
const taskPlanningGoalSchema = {
  type: 'object',
  required: ['goalId', 'name', 'createdAt'],
  properties: {
    goalId: {
      type: 'string',
      description: 'Unique identifier for the goal'
    },
    name: {
      type: 'string',
      description: 'Human-readable name for the goal'
    },
    description: {
      type: 'string',
      description: 'Detailed description of the goal'
    },
    successCriteria: {
      type: 'array',
      description: 'Criteria for determining goal success',
      items: {
        type: 'object',
        required: ['criterionId', 'description'],
        properties: {
          criterionId: {
            type: 'string',
            description: 'Unique identifier for the criterion'
          },
          description: {
            type: 'string',
            description: 'Description of the criterion'
          },
          metric: {
            type: 'string',
            description: 'Metric to measure'
          },
          threshold: {
            type: 'number',
            description: 'Threshold value for success'
          },
          operator: {
            type: 'string',
            enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte'],
            description: 'Comparison operator'
          }
        }
      }
    },
    constraints: {
      type: 'array',
      description: 'Constraints on goal execution',
      items: {
        type: 'object',
        required: ['constraintId', 'description'],
        properties: {
          constraintId: {
            type: 'string',
            description: 'Unique identifier for the constraint'
          },
          description: {
            type: 'string',
            description: 'Description of the constraint'
          },
          type: {
            type: 'string',
            enum: ['time', 'resource', 'security', 'privacy', 'performance', 'other'],
            description: 'Type of constraint'
          },
          value: {
            type: 'object',
            description: 'Constraint value'
          }
        }
      }
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Priority level of the goal'
    },
    deadline: {
      type: 'number',
      description: 'Deadline timestamp in milliseconds since epoch'
    },
    tags: {
      type: 'array',
      description: 'Tags for categorization',
      items: {
        type: 'string'
      }
    },
    createdAt: {
      type: 'number',
      description: 'Creation timestamp in milliseconds since epoch'
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the goal'
    }
  }
};

/**
 * Schema for task.resource.allocation context type.
 * Represents resource allocation for task execution.
 */
const taskResourceAllocationSchema = {
  type: 'object',
  required: ['allocationId', 'resourceType', 'amount', 'taskId', 'createdAt'],
  properties: {
    allocationId: {
      type: 'string',
      description: 'Unique identifier for the allocation'
    },
    resourceType: {
      type: 'string',
      description: 'Type of resource being allocated'
    },
    amount: {
      type: 'number',
      description: 'Amount of resource allocated'
    },
    unit: {
      type: 'string',
      description: 'Unit of measurement for the resource'
    },
    taskId: {
      type: 'string',
      description: 'ID of the task this allocation is for'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan this allocation is for'
    },
    startTime: {
      type: 'number',
      description: 'Start time of allocation in milliseconds since epoch'
    },
    endTime: {
      type: 'number',
      description: 'End time of allocation in milliseconds since epoch'
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Priority level of the allocation'
    },
    status: {
      type: 'string',
      enum: ['pending', 'active', 'completed', 'failed', 'cancelled'],
      description: 'Current status of the allocation'
    },
    createdAt: {
      type: 'number',
      description: 'Creation timestamp in milliseconds since epoch'
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the allocation'
    }
  }
};

/**
 * Schema for task.resource.availability context type.
 * Represents resource availability for task execution.
 */
const taskResourceAvailabilitySchema = {
  type: 'object',
  required: ['resourceType', 'totalAmount', 'availableAmount', 'updatedAt'],
  properties: {
    resourceType: {
      type: 'string',
      description: 'Type of resource'
    },
    totalAmount: {
      type: 'number',
      description: 'Total amount of resource'
    },
    availableAmount: {
      type: 'number',
      description: 'Available amount of resource'
    },
    unit: {
      type: 'string',
      description: 'Unit of measurement for the resource'
    },
    allocations: {
      type: 'array',
      description: 'Current allocations of this resource',
      items: {
        type: 'object',
        required: ['allocationId', 'amount'],
        properties: {
          allocationId: {
            type: 'string',
            description: 'ID of the allocation'
          },
          taskId: {
            type: 'string',
            description: 'ID of the task'
          },
          amount: {
            type: 'number',
            description: 'Amount allocated'
          },
          startTime: {
            type: 'number',
            description: 'Start time of allocation'
          },
          endTime: {
            type: 'number',
            description: 'End time of allocation'
          }
        }
      }
    },
    forecast: {
      type: 'array',
      description: 'Forecast of resource availability',
      items: {
        type: 'object',
        required: ['timestamp', 'amount'],
        properties: {
          timestamp: {
            type: 'number',
            description: 'Forecast timestamp'
          },
          amount: {
            type: 'number',
            description: 'Forecasted available amount'
          }
        }
      }
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the resource'
    }
  }
};

/**
 * Schema for task.execution.progress context type.
 * Represents progress of task execution.
 */
const taskExecutionProgressSchema = {
  type: 'object',
  required: ['taskId', 'status', 'progress', 'updatedAt'],
  properties: {
    taskId: {
      type: 'string',
      description: 'ID of the task'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan'
    },
    status: {
      type: 'string',
      enum: ['pending', 'in_progress', 'paused', 'completed', 'failed', 'cancelled'],
      description: 'Current status of the task'
    },
    progress: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Progress percentage (0-100)'
    },
    currentStepId: {
      type: 'string',
      description: 'ID of the current step'
    },
    completedSteps: {
      type: 'array',
      description: 'IDs of completed steps',
      items: {
        type: 'string'
      }
    },
    remainingSteps: {
      type: 'array',
      description: 'IDs of remaining steps',
      items: {
        type: 'string'
      }
    },
    startTime: {
      type: 'number',
      description: 'Start time in milliseconds since epoch'
    },
    estimatedEndTime: {
      type: 'number',
      description: 'Estimated end time in milliseconds since epoch'
    },
    elapsedTime: {
      type: 'number',
      description: 'Elapsed time in milliseconds'
    },
    remainingTime: {
      type: 'number',
      description: 'Estimated remaining time in milliseconds'
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the progress'
    }
  }
};

/**
 * Schema for task.execution.status context type.
 * Represents detailed status of task execution.
 */
const taskExecutionStatusSchema = {
  type: 'object',
  required: ['taskId', 'status', 'updatedAt'],
  properties: {
    taskId: {
      type: 'string',
      description: 'ID of the task'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan'
    },
    status: {
      type: 'string',
      enum: ['pending', 'in_progress', 'paused', 'completed', 'failed', 'cancelled'],
      description: 'Current status of the task'
    },
    statusDetails: {
      type: 'string',
      description: 'Detailed status description'
    },
    result: {
      type: 'object',
      description: 'Result of the task execution'
    },
    error: {
      type: 'object',
      description: 'Error details if task failed',
      properties: {
        code: {
          type: 'string',
          description: 'Error code'
        },
        message: {
          type: 'string',
          description: 'Error message'
        },
        details: {
          type: 'object',
          description: 'Detailed error information'
        },
        timestamp: {
          type: 'number',
          description: 'Error timestamp'
        }
      }
    },
    performance: {
      type: 'object',
      description: 'Performance metrics',
      properties: {
        cpuUsage: {
          type: 'number',
          description: 'CPU usage percentage'
        },
        memoryUsage: {
          type: 'number',
          description: 'Memory usage in bytes'
        },
        networkUsage: {
          type: 'number',
          description: 'Network usage in bytes'
        },
        executionTime: {
          type: 'number',
          description: 'Total execution time in milliseconds'
        }
      }
    },
    logs: {
      type: 'array',
      description: 'Execution logs',
      items: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error'],
            description: 'Log level'
          },
          message: {
            type: 'string',
            description: 'Log message'
          },
          timestamp: {
            type: 'number',
            description: 'Log timestamp'
          }
        }
      }
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the status'
    }
  }
};

/**
 * Schema for task.error.detection context type.
 * Represents error detection in task execution.
 */
const taskErrorDetectionSchema = {
  type: 'object',
  required: ['errorId', 'taskId', 'errorType', 'severity', 'detectedAt'],
  properties: {
    errorId: {
      type: 'string',
      description: 'Unique identifier for the error'
    },
    taskId: {
      type: 'string',
      description: 'ID of the task where error was detected'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan where error was detected'
    },
    stepId: {
      type: 'string',
      description: 'ID of the step where error was detected'
    },
    errorType: {
      type: 'string',
      description: 'Type of error detected'
    },
    errorCode: {
      type: 'string',
      description: 'Error code'
    },
    message: {
      type: 'string',
      description: 'Error message'
    },
    details: {
      type: 'object',
      description: 'Detailed error information'
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Severity level of the error'
    },
    impact: {
      type: 'string',
      enum: ['none', 'minor', 'major', 'blocking'],
      description: 'Impact on task execution'
    },
    stackTrace: {
      type: 'string',
      description: 'Stack trace if available'
    },
    context: {
      type: 'object',
      description: 'Context information when error occurred'
    },
    detectedAt: {
      type: 'number',
      description: 'Detection timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the error'
    }
  }
};

/**
 * Schema for task.error.recovery context type.
 * Represents error recovery in task execution.
 */
const taskErrorRecoverySchema = {
  type: 'object',
  required: ['recoveryId', 'errorId', 'taskId', 'strategy', 'status', 'createdAt'],
  properties: {
    recoveryId: {
      type: 'string',
      description: 'Unique identifier for the recovery'
    },
    errorId: {
      type: 'string',
      description: 'ID of the error being recovered from'
    },
    taskId: {
      type: 'string',
      description: 'ID of the task'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan'
    },
    strategy: {
      type: 'string',
      enum: ['retry', 'alternate_path', 'rollback', 'skip', 'human_intervention', 'abort'],
      description: 'Recovery strategy'
    },
    actions: {
      type: 'array',
      description: 'Recovery actions',
      items: {
        type: 'object',
        required: ['actionId', 'type', 'status'],
        properties: {
          actionId: {
            type: 'string',
            description: 'ID of the action'
          },
          type: {
            type: 'string',
            description: 'Type of action'
          },
          description: {
            type: 'string',
            description: 'Description of the action'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the action'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'Status of the action'
          },
          result: {
            type: 'object',
            description: 'Result of the action'
          }
        }
      }
    },
    status: {
      type: 'string',
      enum: ['pending', 'in_progress', 'succeeded', 'failed'],
      description: 'Status of the recovery'
    },
    result: {
      type: 'object',
      description: 'Result of the recovery'
    },
    createdAt: {
      type: 'number',
      description: 'Creation timestamp in milliseconds since epoch'
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    completedAt: {
      type: 'number',
      description: 'Completion timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the recovery'
    }
  }
};

/**
 * Schema for task.optimization.performance context type.
 * Represents performance optimization in task execution.
 */
const taskOptimizationPerformanceSchema = {
  type: 'object',
  required: ['taskId', 'metrics', 'optimizations', 'updatedAt'],
  properties: {
    taskId: {
      type: 'string',
      description: 'ID of the task'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan'
    },
    metrics: {
      type: 'object',
      description: 'Performance metrics',
      required: ['executionTime', 'resourceUsage'],
      properties: {
        executionTime: {
          type: 'number',
          description: 'Execution time in milliseconds'
        },
        resourceUsage: {
          type: 'object',
          description: 'Resource usage metrics',
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
            },
            disk: {
              type: 'number',
              description: 'Disk usage in bytes'
            }
          }
        },
        throughput: {
          type: 'number',
          description: 'Operations per second'
        },
        latency: {
          type: 'number',
          description: 'Average latency in milliseconds'
        },
        errorRate: {
          type: 'number',
          description: 'Error rate percentage'
        }
      }
    },
    optimizations: {
      type: 'array',
      description: 'Applied optimizations',
      items: {
        type: 'object',
        required: ['optimizationId', 'type', 'status'],
        properties: {
          optimizationId: {
            type: 'string',
            description: 'ID of the optimization'
          },
          type: {
            type: 'string',
            description: 'Type of optimization'
          },
          description: {
            type: 'string',
            description: 'Description of the optimization'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the optimization'
          },
          status: {
            type: 'string',
            enum: ['pending', 'applied', 'reverted', 'failed'],
            description: 'Status of the optimization'
          },
          impact: {
            type: 'object',
            description: 'Impact of the optimization',
            properties: {
              executionTime: {
                type: 'number',
                description: 'Change in execution time (percentage)'
              },
              resourceUsage: {
                type: 'number',
                description: 'Change in resource usage (percentage)'
              },
              throughput: {
                type: 'number',
                description: 'Change in throughput (percentage)'
              },
              latency: {
                type: 'number',
                description: 'Change in latency (percentage)'
              }
            }
          },
          appliedAt: {
            type: 'number',
            description: 'Timestamp when optimization was applied'
          }
        }
      }
    },
    recommendations: {
      type: 'array',
      description: 'Recommended optimizations',
      items: {
        type: 'object',
        required: ['recommendationId', 'type', 'confidence'],
        properties: {
          recommendationId: {
            type: 'string',
            description: 'ID of the recommendation'
          },
          type: {
            type: 'string',
            description: 'Type of recommended optimization'
          },
          description: {
            type: 'string',
            description: 'Description of the recommendation'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the recommendation'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score (0-1)'
          },
          estimatedImpact: {
            type: 'object',
            description: 'Estimated impact of the recommendation',
            properties: {
              executionTime: {
                type: 'number',
                description: 'Estimated change in execution time (percentage)'
              },
              resourceUsage: {
                type: 'number',
                description: 'Estimated change in resource usage (percentage)'
              }
            }
          }
        }
      }
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the optimization'
    }
  }
};

/**
 * Schema for task.optimization.efficiency context type.
 * Represents efficiency optimization in task execution.
 */
const taskOptimizationEfficiencySchema = {
  type: 'object',
  required: ['taskId', 'metrics', 'optimizations', 'updatedAt'],
  properties: {
    taskId: {
      type: 'string',
      description: 'ID of the task'
    },
    planId: {
      type: 'string',
      description: 'ID of the plan'
    },
    metrics: {
      type: 'object',
      description: 'Efficiency metrics',
      required: ['resourceUtilization', 'costEfficiency'],
      properties: {
        resourceUtilization: {
          type: 'number',
          description: 'Resource utilization percentage'
        },
        costEfficiency: {
          type: 'number',
          description: 'Cost efficiency score'
        },
        energyEfficiency: {
          type: 'number',
          description: 'Energy efficiency score'
        },
        timeEfficiency: {
          type: 'number',
          description: 'Time efficiency score'
        },
        qualityMetrics: {
          type: 'object',
          description: 'Quality-related metrics'
        }
      }
    },
    optimizations: {
      type: 'array',
      description: 'Applied efficiency optimizations',
      items: {
        type: 'object',
        required: ['optimizationId', 'type', 'status'],
        properties: {
          optimizationId: {
            type: 'string',
            description: 'ID of the optimization'
          },
          type: {
            type: 'string',
            description: 'Type of optimization'
          },
          description: {
            type: 'string',
            description: 'Description of the optimization'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the optimization'
          },
          status: {
            type: 'string',
            enum: ['pending', 'applied', 'reverted', 'failed'],
            description: 'Status of the optimization'
          },
          impact: {
            type: 'object',
            description: 'Impact of the optimization',
            properties: {
              resourceUtilization: {
                type: 'number',
                description: 'Change in resource utilization (percentage)'
              },
              costEfficiency: {
                type: 'number',
                description: 'Change in cost efficiency (percentage)'
              },
              energyEfficiency: {
                type: 'number',
                description: 'Change in energy efficiency (percentage)'
              }
            }
          },
          appliedAt: {
            type: 'number',
            description: 'Timestamp when optimization was applied'
          }
        }
      }
    },
    tradeoffs: {
      type: 'array',
      description: 'Efficiency tradeoffs',
      items: {
        type: 'object',
        required: ['tradeoffId', 'metrics', 'decision'],
        properties: {
          tradeoffId: {
            type: 'string',
            description: 'ID of the tradeoff'
          },
          description: {
            type: 'string',
            description: 'Description of the tradeoff'
          },
          metrics: {
            type: 'array',
            description: 'Metrics involved in the tradeoff',
            items: {
              type: 'string'
            }
          },
          options: {
            type: 'array',
            description: 'Available options',
            items: {
              type: 'object',
              properties: {
                optionId: {
                  type: 'string',
                  description: 'ID of the option'
                },
                description: {
                  type: 'string',
                  description: 'Description of the option'
                },
                impacts: {
                  type: 'object',
                  description: 'Impact on different metrics'
                }
              }
            }
          },
          decision: {
            type: 'string',
            description: 'ID of the selected option'
          },
          reasoning: {
            type: 'string',
            description: 'Reasoning for the decision'
          }
        }
      }
    },
    updatedAt: {
      type: 'number',
      description: 'Last update timestamp in milliseconds since epoch'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata for the optimization'
    }
  }
};

/**
 * Validates context data against the appropriate schema.
 * 
 * @param {string} contextType - Type of context
 * @param {Object} contextData - Context data to validate
 * @returns {Object} Validation result with isValid flag and errors
 */
function validateTaskExecutionContext(contextType, contextData) {
  let schema;
  
  switch (contextType) {
    case 'task.planning.plan':
      schema = taskPlanningPlanSchema;
      break;
    case 'task.planning.goal':
      schema = taskPlanningGoalSchema;
      break;
    case 'task.resource.allocation':
      schema = taskResourceAllocationSchema;
      break;
    case 'task.resource.availability':
      schema = taskResourceAvailabilitySchema;
      break;
    case 'task.execution.progress':
      schema = taskExecutionProgressSchema;
      break;
    case 'task.execution.status':
      schema = taskExecutionStatusSchema;
      break;
    case 'task.error.detection':
      schema = taskErrorDetectionSchema;
      break;
    case 'task.error.recovery':
      schema = taskErrorRecoverySchema;
      break;
    case 'task.optimization.performance':
      schema = taskOptimizationPerformanceSchema;
      break;
    case 'task.optimization.efficiency':
      schema = taskOptimizationEfficiencySchema;
      break;
    default:
      return {
        isValid: false,
        errors: [`Unknown context type: ${contextType}`]
      };
  }
  
  return validateAgainstSchema(contextData, schema);
}

/**
 * Validates data against a schema.
 * 
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object} Validation result with isValid flag and errors
 */
function validateAgainstSchema(data, schema) {
  const errors = [];
  
  // Check required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (data[requiredProp] === undefined) {
        errors.push(`Missing required property: ${requiredProp}`);
      }
    }
  }
  
  // Check property types and constraints
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (data[propName] !== undefined) {
        // Check type
        if (propSchema.type && typeof data[propName] !== propSchema.type && 
            !(propSchema.type === 'array' && Array.isArray(data[propName])) &&
            !(propSchema.type === 'object' && typeof data[propName] === 'object' && !Array.isArray(data[propName]))) {
          errors.push(`Property ${propName} should be of type ${propSchema.type}`);
        }
        
        // Check enum values
        if (propSchema.enum && !propSchema.enum.includes(data[propName])) {
          errors.push(`Property ${propName} should be one of: ${propSchema.enum.join(', ')}`);
        }
        
        // Check numeric constraints
        if (propSchema.type === 'number') {
          if (propSchema.minimum !== undefined && data[propName] < propSchema.minimum) {
            errors.push(`Property ${propName} should be >= ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && data[propName] > propSchema.maximum) {
            errors.push(`Property ${propName} should be <= ${propSchema.maximum}`);
          }
        }
        
        // Check array items
        if (propSchema.type === 'array' && Array.isArray(data[propName]) && propSchema.items) {
          for (let i = 0; i < data[propName].length; i++) {
            const itemValidation = validateAgainstSchema(data[propName][i], propSchema.items);
            if (!itemValidation.isValid) {
              errors.push(`Item ${i} in ${propName} array has errors: ${itemValidation.errors.join(', ')}`);
            }
          }
        }
        
        // Check nested objects
        if (propSchema.type === 'object' && typeof data[propName] === 'object' && propSchema.properties) {
          const nestedValidation = validateAgainstSchema(data[propName], propSchema);
          if (!nestedValidation.isValid) {
            errors.push(`Nested object ${propName} has errors: ${nestedValidation.errors.join(', ')}`);
          }
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export all schemas and validation functions
module.exports = {
  // Schemas
  taskPlanningPlanSchema,
  taskPlanningGoalSchema,
  taskResourceAllocationSchema,
  taskResourceAvailabilitySchema,
  taskExecutionProgressSchema,
  taskExecutionStatusSchema,
  taskErrorDetectionSchema,
  taskErrorRecoverySchema,
  taskOptimizationPerformanceSchema,
  taskOptimizationEfficiencySchema,
  
  // Validation functions
  validateTaskExecutionContext,
  validateAgainstSchema
};
