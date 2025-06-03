/**
 * @fileoverview Advanced Error Recovery system for Aideon.
 * This module provides sophisticated error detection, diagnosis, and recovery
 * mechanisms to handle unexpected situations gracefully without user intervention.
 * 
 * @module core/error/ErrorRecoveryManager
 */

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * ErrorRecoveryManager class provides a centralized system for detecting,
 * diagnosing, and recovering from errors across the Aideon system.
 */
class ErrorRecoveryManager {
  /**
   * Creates a new ErrorRecoveryManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.metricsCollector - MetricsCollector instance
   * @param {Object} options.configManager - ConfigurationManager instance
   * @param {string} options.errorLogDir - Directory for error logs
   * @param {boolean} options.enableAutoRecovery - Whether to enable automatic recovery
   */
  constructor(options = {}) {
    this.options = {
      metricsCollector: options.metricsCollector || null,
      configManager: options.configManager || null,
      errorLogDir: options.errorLogDir || path.join(os.homedir(), '.aideon', 'logs', 'errors'),
      enableAutoRecovery: options.enableAutoRecovery !== undefined ? 
        options.enableAutoRecovery : true
    };
    
    // Ensure error log directory exists
    if (!fs.existsSync(this.options.errorLogDir)) {
      fs.mkdirSync(this.options.errorLogDir, { recursive: true });
    }
    
    // Initialize error storage
    this.errorRegistry = {};
    this.recoveryStrategies = {};
    this.activeErrors = {};
    this.errorHistory = [];
    this.recoveryHistory = [];
    
    // Set up event emitter for error events
    this.events = new EventEmitter();
    
    // Initialize metrics if collector is provided
    if (this.options.metricsCollector) {
      this.initializeMetrics();
    }
    
    // Initialize configuration if manager is provided
    if (this.options.configManager) {
      this.initializeConfig();
    }
    
    // Register system error handlers
    this.registerSystemErrorHandlers();
  }
  
  /**
   * Initializes metrics for the error recovery system.
   * @private
   */
  initializeMetrics() {
    const metrics = this.options.metricsCollector;
    
    // Define error metrics
    metrics.defineMetric('error.occurrence', 'counter', 'Error occurrence count');
    metrics.defineMetric('error.recovery.attempt', 'counter', 'Recovery attempt count');
    metrics.defineMetric('error.recovery.success', 'counter', 'Successful recovery count');
    metrics.defineMetric('error.recovery.failure', 'counter', 'Failed recovery count');
    metrics.defineMetric('error.recovery.time', 'histogram', 'Recovery time in ms');
    
    // Define dimensions
    metrics.defineDimension('error.type', 'Error type');
    metrics.defineDimension('error.component', 'Component where error occurred');
    metrics.defineDimension('error.severity', 'Error severity level');
    metrics.defineDimension('error.recovery.strategy', 'Recovery strategy used');
  }
  
  /**
   * Initializes configuration for the error recovery system.
   * @private
   */
  initializeConfig() {
    const config = this.options.configManager;
    
    // Define error recovery configuration schema
    config.defineConfigSchema('errorRecovery', {
      properties: {
        enableAutoRecovery: {
          type: 'boolean',
          default: true,
          description: 'Whether to enable automatic error recovery'
        },
        maxRecoveryAttempts: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 3,
          description: 'Maximum number of recovery attempts per error'
        },
        recoveryTimeout: {
          type: 'integer',
          minimum: 1000,
          maximum: 60000,
          default: 10000,
          description: 'Timeout for recovery attempts in milliseconds'
        },
        errorLogRetention: {
          type: 'integer',
          minimum: 1,
          maximum: 90,
          default: 30,
          description: 'Error log retention period in days'
        },
        notifyUserOnCritical: {
          type: 'boolean',
          default: true,
          description: 'Whether to notify user on critical errors'
        },
        detailedErrorReporting: {
          type: 'boolean',
          default: true,
          description: 'Whether to include detailed information in error reports'
        }
      }
    });
    
    // Load error recovery configuration
    config.loadConfig('errorRecovery');
    
    // Subscribe to configuration changes
    config.subscribeToChanges((event) => {
      if (event.namespace === 'errorRecovery') {
        // Update auto recovery setting if changed
        if (event.changes.enableAutoRecovery) {
          this.options.enableAutoRecovery = event.config.enableAutoRecovery;
        }
      }
    }, 'errorRecovery');
    
    // Register context providers for error recovery
    config.registerContextProvider('error.frequency', () => {
      // Calculate error frequency based on recent history
      const recentErrors = this.errorHistory.filter(
        error => error.timestamp > Date.now() - 3600000 // Last hour
      );
      
      if (recentErrors.length >= 10) {
        return 'high';
      } else if (recentErrors.length >= 5) {
        return 'medium';
      } else {
        return 'low';
      }
    });
    
    // Define context-based overrides for error recovery configuration
    config.defineContextOverride('errorRecovery.maxRecoveryAttempts', {
      context: 'error.frequency',
      values: {
        'low': 3,
        'medium': 2,
        'high': 1
      }
    });
  }
  
  /**
   * Registers system-level error handlers.
   * @private
   */
  registerSystemErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleError({
        error,
        type: 'uncaughtException',
        component: 'system',
        severity: 'critical',
        context: {
          process: process.pid,
          timestamp: Date.now()
        }
      });
      
      // Don't exit process, let recovery attempt handle it
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleError({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        type: 'unhandledRejection',
        component: 'system',
        severity: 'high',
        context: {
          process: process.pid,
          timestamp: Date.now()
        }
      });
    });
  }
  
  /**
   * Registers an error type with the error recovery system.
   * @param {string} errorType - Error type identifier
   * @param {Object} options - Error registration options
   * @param {string} options.description - Error description
   * @param {string} options.severity - Error severity (low, medium, high, critical)
   * @param {Function} options.detector - Optional function to detect this error type
   * @param {Function} options.diagnoser - Optional function to diagnose error details
   * @returns {boolean} - Success status
   */
  registerErrorType(errorType, options) {
    if (!errorType) {
      throw new Error('Error type is required');
    }
    
    if (!options || !options.description || !options.severity) {
      throw new Error('Error description and severity are required');
    }
    
    if (!['low', 'medium', 'high', 'critical'].includes(options.severity)) {
      throw new Error('Invalid severity level: must be low, medium, high, or critical');
    }
    
    this.errorRegistry[errorType] = {
      type: errorType,
      description: options.description,
      severity: options.severity,
      detector: options.detector || null,
      diagnoser: options.diagnoser || null,
      createdAt: new Date()
    };
    
    return true;
  }
  
  /**
   * Registers a recovery strategy for an error type.
   * @param {string} errorType - Error type identifier
   * @param {Object} strategy - Recovery strategy
   * @param {string} strategy.name - Strategy name
   * @param {string} strategy.description - Strategy description
   * @param {Function} strategy.action - Recovery action function
   * @param {number} strategy.priority - Priority (higher number = higher priority)
   * @returns {boolean} - Success status
   */
  registerRecoveryStrategy(errorType, strategy) {
    if (!errorType) {
      throw new Error('Error type is required');
    }
    
    if (!strategy || !strategy.name || !strategy.description || !strategy.action) {
      throw new Error('Strategy name, description, and action are required');
    }
    
    if (typeof strategy.action !== 'function') {
      throw new Error('Strategy action must be a function');
    }
    
    // Initialize strategies array for error type if not exists
    if (!this.recoveryStrategies[errorType]) {
      this.recoveryStrategies[errorType] = [];
    }
    
    // Add strategy
    this.recoveryStrategies[errorType].push({
      name: strategy.name,
      description: strategy.description,
      action: strategy.action,
      priority: strategy.priority || 0,
      createdAt: new Date()
    });
    
    // Sort strategies by priority (descending)
    this.recoveryStrategies[errorType].sort((a, b) => b.priority - a.priority);
    
    return true;
  }
  
  /**
   * Handles an error by logging, diagnosing, and attempting recovery.
   * @param {Object} errorInfo - Error information
   * @param {Error} errorInfo.error - Error object
   * @param {string} errorInfo.type - Error type
   * @param {string} errorInfo.component - Component where error occurred
   * @param {string} errorInfo.severity - Error severity
   * @param {Object} errorInfo.context - Additional context information
   * @returns {Promise<Object>} - Recovery result
   */
  async handleError(errorInfo) {
    if (!errorInfo || !errorInfo.error || !errorInfo.type) {
      throw new Error('Error object and type are required');
    }
    
    try {
      // Generate error ID
      const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add timestamp if not provided
      if (!errorInfo.context || !errorInfo.context.timestamp) {
        errorInfo.context = {
          ...(errorInfo.context || {}),
          timestamp: Date.now()
        };
      }
      
      // Set default severity if not provided
      if (!errorInfo.severity) {
        errorInfo.severity = this.errorRegistry[errorInfo.type]?.severity || 'medium';
      }
      
      // Set default component if not provided
      if (!errorInfo.component) {
        errorInfo.component = 'unknown';
      }
      
      // Log error
      this.logError(errorId, errorInfo);
      
      // Add to active errors
      this.activeErrors[errorId] = {
        ...errorInfo,
        id: errorId,
        recoveryAttempts: 0,
        status: 'detected',
        detectedAt: new Date()
      };
      
      // Add to error history
      this.errorHistory.push({
        id: errorId,
        type: errorInfo.type,
        component: errorInfo.component,
        severity: errorInfo.severity,
        message: errorInfo.error.message,
        timestamp: errorInfo.context.timestamp
      });
      
      // Trim error history if too long
      if (this.errorHistory.length > 100) {
        this.errorHistory = this.errorHistory.slice(-100);
      }
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('error.occurrence', 1, {
          'error.type': errorInfo.type,
          'error.component': errorInfo.component,
          'error.severity': errorInfo.severity
        });
      }
      
      // Emit error event
      try {
        process.nextTick(() => {
          if (this.events.listenerCount('error') > 0) {
            this.events.emit('error', {
              id: errorId,
              ...errorInfo
            });
          } else {
            // If no listeners, just log to console in non-production environments
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Warning: Error event emitted with no listeners:', errorId);
            }
          }
        });
      } catch (emitError) {
        console.error('Error emitting error event:', emitError);
      }
      
      // Attempt recovery if auto-recovery is enabled
      if (this.options.enableAutoRecovery) {
        return this.attemptRecovery(errorId);
      }
      
      return {
        errorId,
        status: 'detected',
        recoveryAttempted: false
      };
    } catch (err) {
      console.error('Error in handleError:', err);
      return {
        errorId: 'error-handling-failed',
        status: 'error',
        error: err.message
      };
    }
  }
  
  /**
   * Logs an error to the error log file.
   * @param {string} errorId - Error ID
   * @param {Object} errorInfo - Error information
   * @private
   */
  logError(errorId, errorInfo) {
    try {
      // Ensure error log directory exists
      if (!fs.existsSync(this.options.errorLogDir)) {
        fs.mkdirSync(this.options.errorLogDir, { recursive: true });
      }
      
      const logFile = path.join(
        this.options.errorLogDir,
        `error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
      
      const logEntry = {
        id: errorId,
        timestamp: new Date().toISOString(),
        type: errorInfo.type,
        component: errorInfo.component,
        severity: errorInfo.severity,
        message: errorInfo.error.message,
        stack: errorInfo.error.stack,
        context: errorInfo.context
      };
      
      fs.writeFileSync(
        logFile,
        JSON.stringify(logEntry, null, 2),
        'utf8'
      );
      
      // Also log to console for critical errors
      if (errorInfo.severity === 'critical') {
        console.error(`CRITICAL ERROR [${errorId}]: ${errorInfo.error.message}`);
        console.error(errorInfo.error.stack);
      }
      
      return true;
    } catch (logError) {
      console.error('Error logging to file:', logError);
      return false;
    }
  }
  
  /**
   * Attempts to recover from an error.
   * @param {string} errorId - Error ID
   * @returns {Promise<Object>} - Recovery result
   */
  async attemptRecovery(errorId) {
    if (!errorId || !this.activeErrors[errorId]) {
      throw new Error(`Error not found: ${errorId}`);
    }
    
    const errorInfo = this.activeErrors[errorId];
    const errorType = errorInfo.type;
    
    // Update error status
    errorInfo.status = 'recovery_in_progress';
    errorInfo.recoveryAttempts++;
    errorInfo.lastRecoveryAttempt = new Date();
    
    // Get max recovery attempts from config if available
    let maxRecoveryAttempts = 3;
    if (this.options.configManager) {
      maxRecoveryAttempts = this.options.configManager.get('errorRecovery', 'maxRecoveryAttempts');
    }
    
    // Check if max recovery attempts reached
    if (errorInfo.recoveryAttempts > maxRecoveryAttempts) {
      errorInfo.status = 'recovery_failed';
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('error.recovery.failure', 1, {
          'error.type': errorType,
          'error.component': errorInfo.component,
          'error.severity': errorInfo.severity
        });
      }
      
      // Emit recovery failed event
      this.events.emit('recoveryFailed', {
        id: errorId,
        error: errorInfo,
        attempts: errorInfo.recoveryAttempts
      });
      
      return {
        errorId,
        status: 'recovery_failed',
        attempts: errorInfo.recoveryAttempts
      };
    }
    
    // Record recovery attempt metric if available
    if (this.options.metricsCollector) {
      this.options.metricsCollector.recordMetric('error.recovery.attempt', 1, {
        'error.type': errorType,
        'error.component': errorInfo.component,
        'error.severity': errorInfo.severity
      });
    }
    
    // Get recovery strategies for error type
    const strategies = this.recoveryStrategies[errorType] || [];
    
    if (strategies.length === 0) {
      // No strategies available
      errorInfo.status = 'no_recovery_strategy';
      
      // Emit no strategy event
      this.events.emit('noRecoveryStrategy', {
        id: errorId,
        error: errorInfo
      });
      
      return {
        errorId,
        status: 'no_recovery_strategy'
      };
    }
    
    // Get recovery timeout from config if available
    let recoveryTimeout = 10000;
    if (this.options.configManager) {
      recoveryTimeout = this.options.configManager.get('errorRecovery', 'recoveryTimeout');
    }
    
    // Try each strategy in priority order
    for (const strategy of strategies) {
      try {
        // Record start time for metrics
        const startTime = Date.now();
        
        // Execute strategy with timeout
        const recoveryResult = await Promise.race([
          strategy.action(errorInfo),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Recovery timeout')), recoveryTimeout)
          )
        ]);
        
        // Record recovery time metric if available
        if (this.options.metricsCollector) {
          const recoveryTime = Date.now() - startTime;
          this.options.metricsCollector.recordMetric('error.recovery.time', recoveryTime, {
            'error.type': errorType,
            'error.component': errorInfo.component,
            'error.severity': errorInfo.severity,
            'error.recovery.strategy': strategy.name
          });
        }
        
        // Check recovery result
        if (recoveryResult && recoveryResult.success) {
          // Recovery successful
          errorInfo.status = 'recovered';
          errorInfo.recoveredAt = new Date();
          errorInfo.recoveryStrategy = strategy.name;
          
          // Add to recovery history
          this.recoveryHistory.push({
            errorId,
            type: errorType,
            component: errorInfo.component,
            severity: errorInfo.severity,
            strategy: strategy.name,
            attempts: errorInfo.recoveryAttempts,
            timestamp: Date.now()
          });
          
          // Trim recovery history if too long
          if (this.recoveryHistory.length > 100) {
            this.recoveryHistory = this.recoveryHistory.slice(-100);
          }
          
          // Record success metric if available
          if (this.options.metricsCollector) {
            this.options.metricsCollector.recordMetric('error.recovery.success', 1, {
              'error.type': errorType,
              'error.component': errorInfo.component,
              'error.severity': errorInfo.severity,
              'error.recovery.strategy': strategy.name
            });
          }
          
          // Emit recovery success event
          this.events.emit('recoverySuccess', {
            id: errorId,
            error: errorInfo,
            strategy: strategy.name,
            result: recoveryResult
          });
          
          return {
            errorId,
            status: 'recovered',
            strategy: strategy.name,
            attempts: errorInfo.recoveryAttempts,
            result: recoveryResult
          };
        }
      } catch (recoveryError) {
        // Strategy failed, continue to next strategy
        console.error(`Recovery strategy ${strategy.name} failed:`, recoveryError);
      }
    }
    
    // All strategies failed, try again or give up
    if (errorInfo.recoveryAttempts < maxRecoveryAttempts) {
      // Schedule another attempt with exponential backoff
      const backoff = Math.pow(2, errorInfo.recoveryAttempts) * 1000;
      setTimeout(() => {
        this.attemptRecovery(errorId).catch(console.error);
      }, backoff);
      
      return {
        errorId,
        status: 'recovery_scheduled',
        nextAttempt: new Date(Date.now() + backoff),
        attempts: errorInfo.recoveryAttempts
      };
    } else {
      // Max attempts reached
      errorInfo.status = 'recovery_failed';
      
      // Record failure metric if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('error.recovery.failure', 1, {
          'error.type': errorType,
          'error.component': errorInfo.component,
          'error.severity': errorInfo.severity
        });
      }
      
      // Emit recovery failed event
      this.events.emit('recoveryFailed', {
        id: errorId,
        error: errorInfo,
        attempts: errorInfo.recoveryAttempts
      });
      
      return {
        errorId,
        status: 'recovery_failed',
        attempts: errorInfo.recoveryAttempts
      };
    }
  }
  
  /**
   * Gets information about an active error.
   * @param {string} errorId - Error ID
   * @returns {Object} - Error information
   */
  getErrorInfo(errorId) {
    if (!errorId || !this.activeErrors[errorId]) {
      throw new Error(`Error not found: ${errorId}`);
    }
    
    return { ...this.activeErrors[errorId] };
  }
  
  /**
   * Gets all active errors.
   * @param {Object} filters - Optional filters
   * @param {string} filters.type - Filter by error type
   * @param {string} filters.component - Filter by component
   * @param {string} filters.severity - Filter by severity
   * @param {string} filters.status - Filter by status
   * @returns {Array<Object>} - Array of active errors
   */
  getActiveErrors(filters = {}) {
    let errors = Object.values(this.activeErrors);
    
    // Apply filters
    if (filters.type) {
      errors = errors.filter(error => error.type === filters.type);
    }
    
    if (filters.component) {
      errors = errors.filter(error => error.component === filters.component);
    }
    
    if (filters.severity) {
      errors = errors.filter(error => error.severity === filters.severity);
    }
    
    if (filters.status) {
      errors = errors.filter(error => error.status === filters.status);
    }
    
    return errors;
  }
  
  /**
   * Gets error history.
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of errors to return
   * @param {number} options.startTime - Start timestamp
   * @param {number} options.endTime - End timestamp
   * @returns {Array<Object>} - Array of historical errors
   */
  getErrorHistory(options = {}) {
    let history = [...this.errorHistory];
    
    // Filter by time range
    if (options.startTime) {
      history = history.filter(error => error.timestamp >= options.startTime);
    }
    
    if (options.endTime) {
      history = history.filter(error => error.timestamp <= options.endTime);
    }
    
    // Sort by timestamp (descending)
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      history = history.slice(0, options.limit);
    }
    
    return history;
  }
  
  /**
   * Gets recovery history.
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of recoveries to return
   * @param {number} options.startTime - Start timestamp
   * @param {number} options.endTime - End timestamp
   * @returns {Array<Object>} - Array of historical recoveries
   */
  getRecoveryHistory(options = {}) {
    let history = [...this.recoveryHistory];
    
    // Filter by time range
    if (options.startTime) {
      history = history.filter(recovery => recovery.timestamp >= options.startTime);
    }
    
    if (options.endTime) {
      history = history.filter(recovery => recovery.timestamp <= options.endTime);
    }
    
    // Sort by timestamp (descending)
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      history = history.slice(0, options.limit);
    }
    
    return history;
  }
  
  /**
   * Analyzes error patterns to identify recurring issues.
   * @returns {Array<Object>} - Array of identified patterns
   */
  analyzeErrorPatterns() {
    const patterns = [];
    const typeFrequency = {};
    const componentFrequency = {};
    const typeComponentFrequency = {};
    
    // Calculate frequencies
    for (const error of this.errorHistory) {
      // Type frequency
      typeFrequency[error.type] = (typeFrequency[error.type] || 0) + 1;
      
      // Component frequency
      componentFrequency[error.component] = (componentFrequency[error.component] || 0) + 1;
      
      // Type-Component frequency
      const typeComponent = `${error.type}:${error.component}`;
      typeComponentFrequency[typeComponent] = (typeComponentFrequency[typeComponent] || 0) + 1;
    }
    
    // Identify high-frequency error types
    for (const type in typeFrequency) {
      if (typeFrequency[type] >= 3) {
        patterns.push({
          type: 'frequent_error_type',
          errorType: type,
          count: typeFrequency[type],
          description: `Frequent errors of type ${type}`
        });
      }
    }
    
    // Identify problematic components
    for (const component in componentFrequency) {
      if (componentFrequency[component] >= 3) {
        patterns.push({
          type: 'problematic_component',
          component,
          count: componentFrequency[component],
          description: `Multiple errors in component ${component}`
        });
      }
    }
    
    // Identify specific type-component combinations
    for (const typeComponent in typeComponentFrequency) {
      if (typeComponentFrequency[typeComponent] >= 3) {
        const [type, component] = typeComponent.split(':');
        patterns.push({
          type: 'recurring_specific_error',
          errorType: type,
          component,
          count: typeComponentFrequency[typeComponent],
          description: `Recurring ${type} errors in ${component}`
        });
      }
    }
    
    // Sort patterns by count (descending)
    patterns.sort((a, b) => b.count - a.count);
    
    return patterns;
  }
  
  /**
   * Subscribes to error events.
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribeToErrors(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.events.on('error', callback);
    
    return () => {
      this.events.off('error', callback);
    };
  }
  
  /**
   * Subscribes to recovery success events.
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribeToRecoverySuccess(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.events.on('recoverySuccess', callback);
    
    return () => {
      this.events.off('recoverySuccess', callback);
    };
  }
  
  /**
   * Subscribes to recovery failure events.
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribeToRecoveryFailure(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.events.on('recoveryFailed', callback);
    
    return () => {
      this.events.off('recoveryFailed', callback);
    };
  }
  
  /**
   * Cleans up old error logs.
   * @returns {Promise<number>} - Number of files deleted
   */
  async cleanupErrorLogs() {
    try {
      // Get retention period from config if available
      let retentionDays = 30;
      if (this.options.configManager) {
        retentionDays = this.options.configManager.get('errorRecovery', 'errorLogRetention');
      }
      
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const files = await fs.promises.readdir(this.options.errorLogDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.startsWith('error-')) continue;
        
        const filePath = path.join(this.options.errorLogDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up error logs:', error);
      return 0;
    }
  }
  
  /**
   * Generates an error report for a specific time period.
   * @param {Object} options - Report options
   * @param {number} options.startTime - Start timestamp
   * @param {number} options.endTime - End timestamp
   * @param {boolean} options.includeDetails - Whether to include error details
   * @returns {Object} - Error report
   */
  generateErrorReport(options = {}) {
    const startTime = options.startTime || (Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const endTime = options.endTime || Date.now();
    const includeDetails = options.includeDetails !== undefined ? options.includeDetails : true;
    
    // Get errors in time range
    const errors = this.getErrorHistory({
      startTime,
      endTime
    });
    
    // Get recoveries in time range
    const recoveries = this.getRecoveryHistory({
      startTime,
      endTime
    });
    
    // Calculate statistics
    const totalErrors = errors.length;
    const totalRecoveries = recoveries.length;
    const successfulRecoveries = recoveries.filter(r => r.status !== 'recovery_failed').length;
    const recoveryRate = totalErrors > 0 ? (successfulRecoveries / totalErrors) * 100 : 0;
    
    // Count errors by type
    const errorsByType = {};
    for (const error of errors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }
    
    // Count errors by component
    const errorsByComponent = {};
    for (const error of errors) {
      errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
    }
    
    // Count errors by severity
    const errorsBySeverity = {};
    for (const error of errors) {
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }
    
    // Analyze patterns
    const patterns = this.analyzeErrorPatterns();
    
    // Build report
    const report = {
      timeRange: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        durationHours: (endTime - startTime) / (60 * 60 * 1000)
      },
      summary: {
        totalErrors,
        totalRecoveries,
        successfulRecoveries,
        recoveryRate: recoveryRate.toFixed(2) + '%',
        errorRate: totalErrors / (report.timeRange.durationHours || 1)
      },
      distribution: {
        byType: errorsByType,
        byComponent: errorsByComponent,
        bySeverity: errorsBySeverity
      },
      patterns: patterns.slice(0, 5), // Top 5 patterns
      recommendations: this.generateRecommendations(patterns)
    };
    
    // Add details if requested
    if (includeDetails) {
      report.details = {
        errors: errors.slice(0, 50), // Limit to 50 errors
        recoveries: recoveries.slice(0, 50) // Limit to 50 recoveries
      };
    }
    
    return report;
  }
  
  /**
   * Generates recommendations based on error patterns.
   * @param {Array<Object>} patterns - Error patterns
   * @returns {Array<string>} - Recommendations
   * @private
   */
  generateRecommendations(patterns) {
    const recommendations = [];
    
    for (const pattern of patterns) {
      if (pattern.type === 'frequent_error_type') {
        recommendations.push(
          `Review error handling for ${pattern.errorType} errors (occurred ${pattern.count} times)`
        );
      } else if (pattern.type === 'problematic_component') {
        recommendations.push(
          `Investigate stability issues in ${pattern.component} component (${pattern.count} errors)`
        );
      } else if (pattern.type === 'recurring_specific_error') {
        recommendations.push(
          `Fix recurring ${pattern.errorType} errors in ${pattern.component} (${pattern.count} occurrences)`
        );
      }
    }
    
    // Add general recommendations if needed
    if (patterns.length > 5) {
      recommendations.push('Consider a comprehensive review of error-prone components');
    }
    
    return recommendations;
  }
  
  /**
   * Stops the error recovery manager and performs cleanup.
   * @returns {Promise<void>}
   */
  async stop() {
    // Clean up error logs
    await this.cleanupErrorLogs();
  }
}

module.exports = ErrorRecoveryManager;
