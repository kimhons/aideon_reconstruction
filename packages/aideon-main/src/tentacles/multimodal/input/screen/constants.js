/**
 * @fileoverview Constants for Screen Recording and Analysis module.
 * 
 * This file defines constants used throughout the Screen Recording and Analysis module.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Screen recording states.
 * @enum {string}
 */
const ScreenRecordingState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  RECORDING: 'recording',
  PAUSED: 'paused',
  ANALYZING: 'analyzing',
  ERROR: 'error'
};

/**
 * Screen recording events.
 * @enum {string}
 */
const ScreenRecordingEvent = {
  INITIALIZED: 'initialized',
  RECORDING_STARTED: 'recording-started',
  RECORDING_STOPPED: 'recording-stopped',
  RECORDING_PAUSED: 'recording-paused',
  RECORDING_RESUMED: 'recording-resumed',
  FRAME_CAPTURED: 'frame-captured',
  ANALYSIS_STARTED: 'analysis-started',
  ANALYSIS_COMPLETED: 'analysis-completed',
  ERROR_OCCURRED: 'error-occurred',
  STATE_CHANGED: 'state-changed'
};

module.exports = {
  ScreenRecordingState,
  ScreenRecordingEvent
};
