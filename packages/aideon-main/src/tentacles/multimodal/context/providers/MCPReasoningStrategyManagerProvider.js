/**
 * @fileoverview MCP Reasoning Strategy Manager Provider.
 * 
 * This provider integrates the ReasoningStrategyManager with the MCP system,
 * enabling context sharing for reasoning strategy selection and execution.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPReasoningEngineContextProvider } = require('./MCPReasoningEngineContextProvider');

/**
 * Provider for integrating ReasoningStrategyManager with MCP.
 */
class MCPReasoningStrategyManagerProvider extends MCPReasoningEngineContextProvider {
  /**
   * Creates a new MCPReasoningStrategyManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.reasoningStrategyManager - ReasoningStrategyManager instance
   */
  constructor(options) {
    super(options);
    
    if (!options.reasoningStrategyManager) {
      throw new Error('MCPReasoningStrategyManagerProvider requires a valid reasoningStrategyManager');
    }
    
    this.reasoningStrategyManager = options.reasoningStrategyManager;
    this.logger.debug('MCPReasoningStrategyManagerProvider created');
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
        
        // Set up event listeners for ReasoningStrategyManager events
        this.reasoningStrategyManager.on('strategySelected', this.handleStrategySelected.bind(this));
        this.reasoningStrategyManager.on('strategyExecuted', this.handleStrategyExecuted.bind(this));
        this.reasoningStrategyManager.on('strategyFailed', this.handleStrategyFailed.bind(this));
        this.reasoningStrategyManager.on('modelSelected', this.handleModelSelected.bind(this));
        
        this.logger.info('MCPReasoningStrategyManagerProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize MCPReasoningStrategyManagerProvider:', error);
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
      'reasoning.strategy.selection',
      'reasoning.strategy.execution',
      'reasoning.model.selection',
      'reasoning.strategy.failure'
    ];
  }
  
  /**
   * Handles strategy selection events.
   * 
   * @param {Object} event - Strategy selection event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleStrategySelected(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        strategyId: event.strategyId,
        strategyType: event.strategyType,
        selectionReason: event.reason,
        alternativeStrategies: event.alternatives || [],
        parameters: event.parameters || {},
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.strategy.selection',
        contextData,
        event.confidence || 0.9
      );
    } catch (error) {
      this.logger.error('Error handling strategy selection event:', error);
      return null;
    }
  }
  
  /**
   * Handles strategy execution events.
   * 
   * @param {Object} event - Strategy execution event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleStrategyExecuted(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        strategyId: event.strategyId,
        executionId: event.executionId,
        duration: event.duration,
        resourceUsage: event.resourceUsage || {},
        resultSummary: event.resultSummary,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.strategy.execution',
        contextData,
        event.confidence || 0.95
      );
    } catch (error) {
      this.logger.error('Error handling strategy execution event:', error);
      return null;
    }
  }
  
  /**
   * Handles strategy failure events.
   * 
   * @param {Object} event - Strategy failure event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleStrategyFailed(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        strategyId: event.strategyId,
        executionId: event.executionId,
        errorType: event.errorType,
        errorMessage: event.errorMessage,
        stackTrace: event.stackTrace,
        recoveryAttempted: event.recoveryAttempted || false,
        recoverySuccessful: event.recoverySuccessful || false,
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.strategy.failure',
        contextData,
        event.confidence || 0.99
      );
    } catch (error) {
      this.logger.error('Error handling strategy failure event:', error);
      return null;
    }
  }
  
  /**
   * Handles model selection events.
   * 
   * @param {Object} event - Model selection event
   * @returns {Promise<string>} Context ID if successful
   */
  async handleModelSelected(event) {
    try {
      const contextData = {
        taskId: event.taskId,
        strategyId: event.strategyId,
        modelId: event.modelId,
        modelType: event.modelType,
        selectionReason: event.reason,
        alternativeModels: event.alternatives || [],
        parameters: event.parameters || {},
        timestamp: Date.now()
      };
      
      return await this.addContext(
        'reasoning.model.selection',
        contextData,
        event.confidence || 0.9
      );
    } catch (error) {
      this.logger.error('Error handling model selection event:', error);
      return null;
    }
  }
  
  /**
   * Retrieves recent strategy selections for a specific task.
   * 
   * @param {string} taskId - Task identifier
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<Object>>} Recent strategy selections
   */
  async getRecentStrategySelections(taskId, options = {}) {
    try {
      return await this.queryContexts('reasoning.strategy.selection', {
        'data.taskId': taskId
      }, {
        limit: options.limit || 5,
        sortBy: 'timestamp',
        descending: true
      });
    } catch (error) {
      this.logger.error('Error retrieving recent strategy selections:', error);
      return [];
    }
  }
  
  /**
   * Retrieves execution history for a specific strategy.
   * 
   * @param {string} strategyId - Strategy identifier
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<Object>>} Strategy execution history
   */
  async getStrategyExecutionHistory(strategyId, options = {}) {
    try {
      return await this.queryContexts('reasoning.strategy.execution', {
        'data.strategyId': strategyId
      }, {
        limit: options.limit || 10,
        sortBy: 'timestamp',
        descending: true
      });
    } catch (error) {
      this.logger.error('Error retrieving strategy execution history:', error);
      return [];
    }
  }
  
  /**
   * Retrieves failure history for a specific strategy.
   * 
   * @param {string} strategyId - Strategy identifier
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<Object>>} Strategy failure history
   */
  async getStrategyFailureHistory(strategyId, options = {}) {
    try {
      return await this.queryContexts('reasoning.strategy.failure', {
        'data.strategyId': strategyId
      }, {
        limit: options.limit || 10,
        sortBy: 'timestamp',
        descending: true
      });
    } catch (error) {
      this.logger.error('Error retrieving strategy failure history:', error);
      return [];
    }
  }
}

module.exports = {
  MCPReasoningStrategyManagerProvider
};
