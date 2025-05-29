/**
 * @fileoverview Reasoning Task Status enum for the Aideon AI Desktop Agent.
 * Defines the possible states of a reasoning task.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Enum for reasoning task status.
 * @enum {string}
 */
const ReasoningTaskStatus = {
  /** Task has been submitted but not yet processed */
  PENDING: 'pending',
  
  /** Task is currently being processed */
  PROCESSING: 'processing',
  
  /** Task has been completed successfully */
  COMPLETED: 'completed',
  
  /** Task processing has failed */
  FAILED: 'failed',
  
  /** Task has been canceled */
  CANCELED: 'canceled'
};

module.exports = { ReasoningTaskStatus };
