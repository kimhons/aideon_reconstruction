/**
 * @fileoverview Learning Context Schemas for the Model Context Protocol (MCP).
 * 
 * This module defines the schemas for all learning context types supported by the
 * Learning from Demonstration MCP integration. These schemas ensure proper validation
 * and interoperability across the MCP system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Joi = require('joi');

/**
 * Base schema for all learning contexts.
 */
const baseLearningContextSchema = Joi.object({
  timestamp: Joi.number().required().description('Timestamp when the context was created'),
  source: Joi.string().required().description('Source component that generated the context'),
  version: Joi.string().default('1.0.0').description('Schema version'),
  metadata: Joi.object().default({}).description('Additional metadata')
});

/**
 * Schema for demonstration recording contexts.
 * 
 * These contexts represent active recording sessions of user demonstrations.
 */
const demonstrationRecordingSchema = baseLearningContextSchema.keys({
  sessionId: Joi.string().required().description('Unique identifier for the demonstration session'),
  startTime: Joi.number().required().description('Timestamp when the recording started'),
  status: Joi.string().valid('active', 'paused', 'completed', 'failed').required()
    .description('Current status of the recording'),
  recordingType: Joi.string().valid('screen', 'interaction', 'combined').required()
    .description('Type of demonstration being recorded'),
  userContext: Joi.object({
    application: Joi.string().description('Application being demonstrated'),
    environment: Joi.object().description('Environment details'),
    task: Joi.string().description('Task being demonstrated')
  }).description('Context about the user and environment during recording'),
  privacySettings: Joi.object({
    maskSensitiveData: Joi.boolean().default(true).description('Whether to mask sensitive data'),
    retentionPeriod: Joi.number().description('Retention period in milliseconds'),
    dataMinimization: Joi.boolean().default(true).description('Whether to apply data minimization')
  }).description('Privacy settings for the recording'),
  metrics: Joi.object({
    eventCount: Joi.number().default(0).description('Number of events recorded'),
    frameCount: Joi.number().default(0).description('Number of frames recorded'),
    duration: Joi.number().default(0).description('Duration of recording in milliseconds')
  }).description('Recording metrics')
});

/**
 * Schema for demonstration session contexts.
 * 
 * These contexts represent completed demonstration sessions with analysis results.
 */
const demonstrationSessionSchema = baseLearningContextSchema.keys({
  sessionId: Joi.string().required().description('Unique identifier for the demonstration session'),
  startTime: Joi.number().required().description('Timestamp when the session started'),
  endTime: Joi.number().required().description('Timestamp when the session ended'),
  duration: Joi.number().required().description('Duration of the session in milliseconds'),
  recordingType: Joi.string().valid('screen', 'interaction', 'combined').required()
    .description('Type of demonstration recorded'),
  eventCount: Joi.number().required().description('Number of events in the session'),
  artifacts: Joi.array().items(Joi.object({
    type: Joi.string().required().description('Type of artifact'),
    id: Joi.string().required().description('Identifier for the artifact'),
    timestamp: Joi.number().required().description('Timestamp when the artifact was created'),
    metadata: Joi.object().description('Additional metadata about the artifact')
  })).description('Artifacts generated during the session'),
  userContext: Joi.object({
    application: Joi.string().description('Application being demonstrated'),
    environment: Joi.object().description('Environment details'),
    task: Joi.string().description('Task being demonstrated')
  }).description('Context about the user and environment during the session'),
  analysisStatus: Joi.string().valid('pending', 'in_progress', 'completed', 'failed').default('pending')
    .description('Status of pattern analysis for this session')
});

/**
 * Schema for event normalization contexts.
 * 
 * These contexts represent normalized events from raw input events.
 */
const eventNormalizedSchema = baseLearningContextSchema.keys({
  sessionId: Joi.string().required().description('Identifier for the demonstration session'),
  originalEventId: Joi.string().required().description('Identifier of the original event'),
  normalizedEventType: Joi.string().required().description('Type of the normalized event'),
  normalizedData: Joi.object().required().description('Normalized event data'),
  originalTimestamp: Joi.number().required().description('Timestamp of the original event'),
  confidence: Joi.number().min(0).max(1).required().description('Confidence in the normalization'),
  mappingRules: Joi.array().items(Joi.string()).description('Rules applied for normalization')
});

/**
 * Schema for context tracking contexts.
 * 
 * These contexts represent environmental and situational context during demonstrations.
 */
const contextSituationSchema = baseLearningContextSchema.keys({
  sessionId: Joi.string().required().description('Identifier for the demonstration session'),
  environmentContext: Joi.object({
    operatingSystem: Joi.string().description('Operating system details'),
    screenResolution: Joi.string().description('Screen resolution'),
    deviceType: Joi.string().description('Type of device'),
    availableMemory: Joi.number().description('Available memory in MB'),
    cpuUsage: Joi.number().description('CPU usage percentage')
  }).description('Environmental context information'),
  applicationContext: Joi.object({
    name: Joi.string().description('Application name'),
    version: Joi.string().description('Application version'),
    windowTitle: Joi.string().description('Window title'),
    focusedElement: Joi.string().description('Currently focused UI element'),
    visibleElements: Joi.array().items(Joi.string()).description('Visible UI elements')
  }).description('Application context information'),
  userContext: Joi.object({
    task: Joi.string().description('Current user task'),
    intent: Joi.string().description('Inferred user intent'),
    preferences: Joi.object().description('User preferences')
  }).description('User context information')
});

/**
 * Schema for pattern detection contexts.
 * 
 * These contexts represent patterns detected in user demonstrations.
 */
const patternDetectedSchema = baseLearningContextSchema.keys({
  sessionId: Joi.string().required().description('Identifier for the demonstration session'),
  patternId: Joi.string().required().description('Unique identifier for the pattern'),
  patternType: Joi.string().valid('sequence', 'repetition', 'condition', 'selection', 'loop').required()
    .description('Type of pattern detected'),
  patternName: Joi.string().description('Human-readable name for the pattern'),
  confidence: Joi.number().min(0).max(1).required().description('Confidence in the pattern detection'),
  occurrences: Joi.number().integer().min(1).required().description('Number of times pattern was observed'),
  events: Joi.array().items(Joi.string()).min(1).required().description('Event IDs in the pattern'),
  duration: Joi.object({
    min: Joi.number().required().description('Minimum duration in milliseconds'),
    max: Joi.number().required().description('Maximum duration in milliseconds'),
    avg: Joi.number().required().description('Average duration in milliseconds')
  }).description('Duration statistics for the pattern'),
  context: Joi.object({
    preconditions: Joi.array().items(Joi.string()).description('Preconditions for the pattern'),
    postconditions: Joi.array().items(Joi.string()).description('Postconditions after the pattern'),
    triggers: Joi.array().items(Joi.string()).description('Events that trigger the pattern')
  }).description('Contextual information about the pattern')
});

/**
 * Schema for pattern frequency contexts.
 * 
 * These contexts represent frequency analysis of detected patterns.
 */
const patternFrequencySchema = baseLearningContextSchema.keys({
  patternId: Joi.string().required().description('Identifier for the pattern'),
  sessionCount: Joi.number().integer().min(1).required().description('Number of sessions with this pattern'),
  totalOccurrences: Joi.number().integer().min(1).required().description('Total occurrences across all sessions'),
  frequencyDistribution: Joi.object().pattern(
    Joi.string(), // Session ID
    Joi.number().integer().min(0) // Occurrence count
  ).required().description('Distribution of occurrences across sessions'),
  timeDistribution: Joi.array().items(Joi.object({
    timeRange: Joi.string().required().description('Time range (e.g., "morning", "afternoon")'),
    occurrences: Joi.number().integer().min(0).required().description('Occurrences in this time range')
  })).description('Distribution of occurrences across time ranges'),
  contextDistribution: Joi.array().items(Joi.object({
    contextFactor: Joi.string().required().description('Context factor (e.g., "application", "task")'),
    distribution: Joi.object().pattern(
      Joi.string(), // Factor value
      Joi.number().integer().min(0) // Occurrence count
    ).required().description('Distribution across factor values')
  })).description('Distribution of occurrences across context factors')
});

/**
 * Schema for workflow generation contexts.
 * 
 * These contexts represent workflows generated from detected patterns.
 */
const workflowGeneratedSchema = baseLearningContextSchema.keys({
  workflowId: Joi.string().required().description('Unique identifier for the workflow'),
  name: Joi.string().required().description('Human-readable name for the workflow'),
  description: Joi.string().description('Description of what the workflow accomplishes'),
  sourceSessionIds: Joi.array().items(Joi.string()).min(1).required()
    .description('Session IDs that contributed to this workflow'),
  patternIds: Joi.array().items(Joi.string()).min(1).required()
    .description('Pattern IDs used in this workflow'),
  steps: Joi.array().items(Joi.object({
    stepId: Joi.string().required().description('Unique identifier for the step'),
    stepType: Joi.string().valid('action', 'decision', 'loop', 'parallel', 'wait').required()
      .description('Type of workflow step'),
    description: Joi.string().required().description('Human-readable description of the step'),
    patternId: Joi.string().description('Pattern ID this step is based on'),
    parameters: Joi.object().description('Parameters for this step'),
    nextSteps: Joi.object().pattern(
      Joi.string(), // Condition or 'default'
      Joi.string() // Next step ID
    ).description('Mapping of conditions to next step IDs')
  })).min(1).required().description('Steps in the workflow'),
  entryPoint: Joi.string().required().description('ID of the first step in the workflow'),
  preconditions: Joi.array().items(Joi.string()).description('Preconditions for the workflow'),
  postconditions: Joi.array().items(Joi.string()).description('Expected postconditions after workflow execution'),
  estimatedDuration: Joi.number().description('Estimated duration in milliseconds'),
  confidence: Joi.number().min(0).max(1).required().description('Confidence in the workflow generation'),
  metadata: Joi.object({
    createdFrom: Joi.string().valid('single_demonstration', 'multiple_demonstrations', 'user_feedback')
      .description('How the workflow was created'),
    generationMethod: Joi.string().description('Method used to generate the workflow'),
    optimizationLevel: Joi.string().valid('none', 'basic', 'advanced').description('Level of optimization applied')
  }).description('Additional metadata about the workflow')
});

/**
 * Schema for workflow step contexts.
 * 
 * These contexts represent individual steps within generated workflows.
 */
const workflowStepSchema = baseLearningContextSchema.keys({
  workflowId: Joi.string().required().description('Identifier for the parent workflow'),
  stepId: Joi.string().required().description('Unique identifier for the step'),
  stepType: Joi.string().valid('action', 'decision', 'loop', 'parallel', 'wait').required()
    .description('Type of workflow step'),
  description: Joi.string().required().description('Human-readable description of the step'),
  implementation: Joi.object({
    type: Joi.string().valid('script', 'api_call', 'ui_interaction', 'system_command').required()
      .description('Implementation type'),
    details: Joi.object().required().description('Implementation details')
  }).description('Technical implementation of the step'),
  parameters: Joi.object().pattern(
    Joi.string(), // Parameter name
    Joi.object({
      type: Joi.string().required().description('Parameter type'),
      description: Joi.string().description('Parameter description'),
      defaultValue: Joi.any().description('Default parameter value'),
      required: Joi.boolean().default(false).description('Whether the parameter is required')
    })
  ).description('Parameters for this step'),
  executionStats: Joi.object({
    successRate: Joi.number().min(0).max(1).description('Success rate of this step'),
    averageDuration: Joi.number().description('Average execution duration in milliseconds'),
    failureReasons: Joi.array().items(Joi.string()).description('Common failure reasons')
  }).description('Execution statistics for this step')
});

/**
 * Schema for feedback processing contexts.
 * 
 * These contexts represent user feedback on demonstrations and workflows.
 */
const feedbackCorrectionSchema = baseLearningContextSchema.keys({
  feedbackId: Joi.string().required().description('Unique identifier for the feedback'),
  targetType: Joi.string().valid('workflow', 'pattern', 'step').required()
    .description('Type of entity receiving feedback'),
  targetId: Joi.string().required().description('Identifier of the target entity'),
  feedbackType: Joi.string().valid('correction', 'refinement', 'confirmation', 'rejection').required()
    .description('Type of feedback provided'),
  description: Joi.string().required().description('Description of the feedback'),
  changes: Joi.array().items(Joi.object({
    field: Joi.string().required().description('Field being changed'),
    oldValue: Joi.any().description('Previous value'),
    newValue: Joi.any().required().description('New value'),
    reason: Joi.string().description('Reason for the change')
  })).description('Specific changes in the feedback'),
  source: Joi.string().valid('user', 'system', 'expert').required().description('Source of the feedback'),
  priority: Joi.number().integer().min(1).max(10).default(5).description('Priority of the feedback'),
  status: Joi.string().valid('pending', 'applied', 'rejected', 'deferred').default('pending')
    .description('Status of the feedback application')
});

/**
 * Schema for continuous learning contexts.
 * 
 * These contexts represent continuous learning and improvement processes.
 */
const continuousLearningSchema = baseLearningContextSchema.keys({
  learningCycleId: Joi.string().required().description('Identifier for the learning cycle'),
  startTime: Joi.number().required().description('Start time of the learning cycle'),
  endTime: Joi.number().description('End time of the learning cycle'),
  status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'failed').required()
    .description('Status of the learning cycle'),
  targetEntities: Joi.array().items(Joi.object({
    type: Joi.string().valid('workflow', 'pattern', 'model').required().description('Entity type'),
    id: Joi.string().required().description('Entity identifier'),
    metrics: Joi.object().description('Performance metrics for the entity')
  })).required().description('Entities targeted for improvement'),
  improvements: Joi.array().items(Joi.object({
    entityType: Joi.string().required().description('Type of entity improved'),
    entityId: Joi.string().required().description('Identifier of the improved entity'),
    changeType: Joi.string().valid('optimization', 'correction', 'enhancement').required()
      .description('Type of improvement'),
    description: Joi.string().required().description('Description of the improvement'),
    metrics: Joi.object({
      before: Joi.object().required().description('Metrics before improvement'),
      after: Joi.object().required().description('Metrics after improvement'),
      improvement: Joi.number().required().description('Percentage improvement')
    }).description('Metrics showing the impact of the improvement')
  })).description('Improvements made during the learning cycle'),
  learningStrategy: Joi.string().valid('incremental', 'batch', 'reinforcement', 'federated').required()
    .description('Learning strategy used'),
  dataUsed: Joi.object({
    sessionCount: Joi.number().integer().min(0).required().description('Number of sessions used'),
    feedbackCount: Joi.number().integer().min(0).required().description('Number of feedback items used'),
    totalEvents: Joi.number().integer().min(0).required().description('Total number of events processed')
  }).description('Data used in the learning cycle')
});

/**
 * Schema for continuous adaptation contexts.
 * 
 * These contexts represent adaptations made based on continuous learning.
 */
const continuousAdaptationSchema = baseLearningContextSchema.keys({
  adaptationId: Joi.string().required().description('Unique identifier for the adaptation'),
  learningCycleId: Joi.string().required().description('Identifier for the source learning cycle'),
  adaptationType: Joi.string().valid('workflow_optimization', 'pattern_refinement', 'model_update').required()
    .description('Type of adaptation'),
  description: Joi.string().required().description('Description of the adaptation'),
  targetEntity: Joi.object({
    type: Joi.string().valid('workflow', 'pattern', 'model').required().description('Entity type'),
    id: Joi.string().required().description('Entity identifier')
  }).required().description('Entity being adapted'),
  changes: Joi.array().items(Joi.object({
    component: Joi.string().required().description('Component being changed'),
    changeType: Joi.string().valid('add', 'remove', 'modify', 'reorder').required().description('Type of change'),
    description: Joi.string().required().description('Description of the change'),
    reason: Joi.string().required().description('Reason for the change')
  })).min(1).required().description('Changes made in the adaptation'),
  performance: Joi.object({
    before: Joi.object().required().description('Performance metrics before adaptation'),
    after: Joi.object().description('Performance metrics after adaptation'),
    improvement: Joi.number().description('Percentage improvement')
  }).description('Performance impact of the adaptation'),
  status: Joi.string().valid('pending', 'applied', 'rolled_back', 'partially_applied').required()
    .description('Status of the adaptation'),
  appliedAt: Joi.number().description('Timestamp when the adaptation was applied')
});

// Export all schemas
module.exports = {
  demonstrationRecordingSchema,
  demonstrationSessionSchema,
  eventNormalizedSchema,
  contextSituationSchema,
  patternDetectedSchema,
  patternFrequencySchema,
  workflowGeneratedSchema,
  workflowStepSchema,
  feedbackCorrectionSchema,
  continuousLearningSchema,
  continuousAdaptationSchema
};
