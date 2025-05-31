/**
 * ProcedureExecutionEngine.js
 * 
 * The ProcedureExecutionEngine is responsible for executing learned procedures in a safe and controlled manner.
 * It handles procedure parameters, monitors execution progress, implements safety mechanisms,
 * provides real-time feedback, and handles errors during execution.
 * 
 * @module tentacles/learning/execution/ProcedureExecutionEngine
 */

const EventBus = require('../common/events/EventBus');
const { ErrorHandler } = require('../common/utils/ErrorHandler');
const Logger = require('../common/utils/Logger');
const Configuration = require('../common/utils/Configuration');

/**
 * Class representing the Procedure Execution Engine
 */
class ProcedureExecutionEngine {
    /**
     * Create a ProcedureExecutionEngine instance
     * @param {Object} options - Configuration options
     * @param {Object} dependencies - Injected dependencies
     */
    constructor(options = {}, dependencies = {}) {
        this.logger = dependencies.logger || new Logger('ProcedureExecutionEngine');
        this.errorHandler = dependencies.errorHandler || new ErrorHandler('ProcedureExecutionEngine');
        this.eventBus = dependencies.eventBus || new EventBus();
        this.config = dependencies.config || new Configuration('execution');
        
        // Default configuration with overrides from options
        this.options = {
            maxExecutionTime: 300000, // 5 minutes in milliseconds
            enableSandboxing: true,
            autoRetryOnError: true,
            maxRetryAttempts: 3,
            retryDelay: 1000,
            ...options
        };
        
        // Execution state tracking
        this.activeExecutions = new Map();
        this.executionHistory = [];
        
        this.logger.info('ProcedureExecutionEngine initialized');
        
        // Register event listeners
        this.registerEventListeners();
    }
    
    /**
     * Register event listeners for the execution engine
     * @private
     */
    registerEventListeners() {
        this.eventBus.on('procedure.execute', this.handleExecuteRequest.bind(this));
        this.eventBus.on('procedure.pause', this.pauseExecution.bind(this));
        this.eventBus.on('procedure.resume', this.resumeExecution.bind(this));
        this.eventBus.on('procedure.abort', this.abortExecution.bind(this));
        
        this.logger.debug('Event listeners registered');
    }
    
    /**
     * Handle an execution request event
     * @private
     * @param {Object} data - Event data
     */
    handleExecuteRequest(data) {
        try {
            const { procedureId, parameters, requestId } = data;
            const executionId = this.executeProcedure(procedureId, parameters);
            
            this.eventBus.emit('procedure.execution.started', {
                requestId,
                executionId,
                procedureId,
                timestamp: Date.now()
            });
        } catch (error) {
            this.errorHandler.handleError(error);
            this.eventBus.emit('procedure.execution.error', {
                requestId: data.requestId,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Execute a procedure with the given parameters
     * @param {string} procedureId - ID of the procedure to execute
     * @param {Object} parameters - Parameters for the procedure
     * @returns {string} Execution ID
     */
    executeProcedure(procedureId, parameters = {}) {
        this.logger.info(`Executing procedure: ${procedureId}`);
        
        // Validate inputs
        if (!procedureId) {
            throw new Error('Procedure ID is required');
        }
        
        // Generate a unique execution ID
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create execution context
        const executionContext = {
            id: executionId,
            procedureId,
            parameters,
            status: 'initializing',
            startTime: Date.now(),
            endTime: null,
            currentStep: 0,
            totalSteps: 0,
            result: null,
            error: null,
            retryCount: 0,
            logs: []
        };
        
        // Store in active executions
        this.activeExecutions.set(executionId, executionContext);
        
        // Start execution asynchronously
        this.startExecution(executionId).catch(error => {
            this.handleExecutionError(executionId, error);
        });
        
        return executionId;
    }
    
    /**
     * Start the execution process for a procedure
     * @private
     * @param {string} executionId - ID of the execution
     */
    async startExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }
        
        try {
            // Update status
            execution.status = 'loading';
            this.logExecutionEvent(executionId, 'Loading procedure');
            
            // Fetch procedure (in a real implementation, this would come from ProcedurePersistenceManager)
            const procedure = await this.fetchProcedure(execution.procedureId);
            
            // Validate parameters
            this.validateParameters(procedure, execution.parameters);
            
            // Prepare execution
            execution.totalSteps = procedure.steps.length;
            execution.status = 'running';
            this.logExecutionEvent(executionId, 'Execution started');
            
            // Execute procedure steps
            const result = await this.executeSteps(executionId, procedure);
            
            // Complete execution
            this.completeExecution(executionId, result);
        } catch (error) {
            this.handleExecutionError(executionId, error);
        }
    }
    
    /**
     * Fetch a procedure by ID
     * @private
     * @param {string} procedureId - ID of the procedure to fetch
     * @returns {Promise<Object>} The procedure object
     */
    async fetchProcedure(procedureId) {
        // In a real implementation, this would fetch from ProcedurePersistenceManager
        // For now, we'll simulate a delay and return a mock procedure
        return new Promise((resolve) => {
            setTimeout(() => {
                // This is a mock procedure for testing
                resolve({
                    id: procedureId,
                    name: `Procedure ${procedureId}`,
                    description: 'A mock procedure for testing',
                    parameters: {
                        param1: { type: 'string', required: true },
                        param2: { type: 'number', required: false, default: 0 }
                    },
                    steps: [
                        { id: 'step1', type: 'action', action: 'click', target: 'button1' },
                        { id: 'step2', type: 'input', target: 'input1', value: '{{param1}}' },
                        { id: 'step3', type: 'wait', duration: 1000 },
                        { id: 'step4', type: 'conditional', condition: '{{param2}} > 0', 
                          thenSteps: [
                              { id: 'step4.1', type: 'action', action: 'click', target: 'button2' }
                          ],
                          elseSteps: [
                              { id: 'step4.2', type: 'action', action: 'click', target: 'button3' }
                          ]
                        }
                    ]
                });
            }, 100);
        });
    }
    
    /**
     * Validate parameters against procedure requirements
     * @private
     * @param {Object} procedure - The procedure to validate against
     * @param {Object} parameters - The parameters to validate
     * @throws {Error} If parameters are invalid
     */
    validateParameters(procedure, parameters) {
        if (!procedure.parameters) {
            return; // No parameters required
        }
        
        const errors = [];
        
        // Check required parameters
        for (const [paramName, paramConfig] of Object.entries(procedure.parameters)) {
            if (paramConfig.required && (parameters[paramName] === undefined || parameters[paramName] === null)) {
                errors.push(`Required parameter '${paramName}' is missing`);
                continue;
            }
            
            // Check parameter type if provided
            if (parameters[paramName] !== undefined && paramConfig.type) {
                const paramType = typeof parameters[paramName];
                if (paramConfig.type === 'number' && paramType !== 'number') {
                    errors.push(`Parameter '${paramName}' should be a number, got ${paramType}`);
                } else if (paramConfig.type === 'string' && paramType !== 'string') {
                    errors.push(`Parameter '${paramName}' should be a string, got ${paramType}`);
                } else if (paramConfig.type === 'boolean' && paramType !== 'boolean') {
                    errors.push(`Parameter '${paramName}' should be a boolean, got ${paramType}`);
                } else if (paramConfig.type === 'object' && (paramType !== 'object' || Array.isArray(parameters[paramName]))) {
                    errors.push(`Parameter '${paramName}' should be an object, got ${Array.isArray(parameters[paramName]) ? 'array' : paramType}`);
                } else if (paramConfig.type === 'array' && !Array.isArray(parameters[paramName])) {
                    errors.push(`Parameter '${paramName}' should be an array, got ${paramType}`);
                }
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Parameter validation failed: ${errors.join(', ')}`);
        }
    }
    
    /**
     * Execute the steps of a procedure
     * @private
     * @param {string} executionId - ID of the execution
     * @param {Object} procedure - The procedure to execute
     * @returns {Promise<Object>} The execution result
     */
    async executeSteps(executionId, procedure) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }
        
        // Create execution context with resolved parameters
        const context = {
            parameters: { ...execution.parameters },
            variables: {},
            result: {}
        };
        
        // Apply default values for missing parameters
        if (procedure.parameters) {
            for (const [paramName, paramConfig] of Object.entries(procedure.parameters)) {
                if (context.parameters[paramName] === undefined && paramConfig.default !== undefined) {
                    context.parameters[paramName] = paramConfig.default;
                }
            }
        }
        
        // Execute steps sequentially
        for (let i = 0; i < procedure.steps.length; i++) {
            // Check if execution was aborted or paused
            if (execution.status === 'aborted') {
                throw new Error('Execution was aborted');
            }
            
            if (execution.status === 'paused') {
                // Wait until resumed or aborted
                await this.waitForResume(executionId);
                
                // Check again after resuming
                if (execution.status === 'aborted') {
                    throw new Error('Execution was aborted');
                }
            }
            
            // Update current step
            execution.currentStep = i;
            const step = procedure.steps[i];
            
            // Log step execution
            this.logExecutionEvent(executionId, `Executing step ${i + 1}/${procedure.steps.length}: ${step.id}`);
            
            try {
                // Execute the step
                await this.executeStep(step, context, executionId);
            } catch (error) {
                // Handle step execution error
                this.logExecutionEvent(executionId, `Error in step ${i + 1}: ${error.message}`, 'error');
                
                // Retry logic
                if (this.options.autoRetryOnError && execution.retryCount < this.options.maxRetryAttempts) {
                    execution.retryCount++;
                    this.logExecutionEvent(executionId, `Retrying step ${i + 1} (attempt ${execution.retryCount}/${this.options.maxRetryAttempts})`);
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                    
                    // Retry the same step
                    i--;
                    continue;
                }
                
                // If no retry or max retries reached, propagate the error
                throw error;
            }
        }
        
        // Return the execution result
        return context.result;
    }
    
    /**
     * Execute a single step of a procedure
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeStep(step, context, executionId) {
        // Resolve template values in step properties
        const resolvedStep = this.resolveTemplateValues(step, context);
        
        // Execute based on step type
        switch (resolvedStep.type) {
            case 'action':
                await this.executeActionStep(resolvedStep, context, executionId);
                break;
                
            case 'input':
                await this.executeInputStep(resolvedStep, context, executionId);
                break;
                
            case 'wait':
                await this.executeWaitStep(resolvedStep, context, executionId);
                break;
                
            case 'conditional':
                await this.executeConditionalStep(resolvedStep, context, executionId);
                break;
                
            case 'loop':
                await this.executeLoopStep(resolvedStep, context, executionId);
                break;
                
            case 'script':
                await this.executeScriptStep(resolvedStep, context, executionId);
                break;
                
            default:
                throw new Error(`Unknown step type: ${resolvedStep.type}`);
        }
    }
    
    /**
     * Resolve template values in an object
     * @private
     * @param {Object} obj - The object containing template values
     * @param {Object} context - The execution context
     * @returns {Object} The object with resolved values
     */
    resolveTemplateValues(obj, context) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        
        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.resolveTemplateValues(item, context));
        }
        
        // Handle objects
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key] = this.resolveTemplateString(value, context);
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this.resolveTemplateValues(value, context);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }
    
    /**
     * Resolve template values in a string
     * @private
     * @param {string} str - The string containing template values
     * @param {Object} context - The execution context
     * @returns {string} The string with resolved values
     */
    resolveTemplateString(str, context) {
        // Replace {{param}} with context.parameters.param
        return str.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const parts = path.trim().split('.');
            let value;
            
            // Check if it's a parameter
            if (parts[0] === 'param' || parts[0] === 'parameter' || parts[0] === 'parameters') {
                value = context.parameters;
                parts.shift(); // Remove the 'param' part
            } else if (parts[0] === 'var' || parts[0] === 'variable' || parts[0] === 'variables') {
                value = context.variables;
                parts.shift(); // Remove the 'var' part
            } else if (parts[0] === 'result' || parts[0] === 'results') {
                value = context.result;
                parts.shift(); // Remove the 'result' part
            } else {
                // Try parameters first, then variables, then results
                value = context.parameters[parts[0]] !== undefined ? 
                    context.parameters : 
                    (context.variables[parts[0]] !== undefined ? 
                        context.variables : 
                        context.result);
            }
            
            // Navigate the path
            for (const part of parts) {
                if (value === undefined || value === null) {
                    return match; // Return original if path doesn't exist
                }
                value = value[part];
            }
            
            return value !== undefined && value !== null ? value : match;
        });
    }
    
    /**
     * Execute an action step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeActionStep(step, context, executionId) {
        this.logExecutionEvent(executionId, `Executing action: ${step.action} on target: ${step.target}`);
        
        // In a real implementation, this would interact with the UI or system
        // For now, we'll simulate a delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Store result if needed
        if (step.resultVariable) {
            context.variables[step.resultVariable] = `Result of ${step.action} on ${step.target}`;
        }
    }
    
    /**
     * Execute an input step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeInputStep(step, context, executionId) {
        this.logExecutionEvent(executionId, `Entering input: ${step.value} into target: ${step.target}`);
        
        // In a real implementation, this would interact with the UI
        // For now, we'll simulate a delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Store result if needed
        if (step.resultVariable) {
            context.variables[step.resultVariable] = step.value;
        }
    }
    
    /**
     * Execute a wait step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeWaitStep(step, context, executionId) {
        const duration = parseInt(step.duration, 10) || 1000;
        this.logExecutionEvent(executionId, `Waiting for ${duration}ms`);
        
        await new Promise(resolve => setTimeout(resolve, duration));
    }
    
    /**
     * Execute a conditional step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeConditionalStep(step, context, executionId) {
        // Evaluate the condition
        let conditionResult = false;
        
        try {
            // Simple condition evaluation for common patterns
            if (typeof step.condition === 'string') {
                // Replace template values
                const condition = this.resolveTemplateString(step.condition, context);
                
                // Evaluate the condition
                // Note: In a production environment, you would use a safer evaluation method
                // eslint-disable-next-line no-new-func
                conditionResult = new Function('return ' + condition)();
            } else if (typeof step.condition === 'boolean') {
                conditionResult = step.condition;
            } else {
                throw new Error('Invalid condition format');
            }
        } catch (error) {
            this.logExecutionEvent(executionId, `Error evaluating condition: ${error.message}`, 'error');
            throw new Error(`Condition evaluation failed: ${error.message}`);
        }
        
        this.logExecutionEvent(executionId, `Condition evaluated to: ${conditionResult}`);
        
        // Execute the appropriate branch
        if (conditionResult) {
            if (step.thenSteps && step.thenSteps.length > 0) {
                this.logExecutionEvent(executionId, 'Executing then branch');
                for (const thenStep of step.thenSteps) {
                    await this.executeStep(thenStep, context, executionId);
                }
            }
        } else {
            if (step.elseSteps && step.elseSteps.length > 0) {
                this.logExecutionEvent(executionId, 'Executing else branch');
                for (const elseStep of step.elseSteps) {
                    await this.executeStep(elseStep, context, executionId);
                }
            }
        }
    }
    
    /**
     * Execute a loop step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeLoopStep(step, context, executionId) {
        // Determine loop type and parameters
        if (step.count !== undefined) {
            // Count-based loop
            const count = parseInt(step.count, 10);
            this.logExecutionEvent(executionId, `Executing count-based loop (${count} iterations)`);
            
            for (let i = 0; i < count; i++) {
                // Add loop index to context
                context.variables._loopIndex = i;
                context.variables._loopCount = count;
                
                // Execute loop body
                for (const loopStep of step.steps) {
                    await this.executeStep(loopStep, context, executionId);
                }
            }
        } else if (step.collection !== undefined) {
            // Collection-based loop
            let collection = step.collection;
            
            // If collection is a string, try to resolve it from context
            if (typeof collection === 'string') {
                const resolvedCollection = this.resolveTemplateString(collection, context);
                try {
                    // Try to parse as JSON if it's a string
                    collection = typeof resolvedCollection === 'string' ? 
                        JSON.parse(resolvedCollection) : 
                        resolvedCollection;
                } catch (error) {
                    collection = resolvedCollection;
                }
            }
            
            // Ensure collection is iterable
            if (!Array.isArray(collection) && typeof collection !== 'object') {
                throw new Error('Loop collection must be an array or object');
            }
            
            const items = Array.isArray(collection) ? collection : Object.entries(collection);
            this.logExecutionEvent(executionId, `Executing collection-based loop (${items.length} items)`);
            
            for (let i = 0; i < items.length; i++) {
                // Add loop variables to context
                context.variables._loopIndex = i;
                context.variables._loopCount = items.length;
                context.variables._loopItem = Array.isArray(collection) ? items[i] : items[i][1];
                context.variables._loopKey = Array.isArray(collection) ? i : items[i][0];
                
                // Execute loop body
                for (const loopStep of step.steps) {
                    await this.executeStep(loopStep, context, executionId);
                }
            }
        } else if (step.condition !== undefined) {
            // Condition-based loop (while)
            this.logExecutionEvent(executionId, 'Executing condition-based loop');
            
            let iteration = 0;
            const maxIterations = step.maxIterations || 100; // Safety limit
            
            while (iteration < maxIterations) {
                // Evaluate the condition
                let conditionResult = false;
                
                try {
                    // Replace template values
                    const condition = this.resolveTemplateString(step.condition, context);
                    
                    // Evaluate the condition
                    // Note: In a production environment, you would use a safer evaluation method
                    // eslint-disable-next-line no-new-func
                    conditionResult = new Function('return ' + condition)();
                } catch (error) {
                    this.logExecutionEvent(executionId, `Error evaluating loop condition: ${error.message}`, 'error');
                    throw new Error(`Loop condition evaluation failed: ${error.message}`);
                }
                
                // Exit if condition is false
                if (!conditionResult) {
                    break;
                }
                
                // Add loop index to context
                context.variables._loopIndex = iteration;
                
                // Execute loop body
                for (const loopStep of step.steps) {
                    await this.executeStep(loopStep, context, executionId);
                }
                
                iteration++;
            }
            
            if (iteration >= maxIterations) {
                this.logExecutionEvent(executionId, `Loop reached maximum iterations (${maxIterations})`, 'warning');
            }
        } else {
            throw new Error('Invalid loop configuration: missing count, collection, or condition');
        }
    }
    
    /**
     * Execute a script step
     * @private
     * @param {Object} step - The step to execute
     * @param {Object} context - The execution context
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async executeScriptStep(step, context, executionId) {
        this.logExecutionEvent(executionId, 'Executing script step');
        
        if (!step.script) {
            throw new Error('Script step missing script property');
        }
        
        // In a real implementation, this would execute the script in a sandbox
        // For now, we'll just simulate a result
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Store result if needed
        if (step.resultVariable) {
            context.variables[step.resultVariable] = `Result of script execution`;
        }
    }
    
    /**
     * Wait for an execution to be resumed
     * @private
     * @param {string} executionId - ID of the execution
     * @returns {Promise<void>}
     */
    async waitForResume(executionId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const execution = this.activeExecutions.get(executionId);
                if (!execution) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                if (execution.status !== 'paused') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    /**
     * Complete an execution with a result
     * @private
     * @param {string} executionId - ID of the execution
     * @param {Object} result - The execution result
     */
    completeExecution(executionId, result) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return;
        }
        
        // Update execution state
        execution.status = 'completed';
        execution.endTime = Date.now();
        execution.result = result;
        
        this.logExecutionEvent(executionId, 'Execution completed successfully');
        
        // Move to history
        this.executionHistory.push({ ...execution });
        this.activeExecutions.delete(executionId);
        
        // Emit completion event
        this.eventBus.emit('procedure.execution.completed', {
            executionId,
            procedureId: execution.procedureId,
            result,
            duration: execution.endTime - execution.startTime,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle an execution error
     * @private
     * @param {string} executionId - ID of the execution
     * @param {Error} error - The error that occurred
     */
    handleExecutionError(executionId, error) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return;
        }
        
        // Log the error
        this.logger.error(`Execution error in ${executionId}: ${error.message}`);
        this.logExecutionEvent(executionId, `Execution failed: ${error.message}`, 'error');
        
        // Update execution state
        execution.status = 'failed';
        execution.endTime = Date.now();
        execution.error = {
            message: error.message,
            stack: error.stack
        };
        
        // Move to history
        this.executionHistory.push({ ...execution });
        this.activeExecutions.delete(executionId);
        
        // Emit error event
        this.eventBus.emit('procedure.execution.failed', {
            executionId,
            procedureId: execution.procedureId,
            error: error.message,
            duration: execution.endTime - execution.startTime,
            timestamp: Date.now()
        });
    }
    
    /**
     * Log an event for an execution
     * @private
     * @param {string} executionId - ID of the execution
     * @param {string} message - The log message
     * @param {string} level - Log level (info, warning, error)
     */
    logExecutionEvent(executionId, message, level = 'info') {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return;
        }
        
        // Add to execution logs
        execution.logs.push({
            timestamp: Date.now(),
            level,
            message
        });
        
        // Log to system logger
        switch (level) {
            case 'error':
                this.logger.error(`[${executionId}] ${message}`);
                break;
            case 'warning':
                this.logger.warn(`[${executionId}] ${message}`);
                break;
            default:
                this.logger.info(`[${executionId}] ${message}`);
        }
    }
    
    /**
     * Pause an execution
     * @param {string} executionId - ID of the execution to pause
     * @returns {boolean} Whether the execution was paused
     */
    pauseExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution || execution.status !== 'running') {
            return false;
        }
        
        execution.status = 'paused';
        this.logExecutionEvent(executionId, 'Execution paused');
        
        // Emit pause event
        this.eventBus.emit('procedure.execution.paused', {
            executionId,
            procedureId: execution.procedureId,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    /**
     * Resume a paused execution
     * @param {string} executionId - ID of the execution to resume
     * @returns {boolean} Whether the execution was resumed
     */
    resumeExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution || execution.status !== 'paused') {
            return false;
        }
        
        execution.status = 'running';
        this.logExecutionEvent(executionId, 'Execution resumed');
        
        // Emit resume event
        this.eventBus.emit('procedure.execution.resumed', {
            executionId,
            procedureId: execution.procedureId,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    /**
     * Abort an execution
     * @param {string} executionId - ID of the execution to abort
     * @returns {boolean} Whether the execution was aborted
     */
    abortExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution || (execution.status !== 'running' && execution.status !== 'paused')) {
            return false;
        }
        
        execution.status = 'aborted';
        execution.endTime = Date.now();
        this.logExecutionEvent(executionId, 'Execution aborted');
        
        // Move to history
        this.executionHistory.push({ ...execution });
        this.activeExecutions.delete(executionId);
        
        // Emit abort event
        this.eventBus.emit('procedure.execution.aborted', {
            executionId,
            procedureId: execution.procedureId,
            duration: execution.endTime - execution.startTime,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    /**
     * Get the status of an execution
     * @param {string} executionId - ID of the execution
     * @returns {Object|null} The execution status or null if not found
     */
    getExecutionStatus(executionId) {
        // Check active executions
        const activeExecution = this.activeExecutions.get(executionId);
        if (activeExecution) {
            return {
                id: activeExecution.id,
                procedureId: activeExecution.procedureId,
                status: activeExecution.status,
                startTime: activeExecution.startTime,
                currentStep: activeExecution.currentStep,
                totalSteps: activeExecution.totalSteps,
                progress: activeExecution.totalSteps > 0 ? 
                    (activeExecution.currentStep / activeExecution.totalSteps) * 100 : 0,
                duration: Date.now() - activeExecution.startTime
            };
        }
        
        // Check execution history
        const historicalExecution = this.executionHistory.find(exec => exec.id === executionId);
        if (historicalExecution) {
            return {
                id: historicalExecution.id,
                procedureId: historicalExecution.procedureId,
                status: historicalExecution.status,
                startTime: historicalExecution.startTime,
                endTime: historicalExecution.endTime,
                duration: historicalExecution.endTime - historicalExecution.startTime,
                result: historicalExecution.result,
                error: historicalExecution.error
            };
        }
        
        return null;
    }
    
    /**
     * Get the logs for an execution
     * @param {string} executionId - ID of the execution
     * @returns {Array|null} The execution logs or null if not found
     */
    getExecutionLogs(executionId) {
        // Check active executions
        const activeExecution = this.activeExecutions.get(executionId);
        if (activeExecution) {
            return [...activeExecution.logs];
        }
        
        // Check execution history
        const historicalExecution = this.executionHistory.find(exec => exec.id === executionId);
        if (historicalExecution) {
            return [...historicalExecution.logs];
        }
        
        return null;
    }
    
    /**
     * Get all active executions
     * @returns {Array} Array of active execution statuses
     */
    getActiveExecutions() {
        return Array.from(this.activeExecutions.values()).map(execution => ({
            id: execution.id,
            procedureId: execution.procedureId,
            status: execution.status,
            startTime: execution.startTime,
            currentStep: execution.currentStep,
            totalSteps: execution.totalSteps,
            progress: execution.totalSteps > 0 ? 
                (execution.currentStep / execution.totalSteps) * 100 : 0,
            duration: Date.now() - execution.startTime
        }));
    }
    
    /**
     * Get execution history
     * @param {Object} options - Filter options
     * @param {number} options.limit - Maximum number of results
     * @param {string} options.status - Filter by status
     * @param {string} options.procedureId - Filter by procedure ID
     * @returns {Array} Array of historical executions
     */
    getExecutionHistory(options = {}) {
        let results = [...this.executionHistory];
        
        // Apply filters
        if (options.status) {
            results = results.filter(exec => exec.status === options.status);
        }
        
        if (options.procedureId) {
            results = results.filter(exec => exec.procedureId === options.procedureId);
        }
        
        // Sort by start time (newest first)
        results.sort((a, b) => b.startTime - a.startTime);
        
        // Apply limit
        if (options.limit && options.limit > 0) {
            results = results.slice(0, options.limit);
        }
        
        return results.map(execution => ({
            id: execution.id,
            procedureId: execution.procedureId,
            status: execution.status,
            startTime: execution.startTime,
            endTime: execution.endTime,
            duration: execution.endTime - execution.startTime,
            result: execution.result,
            error: execution.error
        }));
    }
    
    /**
     * Clear execution history
     * @param {Object} options - Filter options
     * @param {string} options.status - Clear only executions with this status
     * @param {string} options.procedureId - Clear only executions for this procedure
     * @param {number} options.olderThan - Clear only executions older than this timestamp
     * @returns {number} Number of executions cleared
     */
    clearExecutionHistory(options = {}) {
        const initialCount = this.executionHistory.length;
        
        if (Object.keys(options).length === 0) {
            // Clear all history
            this.executionHistory = [];
            return initialCount;
        }
        
        // Apply filters
        this.executionHistory = this.executionHistory.filter(exec => {
            if (options.status && exec.status !== options.status) {
                return true; // Keep
            }
            
            if (options.procedureId && exec.procedureId !== options.procedureId) {
                return true; // Keep
            }
            
            if (options.olderThan && exec.endTime >= options.olderThan) {
                return true; // Keep
            }
            
            return false; // Remove
        });
        
        return initialCount - this.executionHistory.length;
    }
}

module.exports = ProcedureExecutionEngine;
