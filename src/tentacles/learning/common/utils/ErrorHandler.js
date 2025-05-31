/**
 * @fileoverview Error handling utility for the Learning from Demonstration system.
 * Provides standardized error types, error wrapping, and error handling mechanisms.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

/**
 * Base error class for Learning from Demonstration system errors.
 */
class LearningError extends Error {
  /**
   * Creates a new LearningError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   * @param {Error} [options.cause] - Underlying cause of this error
   * @param {string} [options.code] - Error code
   * @param {Object} [options.context={}] - Additional context data
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code || 'LEARNING_ERROR';
    this.context = options.context || {};
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Creates a formatted representation of the error.
   * @returns {string} Formatted error string
   */
  toString() {
    let result = `${this.name}: [${this.code}] ${this.message}`;
    
    if (Object.keys(this.context).length > 0) {
      result += `\nContext: ${JSON.stringify(this.context, null, 2)}`;
    }
    
    if (this.cause) {
      result += `\nCaused by: ${this.cause}`;
    }
    
    return result;
  }
}

/**
 * Error class for validation errors.
 */
class ValidationError extends LearningError {
  /**
   * Creates a new ValidationError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'VALIDATION_ERROR'
    });
  }
}

/**
 * Error class for configuration errors.
 */
class ConfigurationError extends LearningError {
  /**
   * Creates a new ConfigurationError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'CONFIGURATION_ERROR'
    });
  }
}

/**
 * Error class for operation errors.
 */
class OperationError extends LearningError {
  /**
   * Creates a new OperationError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'OPERATION_ERROR'
    });
  }
}

/**
 * Error class for resource errors.
 */
class ResourceError extends LearningError {
  /**
   * Creates a new ResourceError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'RESOURCE_ERROR'
    });
  }
}

/**
 * Error class for not found errors.
 */
class NotFoundError extends LearningError {
  /**
   * Creates a new NotFoundError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'NOT_FOUND_ERROR'
    });
  }
}

/**
 * Error class for permission errors.
 */
class PermissionError extends LearningError {
  /**
   * Creates a new PermissionError.
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error options
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PERMISSION_ERROR'
    });
  }
}

/**
 * Error handler utility.
 */
class ErrorHandler {
  /**
   * Creates a new ErrorHandler.
   * @param {Object} options - Handler options
   * @param {Function} [options.logger] - Logger function
   * @param {Function[]} [options.handlers=[]] - Error handler functions
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.handlers = options.handlers || [];
  }

  /**
   * Handles an error.
   * @param {Error} error - Error to handle
   * @param {Object} [context={}] - Additional context data
   * @returns {boolean} True if error was handled, false otherwise
   */
  handle(error, context = {}) {
    // Log the error if logger is available
    if (this.logger) {
      if (error instanceof LearningError) {
        this.logger.error(error.message, { 
          ...error.context, 
          ...context, 
          errorCode: error.code,
          errorName: error.name
        }, error);
      } else {
        this.logger.error(error.message, context, error);
      }
    }
    
    // Try each handler until one returns true
    for (const handler of this.handlers) {
      try {
        if (handler(error, context) === true) {
          return true;
        }
      } catch (handlerError) {
        if (this.logger) {
          this.logger.error('Error in error handler', handlerError);
        } else {
          console.error('Error in error handler:', handlerError);
        }
      }
    }
    
    return false;
  }

  /**
   * Adds an error handler function.
   * @param {Function} handler - Handler function(error, context)
   * @returns {ErrorHandler} This instance for chaining
   */
  addHandler(handler) {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Removes an error handler function.
   * @param {Function} handler - Handler function to remove
   * @returns {ErrorHandler} This instance for chaining
   */
  removeHandler(handler) {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
    return this;
  }

  /**
   * Creates a wrapper function that catches errors and handles them.
   * @param {Function} fn - Function to wrap
   * @param {Object} [context={}] - Additional context data
   * @returns {Function} Wrapped function
   */
  wrap(fn, context = {}) {
    const self = this;
    
    return function(...args) {
      try {
        const result = fn.apply(this, args);
        
        // Handle promises
        if (result instanceof Promise) {
          return result.catch(error => {
            self.handle(error, context);
            throw error; // Re-throw after handling
          });
        }
        
        return result;
      } catch (error) {
        self.handle(error, context);
        throw error; // Re-throw after handling
      }
    };
  }

  /**
   * Creates an async wrapper function that catches errors and handles them.
   * @param {Function} fn - Async function to wrap
   * @param {Object} [context={}] - Additional context data
   * @returns {Function} Wrapped async function
   */
  wrapAsync(fn, context = {}) {
    const self = this;
    
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        self.handle(error, context);
        throw error; // Re-throw after handling
      }
    };
  }
}

module.exports = {
  LearningError,
  ValidationError,
  ConfigurationError,
  OperationError,
  ResourceError,
  NotFoundError,
  PermissionError,
  ErrorHandler
};
