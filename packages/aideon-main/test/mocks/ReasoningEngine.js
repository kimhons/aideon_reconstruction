/**
 * @fileoverview Mock Reasoning Engine for testing.
 * Provides mock implementations of Reasoning Engine methods.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Create a mock Reasoning Engine for testing.
 * @returns {Object} Mock Reasoning Engine
 */
function createMockReasoningEngine() {
  return {
    /**
     * Extract patterns from demonstrations.
     * @param {Object} options Options
     * @returns {Promise<Object>} Extraction result
     */
    extractPatterns: jest.fn(async (options) => {
      const { demonstrations } = options;
      
      // Create mock patterns
      const patterns = demonstrations.map((demo, index) => ({
        id: `pattern_${Date.now()}_${index}`,
        name: `Pattern ${index + 1}`,
        description: `Automatically extracted pattern from demonstration ${demo.id}`,
        events: demo.properties?.events || [],
        confidence: 0.8,
        occurrenceCount: 1,
        demonstrationIds: [demo.id],
        createdAt: Date.now()
      }));
      
      return {
        patterns,
        demonstrationCount: demonstrations.length,
        patternsExtracted: patterns.length
      };
    }),
    
    /**
     * Generate workflow refinements.
     * @param {Object} options Options
     * @returns {Promise<Object>} Refinement result
     */
    generateWorkflowRefinements: jest.fn(async (options) => {
      const { workflow, analysis } = options;
      
      // Create mock refinements
      const refinements = [];
      
      // Add refinements based on analysis
      if (analysis?.problematicSteps?.length > 0) {
        for (const step of analysis.problematicSteps) {
          refinements.push({
            type: 'stepRefinement',
            stepId: step.stepId,
            action: 'modify',
            reason: `Step failed ${step.failureCount} times`,
            confidence: 0.8,
            properties: {
              errorHandling: true,
              retryCount: 3
            }
          });
        }
      }
      
      // Add workflow-level refinements
      if (analysis?.feedbackMetrics?.averageRating < 4) {
        refinements.push({
          type: 'workflowRefinement',
          action: 'optimize',
          reason: 'Low average rating',
          confidence: 0.7
        });
      }
      
      return {
        workflowId: workflow.id,
        refinements,
        analysisId: `analysis_${Date.now()}`
      };
    }),
    
    /**
     * Optimize a workflow.
     * @param {Object} workflow Workflow to optimize
     * @returns {Promise<Object>} Optimized workflow
     */
    optimizeWorkflow: jest.fn(async (workflow) => {
      // Create optimized workflow
      return {
        ...workflow,
        optimized: true,
        optimizationTimestamp: Date.now()
      };
    })
  };
}

module.exports = {
  createMockReasoningEngine
};
