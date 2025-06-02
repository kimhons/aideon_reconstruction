/**
 * @fileoverview Enhanced Tentacle Integration Template
 * Template for integrating tentacles with advanced multi-LLM orchestration
 * 
 * @module src/tentacles/common/EnhancedTentacleIntegration
 */

/**
 * Enhanced Tentacle Integration
 * Provides standardized methods for integrating tentacles with advanced multi-LLM orchestration
 */
class EnhancedTentacleIntegration {
  /**
   * Create a new Enhanced Tentacle Integration
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    this.options = {
      collaborativeIntelligence: true,
      specializedModelSelection: true,
      adaptiveResourceAllocation: true,
      selfEvaluation: true,
      offlineCapability: 'full', // 'limited', 'standard', 'full'
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.modelOrchestrationSystem = dependencies.modelOrchestrationSystem;
    
    // Validate required dependencies
    if (!this.modelOrchestrationSystem) {
      throw new Error("Model Orchestration System is required for EnhancedTentacleIntegration");
    }
    
    this.collaborationSessions = new Map();
    this.logger.info("[EnhancedTentacleIntegration] Initialized");
  }
  
  /**
   * Initialize advanced orchestration for a tentacle
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {Array<Object>} collaborationConfigs - Collaboration session configurations
   * @returns {Promise<boolean>} Success status
   */
  async initializeAdvancedOrchestration(tentacleId, collaborationConfigs = []) {
    this.logger.debug(`[EnhancedTentacleIntegration] Initializing advanced orchestration for tentacle: ${tentacleId}`);
    
    try {
      // Create collaboration sessions based on configs
      for (const config of collaborationConfigs) {
        const sessionId = `${tentacleId}_${config.name}`;
        
        // Create collaboration session
        await this.modelOrchestrationSystem.createCollaborationSession({
          sessionId,
          modelType: config.modelType,
          taskType: config.taskType,
          collaborationStrategy: config.collaborationStrategy,
          offlineOnly: config.offlineOnly || this.options.offlineCapability === 'full'
        });
        
        // Store session reference
        this.collaborationSessions.set(config.name, sessionId);
      }
      
      this.logger.info(`[EnhancedTentacleIntegration] Advanced orchestration initialized for tentacle: ${tentacleId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[EnhancedTentacleIntegration] Failed to initialize advanced orchestration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Execute a task using collaborative intelligence
   * @param {string} sessionName - Name of the collaboration session
   * @param {Object} input - Task input
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeCollaborativeTask(sessionName, input, options = {}) {
    const sessionId = this.collaborationSessions.get(sessionName);
    
    if (!sessionId) {
      throw new Error(`Collaboration session not found: ${sessionName}`);
    }
    
    this.logger.debug(`[EnhancedTentacleIntegration] Executing collaborative task for session: ${sessionName}`);
    
    try {
      // Execute collaborative task
      const result = await this.modelOrchestrationSystem.executeCollaborativeTask({
        sessionId,
        input,
        options: {
          ...options,
          adaptiveResourceAllocation: this.options.adaptiveResourceAllocation,
          selfEvaluation: this.options.selfEvaluation
        }
      });
      
      return result;
      
    } catch (error) {
      this.logger.error(`[EnhancedTentacleIntegration] Failed to execute collaborative task: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Select specialized model for a specific task
   * @param {Object} taskInfo - Task information
   * @param {string} taskInfo.taskType - Type of task
   * @param {Object} taskInfo.requirements - Task requirements
   * @param {Object} options - Selection options
   * @returns {Promise<Object>} Selected model
   */
  async selectSpecializedModel(taskInfo, options = {}) {
    if (!this.options.specializedModelSelection) {
      throw new Error("Specialized model selection is not enabled");
    }
    
    this.logger.debug(`[EnhancedTentacleIntegration] Selecting specialized model for task: ${taskInfo.taskType}`);
    
    try {
      // Select specialized model
      const model = await this.modelOrchestrationSystem.selectSpecializedModel({
        ...taskInfo,
        options: {
          ...options,
          offlineOnly: options.offlineOnly || this.options.offlineCapability === 'full'
        }
      });
      
      return model;
      
    } catch (error) {
      this.logger.error(`[EnhancedTentacleIntegration] Failed to select specialized model: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a task with cross-modal intelligence fusion
   * @param {Object} input - Task input
   * @param {Array<string>} modalityTypes - Types of modalities to use
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeCrossModalTask(input, modalityTypes, options = {}) {
    this.logger.debug(`[EnhancedTentacleIntegration] Executing cross-modal task`);
    
    try {
      // Execute cross-modal task
      const result = await this.modelOrchestrationSystem.executeCrossModalTask({
        input,
        modalityTypes,
        options: {
          ...options,
          adaptiveResourceAllocation: this.options.adaptiveResourceAllocation,
          selfEvaluation: this.options.selfEvaluation,
          offlineOnly: options.offlineOnly || this.options.offlineCapability === 'full'
        }
      });
      
      return result;
      
    } catch (error) {
      this.logger.error(`[EnhancedTentacleIntegration] Failed to execute cross-modal task: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up resources
   * @returns {Promise<boolean>} Success status
   */
  async cleanup() {
    this.logger.debug(`[EnhancedTentacleIntegration] Cleaning up resources`);
    
    try {
      // Close all collaboration sessions
      for (const [name, sessionId] of this.collaborationSessions.entries()) {
        await this.modelOrchestrationSystem.closeCollaborationSession(sessionId);
      }
      
      this.collaborationSessions.clear();
      
      this.logger.info(`[EnhancedTentacleIntegration] Resources cleaned up`);
      return true;
      
    } catch (error) {
      this.logger.error(`[EnhancedTentacleIntegration] Failed to clean up resources: ${error.message}`);
      return false;
    }
  }
}

module.exports = EnhancedTentacleIntegration;
