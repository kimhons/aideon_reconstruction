/**
 * @fileoverview MCP Deductive Reasoner Provider.
 * 
 * This provider integrates the DeductiveReasoner with the MCP system,
 * enabling context sharing for rule-based inference and logical reasoning.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPReasoningEngineContextProvider } = require('./MCPReasoningEngineContextProvider');

/**
 * Provider for integrating DeductiveReasoner with MCP.
 */
class MCPDeductiveReasonerProvider extends MCPReasoningEngineContextProvider {
  /**
   * Creates a new MCPDeductiveReasonerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.deductiveReasoner - DeductiveReasoner instance
   */
  constructor(options) {
    super(options);
    
    if (!options.deductiveReasoner) {
      throw new Error('MCPDeductiveReasonerProvider requires a valid deductiveReasoner');
    }
    
    this.deductiveReasoner = options.deductiveReasoner;
    this.logger.debug('MCPDeductiveReasonerProvider created');
  }
  
  /**
   * Initializes the provider and sets up event listeners.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    return this.lock.acquire('initialize', async () => {
      if (this.initialized) {
        return true;
      }
      
      try {
        // Initialize base provider
        const baseInitialized = await super.initialize();
        if (!baseInitialized) {
          return false;
        }
        
        // Set up event listeners for DeductiveReasoner events
        this.deductiveReasoner.on('ruleApplied', this.handleRuleApplied.bind(this));
        this.deductiveReasoner.on('inferenceGenerated', this.handleInferenceGenerated.bind(this));
        this.deductiveReasoner.on('contradictionDetected', this.handleContradictionDetected.bind(this));
        this.deductiveReasoner.on('proofCompleted', this.handleProofCompleted.bind(this));
        
        this.logger.info('MCPDeductiveReasonerProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize MCPDeductiveReasonerProvider:', error);
        return false;
      }
    });
  }
  
  /**
   * Returns the list of context types supported by this provider.
   * 
   * @returns {Array<string>} List of supported context types
   */
  getSupportedContextTypes() {
    return [
      'reasoning.deductive.rule',
      'reasoning.deductive.inference',
      'reasoning.deductive.contradiction',
      'reasoning.deductive.proof'
    ];
  }
  
  /**
   * Handles rule application events.
   * 
   * @param {Object} event - Rule application event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleRuleApplied(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        ruleId: event.ruleId,
        ruleName: event.ruleName,
        premises: event.premises || [],
        conclusion: event.conclusion,
        justification: event.justification,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.deductive.rule',
        contextData,
        event.confidence || 0.95
      );
    } catch (error) {
      this.logger.error('Error handling rule application event:', error);
      return null;
    }
  }
  
  /**
   * Handles inference generation events.
   * 
   * @param {Object} event - Inference generation event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleInferenceGenerated(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        inferenceId: event.inferenceId,
        statement: event.statement,
        derivedFrom: event.derivedFrom || [],
        rulesApplied: event.rulesApplied || [],
        confidence: event.confidence || 1.0,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.deductive.inference',
        contextData,
        event.confidence || 0.9
      );
    } catch (error) {
      this.logger.error('Error handling inference generation event:', error);
      return null;
    }
  }
  
  /**
   * Handles contradiction detection events.
   * 
   * @param {Object} event - Contradiction detection event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleContradictionDetected(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        contradictionId: event.contradictionId,
        statements: event.statements || [],
        explanation: event.explanation,
        severity: event.severity || 'high',
        resolutionStrategy: event.resolutionStrategy,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.deductive.contradiction',
        contextData,
        event.confidence || 0.99
      );
    } catch (error) {
      this.logger.error('Error handling contradiction detection event:', error);
      return null;
    }
  }
  
  /**
   * Handles proof completion events.
   * 
   * @param {Object} event - Proof completion event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleProofCompleted(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        proofId: event.proofId,
        goal: event.goal,
        steps: event.steps || [],
        isComplete: event.isComplete || false,
        isValid: event.isValid || false,
        duration: event.duration,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.deductive.proof',
        contextData,
        event.confidence || 0.95
      );
    } catch (error) {
      this.logger.error('Error handling proof completion event:', error);
      return null;
    }
  }
  
  /**
   * Retrieves recent inferences for a specific task.
   * 
   * @param {string} taskId - Task identifier
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<Object>>} Recent inferences
   */
  async getRecentInferences(taskId, options = {}) {
    try {
      return await this.queryContexts('reasoning.deductive.inference', {
        'data.taskId': taskId
      }, {
        limit: options.limit || 10,
        sortBy: 'timestamp',
        descending: true
      });
    } catch (error) {
      this.logger.error('Error retrieving recent inferences:', error);
      return [];
    }
  }
  
  /**
   * Retrieves proof steps for a specific proof.
   * 
   * @param {string} proofId - Proof identifier
   * @returns {Promise<Object>} Proof details with steps
   */
  async getProofDetails(proofId) {
    try {
      const proofs = await this.queryContexts('reasoning.deductive.proof', {
        'data.proofId': proofId
      }, {
        limit: 1
      });
      
      if (proofs.length === 0) {
        return null;
      }
      
      return proofs[0];
    } catch (error) {
      this.logger.error('Error retrieving proof details:', error);
      return null;
    }
  }
}

module.exports = {
  MCPDeductiveReasonerProvider
};
