/**
 * ApplicationStateManager.js
 * Manages application state for complex workflows
 */

const { EventEmitter } = require('events');
const { StateSnapshotManager } = require('./state/StateSnapshotManager');
const { StateDiffCalculator } = require('./state/StateDiffCalculator');
const { StateTransitionValidator } = require('./state/StateTransitionValidator');
const { StateRestoreManager } = require('./state/StateRestoreManager');
const { StateExecutionResult } = require('../common/ExecutionResult');
const { v4: uuidv4 } = require('uuid');

/**
 * Application State Manager
 * Manages application state for complex workflows
 */
class ApplicationStateManager {
    /**
     * Create a new ApplicationStateManager
     * @param {Object} options - Configuration options
     * @param {Object} options.logger - Logger instance
     * @param {EventEmitter} options.eventBus - Event bus for communication
     */
    constructor(options = {}) {
        this.log = options.logger || console;
        this.eventBus = options.eventBus || new EventEmitter();
        
        // Initialize state components
        this.snapshot_manager = new StateSnapshotManager();
        this.diff_calculator = new StateDiffCalculator();
        this.transition_validator = new StateTransitionValidator();
        this.restore_manager = new StateRestoreManager();
        
        // Initialize state
        this.initialized = false;
        this.application_states = new Map();
    }
    
    /**
     * Initialize the component
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize() {
        try {
            this.log.info('Initializing Application State Manager');
            
            // Initialize state components
            await this.snapshot_manager.initialize();
            await this.diff_calculator.initialize();
            await this.transition_validator.initialize();
            await this.restore_manager.initialize();
            
            this.initialized = true;
            this.log.info('Application State Manager initialized successfully');
            return true;
        } catch (error) {
            this.log.error(`Error initializing Application State Manager: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Shutdown the component
     * @returns {Promise<boolean>} Whether shutdown was successful
     */
    async shutdown() {
        try {
            this.log.info('Shutting down Application State Manager');
            
            // Shutdown state components
            await this.restore_manager.shutdown();
            await this.transition_validator.shutdown();
            await this.diff_calculator.shutdown();
            await this.snapshot_manager.shutdown();
            
            // Clear application states
            this.application_states.clear();
            
            this.initialized = false;
            this.log.info('Application State Manager shut down successfully');
            return true;
        } catch (error) {
            this.log.error(`Error shutting down Application State Manager: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Capture application state
     * @param {Object} request - The capture request
     * @param {Object} application_adapter - The application adapter
     * @param {Object} platform_adapter - The platform adapter
     * @returns {Promise<StateExecutionResult>} The execution result
     */
    async captureState(request, application_adapter, platform_adapter) {
        if (!this.initialized) {
            throw new Error('Application State Manager not initialized');
        }
        
        const execution_id = uuidv4();
        
        try {
            this.log.debug(`Capturing application state for: ${request.application_id} (ID: ${execution_id})`);
            
            // Capture state snapshot
            const snapshot = await this.snapshot_manager.captureSnapshot({
                application_id: request.application_id,
                snapshot_type: request.snapshot_type || 'full',
                include_ui: request.include_ui !== false,
                include_data: request.include_data !== false,
                include_resources: request.include_resources === true,
                application_adapter,
                platform_adapter
            });
            
            // Generate snapshot ID
            const snapshot_id = uuidv4();
            
            // Store snapshot
            const application_id = request.application_id;
            
            if (!this.application_states.has(application_id)) {
                this.application_states.set(application_id, new Map());
            }
            
            const app_snapshots = this.application_states.get(application_id);
            app_snapshots.set(snapshot_id, {
                id: snapshot_id,
                timestamp: new Date().toISOString(),
                snapshot,
                metadata: request.metadata || {}
            });
            
            return new StateExecutionResult({
                success: true,
                execution_id,
                snapshot_id,
                application_id,
                snapshot_type: request.snapshot_type || 'full',
                timestamp: new Date().toISOString(),
                metadata: {
                    ui_captured: request.include_ui !== false,
                    data_captured: request.include_data !== false,
                    resources_captured: request.include_resources === true
                }
            });
            
        } catch (error) {
            this.log.error(`Error capturing application state: ${error.message}`);
            
            return new StateExecutionResult({
                success: false,
                execution_id,
                error: {
                    message: error.message,
                    type: error.name
                },
                application_id: request.application_id
            });
        }
    }
    
    /**
     * Compare application states
     * @param {Object} request - The compare request
     * @returns {Promise<StateExecutionResult>} The execution result
     */
    async compareStates(request) {
        if (!this.initialized) {
            throw new Error('Application State Manager not initialized');
        }
        
        const execution_id = uuidv4();
        
        try {
            this.log.debug(`Comparing application states: ${request.snapshot_id_1} and ${request.snapshot_id_2} (ID: ${execution_id})`);
            
            // Get snapshots
            const snapshot1 = await this._getSnapshot(request.application_id, request.snapshot_id_1);
            const snapshot2 = await this._getSnapshot(request.application_id, request.snapshot_id_2);
            
            if (!snapshot1 || !snapshot2) {
                throw new Error('One or both snapshots not found');
            }
            
            // Calculate differences
            const diff_result = await this.diff_calculator.calculateDiff({
                snapshot1: snapshot1.snapshot,
                snapshot2: snapshot2.snapshot,
                diff_type: request.diff_type || 'detailed',
                include_ui: request.include_ui !== false,
                include_data: request.include_data !== false,
                include_resources: request.include_resources === true
            });
            
            return new StateExecutionResult({
                success: true,
                execution_id,
                application_id: request.application_id,
                snapshot_id_1: request.snapshot_id_1,
                snapshot_id_2: request.snapshot_id_2,
                diff_result,
                timestamp: new Date().toISOString(),
                metadata: {
                    diff_type: request.diff_type || 'detailed',
                    changes_detected: diff_result.changes.length > 0,
                    change_count: diff_result.changes.length
                }
            });
            
        } catch (error) {
            this.log.error(`Error comparing application states: ${error.message}`);
            
            return new StateExecutionResult({
                success: false,
                execution_id,
                error: {
                    message: error.message,
                    type: error.name
                },
                application_id: request.application_id,
                snapshot_id_1: request.snapshot_id_1,
                snapshot_id_2: request.snapshot_id_2
            });
        }
    }
    
    /**
     * Validate state transition
     * @param {Object} request - The validation request
     * @returns {Promise<StateExecutionResult>} The execution result
     */
    async validateStateTransition(request) {
        if (!this.initialized) {
            throw new Error('Application State Manager not initialized');
        }
        
        const execution_id = uuidv4();
        
        try {
            this.log.debug(`Validating state transition: ${request.from_snapshot_id} to ${request.to_snapshot_id} (ID: ${execution_id})`);
            
            // Get snapshots
            const from_snapshot = await this._getSnapshot(request.application_id, request.from_snapshot_id);
            const to_snapshot = await this._getSnapshot(request.application_id, request.to_snapshot_id);
            
            if (!from_snapshot || !to_snapshot) {
                throw new Error('One or both snapshots not found');
            }
            
            // Validate transition
            const validation_result = await this.transition_validator.validateTransition({
                from_snapshot: from_snapshot.snapshot,
                to_snapshot: to_snapshot.snapshot,
                transition_type: request.transition_type || 'action',
                expected_changes: request.expected_changes,
                validation_rules: request.validation_rules
            });
            
            return new StateExecutionResult({
                success: true,
                execution_id,
                application_id: request.application_id,
                from_snapshot_id: request.from_snapshot_id,
                to_snapshot_id: request.to_snapshot_id,
                validation_result,
                timestamp: new Date().toISOString(),
                metadata: {
                    transition_type: request.transition_type || 'action',
                    is_valid: validation_result.valid,
                    validation_errors: validation_result.errors.length
                }
            });
            
        } catch (error) {
            this.log.error(`Error validating state transition: ${error.message}`);
            
            return new StateExecutionResult({
                success: false,
                execution_id,
                error: {
                    message: error.message,
                    type: error.name
                },
                application_id: request.application_id,
                from_snapshot_id: request.from_snapshot_id,
                to_snapshot_id: request.to_snapshot_id
            });
        }
    }
    
    /**
     * Restore application state
     * @param {Object} request - The restore request
     * @param {Object} application_adapter - The application adapter
     * @param {Object} platform_adapter - The platform adapter
     * @returns {Promise<StateExecutionResult>} The execution result
     */
    async restoreState(request, application_adapter, platform_adapter) {
        if (!this.initialized) {
            throw new Error('Application State Manager not initialized');
        }
        
        const execution_id = uuidv4();
        
        try {
            this.log.debug(`Restoring application state: ${request.snapshot_id} (ID: ${execution_id})`);
            
            // Get snapshot
            const snapshot_info = await this._getSnapshot(request.application_id, request.snapshot_id);
            
            if (!snapshot_info) {
                throw new Error('Snapshot not found');
            }
            
            // Restore state
            const restore_result = await this.restore_manager.restoreSnapshot({
                application_id: request.application_id,
                snapshot: snapshot_info.snapshot,
                restore_type: request.restore_type || 'full',
                restore_ui: request.restore_ui !== false,
                restore_data: request.restore_data !== false,
                restore_resources: request.restore_resources === true,
                application_adapter,
                platform_adapter
            });
            
            // Capture new state after restore if requested
            let new_snapshot_id = null;
            
            if (request.capture_after_restore) {
                const capture_result = await this.captureState(
                    {
                        application_id: request.application_id,
                        snapshot_type: 'full',
                        include_ui: true,
                        include_data: true,
                        include_resources: request.restore_resources === true,
                        metadata: {
                            restored_from: request.snapshot_id,
                            restore_type: request.restore_type || 'full'
                        }
                    },
                    application_adapter,
                    platform_adapter
                );
                
                if (capture_result.success) {
                    new_snapshot_id = capture_result.snapshot_id;
                }
            }
            
            return new StateExecutionResult({
                success: true,
                execution_id,
                application_id: request.application_id,
                snapshot_id: request.snapshot_id,
                new_snapshot_id,
                restore_result,
                timestamp: new Date().toISOString(),
                metadata: {
                    restore_type: request.restore_type || 'full',
                    ui_restored: request.restore_ui !== false,
                    data_restored: request.restore_data !== false,
                    resources_restored: request.restore_resources === true,
                    success_rate: restore_result.success_rate
                }
            });
            
        } catch (error) {
            this.log.error(`Error restoring application state: ${error.message}`);
            
            return new StateExecutionResult({
                success: false,
                execution_id,
                error: {
                    message: error.message,
                    type: error.name
                },
                application_id: request.application_id,
                snapshot_id: request.snapshot_id
            });
        }
    }
    
    /**
     * Get application state
     * @param {Object} request - The get state request
     * @returns {Promise<StateExecutionResult>} The execution result
     */
    async getState(request) {
        if (!this.initialized) {
            throw new Error('Application State Manager not initialized');
        }
        
        const execution_id = uuidv4();
        
        try {
            this.log.debug(`Getting application state: ${request.snapshot_id} (ID: ${execution_id})`);
            
            // Get snapshot
            const snapshot_info = await this._getSnapshot(request.application_id, request.snapshot_id);
            
            if (!snapshot_info) {
                throw new Error('Snapshot not found');
            }
            
            // Filter snapshot based on request
            const filtered_snapshot = this._filterSnapshot(
                snapshot_info.snapshot,
                
(Content truncated due to size limit. Use line ranges to read in chunks)