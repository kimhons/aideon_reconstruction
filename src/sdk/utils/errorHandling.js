/**
 * @fileoverview Error handling utilities for the Aideon SDK.
 * Provides standardized error classes and error handling functions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base error class for Aideon SDK errors.
 */
class AideonError extends Error {
  /**
   * Creates a new AideonError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code || 'UNKNOWN_ERROR';
    this.cause = cause;
    this.timestamp = Date.now();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Converts the error to a JSON object.
   * @returns {Object} The JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? (this.cause.toJSON ? this.cause.toJSON() : this.cause.message) : undefined
    };
  }
}

/**
 * Error class for API errors.
 */
class ApiError extends AideonError {
  /**
   * Creates a new ApiError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'API_ERROR', cause);
  }
}

/**
 * Error class for configuration errors.
 */
class ConfigError extends AideonError {
  /**
   * Creates a new ConfigError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'CONFIG_ERROR', cause);
  }
}

/**
 * Error class for event errors.
 */
class EventError extends AideonError {
  /**
   * Creates a new EventError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'EVENT_ERROR', cause);
  }
}

/**
 * Error class for logging errors.
 */
class LoggingError extends AideonError {
  /**
   * Creates a new LoggingError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'LOGGING_ERROR', cause);
  }
}

/**
 * Error class for metrics errors.
 */
class MetricsError extends AideonError {
  /**
   * Creates a new MetricsError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'METRICS_ERROR', cause);
  }
}

/**
 * Error class for security errors.
 */
class SecurityError extends AideonError {
  /**
   * Creates a new SecurityError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'SECURITY_ERROR', cause);
  }
}

/**
 * Error class for tentacle errors.
 */
class TentacleError extends AideonError {
  /**
   * Creates a new TentacleError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Error} [cause] - The error cause
   */
  constructor(message, code, cause) {
    super(message, code || 'TENTACLE_ERROR', cause);
  }
}

/**
 * Error class for validation errors.
 */
class ValidationError extends AideonError {
  /**
   * Creates a new ValidationError instance.
   * @param {string} message - The error message
   * @param {string} code - The error code
   * @param {Array} [errors] - Validation errors
   */
  constructor(message, code, errors) {
    super(message, code || 'VALIDATION_ERROR');
    this.errors = errors || [];
  }
  
  /**
   * Converts the error to a JSON object.
   * @returns {Object} The JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

/**
 * Handles an error.
 * @param {Error} error - The error to handle
 * @param {Object} [options] - Options for error handling
 * @param {boolean} [options.log=true] - Whether to log the error
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 * @returns {Object} The error information
 */
function handleError(error, options = {}) {
  const { log = true, rethrow = false } = options;
  
  // Convert to AideonError if needed
  const aideonError = error instanceof AideonError
    ? error
    : new AideonError(error.message || 'Unknown error', 'UNKNOWN_ERROR', error);
  
  // Log error if enabled
  if (log) {
    console.error('[ERROR]', aideonError.toJSON());
  }
  
  // Rethrow if enabled
  if (rethrow) {
    throw aideonError;
  }
  
  return aideonError.toJSON();
}

/**
 * Creates an error handler function.
 * @param {Object} [options] - Options for error handling
 * @param {boolean} [options.log=true] - Whether to log the error
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 * @returns {Function} The error handler function
 */
function createErrorHandler(options = {}) {
  return (error) => handleError(error, options);
}

// Export error classes and functions
module.exports = {
  AideonError,
  ApiError,
  ConfigError,
  EventError,
  LoggingError,
  MetricsError,
  SecurityError,
  TentacleError,
  ValidationError,
  handleError,
  createErrorHandler
};
