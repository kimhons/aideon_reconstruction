/**
 * @fileoverview MCPUIStateManagerProvider for managing UI state context.
 * 
 * This module provides context management for UI state, including current state,
 * view information, modal state, and navigation history.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const MCPUIContextProvider = require('./MCPUIContextProvider');

/**
 * Provider for managing UI state context.
 */
class MCPUIStateManagerProvider extends MCPUIContextProvider {
  /**
   * Constructor for MCPUIStateManagerProvider.
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize state-specific properties
    this.currentState = null;
    this.stateHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 50;
    this.navigationStack = [];
    
    this.logger.info('MCPUIStateManagerProvider created');
  }
  
  /**
   * Register context types with MCP Context Manager.
   * @private
   * @returns {Promise<void>}
   */
  async _registerContextTypes() {
    try {
      this.logger.debug('Registering UI state context types with MCP Context Manager');
      
      // Register context types
      this.contextTypes.add('ui.state.current');
      this.contextTypes.add('ui.state.history');
      
      // Register with MCP Context Manager
      for (const contextType of this.contextTypes) {
        await this.mcpContextManager.registerContextProvider(contextType, this);
      }
      
      this.logger.debug('UI state context types registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register UI state context types: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Update current UI state.
   * @param {Object} stateData UI state data
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateCurrentState(stateData) {
    try {
      this.logger.debug('Updating current UI state', { stateData });
      
      // Validate state data
      if (!stateData || !stateData.state || !stateData.viewId) {
        throw new Error('Invalid UI state data: state and viewId are required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('updateCurrentState', async () => {
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          state: stateData.state,
          viewId: stateData.viewId,
          viewData: stateData.viewData || {},
          modalState: stateData.modalState || { isOpen: false },
          navigationStack: [...this.navigationStack]
        };
        
        // Update current state
        this.currentState = contextData;
        
        // Update navigation stack
        if (this.navigationStack.length === 0 || this.navigationStack[this.navigationStack.length - 1] !== stateData.viewId) {
          this.navigationStack.push(stateData.viewId);
        }
        
        // Update state history
        const historyEntry = {
          state: stateData.state,
          viewId: stateData.viewId,
          timestamp: contextData.timestamp,
          duration: 0
        };
        
        // Calculate duration for previous state
        if (this.stateHistory.length > 0) {
          const previousState = this.stateHistory[this.stateHistory.length - 1];
          previousState.duration = contextData.timestamp - previousState.timestamp;
        }
        
        // Add new history entry
        this.stateHistory.push(historyEntry);
        
        // Trim history if needed
        if (this.stateHistory.length > this.maxHistoryLength) {
          this.stateHistory = this.stateHistory.slice(-this.maxHistoryLength);
        }
        
        // Update context data
        await this._processContextUpdate('ui.state.current', contextData, this.constructor.name);
        
        // Update history context
        const historyContextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          stateHistory: this.stateHistory,
          maxHistoryLength: this.maxHistoryLength
        };
        
        await this._processContextUpdate('ui.state.history', historyContextData, this.constructor.name);
        
        // Emit state change event
        this.emit('stateChanged', {
          previousState: this.stateHistory.length > 1 ? this.stateHistory[this.stateHistory.length - 2] : null,
          currentState: historyEntry
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to update current UI state: ${error.message}`, { error, stateData });
      
      // Emit error event
      this.emit('error', {
        type: 'stateUpdate',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Update modal state.
   * @param {Object} modalData Modal state data
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateModalState(modalData) {
    try {
      this.logger.debug('Updating modal state', { modalData });
      
      // Validate modal data
      if (!modalData || modalData.isOpen === undefined) {
        throw new Error('Invalid modal data: isOpen is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('updateModalState', async () => {
        // Check if current state exists
        if (!this.currentState) {
          throw new Error('Cannot update modal state: current state does not exist');
        }
        
        // Update current state with new modal state
        const updatedState = {
          ...this.currentState,
          modalState: {
            isOpen: modalData.isOpen,
            modalId: modalData.modalId || null,
            modalData: modalData.modalData || {}
          },
          timestamp: Date.now()
        };
        
        // Update context data
        await this._processContextUpdate('ui.state.current', updatedState, this.constructor.name);
        
        // Update current state
        this.currentState = updatedState;
        
        // Emit modal state change event
        this.emit('modalStateChanged', {
          isOpen: modalData.isOpen,
          modalId: modalData.modalId,
          modalData: modalData.modalData
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to update modal state: ${error.message}`, { error, modalData });
      
      // Emit error event
      this.emit('error', {
        type: 'modalStateUpdate',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Navigate back in the UI.
   * @returns {Promise<Object|null>} Previous view data or null if navigation stack is empty
   */
  async navigateBack() {
    try {
      this.logger.debug('Navigating back in UI');
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('navigateBack', async () => {
        // Check if navigation is possible
        if (this.navigationStack.length <= 1) {
          this.logger.debug('Cannot navigate back: navigation stack is empty or has only one item');
          return null;
        }
        
        // Remove current view from stack
        this.navigationStack.pop();
        
        // Get previous view
        const previousViewId = this.navigationStack[this.navigationStack.length - 1];
        
        // Emit navigation event
        this.emit('navigationBack', {
          previousViewId,
          navigationStack: [...this.navigationStack]
        });
        
        return { viewId: previousViewId };
      });
    } catch (error) {
      this.logger.error(`Failed to navigate back: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'navigation',
        message: error.message,
        error
      });
      
      return null;
    }
  }
  
  /**
   * Clear navigation history.
   * @param {string} [keepCurrentView=true] Whether to keep the current view in the navigation stack
   * @returns {Promise<boolean>} True if clearing was successful
   */
  async clearNavigationHistory(keepCurrentView = true) {
    try {
      this.logger.debug('Clearing navigation history', { keepCurrentView });
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('clearNavigationHistory', async () => {
        // Clear navigation stack
        if (keepCurrentView && this.navigationStack.length > 0) {
          const currentView = this.navigationStack[this.navigationStack.length - 1];
          this.navigationStack = [currentView];
        } else {
          this.navigationStack = [];
        }
        
        // Update current state if it exists
        if (this.currentState) {
          const updatedState = {
            ...this.currentState,
            navigationStack: [...this.navigationStack],
            timestamp: Date.now()
          };
          
          // Update context data
          await this._processContextUpdate('ui.state.current', updatedState, this.constructor.name);
          
          // Update current state
          this.currentState = updatedState;
        }
        
        // Emit navigation history cleared event
        this.emit('navigationHistoryCleared', {
          navigationStack: [...this.navigationStack]
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to clear navigation history: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'navigationHistoryClear',
        message: error.message,
        error
      });
      
      return false;
    }
  }
}

module.exports = MCPUIStateManagerProvider;
