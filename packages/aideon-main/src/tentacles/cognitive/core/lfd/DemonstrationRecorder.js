/**
 * @fileoverview Demonstration Recorder for Learning from Demonstration.
 * Captures user actions across applications and records them for analysis.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require("events");

/**
 * Records user demonstrations by capturing events from various sources.
 */
class DemonstrationRecorder extends EventEmitter {
  /**
   * Constructor for DemonstrationRecorder.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.eventBus Global event bus
   * @param {Object} options.configService Configuration service
   * @param {Object} options.securityManager Security manager
   */
  constructor(options) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error("Options are required for DemonstrationRecorder");
    if (!options.logger) throw new Error("Logger is required for DemonstrationRecorder");
    if (!options.eventBus) throw new Error("EventBus is required for DemonstrationRecorder");
    if (!options.configService) throw new Error("ConfigService is required for DemonstrationRecorder");
    if (!options.securityManager) throw new Error("SecurityManager is required for DemonstrationRecorder");
    
    // Initialize properties
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    
    // Initialize state
    this.isRecording = false;
    this.currentDemonstration = null;
    this.eventListeners = [];
    
    // Bind methods
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this._handleEvent = this._handleEvent.bind(this);
    
    this.logger.info("DemonstrationRecorder created");
  }
  
  /**
   * Start recording a new demonstration.
   * @param {Object} options Recording options
   * @param {string} options.userId User ID initiating the recording
   * @param {string} [options.taskId] Optional task ID associated with the demonstration
   * @param {Object} [options.initialContext] Initial context for the demonstration
   * @returns {Promise<string>} ID of the new demonstration
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error("Already recording a demonstration");
    }
    
    if (!options || !options.userId) {
      throw new Error("User ID is required to start recording");
    }
    
    try {
      this.logger.info(`Starting demonstration recording for user: ${options.userId}`);
      
      // Security check
      await this.securityManager.validateAction("start_recording", options.userId);
      
      // Initialize demonstration data
      const demonstrationId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.currentDemonstration = {
        id: demonstrationId,
        userId: options.userId,
        taskId: options.taskId,
        startTime: Date.now(),
        endTime: null,
        events: [],
        initialContext: options.initialContext || {},
        status: "recording"
      };
      
      // Subscribe to relevant events
      this._subscribeToEvents();
      
      this.isRecording = true;
      this.emit("recordingStarted", { demonstrationId });
      this.logger.info(`Demonstration recording started: ${demonstrationId}`);
      
      return demonstrationId;
    } catch (error) {
      this.logger.error(`Failed to start demonstration recording: ${error.message}`, { error, options });
      this.isRecording = false;
      this.currentDemonstration = null;
      throw error;
    }
  }
  
  /**
   * Stop the current demonstration recording.
   * @returns {Promise<Object>} The completed demonstration record
   */
  async stopRecording() {
    if (!this.isRecording) {
      throw new Error("Not currently recording a demonstration");
    }
    
    try {
      this.logger.info(`Stopping demonstration recording: ${this.currentDemonstration.id}`);
      
      // Unsubscribe from events
      this._unsubscribeFromEvents();
      
      // Finalize demonstration data
      this.currentDemonstration.endTime = Date.now();
      this.currentDemonstration.status = "completed";
      
      const completedDemonstration = { ...this.currentDemonstration };
      
      this.isRecording = false;
      this.currentDemonstration = null;
      
      this.emit("recordingStopped", { demonstration: completedDemonstration });
      this.logger.info(`Demonstration recording stopped: ${completedDemonstration.id}`);
      
      return completedDemonstration;
    } catch (error) {
      this.logger.error("Failed to stop demonstration recording", { error });
      // Attempt to salvage data if possible
      if (this.currentDemonstration) {
        this.currentDemonstration.status = "error";
        this.emit("recordingError", { demonstration: this.currentDemonstration, error });
      }
      this.isRecording = false;
      this.currentDemonstration = null;
      throw error;
    }
  }
  
  /**
   * Subscribe to events relevant for demonstration recording.
   * @private
   */
  _subscribeToEvents() {
    const eventTypes = this.configService.get("lfd.recordedEventTypes", [
      "ui.click",
      "ui.input",
      "ui.keypress",
      "app.focusChanged",
      "file.opened",
      "file.saved",
      "clipboard.copied",
      "clipboard.pasted"
      // Add more relevant event types based on system capabilities
    ]);
    
    eventTypes.forEach(eventType => {
      const listener = this._handleEvent.bind(this, eventType);
      this.eventBus.on(eventType, listener);
      this.eventListeners.push({ eventType, listener });
    });
    
    this.logger.info(`Subscribed to ${eventTypes.length} event types for recording`);
  }
  
  /**
   * Unsubscribe from all event listeners.
   * @private
   */
  _unsubscribeFromEvents() {
    this.eventListeners.forEach(({ eventType, listener }) => {
      this.eventBus.off(eventType, listener);
    });
    this.eventListeners = [];
    this.logger.info("Unsubscribed from all recording event listeners");
  }
  
  /**
   * Handle an incoming event during recording.
   * @private
   * @param {string} eventType The type of the event
   * @param {Object} eventData The data associated with the event
   */
  _handleEvent(eventType, eventData) {
    if (!this.isRecording || !this.currentDemonstration) {
      return; // Should not happen if logic is correct, but safety check
    }
    
    try {
      // Basic validation and sanitization (more robust needed)
      if (!eventData || typeof eventData !== "object") {
        this.logger.warn(`Received invalid event data for type ${eventType}`, { eventData });
        return;
      }
      
      // Add timestamp and type to the event
      const recordedEvent = {
        timestamp: Date.now(),
        type: eventType,
        data: { ...eventData } // Create a copy to avoid mutation issues
      };
      
      // Add event to the current demonstration record
      this.currentDemonstration.events.push(recordedEvent);
      
      // Emit event captured event (optional, for real-time monitoring)
      this.emit("eventCaptured", { demonstrationId: this.currentDemonstration.id, event: recordedEvent });
      
    } catch (error) {
      this.logger.error(`Error handling event during recording: ${error.message}`, { error, eventType, eventData });
      // Consider adding error to demonstration record or emitting specific error event
    }
  }
  
  /**
   * Get the status of the recorder.
   * @returns {{isRecording: boolean, demonstrationId: string|null}}
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      demonstrationId: this.currentDemonstration ? this.currentDemonstration.id : null
    };
  }
}

module.exports = DemonstrationRecorder;

