/**
 * @fileoverview Processing Core for the Multi-Modal Integration Tentacle.
 * Responsible for coordinating the processing of multi-modal inputs.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Processing Core
 * Responsible for coordinating the processing of multi-modal inputs.
 */
class ProcessingCore {
  /**
   * Creates a new ProcessingCore instance.
   * @param {Object} options - Core options
   * @param {Object} options.tentacle - Parent tentacle
   * @param {Object} options.config - Configuration system
   * @param {Object} options.logging - Logging system
   * @param {Object} options.events - Event system
   * @param {Object} options.metrics - Metrics system
   * @param {Object} options.modelRegistry - Model registry
   */
  constructor(options = {}) {
    this.tentacle = options.tentacle;
    this.config = options.config;
    this.logging = options.logging;
    this.events = options.events;
    this.metrics = options.metrics;
    this.modelRegistry = options.modelRegistry;
    
    // Create logger with fallback for all methods
    this.logger = this.logging && typeof this.logging.createLogger === 'function' 
      ? this.logging.createLogger('multi-modal-integration:processing-core') 
      : {
          info: console.log,
          warn: console.warn,
          error: console.error,
          debug: console.debug
        };
    
    // Initialize state
    this.processingTasks = new Map();
    this.taskCounter = 0;
    
    // Ensure modalityHandlers exists to prevent errors
    if (this.tentacle && !this.tentacle.modalityHandlers) {
      this.tentacle.modalityHandlers = {
        text: null,
        image: null,
        audio: null,
        video: null
      };
    }
    
    // Define all methods before binding
    this.process = this.process || function() { return Promise.resolve({}); };
    this.generate = this.generate || function() { return Promise.resolve({}); };
    this.routeToHandlers = this.routeToHandlers || function() { return Promise.resolve({}); };
    this.processModality = this.processModality || function() { return Promise.resolve({}); };
    this.generateModality = this.generateModality || function() { return Promise.resolve({}); };
    this.createTask = this.createTask || function() { return ''; };
    this.updateTask = this.updateTask || function() {};
    this.completeTask = this.completeTask || function() {};
    this.failTask = this.failTask || function() {};
    
    // Bind methods safely
    this.process = this.process.bind(this);
    this.generate = this.generate.bind(this);
    this.routeToHandlers = this.routeToHandlers.bind(this);
    this.processModality = this.processModality.bind(this);
    this.generateModality = this.generateModality.bind(this);
    this.createTask = this.createTask.bind(this);
    this.updateTask = this.updateTask.bind(this);
    this.completeTask = this.completeTask.bind(this);
    this.failTask = this.failTask.bind(this);
  }
  
  /**
   * Initializes the core.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Processing Core');
      
      // Load configuration
      this.processingTimeout = this.config ? this.config.get('multi-modal.processing.timeout', 60000) : 60000;
      this.maxConcurrentTasks = this.config ? this.config.get('multi-modal.processing.maxConcurrentTasks', 10) : 10;
      this.enableParallelProcessing = this.config ? this.config.get('multi-modal.processing.enableParallelProcessing', true) : true;
      
      this.logger.info('Processing Core initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Processing Core:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the core.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Processing Core');
      
      // Cancel all running tasks
      for (const [taskId, task] of this.processingTasks.entries()) {
        this.logger.info(`Cancelling task ${taskId}`);
        this.failTask(taskId, new Error('Processing Core is shutting down'));
      }
      
      this.logger.info('Processing Core shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Processing Core:', error);
      throw error;
    }
  }
  
  /**
   * Processes input through the core.
   * @param {Object} input - Input data
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async process(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Create task
      const taskId = this.createTask('process', input, options);
      
      try {
        // Route to appropriate handlers
        const results = await this.routeToHandlers(input, options, 'process');
        
        // Combine results
        const combinedResult = this.combineResults(results, input, options);
        
        // Complete task
        this.completeTask(taskId, combinedResult);
        
        // Record metrics
        if (this.metrics) {
          this.metrics.record('multi-modal.processing.process.count', 1);
          this.metrics.recordTiming('multi-modal.processing.process.time', Date.now() - startTime);
        }
        
        // Emit event
        if (this.events) {
          this.events.emit('multi-modal.processing.processed', {
            input,
            result: combinedResult,
            processingTime: Date.now() - startTime
          });
        }
        
        return combinedResult;
      } catch (error) {
        // Fail task
        this.failTask(taskId, error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Failed to process input:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.processing.process.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Generates output through the core.
   * @param {Object} spec - Output specification
   * @param {Object} [context] - Generation context
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} - Generated output
   */
  async generate(spec, context = {}, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Create task
      const taskId = this.createTask('generate', { spec, context }, options);
      
      try {
        // Route to appropriate handlers
        const results = await this.routeToHandlers(spec, { ...options, context }, 'generate');
        
        // Combine results
        const combinedResult = this.combineResults(results, spec, options);
        
        // Complete task
        this.completeTask(taskId, combinedResult);
        
        // Record metrics
        if (this.metrics) {
          this.metrics.record('multi-modal.processing.generate.count', 1);
          this.metrics.recordTiming('multi-modal.processing.generate.time', Date.now() - startTime);
        }
        
        // Emit event
        if (this.events) {
          this.events.emit('multi-modal.processing.generated', {
            spec,
            result: combinedResult,
            processingTime: Date.now() - startTime
          });
        }
        
        return combinedResult;
      } catch (error) {
        // Fail task
        this.failTask(taskId, error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Failed to generate output:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.processing.generate.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Routes input to appropriate handlers.
   * @param {Object} input - Input data
   * @param {Object} [options] - Processing options
   * @param {string} operation - Operation type ('process' or 'generate')
   * @returns {Promise<Object>} - Handler results
   * @private
   */
  async routeToHandlers(input, options = {}, operation) {
    const results = {};
    const modalityHandlers = this.tentacle && this.tentacle.modalityHandlers ? this.tentacle.modalityHandlers : {};
    
    // Get modalities to process
    const modalities = ['text', 'image', 'audio', 'video'].filter(modality => input[modality]);
    
    if (modalities.length === 0) {
      throw new Error('No modalities to process');
    }
    
    // Process modalities
    if (this.enableParallelProcessing && options.enableParallelProcessing !== false) {
      // Process in parallel
      const promises = modalities.map(modality => 
        this.processModality(modality, input[modality], modalityHandlers[modality], options, operation)
          .then(result => {
            results[modality] = result;
            return result;
          })
          .catch(error => {
            this.logger.error(`Failed to process ${modality}:`, error);
            
            // If strict mode is enabled, rethrow the error
            if (options.strictMode) {
              throw error;
            }
            
            // Otherwise, store the error and continue
            results[modality] = { 
              error: error.message,
              metadata: {
                status: 'error',
                errorMessage: error.message,
                errorStack: error.stack,
                processedAt: Date.now()
              }
            };
            return { 
              error: error.message,
              metadata: {
                status: 'error',
                errorMessage: error.message,
                errorStack: error.stack,
                processedAt: Date.now()
              }
            };
          })
      );
      
      await Promise.all(promises);
    } else {
      // Process sequentially
      for (const modality of modalities) {
        try {
          results[modality] = await this.processModality(
            modality, 
            input[modality], 
            modalityHandlers[modality], 
            options,
            operation
          );
        } catch (error) {
          this.logger.error(`Failed to process ${modality}:`, error);
          
          // If strict mode is enabled, rethrow the error
          if (options.strictMode) {
            throw error;
          }
          
          // Otherwise, store the error and continue
          results[modality] = { 
            error: error.message,
            metadata: {
              status: 'error',
              errorMessage: error.message,
              errorStack: error.stack,
              processedAt: Date.now()
            }
          };
        }
      }
    }
    
    return results;
  }
  
  /**
   * Processes a specific modality.
   * @param {string} modality - Modality name
   * @param {Object} input - Modality input
   * @param {Object} handler - Modality handler
   * @param {Object} [options] - Processing options
   * @param {string} operation - Operation type ('process' or 'generate')
   * @returns {Promise<Object>} - Processing result
   * @private
   */
  async processModality(modality, input, handler, options = {}, operation) {
    if (!handler) {
      // Return a default result if handler is missing
      return {
        [modality]: input,
        features: {},
        analysis: {},
        metadata: { 
          processedAt: Date.now(),
          status: 'skipped',
          reason: 'No handler available'
        }
      };
    }
    
    // Start timing
    const startTime = Date.now();
    
    // Create timeout promise and timer ID
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutMs = options.timeout || this.processingTimeout;
      timeoutId = setTimeout(() => {
        reject(new Error(`Processing ${modality} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    try {
      // Process with timeout
      const processingPromise = operation === 'process'
        ? handler.processInput(input, options)
        : handler.generateOutput(input, options.context, options);
      
      const result = await Promise.race([processingPromise, timeoutPromise]);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record(`multi-modal.processing.${modality}.count`, 1);
        this.metrics.recordTiming(`multi-modal.processing.${modality}.time`, Date.now() - startTime);
      }
      
      // Ensure result has metadata
      if (!result.metadata) {
        result.metadata = {
          processedAt: Date.now(),
          status: 'success',
          modality: modality,
          operation: operation
        };
      }
      
      return result;
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record(`multi-modal.processing.${modality}.error`, 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Generates output for a specific modality.
   * @param {string} modality - Modality name
   * @param {Object} spec - Output specification
   * @param {Object} handler - Modality handler
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} - Generated output
   * @private
   */
  async generateModality(modality, spec, handler, options = {}) {
    if (!handler) {
      // Return a default result if handler is missing
      return {
        [modality]: null,
        metadata: { 
          generatedAt: Date.now(),
          status: 'skipped',
          reason: 'No handler available'
        }
      };
    }
    
    // Start timing
    const startTime = Date.now();
    
    // Create timeout promise and timer ID
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutMs = options.timeout || this.processingTimeout;
      timeoutId = setTimeout(() => {
        reject(new Error(`Generating ${modality} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    try {
      // Generate with timeout
      const generationPromise = handler.generateOutput(spec, options.context, options);
      const result = await Promise.race([generationPromise, timeoutPromise]);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record(`multi-modal.processing.${modality}.generate.count`, 1);
        this.metrics.recordTiming(`multi-modal.processing.${modality}.generate.time`, Date.now() - startTime);
      }
      
      // Ensure result has metadata
      if (!result.metadata) {
        result.metadata = {
          generatedAt: Date.now(),
          status: 'success',
          modality: modality,
          operation: 'generate'
        };
      }
      
      return result;
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record(`multi-modal.processing.${modality}.generate.error`, 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Combines results from multiple handlers.
   * @param {Object} results - Handler results
   * @param {Object} input - Original input
   * @param {Object} [options] - Processing options
   * @returns {Object} - Combined result
   * @private
   */
  combineResults(results, input, options = {}) {
    const combinedResult = {
      ...results,
      metadata: {
        timestamp: Date.now(),
        modalityCount: Object.keys(results).length,
        input: options.includeInput ? input : undefined,
        status: 'success',
        processingTime: Date.now() - (options.startTime || Date.now())
      }
    };
    
    return combinedResult;
  }
  
  /**
   * Creates a new processing task.
   * @param {string} type - Task type
   * @param {Object} input - Task input
   * @param {Object} [options] - Task options
   * @returns {string} - Task ID
   * @private
   */
  createTask(type, input, options = {}) {
    const taskId = `task-${Date.now()}-${this.taskCounter++}`;
    
    const task = {
      id: taskId,
      type,
      input,
      options,
      status: 'running',
      startTime: Date.now(),
      progress: 0,
      result: null,
      error: null
    };
    
    this.processingTasks.set(taskId, task);
    
    // Emit event
    if (this.events) {
      this.events.emit('multi-modal.task.created', { task });
    }
    
    return taskId;
  }
  
  /**
   * Updates a processing task.
   * @param {string} taskId - Task ID
   * @param {Object} update - Task update
   * @private
   */
  updateTask(taskId, update) {
    const task = this.processingTasks.get(taskId);
    
    if (!task) {
      this.logger.warn(`Cannot update task ${taskId}: task not found`);
      return;
    }
    
    Object.assign(task, update);
    
    // Emit event
    if (this.events) {
      this.events.emit('multi-modal.task.updated', { task });
    }
  }
  
  /**
   * Completes a processing task.
   * @param {string} taskId - Task ID
   * @param {Object} result - Task result
   * @private
   */
  completeTask(taskId, result) {
    const task = this.processingTasks.get(taskId);
    
    if (!task) {
      this.logger.warn(`Cannot complete task ${taskId}: task not found`);
      return;
    }
    
    task.status = 'completed';
    task.progress = 100;
    task.result = result;
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    
    // Emit event
    if (this.events) {
      this.events.emit('multi-modal.task.completed', { task });
    }
    
    // Remove task after a delay
    setTimeout(() => {
      this.processingTasks.delete(taskId);
    }, 60000);
  }
  
  /**
   * Fails a processing task.
   * @param {string} taskId - Task ID
   * @param {Error} error - Task error
   * @private
   */
  failTask(taskId, error) {
    const task = this.processingTasks.get(taskId);
    
    if (!task) {
      this.logger.warn(`Cannot fail task ${taskId}: task not found`);
      return;
    }
    
    task.status = 'failed';
    task.error = error.message;
    task.stack = error.stack;
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    
    // Emit event
    if (this.events) {
      this.events.emit('multi-modal.task.failed', { task, error });
    }
    
    // Remove task after a delay
    setTimeout(() => {
      this.processingTasks.delete(taskId);
    }, 60000);
  }
}

module.exports = ProcessingCore;
