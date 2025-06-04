/**
 * @fileoverview Module index for Screen Recording and Analysis module.
 * 
 * This file exports the main components of the Screen Recording and Analysis module,
 * using absolute paths to prevent module resolution issues.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');

// Use absolute paths for reliable module resolution
const BASE_PATH = __dirname;

// Export main components
module.exports = {
  // Export the enhanced manager as the default implementation
  ScreenRecordingManager: require(path.join(BASE_PATH, 'EnhancedScreenRecordingManager')),
  
  // Export constants
  ...require(path.join(BASE_PATH, 'constants')),
  
  // Export utilities
  utils: require(path.join(BASE_PATH, 'utils')),
  
  // Export platform-specific components
  platform: {
    WindowsCaptureService: require(path.join(BASE_PATH, 'platform', 'WindowsCaptureService')),
    MacOSCaptureService: require(path.join(BASE_PATH, 'platform', 'MacOSCaptureService')),
    LinuxCaptureService: require(path.join(BASE_PATH, 'platform', 'LinuxCaptureService'))
  },
  
  // Export analysis components
  analysis: {
    AnalysisEngine: require(path.join(BASE_PATH, 'analysis', 'AnalysisEngine')),
    ElementRecognitionService: require(path.join(BASE_PATH, 'analysis', 'ElementRecognitionService')),
    ActivityTrackingService: require(path.join(BASE_PATH, 'analysis', 'ActivityTrackingService')),
    ContentUnderstandingService: require(path.join(BASE_PATH, 'analysis', 'ContentUnderstandingService'))
  },
  
  // Export integration components
  integration: {
    KnowledgeGraphIntegration: require(path.join(BASE_PATH, 'integration', 'KnowledgeGraphIntegration')),
    LearningFromDemonstrationIntegration: require(path.join(BASE_PATH, 'integration', 'LearningFromDemonstrationIntegration')),
    VoiceRecognitionIntegration: require(path.join(BASE_PATH, 'integration', 'VoiceRecognitionIntegration'))
  }
};
