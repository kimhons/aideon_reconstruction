/**
 * @fileoverview Communication Assistant for the Personal Assistant Tentacle.
 * Manages messaging, notifications, and provides AI-driven communication support.
 * 
 * @module src/tentacles/personal_assistant/communication/CommunicationAssistant
 */

const EventEmitter = require("events");

/**
 * Communication Assistant
 * @extends EventEmitter
 */
class CommunicationAssistant extends EventEmitter {
  /**
   * Create a new Communication Assistant
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.securityFramework - Security and Governance Framework
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager
   * @param {Object} dependencies.contactManagementSystem - Contact Management System
   * @param {Object} dependencies.notificationSystem - System for handling notifications
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      defaultChannel: "email",
      maxSuggestions: 3,
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    this.connectedServices = new Map();
    this.messageQueue = [];
    this.isOnline = true; // Assume online initially, should be updated by network status events
    
    this.logger.info("[CommunicationAssistant] Communication Assistant initialized");
    
    // Initialize model integrations
    this.models = {};
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegrations();
    }
    
    // Listen for network status changes (placeholder)
    // this.dependencies.networkMonitor.on("statusChange", this._handleNetworkStatusChange.bind(this));
  }
  
  /**
   * Initialize model integrations for communication tasks
   * @private
   */
  async _initializeModelIntegrations() {
    const modelTypes = [
      "communication_drafting",
      "communication_summarization",
      "communication_tone_analysis",
      "communication_intent_recognition"
    ];
    
    for (const type of modelTypes) {
      try {
        this.models[type] = await this.dependencies.modelIntegrationManager.getModelIntegration(type);
        this.logger.info(`[CommunicationAssistant] Model integration initialized for ${type}`);
      } catch (error) {
        this.logger.warn(`[CommunicationAssistant] Failed to initialize model integration for ${type}`, { error: error.message });
      }
    }
  }
  
  /**
   * Handle network status changes
   * @param {boolean} isOnline - Current network status
   * @private
   */
  _handleNetworkStatusChange(isOnline) {
    this.isOnline = isOnline;
    this.logger.info(`[CommunicationAssistant] Network status changed: ${isOnline ? "Online" : "Offline"}`);
    
    if (isOnline) {
      this._processMessageQueue();
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      connectedServices: Array.from(this.connectedServices.keys()),
      queuedMessages: this.messageQueue.length,
      isOnline: this.isOnline,
      modelIntegrations: Object.keys(this.models)
    };
  }
  
  /**
   * Connect to a messaging service (e.g., email, chat)
   * @param {Object} connectionData - Connection details
   * @param {string} connectionData.serviceType - Type of service (e.g., "email", "slack")
   * @param {Object} connectionData.credentials - Authentication credentials
   * @returns {Promise<Object>} Connection status
   */
  async connectMessagingService(connectionData) {
    this.logger.debug("[CommunicationAssistant] Connecting to messaging service", { serviceType: connectionData.serviceType });
    
    const serviceId = `${connectionData.serviceType}_${Date.now()}`;
    
    // Placeholder for actual connection logic
    // In a real implementation, this would involve using APIs or libraries for the specific service
    try {
      // Simulate connection attempt
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const serviceInfo = {
        id: serviceId,
        type: connectionData.serviceType,
        status: "connected",
        lastSync: null,
        // Store necessary session/connection info here
      };
      
      this.connectedServices.set(serviceId, serviceInfo);
      this.logger.info("[CommunicationAssistant] Connected to messaging service successfully", { serviceId, serviceType: connectionData.serviceType });
      
      // Start listening for incoming messages (placeholder)
      this._startListening(serviceId);
      
      return { status: "success", serviceId };
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to connect to messaging service", { serviceType: connectionData.serviceType, error: error.message });
      return { status: "error", error: error.message };
    }
  }
  
  /**
   * Start listening for incoming messages on a service (placeholder)
   * @param {string} serviceId - Service ID
   * @private
   */
  _startListening(serviceId) {
    const serviceInfo = this.connectedServices.get(serviceId);
    if (!serviceInfo) return;
    
    this.logger.debug(`[CommunicationAssistant] Started listening for messages on ${serviceId}`);
    // Placeholder: In a real implementation, set up event listeners or polling for the service
    // Example: serviceClient.on("newMessage", (msg) => this.receiveMessage(serviceId, msg));
  }
  
  /**
   * Send a message
   * @param {Object} messageData - Message details
   * @param {string} messageData.channel - Communication channel (e.g., "email", "chat")
   * @param {string} messageData.recipient - Recipient identifier (e.g., email address, user ID)
   * @param {string} messageData.subject - Message subject (for email)
   * @param {string} messageData.body - Message content
   * @param {Array<string>} [messageData.attachments] - File paths for attachments
   * @returns {Promise<Object>} Send status
   */
  async sendMessage(messageData) {
    this.logger.debug("[CommunicationAssistant] Preparing to send message", { channel: messageData.channel, recipient: messageData.recipient });
    
    const message = {
      id: `msg_out_${Date.now()}_${this._generateRandomId()}`,
      timestamp: new Date(),
      direction: "outgoing",
      ...messageData
    };
    
    // Apply privacy controls before sending
    if (this.dependencies.securityFramework) {
      const privacyCheck = await this.dependencies.securityFramework.checkCommunicationPolicy({
        recipient: message.recipient,
        content: message.body,
        channel: message.channel
      });
      
      if (!privacyCheck.allowed) {
        this.logger.warn("[CommunicationAssistant] Message blocked by privacy policy", { messageId: message.id });
        throw new Error(`Message blocked by privacy policy: ${privacyCheck.reason}`);
      }
    }
    
    // Queue message if offline
    if (!this.isOnline) {
      this.messageQueue.push(message);
      this.logger.info("[CommunicationAssistant] Message queued for sending (offline)", { messageId: message.id });
      return { status: "queued", messageId: message.id };
    }
    
    // Send message immediately if online
    return this._sendMessageInternal(message);
  }
  
  /**
   * Internal method to send a message via the appropriate service
   * @param {Object} message - Message object
   * @returns {Promise<Object>} Send status
   * @private
   */
  async _sendMessageInternal(message) {
    // Find appropriate connected service
    const service = Array.from(this.connectedServices.values()).find(s => s.type === message.channel && s.status === "connected");
    
    if (!service) {
      this.logger.error("[CommunicationAssistant] No connected service found for channel", { channel: message.channel });
      throw new Error(`No connected service for channel: ${message.channel}`);
    }
    
    // Placeholder for actual sending logic using the service API
    try {
      this.logger.debug(`[CommunicationAssistant] Sending message via service ${service.id}`);
      // Example: await serviceClient.send({ to: message.recipient, subject: message.subject, body: message.body });
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      
      this.logger.info("[CommunicationAssistant] Message sent successfully", { messageId: message.id, serviceId: service.id });
      
      // Log communication with contact if possible
      if (this.dependencies.contactManagementSystem) {
        try {
          // Attempt to find contact based on recipient identifier
          const contacts = await this.dependencies.contactManagementSystem.searchContacts({ query: message.recipient });
          if (contacts.length > 0) {
            await this.dependencies.contactManagementSystem.logCommunication(contacts[0].id, {
              channel: message.channel,
              direction: "outgoing",
              summary: message.subject || message.body.substring(0, 50) + "..."
            });
          }
        } catch (contactError) {
          this.logger.warn("[CommunicationAssistant] Failed to log communication with contact", { error: contactError.message });
        }
      }
      
      // Store sent message in memory
      if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.storeEntity({ type: "message", id: message.id, data: message });
      }
      
      return { status: "sent", messageId: message.id };
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to send message", { messageId: message.id, error: error.message });
      // Re-queue if it was a network error and we are now offline
      if (!this.isOnline) {
        this.messageQueue.unshift(message); // Add back to the front of the queue
        return { status: "queued", messageId: message.id };
      }
      throw error; // Rethrow other errors
    }
  }
  
  /**
   * Process queued messages when back online
   * @private
   */
  async _processMessageQueue() {
    this.logger.info(`[CommunicationAssistant] Processing message queue (${this.messageQueue.length} messages)`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of queue) {
      try {
        await this._sendMessageInternal(message);
      } catch (error) {
        this.logger.error("[CommunicationAssistant] Failed to send queued message", { messageId: message.id, error: error.message });
        // Decide whether to re-queue or discard based on error type
        // For simplicity, we discard here, but production code might retry
      }
    }
    this.logger.info("[CommunicationAssistant] Finished processing message queue");
  }
  
  /**
   * Receive a message from a connected service
   * @param {string} serviceId - ID of the service providing the message
   * @param {Object} rawMessageData - Raw message data from the service
   * @returns {Promise<void>}
   */
  async receiveMessage(serviceId, rawMessageData) {
    const serviceInfo = this.connectedServices.get(serviceId);
    if (!serviceInfo) {
      this.logger.warn("[CommunicationAssistant] Received message from unknown service", { serviceId });
      return;
    }
    
    this.logger.debug(`[CommunicationAssistant] Received raw message from service ${serviceId}`);
    
    // Normalize message data (placeholder - depends on service format)
    const message = {
      id: `msg_in_${Date.now()}_${this._generateRandomId()}`,
      externalId: rawMessageData.id, // ID from the original service
      serviceId: serviceId,
      channel: serviceInfo.type,
      timestamp: new Date(rawMessageData.timestamp || Date.now()),
      direction: "incoming",
      sender: rawMessageData.sender,
      recipient: rawMessageData.recipient, // Usually the user
      subject: rawMessageData.subject,
      body: rawMessageData.body,
      attachments: rawMessageData.attachments || [],
      isRead: false
    };
    
    // Store received message in memory
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "message", id: message.id, data: message });
    }
    
    // Notify other systems (e.g., UI, Notification System)
    this.emit("newMessage", message);
    
    if (this.dependencies.notificationSystem) {
      this.dependencies.notificationSystem.createNotification({
        type: "newMessage",
        title: `New ${message.channel} from ${message.sender}`,
        message: message.subject || message.body.substring(0, 100) + "...",
        source: "CommunicationAssistant",
        data: { messageId: message.id }
      });
    }
    
    // Log communication with contact if possible
    if (this.dependencies.contactManagementSystem) {
      try {
        const contacts = await this.dependencies.contactManagementSystem.searchContacts({ query: message.sender });
        if (contacts.length > 0) {
          await this.dependencies.contactManagementSystem.logCommunication(contacts[0].id, {
            channel: message.channel,
            direction: "incoming",
            summary: message.subject || message.body.substring(0, 50) + "..."
          });
        }
      } catch (contactError) {
        this.logger.warn("[CommunicationAssistant] Failed to log incoming communication with contact", { error: contactError.message });
      }
    }
    
    this.logger.info("[CommunicationAssistant] Processed incoming message", { messageId: message.id, channel: message.channel });
  }
  
  /**
   * Generate reply suggestions for a message
   * @param {string} messageId - ID of the message to reply to
   * @param {Object} context - Additional context for generation
   * @returns {Promise<Array<string>>} Array of suggested replies
   */
  async generateReplySuggestion(messageId, context = {}) {
    this.logger.debug("[CommunicationAssistant] Generating reply suggestions", { messageId });
    
    if (!this.models.communication_drafting) {
      this.logger.warn("[CommunicationAssistant] Drafting model not available for suggestions");
      return [];
    }
    
    // Retrieve message from memory
    const message = await this.dependencies.memoryTentacle.getEntity({ type: "message", id: messageId });
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    try {
      const result = await this.models.communication_drafting.generateReply({
        messageContent: message.data.body,
        sender: message.data.sender,
        context: context,
        suggestionCount: this.options.maxSuggestions
      });
      
      this.logger.info("[CommunicationAssistant] Generated reply suggestions successfully", { messageId, count: result.suggestions.length });
      return result.suggestions || [];
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to generate reply suggestions", { messageId, error: error.message });
      return [];
    }
  }
  
  /**
   * Summarize a message or conversation thread
   * @param {string | Array<string>} messageIds - Single message ID or array of IDs for a thread
   * @returns {Promise<string>} Summarized text
   */
  async summarizeMessage(messageIds) {
    const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
    this.logger.debug("[CommunicationAssistant] Summarizing message(s)", { count: ids.length });
    
    if (!this.models.communication_summarization) {
      this.logger.warn("[CommunicationAssistant] Summarization model not available");
      return "Summarization model not available.";
    }
    
    // Retrieve messages from memory
    const messages = [];
    for (const id of ids) {
      const msg = await this.dependencies.memoryTentacle.getEntity({ type: "message", id });
      if (msg) {
        messages.push(msg.data);
      }
    }
    
    if (messages.length === 0) {
      throw new Error("No messages found for summarization");
    }
    
    // Sort messages chronologically for context
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const conversationText = messages.map(m => `${m.sender}: ${m.body}`).join("\n---\n");
    
    try {
      const result = await this.models.communication_summarization.summarize({
        text: conversationText,
        maxLength: 150 // Example parameter
      });
      
      this.logger.info("[CommunicationAssistant] Summarization successful", { messageCount: ids.length });
      return result.summary || "Failed to generate summary.";
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to summarize message(s)", { error: error.message });
      return `Error during summarization: ${error.message}`;
    }
  }
  
  /**
   * Analyze the tone of a message
   * @param {string} text - Text content to analyze
   * @returns {Promise<Object>} Tone analysis results (e.g., { sentiment: "positive", emotions: ["joy"] })
   */
  async analyzeTone(text) {
    this.logger.debug("[CommunicationAssistant] Analyzing tone");
    
    if (!this.models.communication_tone_analysis) {
      this.logger.warn("[CommunicationAssistant] Tone analysis model not available");
      return { error: "Tone analysis model not available." };
    }
    
    try {
      const result = await this.models.communication_tone_analysis.analyze({ text });
      this.logger.info("[CommunicationAssistant] Tone analysis successful");
      return result.analysis || { error: "Failed to analyze tone." };
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to analyze tone", { error: error.message });
      return { error: `Error during tone analysis: ${error.message}` };
    }
  }
  
  /**
   * Recognize the intent of an incoming message
   * @param {string} messageId - ID of the message
   * @returns {Promise<Object>} Intent recognition results (e.g., { intent: "meeting_request", entities: [...] })
   */
  async recognizeIntent(messageId) {
    this.logger.debug("[CommunicationAssistant] Recognizing intent", { messageId });

    if (!this.models.communication_intent_recognition) {
      this.logger.warn("[CommunicationAssistant] Intent recognition model not available");
      return { error: "Intent recognition model not available." };
    }

    const message = await this.dependencies.memoryTentacle.getEntity({ type: "message", id: messageId });
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    try {
      const result = await this.models.communication_intent_recognition.recognize({
        text: message.data.body,
        sender: message.data.sender,
        subject: message.data.subject
      });
      this.logger.info("[CommunicationAssistant] Intent recognition successful", { messageId, intent: result.intent });
      return result.recognition || { error: "Failed to recognize intent." };
    } catch (error) {
      this.logger.error("[CommunicationAssistant] Failed to recognize intent", { messageId, error: error.message });
      return { error: `Error during intent recognition: ${error.message}` };
    }
  }

  /**
   * Generate a random ID
   * @returns {string} Random ID
   * @private
   */
  _generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

module.exports = CommunicationAssistant;

