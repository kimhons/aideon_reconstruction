# Automatic Screen Recording Triggers Documentation

## Overview

This document provides an overview of the automatic screen recording trigger system implemented for the Aideon AI Desktop Agent. The system enables automatic activation of screen recording based on various triggers, enhancing the agent's ability to capture relevant user interactions without requiring manual activation.

## Trigger Types

The following trigger types have been implemented:

1. **Learning from Demonstration Mode**
   - Automatically starts recording when the user enters "teach mode"
   - Captures the entire demonstration for learning purposes
   - Prioritizes high-quality capture for accurate learning

2. **Voice Command Integration**
   - Begins recording in response to specific voice commands
   - Examples: "Aideon, watch this" or "Aideon, learn from this"
   - Provides natural, hands-free recording activation

3. **Error Diagnosis**
   - Triggers recording when unexpected application crashes or errors occur
   - Captures context and user actions leading up to the problem
   - Helps with troubleshooting and bug fixing

4. **Context Switching Detection**
   - Activates recording when rapid application switching is detected
   - Helps Aideon understand multi-application workflows
   - Captures complex user context transitions

5. **Task Completion Analysis**
   - Starts recording when the user begins complex workflows
   - Gathers insights on how users accomplish tasks
   - Improves Aideon's assistance capabilities

## Architecture

The automatic trigger system follows a modular architecture:

### Core Components

1. **TriggerManager**
   - Central coordinator for all trigger detectors
   - Manages trigger registration and lifecycle
   - Routes trigger events to the recording manager
   - Handles configuration and policy enforcement

2. **TriggerDetector (Base Interface)**
   - Common interface for all trigger detectors
   - Provides standardized lifecycle methods
   - Enables consistent event emission
   - Supports confidence scoring for triggers

3. **Specialized Detectors**
   - LearningModeTriggerDetector
   - VoiceCommandTriggerDetector
   - ErrorDiagnosisTriggerDetector
   - (Additional specialized detectors)

4. **EnhancedScreenRecordingManager**
   - Integrates with TriggerManager
   - Handles automatic recording activation/deactivation
   - Manages recording lifecycle and resources
   - Provides user feedback mechanisms

### Key Features

- **Confidence-based Activation**: Triggers include confidence scores to prevent false activations
- **Duration Management**: Automatic recordings have configurable maximum durations
- **User Review**: Optional user review before saving automatic recordings
- **Visual Indicators**: Clear indicators when automatic recording is active
- **Privacy Controls**: Configurable trigger types and global enable/disable
- **Resource Management**: Proper cleanup and resource handling

## Configuration Options

The automatic recording system supports the following configuration options:

```javascript
{
  automaticRecording: {
    enabled: true,                      // Master enable/disable
    requireUserReview: true,            // Require user review before saving
    maxDuration: 300,                   // Maximum recording duration (seconds)
    showIndicator: true,                // Show visual indicator during recording
    enabledTriggers: ['learning', 'voice', 'error'] // Enabled trigger types
  }
}
```

## Usage Examples

### Learning Mode Trigger

```javascript
// Register learning mode detector
const learningDetector = new LearningModeTriggerDetector({
  logger: logger,
  learningManager: learningManager
});

triggerManager.registerTrigger(learningDetector);

// Learning mode will automatically trigger recording when activated
```

### Voice Command Trigger

```javascript
// Register voice command detector
const voiceDetector = new VoiceCommandTriggerDetector({
  logger: logger,
  voiceInputManager: voiceInputManager,
  commands: ['record screen', 'watch this', 'learn this']
});

triggerManager.registerTrigger(voiceDetector);

// Voice commands will automatically trigger recording
```

### Error Diagnosis Trigger

```javascript
// Register error diagnosis detector
const errorDetector = new ErrorDiagnosisTriggerDetector({
  logger: logger,
  errorMonitor: errorMonitor,
  config: {
    errorSeverityThreshold: 'medium'
  }
});

triggerManager.registerTrigger(errorDetector);

// Errors will automatically trigger recording for diagnosis
```

## Testing

The automatic trigger system has been thoroughly tested using both:

1. **Full Integration Tests**: Testing the complete integration with EnhancedScreenRecordingManager
2. **Simplified Functional Tests**: Testing the core trigger logic independently

All tests validate the following key behaviors:

- Correct activation of recording based on triggers
- Proper deactivation when triggers are removed
- Respect for configuration settings (disabled triggers, etc.)
- Maximum duration enforcement
- Concurrent trigger handling
- Error handling and recovery

## Privacy and User Experience Considerations

The automatic trigger system has been designed with privacy and user experience as top priorities:

1. **Explicit Indicators**: Clear visual indicators when automatic recording is active
2. **User Control**: Global enable/disable and per-trigger type configuration
3. **Duration Limits**: Strict maximum duration enforcement
4. **Review Process**: Optional user review before saving recordings
5. **Transparent Activation**: Clear communication about what triggered recording
6. **Data Minimization**: Recording only what's necessary for the specific trigger

## Future Enhancements

Potential future enhancements to the automatic trigger system:

1. **Machine Learning-based Triggers**: Using ML to detect important moments for recording
2. **Contextual Awareness**: More sophisticated context detection for smarter triggering
3. **Customizable Triggers**: User-defined custom triggers and conditions
4. **Selective Recording**: Recording only specific applications or windows
5. **Pre-recording Buffer**: Maintaining a buffer to capture events before trigger activation

## Conclusion

The automatic screen recording trigger system enhances the Aideon AI Desktop Agent's ability to capture relevant user interactions without requiring manual activation. The modular architecture ensures extensibility for future trigger types, while the comprehensive testing ensures robust and reliable operation.
