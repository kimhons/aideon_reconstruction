/**
 * @fileoverview Feedback Processor for Learning from Demonstration.
 * Handles user feedback on generated workflows.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Processes user feedback on generated workflows.
 */
class FeedbackProcessor {
  /**
   * Constructor for FeedbackProcessor.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   * @param {Object} options.probabilisticKnowledgeManager Probabilistic knowledge manager
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for FeedbackProcessor");
    if (!options.logger) throw new Error("Logger is required for FeedbackProcessor");
    if (!options.configService) throw new Error("ConfigService is required for FeedbackProcessor");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for FeedbackProcessor");
    if (!options.probabilisticKnowledgeManager) throw new Error("ProbabilisticKnowledgeManager is required for FeedbackProcessor");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
    
    this.logger.info("FeedbackProcessor created");
  }
  
  /**
   * Process user feedback on a workflow.
   * @param {Object} workflow The workflow receiving feedback
   * @param {Object} feedback The user feedback
   * @returns {Promise<Object>} Processing result
   */
  async processFeedback(workflow, feedback) {
    if (!workflow || !workflow.id) {
      throw new Error("Valid workflow with ID is required");
    }
    
    if (!feedback || typeof feedback !== "object") {
      throw new Error("Valid feedback object is required");
    }
    
    this.logger.info(`Processing feedback for workflow: ${workflow.id}`);
    
    try {
      // Prepare the result object
      const result = {
        workflowId: workflow.id,
        timestamp: Date.now(),
        feedbackProcessed: true,
        adjustments: [],
        metadata: {
          processingTime: 0
        }
      };
      
      const startTime = Date.now();
      
      // Process different types of feedback
      if (feedback.rating !== undefined) {
        await this._processRatingFeedback(workflow, feedback.rating, result);
      }
      
      if (feedback.comments) {
        await this._processCommentsFeedback(workflow, feedback.comments, result);
      }
      
      if (feedback.stepAdjustments) {
        await this._processStepAdjustments(workflow, feedback.stepAdjustments, result);
      }
      
      if (feedback.parameterAdjustments) {
        await this._processParameterAdjustments(workflow, feedback.parameterAdjustments, result);
      }
      
      if (feedback.executionResult) {
        await this._processExecutionResult(workflow, feedback.executionResult, result);
      }
      
      // Store feedback in knowledge graph
      await this._storeFeedbackInKnowledgeGraph(workflow, feedback, result);
      
      // Calculate processing time
      result.metadata.processingTime = Date.now() - startTime;
      
      this.logger.info(`Feedback processing complete for workflow: ${workflow.id}`, {
        adjustmentCount: result.adjustments.length,
        processingTime: result.metadata.processingTime
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error processing feedback: ${error.message}`, { error, workflowId: workflow.id });
      throw error;
    }
  }
  
  /**
   * Process rating feedback.
   * @private
   * @param {Object} workflow The workflow
   * @param {number} rating The user rating
   * @param {Object} result The result object to update
   * @returns {Promise<void>}
   */
  async _processRatingFeedback(workflow, rating, result) {
    try {
      // Validate rating
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        this.logger.warn(`Invalid rating value: ${rating}, must be between 1 and 5`);
        return;
      }
      
      // Update confidence based on rating
      const confidenceAdjustment = this._calculateConfidenceAdjustment(rating);
      
      // Add to result
      result.adjustments.push({
        type: 'confidence',
        value: confidenceAdjustment,
        source: 'rating',
        rating: rating
      });
      
      // Update workflow confidence if available
      if (workflow.confidence !== undefined) {
        const newConfidence = Math.max(0, Math.min(1, workflow.confidence + confidenceAdjustment));
        
        // Add to result
        result.adjustments.push({
          type: 'workflowConfidence',
          oldValue: workflow.confidence,
          newValue: newConfidence,
          source: 'rating'
        });
      }
      
      // Update pattern confidence if available
      if (workflow.patternId) {
        try {
          await this.probabilisticKnowledgeManager.updateConfidence(
            'Pattern',
            workflow.patternId,
            confidenceAdjustment,
            {
              source: 'userFeedback',
              rating: rating,
              timestamp: Date.now()
            }
          );
          
          // Add to result
          result.adjustments.push({
            type: 'patternConfidence',
            patternId: workflow.patternId,
            adjustment: confidenceAdjustment,
            source: 'rating'
          });
        } catch (error) {
          this.logger.error(`Error updating pattern confidence: ${error.message}`, { error, patternId: workflow.patternId });
        }
      }
    } catch (error) {
      this.logger.error(`Error processing rating feedback: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Process comments feedback.
   * @private
   * @param {Object} workflow The workflow
   * @param {string} comments The user comments
   * @param {Object} result The result object to update
   * @returns {Promise<void>}
   */
  async _processCommentsFeedback(workflow, comments, result) {
    try {
      // Validate comments
      if (typeof comments !== 'string' || comments.trim().length === 0) {
        return;
      }
      
      // Analyze sentiment of comments
      const sentiment = await this._analyzeSentiment(comments);
      
      // Add to result
      result.adjustments.push({
        type: 'sentiment',
        value: sentiment.score,
        source: 'comments',
        sentiment: sentiment
      });
      
      // Extract action items from comments
      const actionItems = await this._extractActionItems(comments);
      
      if (actionItems.length > 0) {
        // Add to result
        result.adjustments.push({
          type: 'actionItems',
          items: actionItems,
          source: 'comments'
        });
      }
    } catch (error) {
      this.logger.error(`Error processing comments feedback: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Process step adjustments feedback.
   * @private
   * @param {Object} workflow The workflow
   * @param {Array<Object>} stepAdjustments The step adjustments
   * @param {Object} result The result object to update
   * @returns {Promise<void>}
   */
  async _processStepAdjustments(workflow, stepAdjustments, result) {
    try {
      // Validate step adjustments
      if (!Array.isArray(stepAdjustments) || stepAdjustments.length === 0) {
        return;
      }
      
      // Process each step adjustment
      for (const adjustment of stepAdjustments) {
        // Validate adjustment
        if (!adjustment.stepId || !adjustment.type) {
          continue;
        }
        
        // Find the step in the workflow
        const stepIndex = workflow.steps.findIndex(step => step.id === adjustment.stepId);
        
        if (stepIndex === -1) {
          this.logger.warn(`Step not found: ${adjustment.stepId}`);
          continue;
        }
        
        // Process based on adjustment type
        switch (adjustment.type) {
          case 'modify':
            if (adjustment.properties) {
              // Add to result
              result.adjustments.push({
                type: 'stepModify',
                stepId: adjustment.stepId,
                properties: adjustment.properties,
                source: 'stepAdjustments'
              });
            }
            break;
            
          case 'remove':
            // Add to result
            result.adjustments.push({
              type: 'stepRemove',
              stepId: adjustment.stepId,
              source: 'stepAdjustments'
            });
            break;
            
          case 'add':
            if (adjustment.step) {
              // Add to result
              result.adjustments.push({
                type: 'stepAdd',
                position: adjustment.position || 'after',
                relativeTo: adjustment.stepId,
                step: adjustment.step,
                source: 'stepAdjustments'
              });
            }
            break;
            
          case 'reorder':
            if (adjustment.newPosition !== undefined) {
              // Add to result
              result.adjustments.push({
                type: 'stepReorder',
                stepId: adjustment.stepId,
                newPosition: adjustment.newPosition,
                source: 'stepAdjustments'
              });
            }
            break;
            
          default:
            this.logger.warn(`Unknown step adjustment type: ${adjustment.type}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing step adjustments: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Process parameter adjustments feedback.
   * @private
   * @param {Object} workflow The workflow
   * @param {Array<Object>} parameterAdjustments The parameter adjustments
   * @param {Object} result The result object to update
   * @returns {Promise<void>}
   */
  async _processParameterAdjustments(workflow, parameterAdjustments, result) {
    try {
      // Validate parameter adjustments
      if (!Array.isArray(parameterAdjustments) || parameterAdjustments.length === 0) {
        return;
      }
      
      // Process each parameter adjustment
      for (const adjustment of parameterAdjustments) {
        // Validate adjustment
        if (!adjustment.paramName || !adjustment.type) {
          continue;
        }
        
        // Find the parameter in the workflow
        const paramIndex = workflow.parameters.findIndex(param => param.name === adjustment.paramName);
        
        // Process based on adjustment type
        switch (adjustment.type) {
          case 'modify':
            if (adjustment.properties) {
              // Add to result
              result.adjustments.push({
                type: 'parameterModify',
                paramName: adjustment.paramName,
                properties: adjustment.properties,
                paramExists: paramIndex !== -1,
                source: 'parameterAdjustments'
              });
            }
            break;
            
          case 'remove':
            if (paramIndex !== -1) {
              // Add to result
              result.adjustments.push({
                type: 'parameterRemove',
                paramName: adjustment.paramName,
                source: 'parameterAdjustments'
              });
            }
            break;
            
          case 'add':
            if (adjustment.parameter) {
              // Add to result
              result.adjustments.push({
                type: 'parameterAdd',
                parameter: adjustment.parameter,
                source: 'parameterAdjustments'
              });
            }
            break;
            
          default:
            this.logger.warn(`Unknown parameter adjustment type: ${adjustment.type}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing parameter adjustments: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Process execution result feedback.
   * @private
   * @param {Object} workflow The workflow
   * @param {Object} executionResult The execution result
   * @param {Object} result The result object to update
   * @returns {Promise<void>}
   */
  async _processExecutionResult(workflow, executionResult, result) {
    try {
      // Validate execution result
      if (!executionResult || typeof executionResult !== 'object') {
        return;
      }
      
      // Extract success/failure information
      const success = executionResult.success === true;
      const errorStep = executionResult.errorStep;
      const errorMessage = executionResult.errorMessage;
      
      // Add to result
      result.adjustments.push({
        type: 'executionResult',
        success: success,
        errorStep: errorStep,
        errorMessage: errorMessage,
        source: 'executionResult'
      });
      
      // Update confidence based on execution result
      const confidenceAdjustment = success ? 0.1 : -0.2;
      
      // Add to result
      result.adjustments.push({
        type: 'confidence',
        value: confidenceAdjustment,
        source: 'executionResult',
        executionSuccess: success
      });
      
      // Update workflow confidence if available
      if (workflow.confidence !== undefined) {
        const newConfidence = Math.max(0, Math.min(1, workflow.confidence + confidenceAdjustment));
        
        // Add to result
        result.adjustments.push({
          type: 'workflowConfidence',
          oldValue: workflow.confidence,
          newValue: newConfidence,
          source: 'executionResult'
        });
      }
      
      // If execution failed, analyze the error
      if (!success && errorStep && errorMessage) {
        const errorAnalysis = await this._analyzeExecutionError(errorStep, errorMessage);
        
        // Add to result
        result.adjustments.push({
          type: 'errorAnalysis',
          stepId: errorStep,
          analysis: errorAnalysis,
          source: 'executionResult'
        });
      }
    } catch (error) {
      this.logger.error(`Error processing execution result: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Store feedback in knowledge graph.
   * @private
   * @param {Object} workflow The workflow
   * @param {Object} feedback The user feedback
   * @param {Object} result The processing result
   * @returns {Promise<void>}
   */
  async _storeFeedbackInKnowledgeGraph(workflow, feedback, result) {
    try {
      // Create feedback node
      const feedbackNode = {
        type: 'WorkflowFeedback',
        id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        properties: {
          workflowId: workflow.id,
          timestamp: Date.now(),
          rating: feedback.rating,
          comments: feedback.comments,
          hasStepAdjustments: !!feedback.stepAdjustments,
          hasParameterAdjustments: !!feedback.parameterAdjustments,
          executionSuccess: feedback.executionResult?.success
        }
      };
      
      await this.knowledgeGraphManager.addNode(feedbackNode);
      
      // Create relationship between workflow and feedback
      const feedbackRelationship = {
        sourceType: 'Workflow',
        sourceId: workflow.id,
        targetType: 'WorkflowFeedback',
        targetId: feedbackNode.id,
        type: 'HAS_FEEDBACK',
        properties: {
          timestamp: Date.now()
        }
      };
      
      await this.knowledgeGraphManager.addRelationship(feedbackRelationship);
      
      // If workflow has a pattern, create relationship between pattern and feedback
      if (workflow.patternId) {
        const patternFeedbackRelationship = {
          sourceType: 'Pattern',
          sourceId: workflow.patternId,
          targetType: 'WorkflowFeedback',
          targetId: feedbackNode.id,
          type: 'PATTERN_FEEDBACK',
          properties: {
            timestamp: Date.now(),
            indirect: true
          }
        };
        
        await this.knowledgeGraphManager.addRelationship(patternFeedbackRelationship);
      }
      
      // Add to result
      result.adjustments.push({
        type: 'knowledgeGraph',
        feedbackNodeId: feedbackNode.id,
        source: 'storeFeedback'
      });
    } catch (error) {
      this.logger.error(`Error storing feedback in knowledge graph: ${error.message}`, { error, workflowId: workflow.id });
    }
  }
  
  /**
   * Calculate confidence adjustment based on rating.
   * @private
   * @param {number} rating The user rating (1-5)
   * @returns {number} Confidence adjustment (-0.3 to 0.2)
   */
  _calculateConfidenceAdjustment(rating) {
    switch (rating) {
      case 1:
        return -0.3;
      case 2:
        return -0.15;
      case 3:
        return 0;
      case 4:
        return 0.1;
      case 5:
        return 0.2;
      default:
        return 0;
    }
  }
  
  /**
   * Analyze sentiment of text.
   * @private
   * @param {string} text Text to analyze
   * @returns {Promise<Object>} Sentiment analysis result
   */
  async _analyzeSentiment(text) {
    try {
      // Simple sentiment analysis based on keywords
      // In a production environment, this would use a more sophisticated NLP service
      
      const positiveWords = [
        'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic',
        'helpful', 'useful', 'perfect', 'love', 'like', 'best', 'better',
        'improved', 'accurate', 'efficient', 'effective', 'works', 'working'
      ];
      
      const negativeWords = [
        'bad', 'poor', 'terrible', 'awful', 'horrible', 'useless', 'waste',
        'broken', 'wrong', 'error', 'fail', 'failed', 'failure', 'issue',
        'problem', 'bug', 'incorrect', 'inaccurate', 'inefficient', 'doesn\'t work'
      ];
      
      // Normalize text
      const normalizedText = text.toLowerCase();
      
      // Count positive and negative words
      let positiveCount = 0;
      let negativeCount = 0;
      
      for (const word of positiveWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = normalizedText.match(regex);
        if (matches) {
          positiveCount += matches.length;
        }
      }
      
      for (const word of negativeWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = normalizedText.match(regex);
        if (matches) {
          negativeCount += matches.length;
        }
      }
      
      // Calculate sentiment score (-1 to 1)
      let score = 0;
      const totalWords = positiveCount + negativeCount;
      
      if (totalWords > 0) {
        score = (positiveCount - negativeCount) / totalWords;
      }
      
      return {
        score: score,
        positive: positiveCount,
        negative: negativeCount,
        neutral: totalWords === 0,
        text: text
      };
    } catch (error) {
      this.logger.error(`Error analyzing sentiment: ${error.message}`, { error });
      return {
        score: 0,
        positive: 0,
        negative: 0,
        neutral: true,
        error: error.message
      };
    }
  }
  
  /**
   * Extract action items from text.
   * @private
   * @param {string} text Text to analyze
   * @returns {Promise<Array<Object>>} Extracted action items
   */
  async _extractActionItems(text) {
    try {
      // Simple action item extraction based on keywords and patterns
      // In a production environment, this would use a more sophisticated NLP service
      
      const actionItems = [];
      
      // Look for common action item patterns
      const patterns = [
        {
          regex: /(?:please|pls|plz)\s+(?:add|include|implement)\s+([^.!?]+)/gi,
          type: 'add'
        },
        {
          regex: /(?:please|pls|plz)\s+(?:remove|delete|eliminate)\s+([^.!?]+)/gi,
          type: 'remove'
        },
        {
          regex: /(?:please|pls|plz)\s+(?:change|modify|update|fix)\s+([^.!?]+)/gi,
          type: 'modify'
        },
        {
          regex: /(?:need|needs|should|must)\s+(?:to\s+)?(?:add|include|implement)\s+([^.!?]+)/gi,
          type: 'add'
        },
        {
          regex: /(?:need|needs|should|must)\s+(?:to\s+)?(?:remove|delete|eliminate)\s+([^.!?]+)/gi,
          type: 'remove'
        },
        {
          regex: /(?:need|needs|should|must)\s+(?:to\s+)?(?:change|modify|update|fix)\s+([^.!?]+)/gi,
          type: 'modify'
        },
        {
          regex: /(?:missing|lacks|doesn't have|does not have)\s+([^.!?]+)/gi,
          type: 'add'
        },
        {
          regex: /(?:wrong|incorrect|error in|problem with)\s+([^.!?]+)/gi,
          type: 'modify'
        }
      ];
      
      // Apply each pattern
      for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern.regex)];
        
        for (const match of matches) {
          actionItems.push({
            type: pattern.type,
            text: match[1].trim(),
            source: match[0].trim()
          });
        }
      }
      
      return actionItems;
    } catch (error) {
      this.logger.error(`Error extracting action items: ${error.message}`, { error });
      return [];
    }
  }
  
  /**
   * Analyze execution error.
   * @private
   * @param {string} stepId ID of the step with error
   * @param {string} errorMessage Error message
   * @returns {Promise<Object>} Error analysis
   */
  async _analyzeExecutionError(stepId, errorMessage) {
    try {
      // Simple error analysis
      // In a production environment, this would use more sophisticated error analysis
      
      // Categorize error
      let category = 'unknown';
      let suggestion = '';
      
      if (/permission|access|denied/i.test(errorMessage)) {
        category = 'permission';
        suggestion = 'Check if the workflow has the necessary permissions to perform this action.';
      } else if (/not found|missing|doesn't exist|does not exist/i.test(errorMessage)) {
        category = 'notFound';
        suggestion = 'Verify that the target element or resource exists before executing this step.';
      } else if (/timeout|timed out/i.test(errorMessage)) {
        category = 'timeout';
        suggestion = 'Consider adding a wait step or increasing the timeout value.';
      } else if (/invalid|incorrect|wrong/i.test(errorMessage)) {
        category = 'invalidInput';
        suggestion = 'Check the input parameters for this step and ensure they are valid.';
      } else if (/network|connection|offline/i.test(errorMessage)) {
        category = 'network';
        suggestion = 'Verify network connectivity before executing this workflow.';
      } else {
        category = 'other';
        suggestion = 'Review the step configuration and try again.';
      }
      
      return {
        category: category,
        suggestion: suggestion,
        errorMessage: errorMessage,
        stepId: stepId
      };
    } catch (error) {
      this.logger.error(`Error analyzing execution error: ${error.message}`, { error });
      return {
        category: 'analysisError',
        suggestion: 'Unable to analyze the error. Please review the error message manually.',
        errorMessage: errorMessage,
        stepId: stepId
      };
    }
  }
}

module.exports = FeedbackProcessor;
