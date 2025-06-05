/**
 * UserInterface.js
 * 
 * Provides user interface capabilities for recovery strategy execution.
 * This component is responsible for interacting with users during strategy execution,
 * including displaying information, requesting approvals, and collecting feedback.
 * 
 * @module src/core/error_recovery/interaction/UserInterface
 */

'use strict';

/**
 * Class responsible for user interaction during strategy execution
 */
class UserInterface {
  /**
   * Creates a new UserInterface instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.interactionMode = this.config.interactionMode || 'interactive';
    this.autoApproveLevel = this.config.autoApproveLevel || 'low';
    this.timeoutMs = this.config.timeoutMs || 30000; // 30 seconds
    this.notificationChannels = this.config.notificationChannels || ['toast', 'console'];
    
    this.pendingInteractions = new Map();
    this.interactionHistory = [];
    
    this._initialize();
  }
  
  /**
   * Initialize the user interface
   * @private
   */
  _initialize() {
    if (!this.enabled) {
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('ui:config:updated', this._handleConfigUpdate.bind(this));
      this.eventBus.on('ui:response:received', this._handleUserResponse.bind(this));
    }
  }
  
  /**
   * Display a notification to the user
   * 
   * @param {string} message - Notification message
   * @param {Object} options - Notification options
   * @returns {Promise<Object>} Notification result
   */
  async notify(message, options = {}) {
    if (!this.enabled || !message) {
      return {
        success: true,
        reason: 'ui_disabled'
      };
    }
    
    const { type = 'info', title, executionId, details } = options;
    
    try {
      // Create notification record
      const notification = {
        id: `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        message,
        type,
        title: title || this._getDefaultTitle(type),
        timestamp: Date.now(),
        executionId,
        details
      };
      
      // Add to history
      this.interactionHistory.push({
        type: 'notification',
        ...notification
      });
      
      // Emit notification event
      if (this.eventBus) {
        this.eventBus.emit('ui:notification:displayed', {
          ...notification,
          channels: this.notificationChannels
        });
      }
      
      // In a real implementation, this would display a notification to the user
      // For now, we'll just log it
      console.log(`[${type.toUpperCase()}] ${title || this._getDefaultTitle(type)}: ${message}`);
      
      return {
        success: true,
        notificationId: notification.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: 'notification_error'
      };
    }
  }
  
  /**
   * Request approval from the user
   * 
   * @param {string} message - Approval request message
   * @param {Object} options - Approval options
   * @returns {Promise<Object>} Approval result
   */
  async requestApproval(message, options = {}) {
    if (!this.enabled || !message) {
      return {
        approved: true,
        reason: 'ui_disabled'
      };
    }
    
    const { 
      type = 'approval', 
      title, 
      executionId, 
      details,
      riskLevel = 'medium',
      timeout = this.timeoutMs,
      defaultAction = 'reject'
    } = options;
    
    try {
      // Check if we should auto-approve based on risk level
      if (this._shouldAutoApprove(riskLevel)) {
        return {
          approved: true,
          automatic: true,
          reason: 'auto_approved',
          riskLevel
        };
      }
      
      // Check if we're in non-interactive mode
      if (this.interactionMode === 'non-interactive') {
        return {
          approved: defaultAction === 'approve',
          automatic: true,
          reason: 'non_interactive_mode',
          defaultAction
        };
      }
      
      // Create approval request
      const approvalRequest = {
        id: `approval_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        message,
        type,
        title: title || 'Approval Required',
        timestamp: Date.now(),
        executionId,
        details,
        riskLevel,
        timeout,
        defaultAction
      };
      
      // Add to pending interactions
      this.pendingInteractions.set(approvalRequest.id, {
        type: 'approval',
        request: approvalRequest,
        resolve: null,
        timer: null
      });
      
      // Emit approval request event
      if (this.eventBus) {
        this.eventBus.emit('ui:approval:requested', {
          ...approvalRequest
        });
      }
      
      // In a real implementation, this would display an approval request to the user
      // For now, we'll simulate a user response after a delay
      return new Promise((resolve) => {
        // Store resolve function
        const interaction = this.pendingInteractions.get(approvalRequest.id);
        interaction.resolve = resolve;
        
        // Set timeout
        interaction.timer = setTimeout(() => {
          this._handleApprovalTimeout(approvalRequest.id);
        }, timeout);
        
        // Simulate user response
        setTimeout(() => {
          // 80% approval rate for simulation
          const approved = Math.random() < 0.8;
          
          this._handleUserResponse({
            interactionId: approvalRequest.id,
            approved,
            timestamp: Date.now()
          });
        }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
      });
    } catch (error) {
      return {
        approved: false,
        error: error.message,
        reason: 'approval_error'
      };
    }
  }
  
  /**
   * Display information to the user
   * 
   * @param {string} message - Information message
   * @param {Object} options - Information options
   * @returns {Promise<Object>} Information result
   */
  async displayInformation(message, options = {}) {
    if (!this.enabled || !message) {
      return {
        success: true,
        reason: 'ui_disabled'
      };
    }
    
    const { 
      type = 'info', 
      title, 
      executionId, 
      details,
      requireAcknowledgment = false,
      timeout = this.timeoutMs
    } = options;
    
    try {
      // Create information record
      const information = {
        id: `info_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        message,
        type,
        title: title || this._getDefaultTitle(type),
        timestamp: Date.now(),
        executionId,
        details,
        requireAcknowledgment
      };
      
      // Add to history
      this.interactionHistory.push({
        type: 'information',
        ...information
      });
      
      // Emit information event
      if (this.eventBus) {
        this.eventBus.emit('ui:information:displayed', {
          ...information
        });
      }
      
      // In a real implementation, this would display information to the user
      // For now, we'll just log it
      console.log(`[INFO] ${title || this._getDefaultTitle(type)}: ${message}`);
      
      // If acknowledgment is required, wait for user response
      if (requireAcknowledgment) {
        // Add to pending interactions
        this.pendingInteractions.set(information.id, {
          type: 'information',
          request: information,
          resolve: null,
          timer: null
        });
        
        return new Promise((resolve) => {
          // Store resolve function
          const interaction = this.pendingInteractions.get(information.id);
          interaction.resolve = resolve;
          
          // Set timeout
          interaction.timer = setTimeout(() => {
            this._handleInformationTimeout(information.id);
          }, timeout);
          
          // Simulate user acknowledgment
          setTimeout(() => {
            this._handleUserResponse({
              interactionId: information.id,
              acknowledged: true,
              timestamp: Date.now()
            });
          }, 500 + Math.random() * 1500); // Random delay between 0.5-2 seconds
        });
      }
      
      return {
        success: true,
        informationId: information.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: 'information_error'
      };
    }
  }
  
  /**
   * Request input from the user
   * 
   * @param {string} message - Input request message
   * @param {Object} options - Input options
   * @returns {Promise<Object>} Input result
   */
  async requestInput(message, options = {}) {
    if (!this.enabled || !message) {
      return {
        success: false,
        reason: 'ui_disabled',
        value: null
      };
    }
    
    const { 
      type = 'text', 
      title, 
      executionId, 
      details,
      defaultValue = '',
      timeout = this.timeoutMs,
      validation = null
    } = options;
    
    try {
      // Check if we're in non-interactive mode
      if (this.interactionMode === 'non-interactive') {
        return {
          success: true,
          automatic: true,
          reason: 'non_interactive_mode',
          value: defaultValue
        };
      }
      
      // Create input request
      const inputRequest = {
        id: `input_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        message,
        type,
        title: title || 'Input Required',
        timestamp: Date.now(),
        executionId,
        details,
        defaultValue,
        validation
      };
      
      // Add to pending interactions
      this.pendingInteractions.set(inputRequest.id, {
        type: 'input',
        request: inputRequest,
        resolve: null,
        timer: null
      });
      
      // Emit input request event
      if (this.eventBus) {
        this.eventBus.emit('ui:input:requested', {
          ...inputRequest
        });
      }
      
      // In a real implementation, this would request input from the user
      // For now, we'll simulate a user response after a delay
      return new Promise((resolve) => {
        // Store resolve function
        const interaction = this.pendingInteractions.get(inputRequest.id);
        interaction.resolve = resolve;
        
        // Set timeout
        interaction.timer = setTimeout(() => {
          this._handleInputTimeout(inputRequest.id);
        }, timeout);
        
        // Simulate user input
        setTimeout(() => {
          // Generate a simulated response based on input type
          let value = defaultValue;
          
          switch (type) {
            case 'text':
              value = 'Simulated user input';
              break;
            case 'number':
              value = Math.floor(Math.random() * 100);
              break;
            case 'boolean':
              value = Math.random() > 0.5;
              break;
            case 'select':
              if (Array.isArray(options.options) && options.options.length > 0) {
                const index = Math.floor(Math.random() * options.options.length);
                value = options.options[index].value || options.options[index];
              }
              break;
          }
          
          this._handleUserResponse({
            interactionId: inputRequest.id,
            value,
            timestamp: Date.now()
          });
        }, 1500 + Math.random() * 2500); // Random delay between 1.5-4 seconds
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: 'input_error',
        value: null
      };
    }
  }
  
  /**
   * Display progress to the user
   * 
   * @param {string} message - Progress message
   * @param {Object} options - Progress options
   * @returns {Promise<Object>} Progress result
   */
  async updateProgress(message, options = {}) {
    if (!this.enabled || !message) {
      return {
        success: true,
        reason: 'ui_disabled'
      };
    }
    
    const { 
      progress = 0, 
      total = 100, 
      title, 
      executionId, 
      details,
      progressId
    } = options;
    
    try {
      // Create or update progress record
      const id = progressId || `progress_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const progressUpdate = {
        id,
        message,
        progress,
        total,
        percentage: Math.floor((progress / total) * 100),
        title: title || 'Operation in Progress',
        timestamp: Date.now(),
        executionId,
        details
      };
      
      // Add to history if new
      if (!progressId) {
        this.interactionHistory.push({
          type: 'progress',
          ...progressUpdate
        });
      }
      
      // Emit progress event
      if (this.eventBus) {
        this.eventBus.emit('ui:progress:updated', {
          ...progressUpdate
        });
      }
      
      // In a real implementation, this would update a progress indicator
      // For now, we'll just log it
      console.log(`[PROGRESS] ${progressUpdate.percentage}% - ${message}`);
      
      return {
        success: true,
        progressId: id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: 'progress_error'
      };
    }
  }
  
  /**
   * Get interaction history
   * 
   * @param {Object} options - Filter options
   * @returns {Array} Interaction history
   */
  getInteractionHistory(options = {}) {
    const { 
      type, 
      executionId, 
      limit = 100, 
      startTime, 
      endTime 
    } = options;
    
    // Apply filters
    let filteredHistory = [...this.interactionHistory];
    
    if (type) {
      filteredHistory = filteredHistory.filter(item => item.type === type);
    }
    
    if (executionId) {
      filteredHistory = filteredHistory.filter(item => item.executionId === executionId);
    }
    
    if (startTime) {
      filteredHistory = filteredHistory.filter(item => item.timestamp >= startTime);
    }
    
    if (endTime) {
      filteredHistory = filteredHistory.filter(item => item.timestamp <= endTime);
    }
    
    // Sort by timestamp (newest first) and limit
    return filteredHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Handle config update event
   * 
   * @param {Object} data - Config update data
   * @private
   */
  _handleConfigUpdate(data) {
    if (!data) {
      return;
    }
    
    // Update configuration
    if (data.interactionMode) {
      this.interactionMode = data.interactionMode;
    }
    
    if (data.autoApproveLevel) {
      this.autoApproveLevel = data.autoApproveLevel;
    }
    
    if (data.timeoutMs) {
      this.timeoutMs = data.timeoutMs;
    }
    
    if (Array.isArray(data.notificationChannels)) {
      this.notificationChannels = data.notificationChannels;
    }
  }
  
  /**
   * Handle user response event
   * 
   * @param {Object} data - User response data
   * @private
   */
  _handleUserResponse(data) {
    if (!data || !data.interactionId) {
      return;
    }
    
    const interactionId = data.interactionId;
    
    // Check if interaction exists
    if (!this.pendingInteractions.has(interactionId)) {
      return;
    }
    
    const interaction = this.pendingInteractions.get(interactionId);
    
    // Clear timeout
    if (interaction.timer) {
      clearTimeout(interaction.timer);
      interaction.timer = null;
    }
    
    // Process response based on interaction type
    let result;
    
    switch (interaction.type) {
      case 'approval':
        result = {
          approved: data.approved === true,
          timestamp: data.timestamp || Date.now(),
          reason: data.reason || 'user_response'
        };
        break;
      case 'information':
        result = {
          success: true,
          acknowledged: data.acknowledged === true,
          timestamp: data.timestamp || Date.now()
        };
        break;
      case 'input':
        result = {
          success: true,
          value: data.value,
          timestamp: data.timestamp || Date.now()
        };
        break;
      default:
        result = {
          success: false,
          reason: 'unknown_interaction_type'
        };
    }
    
    // Add to history
    this.interactionHistory.push({
      type: `${interaction.type}_response`,
      interactionId,
      request: interaction.request,
      response: result,
      timestamp: data.timestamp || Date.now()
    });
    
    // Emit response event
    if (this.eventBus) {
      this.eventBus.emit(`ui:${interaction.type}:response`, {
        interactionId,
        ...result
      });
    }
    
    // Resolve promise
    if (interaction.resolve) {
      interaction.resolve(result);
    }
    
    // Remove from pending interactions
    this.pendingInteractions.delete(interactionId);
  }
  
  /**
   * Handle approval timeout
   * 
   * @param {string} interactionId - Interaction ID
   * @private
   */
  _handleApprovalTimeout(interactionId) {
    if (!this.pendingInteractions.has(interactionId)) {
      return;
    }
    
    const interaction = this.pendingInteractions.get(interactionId);
    const defaultAction = interaction.request.defaultAction || 'reject';
    
    // Create timeout result
    const result = {
      approved: defaultAction === 'approve',
      timestamp: Date.now(),
      reason: 'timeout',
      defaultAction
    };
    
    // Add to history
    this.interactionHistory.push({
      type: 'approval_timeout',
      interactionId,
      request: interaction.request,
      response: result,
      timestamp: Date.now()
    });
    
    // Emit timeout event
    if (this.eventBus) {
      this.eventBus.emit('ui:approval:timeout', {
        interactionId,
        ...result
      });
    }
    
    // Resolve promise
    if (interaction.resolve) {
      interaction.resolve(result);
    }
    
    // Remove from pending interactions
    this.pendingInteractions.delete(interactionId);
  }
  
  /**
   * Handle information timeout
   * 
   * @param {string} interactionId - Interaction ID
   * @private
   */
  _handleInformationTimeout(interactionId) {
    if (!this.pendingInteractions.has(interactionId)) {
      return;
    }
    
    const interaction = this.pendingInteractions.get(interactionId);
    
    // Create timeout result
    const result = {
      success: true,
      acknowledged: false,
      timestamp: Date.now(),
      reason: 'timeout'
    };
    
    // Add to history
    this.interactionHistory.push({
      type: 'information_timeout',
      interactionId,
      request: interaction.request,
      response: result,
      timestamp: Date.now()
    });
    
    // Emit timeout event
    if (this.eventBus) {
      this.eventBus.emit('ui:information:timeout', {
        interactionId,
        ...result
      });
    }
    
    // Resolve promise
    if (interaction.resolve) {
      interaction.resolve(result);
    }
    
    // Remove from pending interactions
    this.pendingInteractions.delete(interactionId);
  }
  
  /**
   * Handle input timeout
   * 
   * @param {string} interactionId - Interaction ID
   * @private
   */
  _handleInputTimeout(interactionId) {
    if (!this.pendingInteractions.has(interactionId)) {
      return;
    }
    
    const interaction = this.pendingInteractions.get(interactionId);
    const defaultValue = interaction.request.defaultValue;
    
    // Create timeout result
    const result = {
      success: true,
      value: defaultValue,
      timestamp: Date.now(),
      reason: 'timeout'
    };
    
    // Add to history
    this.interactionHistory.push({
      type: 'input_timeout',
      interactionId,
      request: interaction.request,
      response: result,
      timestamp: Date.now()
    });
    
    // Emit timeout event
    if (this.eventBus) {
      this.eventBus.emit('ui:input:timeout', {
        interactionId,
        ...result
      });
    }
    
    // Resolve promise
    if (interaction.resolve) {
      interaction.resolve(result);
    }
    
    // Remove from pending interactions
    this.pendingInteractions.delete(interactionId);
  }
  
  /**
   * Get default title based on notification type
   * 
   * @param {string} type - Notification type
   * @returns {string} Default title
   * @private
   */
  _getDefaultTitle(type) {
    switch (type) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'success':
        return 'Success';
      case 'info':
      default:
        return 'Information';
    }
  }
  
  /**
   * Check if approval should be automatic based on risk level
   * 
   * @param {string} riskLevel - Risk level
   * @returns {boolean} Whether to auto-approve
   * @private
   */
  _shouldAutoApprove(riskLevel) {
    const riskLevels = {
      'none': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    
    const autoApproveLevels = {
      'none': -1, // Auto-approve nothing
      'low': 0,
      'medium': 1,
      'high': 2,
      'all': 5 // Auto-approve everything
    };
    
    const riskValue = riskLevels[riskLevel] !== undefined ? riskLevels[riskLevel] : 2;
    const autoApproveValue = autoApproveLevels[this.autoApproveLevel] !== undefined ? 
      autoApproveLevels[this.autoApproveLevel] : -1;
    
    return riskValue <= autoApproveValue;
  }
  
  /**
   * Dispose resources used by this interface
   */
  dispose() {
    // Clear all timeouts
    for (const [_, interaction] of this.pendingInteractions.entries()) {
      if (interaction.timer) {
        clearTimeout(interaction.timer);
        interaction.timer = null;
      }
    }
    
    if (this.eventBus) {
      this.eventBus.removeAllListeners('ui:config:updated');
      this.eventBus.removeAllListeners('ui:response:received');
    }
    
    this.pendingInteractions.clear();
  }
}

module.exports = UserInterface;
