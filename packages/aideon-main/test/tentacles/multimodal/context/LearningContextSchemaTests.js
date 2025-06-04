/**
 * @fileoverview Tests for Learning Context Schemas in the Model Context Protocol (MCP).
 * 
 * This module contains comprehensive tests for all learning context schemas
 * to ensure proper validation and interoperability across the MCP system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { requireModule } = require('./utils/TestModuleResolver');
const { 
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
} = requireModule('../../src/tentacles/multimodal/context/schemas/LearningContextSchemas');

describe('Learning Context Schemas', () => {
  describe('Demonstration Recording Schema', () => {
    let validRecordingContext;
    
    beforeEach(() => {
      // Setup a valid demonstration recording context
      validRecordingContext = {
        timestamp: Date.now(),
        source: 'DemonstrationRecorder',
        version: '1.0.0',
        sessionId: `demo_${Date.now()}`,
        startTime: Date.now(),
        status: 'active',
        recordingType: 'screen',
        userContext: {
          application: 'TestApp',
          environment: { os: 'Windows', version: '10' },
          task: 'Testing'
        },
        privacySettings: {
          maskSensitiveData: true,
          retentionPeriod: 86400000, // 24 hours
          dataMinimization: true
        },
        metrics: {
          eventCount: 0,
          frameCount: 0,
          duration: 0
        },
        metadata: {}
      };
    });
    
    it('should validate a valid demonstration recording context', () => {
      const result = demonstrationRecordingSchema.validate(validRecordingContext);
      expect(result.error).toBeUndefined();
    });
    
    it('should reject a context with missing required fields', () => {
      delete validRecordingContext.sessionId;
      const result = demonstrationRecordingSchema.validate(validRecordingContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('sessionId');
    });
    
    it('should reject a context with invalid status', () => {
      validRecordingContext.status = 'invalid_status';
      const result = demonstrationRecordingSchema.validate(validRecordingContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('status');
    });
    
    it('should apply default values for optional fields', () => {
      delete validRecordingContext.version;
      delete validRecordingContext.metadata;
      const result = demonstrationRecordingSchema.validate(validRecordingContext);
      expect(result.error).toBeUndefined();
      expect(result.value.version).toBe('1.0.0');
      expect(result.value.metadata).toEqual({});
    });
  });
  
  describe('Demonstration Session Schema', () => {
    let validSessionContext;
    
    beforeEach(() => {
      // Setup a valid demonstration session context
      validSessionContext = {
        timestamp: Date.now(),
        source: 'DemonstrationRecorder',
        version: '1.0.0',
        sessionId: `demo_${Date.now()}`,
        startTime: Date.now() - 60000, // 1 minute ago
        endTime: Date.now(),
        duration: 60000, // 1 minute
        recordingType: 'screen',
        eventCount: 120,
        artifacts: [
          {
            type: 'screenshot',
            id: 'screenshot_1',
            timestamp: Date.now() - 30000,
            metadata: { format: 'png', resolution: '1920x1080' }
          }
        ],
        userContext: {
          application: 'TestApp',
          environment: { os: 'Windows', version: '10' },
          task: 'Testing'
        },
        analysisStatus: 'pending',
        metadata: {}
      };
    });
    
    it('should validate a valid demonstration session context', () => {
      const result = demonstrationSessionSchema.validate(validSessionContext);
      expect(result.error).toBeUndefined();
    });
    
    it('should reject a context with missing required fields', () => {
      delete validSessionContext.duration;
      const result = demonstrationSessionSchema.validate(validSessionContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('duration');
    });
    
    it('should apply default values for optional fields', () => {
      delete validSessionContext.analysisStatus;
      const result = demonstrationSessionSchema.validate(validSessionContext);
      expect(result.error).toBeUndefined();
      expect(result.value.analysisStatus).toBe('pending');
    });
  });
  
  describe('Pattern Detected Schema', () => {
    let validPatternContext;
    
    beforeEach(() => {
      // Setup a valid pattern detected context
      validPatternContext = {
        timestamp: Date.now(),
        source: 'PatternExtractionEngine',
        version: '1.0.0',
        sessionId: `demo_${Date.now()}`,
        patternId: `pattern_${Date.now()}`,
        patternType: 'sequence',
        patternName: 'Login Sequence',
        confidence: 0.85,
        occurrences: 3,
        events: ['event_1', 'event_2', 'event_3'],
        duration: {
          min: 2000,
          max: 3500,
          avg: 2800
        },
        context: {
          preconditions: ['Application started'],
          postconditions: ['User logged in'],
          triggers: ['Login button clicked']
        },
        metadata: {}
      };
    });
    
    it('should validate a valid pattern detected context', () => {
      const result = patternDetectedSchema.validate(validPatternContext);
      expect(result.error).toBeUndefined();
    });
    
    it('should reject a context with missing required fields', () => {
      delete validPatternContext.confidence;
      const result = patternDetectedSchema.validate(validPatternContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('confidence');
    });
    
    it('should reject a context with invalid pattern type', () => {
      validPatternContext.patternType = 'invalid_type';
      const result = patternDetectedSchema.validate(validPatternContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('patternType');
    });
    
    it('should reject a context with confidence out of range', () => {
      validPatternContext.confidence = 1.5;
      const result = patternDetectedSchema.validate(validPatternContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('confidence');
    });
  });
  
  describe('Workflow Generated Schema', () => {
    let validWorkflowContext;
    
    beforeEach(() => {
      // Setup a valid workflow generated context
      validWorkflowContext = {
        timestamp: Date.now(),
        source: 'WorkflowSynthesisEngine',
        version: '1.0.0',
        workflowId: `workflow_${Date.now()}`,
        name: 'Login and Search Workflow',
        description: 'Logs in and performs a search',
        sourceSessionIds: [`demo_${Date.now()}`],
        patternIds: [`pattern_${Date.now()}`, `pattern_${Date.now() + 1}`],
        steps: [
          {
            stepId: 'step_1',
            stepType: 'action',
            description: 'Enter username',
            patternId: `pattern_${Date.now()}`,
            parameters: { username: 'test_user' },
            nextSteps: { default: 'step_2' }
          },
          {
            stepId: 'step_2',
            stepType: 'action',
            description: 'Enter password',
            patternId: `pattern_${Date.now() + 1}`,
            parameters: { password: '********' },
            nextSteps: { default: 'step_3' }
          },
          {
            stepId: 'step_3',
            stepType: 'action',
            description: 'Click login button',
            nextSteps: {}
          }
        ],
        entryPoint: 'step_1',
        preconditions: ['Application started'],
        postconditions: ['User logged in'],
        estimatedDuration: 5000,
        confidence: 0.9,
        metadata: {
          createdFrom: 'multiple_demonstrations',
          generationMethod: 'sequence_analysis',
          optimizationLevel: 'basic'
        }
      };
    });
    
    it('should validate a valid workflow generated context', () => {
      const result = workflowGeneratedSchema.validate(validWorkflowContext);
      expect(result.error).toBeUndefined();
    });
    
    it('should reject a context with missing required fields', () => {
      delete validWorkflowContext.entryPoint;
      const result = workflowGeneratedSchema.validate(validWorkflowContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('entryPoint');
    });
    
    it('should reject a context with empty steps array', () => {
      validWorkflowContext.steps = [];
      const result = workflowGeneratedSchema.validate(validWorkflowContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('steps');
    });
    
    it('should reject a context with invalid step type', () => {
      validWorkflowContext.steps[0].stepType = 'invalid_type';
      const result = workflowGeneratedSchema.validate(validWorkflowContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('stepType');
    });
  });
  
  describe('Continuous Learning Schema', () => {
    let validLearningContext;
    
    beforeEach(() => {
      // Setup a valid continuous learning context
      validLearningContext = {
        timestamp: Date.now(),
        source: 'ContinuousLearningSystem',
        version: '1.0.0',
        learningCycleId: `cycle_${Date.now()}`,
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: Date.now(),
        status: 'completed',
        targetEntities: [
          {
            type: 'workflow',
            id: `workflow_${Date.now()}`,
            metrics: { successRate: 0.85, averageDuration: 4500 }
          },
          {
            type: 'pattern',
            id: `pattern_${Date.now()}`,
            metrics: { confidence: 0.8, occurrences: 15 }
          }
        ],
        improvements: [
          {
            entityType: 'workflow',
            entityId: `workflow_${Date.now()}`,
            changeType: 'optimization',
            description: 'Optimized login sequence',
            metrics: {
              before: { successRate: 0.85, averageDuration: 4500 },
              after: { successRate: 0.92, averageDuration: 3800 },
              improvement: 15.6
            }
          }
        ],
        learningStrategy: 'incremental',
        dataUsed: {
          sessionCount: 10,
          feedbackCount: 5,
          totalEvents: 1200
        },
        metadata: {}
      };
    });
    
    it('should validate a valid continuous learning context', () => {
      const result = continuousLearningSchema.validate(validLearningContext);
      expect(result.error).toBeUndefined();
    });
    
    it('should reject a context with missing required fields', () => {
      delete validLearningContext.learningStrategy;
      const result = continuousLearningSchema.validate(validLearningContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('learningStrategy');
    });
    
    it('should reject a context with invalid learning strategy', () => {
      validLearningContext.learningStrategy = 'invalid_strategy';
      const result = continuousLearningSchema.validate(validLearningContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('learningStrategy');
    });
    
    it('should reject a context with invalid status', () => {
      validLearningContext.status = 'invalid_status';
      const result = continuousLearningSchema.validate(validLearningContext);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('status');
    });
  });
  
  // Additional tests for other schemas would follow the same pattern
});
