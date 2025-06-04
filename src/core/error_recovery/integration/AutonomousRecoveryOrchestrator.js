/**
 * AutonomousRecoveryOrchestrator.js
 * 
 * A comprehensive orchestrator for the Autonomous Error Recovery System.
 * Coordinates the entire recovery flow with robust error handling and circuit breaking.
 */

const { v4: uuidv4 } = require('uuid');

class CircuitBreaker {
  /**
   * Creates a new CircuitBreaker instance
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms before attempting to close circuit
   * @param {number} options.halfOpenMaxCalls - Max calls allowed in half-open state
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 1;
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
  }
  
  /**
   * Executes a function with circuit breaker protection
   * 
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} - Result of the function
   * @throws {Error} - If circuit is open or function fails
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new Error('Circuit breaker is half-open and at capacity');
    }
    
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }
    
    try {
      const result = await fn();
      
      // Success, reset circuit
      this.reset();
      
      return result;
    } catch (error) {
      // Failure, increment counter
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
  
  /**
   * Resets the circuit breaker to closed state
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
  }
  
  /**
   * Gets the current state of the circuit breaker
   * 
   * @returns {Object} - Circuit breaker state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls
    };
  }
}

class AutonomousRecoveryOrchestrator {
  /**
   * Creates a new AutonomousRecoveryOrchestrator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.container - Dependency container
   * @param {Object} options.eventBus - Event bus instance
   * @param {Object} options.contextManager - Context manager instance
   * @param {Object} options.metrics - Metrics collector instance
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.container = options.container;
    this.eventBus = options.eventBus;
    this.contextManager = options.contextManager;
    this.metrics = options.metrics;
    this.logger = options.logger || console;
    
    // Component instances
    this.analyzer = null;
    this.strategyGenerator = null;
    this.validationRunner = null;
    this.resolutionExecutor = null;
    this.learningSystem = null;
    this.neuralHub = null;
    
    // Recovery flow registry
    this.recoveryFlows = new Map();
    
    // Circuit breakers for components
    this.circuitBreakers = new Map();
    
    this.logger.info('AutonomousRecoveryOrchestrator initialized');
  }
  
  /**
   * Initializes the orchestrator and its dependencies
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logger.info('Initializing AutonomousRecoveryOrchestrator');
      
      // Resolve dependencies from container
      if (this.container) {
        this.analyzer = await this.container.resolve('causalAnalyzer');
        this.strategyGenerator = await this.container.resolve('recoveryStrategyGenerator');
        this.validationRunner = await this.container.resolve('integrationValidationRunner');
        this.resolutionExecutor = await this.container.resolve('resolutionExecutor');
        this.learningSystem = await this.container.resolve('recoveryLearningSystem');
        this.neuralHub = await this.container.resolve('neuralCoordinationHub');
      } else {
        throw new Error('Dependency container is required for initialization');
      }
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      // Register event listeners
      this.registerEventListeners();
      
      this.logger.info('AutonomousRecoveryOrchestrator initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing AutonomousRecoveryOrchestrator: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Initializes circuit breakers for components
   * 
   * @private
   */
  initializeCircuitBreakers() {
    // Create circuit breakers for each component
    this.circuitBreakers.set('analyzer', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.circuitBreakers.set('strategyGenerator', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.circuitBreakers.set('validationRunner', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.circuitBreakers.set('resolutionExecutor', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.circuitBreakers.set('learningSystem', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.circuitBreakers.set('neuralHub', new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    }));
    
    this.logger.debug('Circuit breakers initialized');
  }
  
  /**
   * Registers event listeners with the event bus
   * 
   * @private
   */
  registerEventListeners() {
    if (!this.eventBus) {
      this.logger.warn('No event bus provided, skipping event listener registration');
      return;
    }
    
    // Register for error detection events
    this.eventBus.on('error:detected', this.handleErrorDetected.bind(this), { component: 'RecoveryOrchestrator' });
    
    this.logger.debug('Event listeners registered');
  }
  
  /**
   * Handles error detection events
   * 
   * @param {Object} errorContext - Error context
   * @private
   */
  async handleErrorDetected(errorContext) {
    try {
      this.logger.info(`Handling detected error: ${errorContext.error?.message || 'Unknown error'}`);
      
      // Create recovery context if not provided
      let contextId = errorContext.contextId;
      
      if (!contextId && this.contextManager) {
        contextId = this.contextManager.createContext({
          error: errorContext.error,
          source: errorContext.source || 'unknown',
          timestamp: Date.now(),
          recoveryAttempts: 0
        }, 'recovery-orchestrator');
        
        this.logger.debug(`Created recovery context: ${contextId}`);
      }
      
      // Start recovery flow
      await this.startRecoveryFlow(errorContext.error, contextId);
    } catch (error) {
      this.logger.error(`Error handling error detection event: ${error.message}`, error);
      
      if (this.metrics) {
        this.metrics.incrementCounter('recovery_orchestrator_errors');
      }
    }
  }
  
  /**
   * Starts a recovery flow for an error
   * 
   * @param {Error} error - Error to recover from
   * @param {string} contextId - Context ID
   * @returns {Promise<Object>} - Recovery result
   */
  async startRecoveryFlow(error, contextId) {
    const flowId = uuidv4();
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting recovery flow ${flowId} for error: ${error?.message || 'Unknown error'}`);
      
      if (this.eventBus) {
        this.eventBus.emit('recovery:started', { 
          flowId, 
          error, 
          contextId 
        });
      }
      
      if (this.metrics) {
        this.metrics.incrementCounter('recovery_flows_started');
      }
      
      // Register flow
      this.recoveryFlows.set(flowId, {
        flowId,
        contextId,
        error,
        startTime,
        status: 'running',
        steps: []
      });
      
      // Execute recovery flow
      const result = await this.executeRecoveryFlow(flowId, error, contextId);
      
      // Update flow status
      const flow = this.recoveryFlows.get(flowId);
      flow.status = result.successful ? 'completed' : 'failed';
      flow.endTime = Date.now();
      flow.result = result;
      
      const duration = flow.endTime - flow.startTime;
      
      this.logger.info(`Recovery flow ${flowId} ${result.successful ? 'completed successfully' : 'failed'} in ${duration}ms`);
      
      if (this.eventBus) {
        this.eventBus.emit('recovery:completed', { 
          flowId, 
          successful: result.successful,
          duration,
          result
        });
      }
      
      if (this.metrics) {
        this.metrics.incrementCounter('recovery_flows_completed');
        this.metrics.recordSuccess('recovery_flow', result.successful);
        this.metrics.recordTiming('recovery_flow_duration', duration);
      }
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.logger.error(`Error in recovery flow ${flowId}: ${error.message}`, error);
      
      // Update flow status
      const flow = this.recoveryFlows.get(flowId);
      if (flow) {
        flow.status = 'error';
        flow.endTime = endTime;
        flow.error = {
          message: error.message,
          stack: error.stack
        };
      }
      
      if (this.eventBus) {
        this.eventBus.emit('recovery:error', { 
          flowId, 
          error,
          duration
        });
      }
      
      if (this.metrics) {
        this.metrics.incrementCounter('recovery_flows_errors');
        this.metrics.recordSuccess('recovery_flow', false);
        this.metrics.recordTiming('recovery_flow_duration', duration);
      }
      
      return {
        successful: false,
        error: {
          message: error.message,
          stack: error.stack
        }
      };
    }
  }
  
  /**
   * Executes a recovery flow
   * 
   * @param {string} flowId - Flow ID
   * @param {Error} error - Error to recover from
   * @param {string} contextId - Context ID
   * @returns {Promise<Object>} - Recovery result
   * @private
   */
  async executeRecoveryFlow(flowId, error, contextId) {
    // Get context
    let context = {};
    if (this.contextManager && contextId) {
      context = this.contextManager.getContext(contextId);
    }
    
    // Increment recovery attempts
    if (this.contextManager && contextId) {
      this.contextManager.updateContext(contextId, {
        recoveryAttempts: (context.recoveryAttempts || 0) + 1
      }, 'recovery-orchestrator');
      
      // Refresh context
      context = this.contextManager.getContext(contextId);
    }
    
    // Check if max recovery attempts exceeded
    const maxAttempts = 3; // Could be configurable
    if (context.recoveryAttempts > maxAttempts) {
      this.logger.warn(`Max recovery attempts (${maxAttempts}) exceeded for context ${contextId}`);
      
      return {
        successful: false,
        reason: 'MAX_ATTEMPTS_EXCEEDED',
        message: `Max recovery attempts (${maxAttempts}) exceeded`
      };
    }
    
    try {
      // Step 1: Analyze cause
      this.logger.info(`Step 1: Analyzing cause for flow ${flowId}`);
      
      const analyzeStartTime = Date.now();
      
      if (this.eventBus) {
        this.eventBus.emit('analysis:started', { 
          flowId, 
          contextId 
        });
      }
      
      const circuitBreaker = this.circuitBreakers.get('analyzer');
      const cause = await circuitBreaker.execute(async () => {
        return await this.analyzer.analyzeError(error, context);
      });
      
      const analyzeEndTime = Date.now();
      const analyzeDuration = analyzeEndTime - analyzeStartTime;
      
      // Record step
      const flow = this.recoveryFlows.get(flowId);
      flow.steps.push({
        name: 'analyze',
        startTime: analyzeStartTime,
        endTime: analyzeEndTime,
        duration: analyzeDuration,
        successful: true,
        result: cause
      });
      
      if (this.eventBus) {
        this.eventBus.emit('analysis:completed', { 
          flowId, 
          contextId,
          success: true,
          duration: analyzeDuration,
          cause
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('analysis_duration', analyzeDuration);
        this.metrics.recordSuccess('analysis', true);
      }
      
      // Update context with cause
      if (this.contextManager && contextId) {
        this.contextManager.updateContext(contextId, {
          cause
        }, 'recovery-orchestrator');
      }
      
      // Step 2: Generate recovery strategy
      this.logger.info(`Step 2: Generating recovery strategy for flow ${flowId}`);
      
      const generateStartTime = Date.now();
      
      if (this.eventBus) {
        this.eventBus.emit('strategy:generation:started', { 
          flowId, 
          contextId,
          cause
        });
      }
      
      const strategyCircuitBreaker = this.circuitBreakers.get('strategyGenerator');
      const strategy = await strategyCircuitBreaker.execute(async () => {
        return await this.strategyGenerator.generateStrategy(cause, context);
      });
      
      const generateEndTime = Date.now();
      const generateDuration = generateEndTime - generateStartTime;
      
      // Record step
      flow.steps.push({
        name: 'generate',
        startTime: generateStartTime,
        endTime: generateEndTime,
        duration: generateDuration,
        successful: true,
        result: strategy
      });
      
      if (this.eventBus) {
        this.eventBus.emit('strategy:generation:completed', { 
          flowId, 
          contextId,
          success: true,
          duration: generateDuration,
          strategy
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('strategy_generation_duration', generateDuration);
        this.metrics.recordSuccess('strategy_generation', true);
      }
      
      // Update context with strategy
      if (this.contextManager && contextId) {
        this.contextManager.updateContext(contextId, {
          strategy
        }, 'recovery-orchestrator');
      }
      
      // Step 3: Validate strategy
      this.logger.info(`Step 3: Validating strategy for flow ${flowId}`);
      
      const validateStartTime = Date.now();
      
      if (this.eventBus) {
        this.eventBus.emit('validation:started', { 
          flowId, 
          contextId,
          strategy
        });
      }
      
      const validationCircuitBreaker = this.circuitBreakers.get('validationRunner');
      const isValid = await validationCircuitBreaker.execute(async () => {
        return await this.validationRunner.validateStrategy(strategy, context);
      });
      
      const validateEndTime = Date.now();
      const validateDuration = validateEndTime - validateStartTime;
      
      // Record step
      flow.steps.push({
        name: 'validate',
        startTime: validateStartTime,
        endTime: validateEndTime,
        duration: validateDuration,
        successful: isValid,
        result: { isValid }
      });
      
      if (this.eventBus) {
        this.eventBus.emit('validation:completed', { 
          flowId, 
          contextId,
          success: true,
          isValid,
          duration: validateDuration
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('validation_duration', validateDuration);
        this.metrics.recordSuccess('validation', isValid);
      }
      
      // Update context with validation result
      if (this.contextManager && contextId) {
        this.contextManager.updateContext(contextId, {
          validationResult: { isValid }
        }, 'recovery-orchestrator');
      }
      
      if (!isValid) {
        this.logger.warn(`Strategy validation failed for flow ${flowId}`);
        
        return {
          successful: false,
          reason: 'VALIDATION_FAILED',
          message: 'Generated strategy failed validation'
        };
      }
      
      // Step 4: Execute resolution
      this.logger.info(`Step 4: Executing resolution for flow ${flowId}`);
      
      const executeStartTime = Date.now();
      
      if (this.eventBus) {
        this.eventBus.emit('execution:started', { 
          flowId, 
          contextId,
          strategy
        });
      }
      
      const executionCircuitBreaker = this.circuitBreakers.get('resolutionExecutor');
      const executionResult = await executionCircuitBreaker.execute(async () => {
        return await this.resolutionExecutor.executeStrategy(strategy, context);
      });
      
      const executeEndTime = Date.now();
      const executeDuration = executeEndTime - executeStartTime;
      
      // Record step
      flow.steps.push({
        name: 'execute',
        startTime: executeStartTime,
        endTime: executeEndTime,
        duration: executeDuration,
        successful: executionResult.successful,
        result: executionResult
      });
      
      if (this.eventBus) {
        this.eventBus.emit('execution:completed', { 
          flowId, 
          contextId,
          success: executionResult.successful,
          duration: executeDuration,
          result: executionResult
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('execution_duration', executeDuration);
        this.metrics.recordSuccess('execution', executionResult.successful);
      }
      
      // Update context with execution result
      if (this.contextManager && contextId) {
        this.contextManager.updateContext(contextId, {
          executionResult
        }, 'recovery-orchestrator');
      }
      
      if (!executionResult.successful) {
        this.logger.warn(`Strategy execution failed for flow ${flowId}: ${executionResult.message || 'Unknown error'}`);
        
        return {
          successful: false,
          reason: 'EXECUTION_FAILED',
          message: executionResult.message || 'Strategy execution failed',
          details: executionResult
        };
      }
      
      // Step 5: Learn from success
      this.logger.info(`Step 5: Learning from success for flow ${flowId}`);
      
      const learnStartTime = Date.now();
      
      if (this.eventBus) {
        this.eventBus.emit('learning:started', { 
          flowId, 
          contextId,
          success: true
        });
      }
      
      const learningCircuitBreaker = this.circuitBreakers.get('learningSystem');
      await learningCircuitBreaker.execute(async () => {
        return await this.learningSystem.recordSuccess(error, cause, strategy, executionResult, context);
      });
      
      const learnEndTime = Date.now();
      const learnDuration = learnEndTime - learnStartTime;
      
      // Record step
      flow.steps.push({
        name: 'learn',
        startTime: learnStartTime,
        endTime: learnEndTime,
        duration: learnDuration,
        successful: true
      });
      
      if (this.eventBus) {
        this.eventBus.emit('learning:completed', { 
          flowId, 
          contextId,
          success: true,
          duration: learnDuration
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('learning_duration', learnDuration);
        this.metrics.recordSuccess('learning', true);
      }
      
      // Return success result
      return {
        successful: true,
        flowId,
        contextId,
        executionResult
      };
    } catch (error) {
      this.logger.error(`Error in recovery flow ${flowId}: ${error.message}`, error);
      
      // Record failure in learning system
      try {
        if (this.learningSystem) {
          const learningCircuitBreaker = this.circuitBreakers.get('learningSystem');
          await learningCircuitBreaker.execute(async () => {
            return await this.learningSystem.recordFailure(error, context);
          });
        }
      } catch (learningError) {
        this.logger.error(`Error recording failure in learning system: ${learningError.message}`, learningError);
      }
      
      if (this.eventBus) {
        this.eventBus.emit('recovery:error', { 
          flowId, 
          contextId,
          error
        });
      }
      
      return {
        successful: false,
        reason: 'RECOVERY_ERROR',
        message: error.message,
        error: {
          message: error.message,
          stack: error.stack
        }
      };
    }
  }
  
  /**
   * Gets a recovery flow by ID
   * 
   * @param {string} flowId - Flow ID
   * @returns {Object|null} - Recovery flow or null if not found
   */
  getRecoveryFlow(flowId) {
    return this.recoveryFlows.get(flowId) || null;
  }
  
  /**
   * Gets all recovery flows
   * 
   * @param {Object} options - Filter options
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Limit number of results
   * @returns {Array<Object>} - Recovery flows
   */
  getRecoveryFlows(options = {}) {
    let flows = Array.from(this.recoveryFlows.values());
    
    // Apply status filter
    if (options.status) {
      flows = flows.filter(flow => flow.status === options.status);
    }
    
    // Sort by start time (newest first)
    flows.sort((a, b) => b.startTime - a.startTime);
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      flows = flows.slice(0, options.limit);
    }
    
    return flows;
  }
  
  /**
   * Gets recovery flow statistics
   * 
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const flows = Array.from(this.recoveryFlows.values());
    
    const total = flows.length;
    const completed = flows.filter(flow => flow.status === 'completed').length;
    const failed = flows.filter(flow => flow.status === 'failed').length;
    const error = flows.filter(flow => flow.status === 'error').length;
    const running = flows.filter(flow => flow.status === 'running').length;
    
    const successRate = total > 0 ? completed / total : 0;
    
    // Calculate average durations
    const completedFlows = flows.filter(flow => flow.status === 'completed' && flow.endTime && flow.startTime);
    const averageDuration = completedFlows.length > 0
      ? completedFlows.reduce((sum, flow) => sum + (flow.endTime - flow.startTime), 0) / completedFlows.length
      : 0;
    
    // Get circuit breaker states
    const circuitBreakerStates = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStates[name] = breaker.getState();
    }
    
    return {
      flows: {
        total,
        completed,
        failed,
        error,
        running,
        successRate
      },
      performance: {
        averageDuration
      },
      circuitBreakers: circuitBreakerStates
    };
  }
  
  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {AutonomousRecoveryOrchestrator} - This instance for chaining
   */
  setLogger(logger) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('Invalid logger: must be an object');
    }
    
    if (!logger.debug || !logger.info || !logger.warn || !logger.error) {
      throw new Error('Invalid logger: must have debug, info, warn, error methods');
    }
    
    this.logger = logger;
    return this;
  }
  
  /**
   * Sets the event bus instance
   * 
   * @param {Object} eventBus - Event bus instance
   * @returns {AutonomousRecoveryOrchestrator} - This instance for chaining
   */
  setEventBus(eventBus) {
    if (!eventBus || typeof eventBus !== 'object') {
      throw new Error('Invalid event bus: must be an object');
    }
    
    if (!eventBus.on || !eventBus.emit) {
      throw new Error('Invalid event bus: must have on and emit methods');
    }
    
    this.eventBus = eventBus;
    
    // Register event listeners
    this.registerEventListeners();
    
    return this;
  }
  
  /**
   * Sets the context manager instance
   * 
   * @param {Object} contextManager - Context manager instance
   * @returns {AutonomousRecoveryOrchestrator} - This instance for chaining
   */
  setContextManager(contextManager) {
    if (!contextManager || typeof contextManager !== 'object') {
      throw new Error('Invalid context manager: must be an object');
    }
    
    if (!contextManager.createContext || !contextManager.getContext || !contextManager.updateContext) {
      throw new Error('Invalid context manager: must have createContext, getContext, and updateContext methods');
    }
    
    this.contextManager = contextManager;
    return this;
  }
  
  /**
   * Sets the metrics collector instance
   * 
   * @param {Object} metrics - Metrics collector instance
   * @returns {AutonomousRecoveryOrchestrator} - This instance for chaining
   */
  setMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      throw new Error('Invalid metrics collector: must be an object');
    }
    
    if (!metrics.incrementCounter || !metrics.recordTiming || !metrics.recordSuccess) {
      throw new Error('Invalid metrics collector: must have incrementCounter, recordTiming, and recordSuccess methods');
    }
    
    this.metrics = metrics;
    return this;
  }
  
  /**
   * Disposes of the orchestrator
   */
  dispose() {
    // Unregister event listeners
    if (this.eventBus) {
      this.eventBus.off('error:detected', this.handleErrorDetected);
    }
    
    this.logger.info('AutonomousRecoveryOrchestrator disposed');
  }
}

module.exports = {
  AutonomousRecoveryOrchestrator,
  CircuitBreaker
};
