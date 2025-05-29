/**
 * @fileoverview Core data structures for the Aideon AI Desktop Agent's Reasoning Engine.
 * Defines the structures for reasoning tasks, results, and related entities.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Structure for a reasoning task.
 * 
 * @typedef {Object} ReasoningTask
 * @property {string} id - Unique identifier for the task
 * @property {string} query - The reasoning query or problem statement
 * @property {Object} context - Context information for the reasoning task
 * @property {string[]} [preferredStrategies] - Preferred reasoning strategies to use
 * @property {Object} constraints - Constraints for the reasoning process
 * @property {Object} metadata - Additional metadata for the task
 * @property {string} status - Current status of the task (from ReasoningTaskStatus)
 * @property {Object} result - Result of the reasoning task (null if not completed)
 * @property {Object} explanation - Explanation of the reasoning process (null if not available)
 * @property {number} confidence - Confidence score for the result (0-1, null if not available)
 * @property {Object} error - Error information if the task failed (null if no error)
 */

/**
 * Structure for a reasoning result.
 * 
 * @typedef {Object} ReasoningResult
 * @property {Object} result - The actual result data (structure depends on strategy)
 * @property {number} confidence - Confidence score for the result (0-1)
 * @property {Object} metadata - Additional metadata about the result
 */

/**
 * Structure for a reasoning explanation.
 * 
 * @typedef {Object} ReasoningExplanation
 * @property {string} summary - Brief summary of the reasoning process
 * @property {Array<Object>} steps - Detailed steps of the reasoning process
 * @property {Object} evidence - Evidence supporting the conclusion
 * @property {Object} alternatives - Alternative conclusions considered
 * @property {Object} metadata - Additional metadata about the explanation
 */

/**
 * Structure for a reasoning strategy capability assessment.
 * 
 * @typedef {Object} StrategyCapability
 * @property {boolean} canHandle - Whether the strategy can handle the task
 * @property {number} confidence - Confidence score for the capability assessment (0-1)
 * @property {string} [reason] - Reason for the capability assessment
 */

/**
 * Structure for a reasoning strategy selection result.
 * 
 * @typedef {Object} StrategySelection
 * @property {string} strategyName - Name of the selected strategy
 * @property {number} confidence - Confidence score for the selection (0-1)
 * @property {string} reason - Reason for the selection
 */

/**
 * Structure for tentacle information.
 * 
 * @typedef {Object} TentacleInfo
 * @property {string} name - Name of the tentacle
 * @property {string} version - Version of the tentacle
 * @property {string[]} capabilities - Capabilities provided by the tentacle
 * @property {Object} metadata - Additional metadata about the tentacle
 * @property {number} registeredAt - Timestamp when the tentacle was registered
 * @property {number} lastActiveAt - Timestamp when the tentacle was last active
 */

/**
 * Structure for tentacle context data.
 * 
 * @typedef {Object} TentacleContext
 * @property {Object} data - Context data specific to the tentacle
 * @property {number} updatedAt - Timestamp when the context was last updated
 */

module.exports = {
  // These are type definitions only, no actual implementations
  // They are exported for documentation purposes
};
