/**
 * @fileoverview Implementation of the RecoveryLearningSystem component for the Autonomous Error Recovery System.
 * This component is responsible for learning from recovery attempts to improve future strategies.
 * 
 * @module core/error_recovery/RecoveryLearningSystem
 */

/**
 * RecoveryLearningSystem learns from recovery attempts to improve future strategies.
 */
class RecoveryLearningSystem {
  /**
   * Creates a new RecoveryLearningSystem instance.
   * @param {Object} options - Configuration options
   * @param {Object} [options.eventBus] - Event bus for publishing learning events
   * @param {Object} [options.metrics] - Metrics collector for tracking learning performance
   * @param {Object} [options.neuralHub] - Neural coordination hub for advanced learning
   * @param {Object} [options.logger] - Logger instance
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.metrics = options.metrics;
    this.neuralHub = options.neuralHub;
    this.logger = options.logger || console;
    
    // Learning database (in-memory for now)
    this.learningDb = new Map();
    
    this.logger.info("RecoveryLearningSystem initialized");
  }

  /**
   * Learns from a recovery attempt.
   * @param {Object} recoveryFlow - Recovery flow data
   * @param {Object} context - Recovery context
   * @returns {Promise<Object>} Learning results
   */
  async learnFromRecovery(recoveryFlow, context) {
    try {
      this.logger.debug(`Learning from recovery flow: ${recoveryFlow.id}`);
      
      if (this.eventBus) {
        this.eventBus.emit('learning:started', { 
          flowId: recoveryFlow.id,
          timestamp: Date.now()
        });
      }
      
      // Extract key information from recovery flow
      const { rootCauses, strategy, successful } = this.extractLearningData(recoveryFlow);
      
      // Store learning data
      this.storeLearningData(rootCauses, strategy, successful);
      
      // Update success/failure metrics
      if (this.metrics) {
        if (successful) {
          this.metrics.incrementCounter('recovery_learning_success');
        } else {
          this.metrics.incrementCounter('recovery_learning_failure');
        }
      }
      
      // Record success or failure
      if (successful) {
        await this.recordSuccess(rootCauses || [], strategy);
      } else {
        await this.recordFailure(rootCauses || [], strategy);
      }
      
      // Emit learning completed event AFTER async operations complete
      if (this.eventBus) {
        this.eventBus.emit('learning:completed', {
          flowId: recoveryFlow.id,
          successful: true,
          timestamp: Date.now()
        });
      }
      
      return { successful: true };
    } catch (error) {
      this.logger.error(`Error in learning from recovery: ${error.message}`, error);
      
      // Emit learning failed event
      if (this.eventBus) {
        this.eventBus.emit('learning:failed', {
          flowId: recoveryFlow.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return { successful: false, error: error.message };
    }
  }
  
  /**
   * Records a successful recovery for learning.
   * @param {Array} rootCauses - Root causes identified
   * @param {Object} strategy - Strategy that was successful
   * @returns {Promise<void>}
   */
  async recordSuccess(rootCauses, strategy) {
    this.logger.debug(`Recording successful recovery for strategy: ${strategy?.id}`);
    
    // Debug output to trace execution flow and dependencies
    console.log('RecoveryLearningSystem.recordSuccess called with:', {
      hasRootCauses: !!rootCauses,
      rootCausesLength: rootCauses?.length,
      strategyId: strategy?.id,
      hasNeuralHub: !!this.neuralHub,
      neuralHubType: this.neuralHub ? typeof this.neuralHub : 'undefined',
      neuralHubMethods: this.neuralHub ? Object.keys(this.neuralHub) : []
    });
    
    // Ensure rootCauses is iterable
    if (!rootCauses || !Array.isArray(rootCauses)) {
      rootCauses = [];
      this.logger.warn("recordSuccess called with non-iterable rootCauses");
    }
    
    // For each root cause type, record the successful strategy
    for (const cause of rootCauses) {
      const causeType = cause?.type || 'UNKNOWN';
      if (!this.learningDb.has(causeType)) {
        this.learningDb.set(causeType, { 
          successfulStrategies: [],
          failedStrategies: []
        });
      }
      
      const causeData = this.learningDb.get(causeType);
      
      // Add strategy to successful list if not already there
      const existingIndex = causeData.successfulStrategies.findIndex(s => s.id === strategy?.id);
      if (existingIndex >= 0) {
        // Update existing entry
        causeData.successfulStrategies[existingIndex].successCount = 
          (causeData.successfulStrategies[existingIndex].successCount || 0) + 1;
      } else if (strategy?.id) {
        // Add new entry
        causeData.successfulStrategies.push({
          id: strategy.id,
          actions: strategy.actions || [],
          successCount: 1,
          lastSuccess: Date.now()
        });
      }
    }
    
    // Integrate with neural hub if available
    if (this.neuralHub) {
      console.log('Calling neuralHub.recordRecoverySuccess with:', {
        rootCausesLength: rootCauses.length,
        strategyId: strategy?.id,
        neuralHubMethods: Object.keys(this.neuralHub)
      });
      
      try {
        await this.neuralHub.recordRecoverySuccess({
          rootCauses,
          strategy,
          timestamp: Date.now()
        });
        console.log('neuralHub.recordRecoverySuccess completed successfully');
      } catch (error) {
        console.error('Error in neuralHub.recordRecoverySuccess:', error);
        this.logger.warn(`Failed to record success in neural hub: ${error.message}`);
      }
    }
  }  /**
   * Records a failure in recovery for learning.
   * @param {Array} rootCauses - Root causes identified
   * @param {Object} strategy - Strategy that failed
   * @returns {Promise<void>}
   */
  async recordFailure(rootCauses, strategy) {
    this.logger.debug(`Recording failed recovery for strategy: ${strategy?.id}`);
    
    // Debug output to trace execution flow and dependencies
    console.log('RecoveryLearningSystem.recordFailure called with:', {
      hasRootCauses: !!rootCauses,
      rootCausesLength: rootCauses?.length,
      strategyId: strategy?.id,
      hasNeuralHub: !!this.neuralHub,
      neuralHubType: this.neuralHub ? typeof this.neuralHub : 'undefined',
      neuralHubMethods: this.neuralHub ? Object.keys(this.neuralHub) : []
    });
    
    // Ensure rootCauses is iterable
    if (!rootCauses || !Array.isArray(rootCauses)) {
      rootCauses = [];
      this.logger.warn("recordFailure called with non-iterable rootCauses");
    }
    
    // For each root cause type, record the failed strategy
    for (const cause of rootCauses) {
      const causeType = cause?.type || 'UNKNOWN';
      if (!this.learningDb.has(causeType)) {
        this.learningDb.set(causeType, { 
          successfulStrategies: [],
          failedStrategies: []
        });
      }
      
      const causeData = this.learningDb.get(causeType);
      
      // Add strategy to failed list if not already there
      const existingIndex = causeData.failedStrategies.findIndex(s => s.id === strategy?.id);
      if (existingIndex >= 0) {
        // Update existing entry
        causeData.failedStrategies[existingIndex].failureCount = 
          (causeData.failedStrategies[existingIndex].failureCount || 0) + 1;
      } else if (strategy?.id) {
        // Add new entry
        causeData.failedStrategies.push({
          id: strategy.id,
          actions: strategy.actions || [],
          failureCount: 1,
          lastFailure: Date.now()
        });
      }
    }
    
    // Integrate with neural hub if available
    if (this.neuralHub) {
      console.log('Calling neuralHub.recordRecoveryFailure with:', {
        rootCausesLength: rootCauses.length,
        strategyId: strategy?.id,
        neuralHubMethods: Object.keys(this.neuralHub)
      });
      
      try {
        await this.neuralHub.recordRecoveryFailure({
          rootCauses,
          strategy,
          timestamp: Date.now()
        });
        console.log('neuralHub.recordRecoveryFailure completed successfully');
      } catch (error) {
        console.error('Error in neuralHub.recordRecoveryFailure:', error);
        this.logger.warn(`Failed to record failure in neural hub: ${error.message}`);
      }
    }
  }
  
  /**
   * Extracts learning data from a recovery flow.
   * @param {Object} recoveryFlow - Recovery flow data
   * @returns {Object} Extracted learning data
   * @private
   */
  extractLearningData(recoveryFlow) {
    // Validate recovery flow structure
    if (!recoveryFlow || !recoveryFlow.steps || !Array.isArray(recoveryFlow.steps)) {
      throw new Error('Invalid recovery flow structure: steps array is missing or invalid');
    }
    
    // Find analysis step
    const analysisStep = recoveryFlow.steps.find(step => step.name === 'analyze');
    const rootCauses = analysisStep?.result?.rootCauses || [];
    
    // Find strategy generation step
    const strategyStep = recoveryFlow.steps.find(step => step.name === 'generate');
    const strategy = strategyStep?.result || null;
    
    // Determine if recovery was successful
    const executionStep = recoveryFlow.steps.find(step => step.name === 'execute');
    const successful = executionStep?.successful || false;
    
    return { rootCauses, strategy, successful };
  }
  
  /**
   * Stores learning data for future reference.
   * @param {Array} rootCauses - Root causes identified
   * @param {Object} strategy - Strategy used
   * @param {boolean} successful - Whether recovery was successful
   * @private
   */
  storeLearningData(rootCauses, strategy, successful) {
    // Implementation depends on storage mechanism
    // For now, just log the data
    this.logger.debug(`Storing learning data: ${rootCauses?.length || 0} root causes, strategy ${strategy?.id || 'unknown'}, successful: ${successful}`);
    
    // Track metrics if available
    if (this.metrics) {
      // Use incrementCounter instead of recordMetric to match the MetricsCollector interface
      if (typeof this.metrics.incrementCounter === 'function') {
        this.metrics.incrementCounter('recovery_learning_data_stored', 1);
      } else if (typeof this.metrics.recordMetric === 'function') {
        // Fallback for backward compatibility
        this.metrics.recordMetric('recovery_learning_data_stored', 1);
      } else {
        this.logger.warn('Metrics collector does not implement incrementCounter or recordMetric');
      }
    }
  }
  
  /**
   * Gets recommended strategies for a given root cause.
   * @param {string} causeType - Root cause type
   * @returns {Array} Recommended strategies, sorted by success rate
   */
  getRecommendedStrategies(causeType) {
    if (!this.learningDb.has(causeType)) {
      return [];
    }
    
    const causeData = this.learningDb.get(causeType);
    
    // Sort by success count (descending)
    return [...causeData.successfulStrategies].sort((a, b) => 
      (b.successCount || 0) - (a.successCount || 0)
    );
  }
  
  /**
   * Gets strategies to avoid for a given root cause.
   * @param {string} causeType - Root cause type
   * @returns {Array} Strategies to avoid, sorted by failure rate
   */
  getStrategiesToAvoid(causeType) {
    if (!this.learningDb.has(causeType)) {
      return [];
    }
    
    const causeData = this.learningDb.get(causeType);
    
    // Sort by failure count (descending)
    return [...causeData.failedStrategies].sort((a, b) => 
      (b.failureCount || 0) - (a.failureCount || 0)
    );
  }
  
  /**
   * Clears learning data.
   * @returns {void}
   */
  clearLearningData() {
    this.learningDb.clear();
    this.logger.info("Learning data cleared");
  }
}

module.exports = RecoveryLearningSystem;
