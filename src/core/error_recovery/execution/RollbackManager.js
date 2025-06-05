/**
 * RollbackManager.js
 * 
 * Provides rollback capabilities for recovery strategy execution.
 * This component is responsible for creating system snapshots before execution
 * and performing rollbacks when execution fails or is cancelled.
 * 
 * @module src/core/error_recovery/execution/RollbackManager
 */

'use strict';

/**
 * Class responsible for managing rollbacks during strategy execution
 */
class RollbackManager {
  /**
   * Creates a new RollbackManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.snapshotService - Service for creating and restoring snapshots
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.snapshotService = options.snapshotService;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.snapshotMode = this.config.snapshotMode || 'selective';
    this.maxSnapshots = this.config.maxSnapshots || 10;
    this.snapshotTTL = this.config.snapshotTTLMs || 3600000; // 1 hour default
    
    this.snapshots = new Map();
    this.compensatingActions = new Map();
    
    this._initialize();
  }
  
  /**
   * Initialize the rollback manager
   * @private
   */
  _initialize() {
    if (!this.enabled) {
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('action:execution:completed', this._handleActionCompleted.bind(this));
    }
    
    // Set up snapshot cleanup timer
    this.cleanupTimer = setInterval(() => {
      this._cleanupExpiredSnapshots();
    }, 300000); // Clean up every 5 minutes
  }
  
  /**
   * Create a snapshot before strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Snapshot options
   * @returns {Promise<boolean>} Whether snapshot was created successfully
   */
  async createSnapshot(executionId, options = {}) {
    if (!this.enabled || !executionId) {
      return false;
    }
    
    const { strategy, executionContext } = options;
    
    try {
      // Determine what to snapshot based on strategy and mode
      const snapshotTargets = this._determineSnapshotTargets(strategy);
      
      if (snapshotTargets.length === 0) {
        // No targets to snapshot, just record execution
        this.snapshots.set(executionId, {
          id: executionId,
          timestamp: Date.now(),
          targets: [],
          snapshots: {},
          strategy: {
            id: strategy?.id,
            type: strategy?.type
          }
        });
        return true;
      }
      
      // Create snapshots for each target
      const snapshots = {};
      
      for (const target of snapshotTargets) {
        if (this.snapshotService) {
          snapshots[target] = await this.snapshotService.createSnapshot(target, {
            executionId,
            strategy,
            executionContext
          });
        }
      }
      
      // Store snapshot information
      this.snapshots.set(executionId, {
        id: executionId,
        timestamp: Date.now(),
        targets: snapshotTargets,
        snapshots,
        strategy: {
          id: strategy?.id,
          type: strategy?.type
        }
      });
      
      // Emit snapshot created event
      if (this.eventBus) {
        this.eventBus.emit('rollback:snapshot:created', {
          executionId,
          strategyId: strategy?.id,
          targets: snapshotTargets,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.warn(`Failed to create snapshot for execution ${executionId}:`, error.message);
      
      // Emit snapshot failed event
      if (this.eventBus) {
        this.eventBus.emit('rollback:snapshot:failed', {
          executionId,
          strategyId: strategy?.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return false;
    }
  }
  
  /**
   * Register a compensating action for an executed action
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} action - Executed action
   * @param {Object} compensatingAction - Compensating action
   * @returns {boolean} Whether registration was successful
   */
  registerCompensatingAction(executionId, action, compensatingAction) {
    if (!this.enabled || !executionId || !action || !compensatingAction) {
      return false;
    }
    
    // Get or create compensating actions list for this execution
    if (!this.compensatingActions.has(executionId)) {
      this.compensatingActions.set(executionId, []);
    }
    
    const actions = this.compensatingActions.get(executionId);
    
    // Add compensating action to the beginning of the list (for LIFO execution)
    actions.unshift({
      originalAction: {
        type: action.type,
        id: action.id
      },
      compensatingAction,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Perform rollback for a failed or cancelled execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Rollback options
   * @returns {Promise<Object>} Rollback result
   */
  async performRollback(executionId, options = {}) {
    if (!this.enabled || !executionId) {
      return { success: false, reason: 'rollback_disabled' };
    }
    
    const { error, cancelled, executionContext } = options;
    
    try {
      // Emit rollback started event
      if (this.eventBus) {
        this.eventBus.emit('rollback:started', {
          executionId,
          reason: cancelled ? 'cancelled' : 'error',
          error: error?.message,
          timestamp: Date.now()
        });
      }
      
      // First, execute compensating actions if available
      const compensatingResult = await this._executeCompensatingActions(executionId);
      
      // Then, restore snapshots if needed and available
      let snapshotResult = { success: true, restored: [] };
      
      if (!compensatingResult.success || this.snapshotMode === 'always') {
        snapshotResult = await this._restoreSnapshots(executionId);
      }
      
      // Determine overall success
      const success = compensatingResult.success || snapshotResult.success;
      
      // Emit rollback completed event
      if (this.eventBus) {
        this.eventBus.emit('rollback:completed', {
          executionId,
          success,
          compensatingActionsExecuted: compensatingResult.executed,
          snapshotsRestored: snapshotResult.restored,
          timestamp: Date.now()
        });
      }
      
      // Clean up after rollback
      this.compensatingActions.delete(executionId);
      
      // Keep snapshot for a while in case it's needed
      setTimeout(() => {
        this.snapshots.delete(executionId);
      }, 300000); // Keep for 5 minutes
      
      return {
        success,
        compensatingActions: compensatingResult,
        snapshots: snapshotResult
      };
    } catch (error) {
      // Emit rollback failed event
      if (this.eventBus) {
        this.eventBus.emit('rollback:failed', {
          executionId,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check if rollback is available for an execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Rollback availability status
   */
  checkRollbackAvailability(executionId) {
    if (!this.enabled || !executionId) {
      return { available: false, reason: 'rollback_disabled' };
    }
    
    const hasSnapshot = this.snapshots.has(executionId);
    const hasCompensatingActions = this.compensatingActions.has(executionId) && 
                                  this.compensatingActions.get(executionId).length > 0;
    
    return {
      available: hasSnapshot || hasCompensatingActions,
      hasSnapshot,
      hasCompensatingActions,
      compensatingActionCount: hasCompensatingActions ? this.compensatingActions.get(executionId).length : 0
    };
  }
  
  /**
   * Handle action completed event
   * 
   * @param {Object} data - Action completion data
   * @private
   */
  _handleActionCompleted(data) {
    if (!data || !data.executionId || !data.actionType || !data.success) {
      return;
    }
    
    // In a real implementation, this would automatically generate and register
    // compensating actions for certain action types
    // For now, we'll just log the event
    console.debug(`Action completed: ${data.actionType} for execution ${data.executionId}`);
  }
  
  /**
   * Determine what to snapshot based on strategy
   * 
   * @param {Object} strategy - Strategy being executed
   * @returns {Array} Snapshot targets
   * @private
   */
  _determineSnapshotTargets(strategy) {
    if (!strategy) {
      return [];
    }
    
    // If snapshot mode is 'all', snapshot everything
    if (this.snapshotMode === 'all') {
      return ['system', 'files', 'network', 'services'];
    }
    
    // If snapshot mode is 'none', don't snapshot anything
    if (this.snapshotMode === 'none') {
      return [];
    }
    
    // For selective mode, determine targets based on strategy actions
    const targets = new Set();
    
    if (Array.isArray(strategy.actions)) {
      for (const action of strategy.actions) {
        switch (action.type) {
          case 'system_call':
          case 'process_kill':
            targets.add('system');
            break;
          case 'file_write':
            targets.add('files');
            break;
          case 'network_config':
            targets.add('network');
            break;
          case 'service_control':
            targets.add('services');
            break;
        }
      }
    }
    
    return Array.from(targets);
  }
  
  /**
   * Execute compensating actions for an execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeCompensatingActions(executionId) {
    if (!this.compensatingActions.has(executionId)) {
      return { success: true, executed: 0 };
    }
    
    const actions = this.compensatingActions.get(executionId);
    if (actions.length === 0) {
      return { success: true, executed: 0 };
    }
    
    let executed = 0;
    let failed = 0;
    
    // Execute compensating actions in reverse order (LIFO)
    for (const item of actions) {
      try {
        // In a real implementation, this would execute the compensating action
        // For now, we'll simulate success
        console.debug(`Executing compensating action for ${item.originalAction.type}`);
        
        // Emit compensating action event
        if (this.eventBus) {
          this.eventBus.emit('rollback:compensating:executed', {
            executionId,
            originalActionType: item.originalAction.type,
            timestamp: Date.now()
          });
        }
        
        executed++;
      } catch (error) {
        failed++;
        
        // Emit compensating action failed event
        if (this.eventBus) {
          this.eventBus.emit('rollback:compensating:failed', {
            executionId,
            originalActionType: item.originalAction.type,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
    }
    
    return {
      success: failed === 0,
      executed,
      failed
    };
  }
  
  /**
   * Restore snapshots for an execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Restoration result
   * @private
   */
  async _restoreSnapshots(executionId) {
    if (!this.snapshots.has(executionId)) {
      return { success: false, reason: 'no_snapshot', restored: [] };
    }
    
    const snapshot = this.snapshots.get(executionId);
    if (!snapshot.targets || snapshot.targets.length === 0) {
      return { success: true, reason: 'no_targets', restored: [] };
    }
    
    let restored = [];
    let failed = [];
    
    // Restore each snapshot
    for (const target of snapshot.targets) {
      try {
        if (this.snapshotService && snapshot.snapshots[target]) {
          await this.snapshotService.restoreSnapshot(target, snapshot.snapshots[target]);
          restored.push(target);
          
          // Emit snapshot restored event
          if (this.eventBus) {
            this.eventBus.emit('rollback:snapshot:restored', {
              executionId,
              target,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        failed.push(target);
        
        // Emit snapshot restore failed event
        if (this.eventBus) {
          this.eventBus.emit('rollback:snapshot:restore:failed', {
            executionId,
            target,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
    }
    
    return {
      success: failed.length === 0,
      restored,
      failed
    };
  }
  
  /**
   * Clean up expired snapshots
   * @private
   */
  _cleanupExpiredSnapshots() {
    const now = Date.now();
    
    // Check each snapshot for expiration
    for (const [executionId, snapshot] of this.snapshots.entries()) {
      if (now - snapshot.timestamp > this.snapshotTTL) {
        // Delete expired snapshot
        this.snapshots.delete(executionId);
        
        // Emit snapshot expired event
        if (this.eventBus) {
          this.eventBus.emit('rollback:snapshot:expired', {
            executionId,
            timestamp: now
          });
        }
      }
    }
    
    // Ensure we don't exceed max snapshots
    if (this.snapshots.size > this.maxSnapshots) {
      // Sort snapshots by timestamp (oldest first)
      const sortedSnapshots = Array.from(this.snapshots.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Delete oldest snapshots to get back to max
      const toDelete = sortedSnapshots.slice(0, this.snapshots.size - this.maxSnapshots);
      
      for (const [executionId] of toDelete) {
        this.snapshots.delete(executionId);
        
        // Emit snapshot deleted event
        if (this.eventBus) {
          this.eventBus.emit('rollback:snapshot:deleted', {
            executionId,
            reason: 'max_exceeded',
            timestamp: now
          });
        }
      }
    }
  }
  
  /**
   * Dispose resources used by this manager
   */
  dispose() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.eventBus) {
      this.eventBus.removeAllListeners('action:execution:completed');
    }
    
    this.snapshots.clear();
    this.compensatingActions.clear();
  }
}

module.exports = RollbackManager;
