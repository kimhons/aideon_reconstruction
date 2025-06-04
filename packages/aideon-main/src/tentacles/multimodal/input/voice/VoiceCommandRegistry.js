/**
 * @fileoverview VoiceCommandRegistry manages and executes voice commands
 * for the Aideon AI Desktop Agent. It provides a registry for voice commands
 * and handles their execution based on recognized intents.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { LogManager } = require('../../../core/logging/LogManager');
const { ConfigManager } = require('../../../core/config/ConfigManager');
const { SecurityManager } = require('../../../core/security/SecurityManager');
const { PerformanceTracker } = require('../../../core/performance/PerformanceTracker');

/**
 * Command execution status
 * @enum {string}
 */
const CommandExecutionStatus = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  PERMISSION_DENIED: 'permission_denied',
  NOT_FOUND: 'not_found',
  INVALID_PARAMETERS: 'invalid_parameters',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

/**
 * Command permission level
 * @enum {string}
 */
const CommandPermissionLevel = {
  PUBLIC: 'public',      // No authentication required
  USER: 'user',          // User authentication required
  ADMIN: 'admin',        // Admin authentication required
  SYSTEM: 'system'       // System-level access required
};

/**
 * VoiceCommandRegistry class
 * Manages and executes voice commands
 */
class VoiceCommandRegistry extends EventEmitter {
  /**
   * Create a new VoiceCommandRegistry
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Optional custom logger
   * @param {Object} [options.configManager] - Optional custom config manager
   * @param {Object} [options.securityManager] - Optional custom security manager
   * @param {Object} [options.performanceTracker] - Optional custom performance tracker
   */
  constructor(options = {}) {
    super();
    
    // Initialize system services
    this.logger = options.logger || LogManager.getLogger('VoiceCommandRegistry');
    this.configManager = options.configManager || ConfigManager.getInstance();
    this.securityManager = options.securityManager || SecurityManager.getInstance();
    this.performanceTracker = options.performanceTracker || new PerformanceTracker('VoiceCommandRegistry');
    
    // Initialize state
    this.config = {};
    this.initialized = false;
    this.commands = new Map();
    this.commandGroups = new Map();
    this.executionHistory = [];
    this.activeExecutions = new Map();
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.registerCommand = this.registerCommand.bind(this);
    this.unregisterCommand = this.unregisterCommand.bind(this);
    this.hasCommand = this.hasCommand.bind(this);
    this.executeCommand = this.executeCommand.bind(this);
    this.cancelExecution = this.cancelExecution.bind(this);
    this.getCommandInfo = this.getCommandInfo.bind(this);
    this.getCommandGroups = this.getCommandGroups.bind(this);
    this.getExecutionHistory = this.getExecutionHistory.bind(this);
    this._loadConfiguration = this._loadConfiguration.bind(this);
    this._registerBuiltInCommands = this._registerBuiltInCommands.bind(this);
    this._checkPermission = this._checkPermission.bind(this);
    this._validateParameters = this._validateParameters.bind(this);
    this._executeCommandInternal = this._executeCommandInternal.bind(this);
    
    this.logger.info('VoiceCommandRegistry created');
  }
  
  /**
   * Initialize the voice command registry
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization successful
   * @throws {Error} If initialization fails
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing voice command registry');
      this.performanceTracker.startTracking('initialize');
      
      // Load configuration
      await this._loadConfiguration(options);
      
      // Register built-in commands
      await this._registerBuiltInCommands();
      
      // Mark as initialized
      this.initialized = true;
      
      this.performanceTracker.stopTracking('initialize');
      this.logger.info('Voice command registry initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceTracker.stopTracking('initialize');
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Register a command
   * @param {string} intent - Intent that triggers the command
   * @param {Object} commandConfig - Command configuration
   * @param {Function} commandConfig.execute - Command execution function
   * @param {string} [commandConfig.description] - Command description
   * @param {string} [commandConfig.group] - Command group
   * @param {Array<Object>} [commandConfig.parameters] - Command parameters
   * @param {string} [commandConfig.permissionLevel] - Command permission level
   * @param {number} [commandConfig.timeout] - Command execution timeout in milliseconds
   * @returns {Promise<boolean>} - True if registration successful
   * @throws {Error} If registration fails
   */
  async registerCommand(intent, commandConfig) {
    try {
      if (!this.initialized) {
        throw new Error('VoiceCommandRegistry not initialized');
      }
      
      if (!intent) {
        throw new Error('Intent is required');
      }
      
      if (!commandConfig || typeof commandConfig.execute !== 'function') {
        throw new Error('Command configuration with execute function is required');
      }
      
      this.logger.debug(`Registering command for intent: ${intent}`);
      
      // Create command object
      const command = {
        intent,
        description: commandConfig.description || '',
        group: commandConfig.group || 'default',
        parameters: commandConfig.parameters || [],
        permissionLevel: commandConfig.permissionLevel || CommandPermissionLevel.PUBLIC,
        timeout: commandConfig.timeout || this.config.defaultCommandTimeout,
        execute: commandConfig.execute
      };
      
      // Add to commands map
      this.commands.set(intent, command);
      
      // Add to command group
      if (!this.commandGroups.has(command.group)) {
        this.commandGroups.set(command.group, []);
      }
      
      const groupCommands = this.commandGroups.get(command.group);
      if (!groupCommands.includes(intent)) {
        groupCommands.push(intent);
      }
      
      this.logger.debug(`Command registered for intent: ${intent}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register command for intent: ${intent}`, error);
      throw error;
    }
  }
  
  /**
   * Unregister a command
   * @param {string} intent - Intent that triggers the command
   * @returns {Promise<boolean>} - True if unregistration successful
   * @throws {Error} If unregistration fails
   */
  async unregisterCommand(intent) {
    try {
      if (!this.initialized) {
        throw new Error('VoiceCommandRegistry not initialized');
      }
      
      if (!intent) {
        throw new Error('Intent is required');
      }
      
      this.logger.debug(`Unregistering command for intent: ${intent}`);
      
      // Check if command exists
      if (!this.commands.has(intent)) {
        this.logger.warn(`Command not found for intent: ${intent}`);
        return false;
      }
      
      // Get command
      const command = this.commands.get(intent);
      
      // Remove from command group
      if (this.commandGroups.has(command.group)) {
        const groupCommands = this.commandGroups.get(command.group);
        const index = groupCommands.indexOf(intent);
        
        if (index !== -1) {
          groupCommands.splice(index, 1);
        }
        
        // Remove group if empty
        if (groupCommands.length === 0) {
          this.commandGroups.delete(command.group);
        }
      }
      
      // Remove from commands map
      this.commands.delete(intent);
      
      this.logger.debug(`Command unregistered for intent: ${intent}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister command for intent: ${intent}`, error);
      throw error;
    }
  }
  
  /**
   * Check if a command exists for an intent
   * @param {string} intent - Intent to check
   * @returns {boolean} - True if command exists
   */
  hasCommand(intent) {
    if (!this.initialized) {
      return false;
    }
    
    return this.commands.has(intent);
  }
  
  /**
   * Execute a command
   * @param {string} intent - Intent that triggers the command
   * @param {Object} [options] - Execution options
   * @param {Object} [options.entities] - Entities extracted from the command
   * @param {Object} [options.context] - Context for command execution
   * @param {string} [options.sessionId] - Session ID for the command
   * @param {string} [options.rawText] - Raw text of the command
   * @returns {Promise<Object>} - Execution result
   * @throws {Error} If execution fails
   */
  async executeCommand(intent, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('VoiceCommandRegistry not initialized');
      }
      
      if (!intent) {
        throw new Error('Intent is required');
      }
      
      this.logger.debug(`Executing command for intent: ${intent}`);
      this.performanceTracker.startTracking(`execute_${intent}`);
      
      // Check if command exists
      if (!this.commands.has(intent)) {
        this.logger.warn(`Command not found for intent: ${intent}`);
        
        const result = {
          status: CommandExecutionStatus.NOT_FOUND,
          message: `Command not found for intent: ${intent}`,
          timestamp: Date.now()
        };
        
        this._addToExecutionHistory(intent, options, result);
        this.performanceTracker.stopTracking(`execute_${intent}`);
        
        return result;
      }
      
      // Get command
      const command = this.commands.get(intent);
      
      // Check permission
      const permissionResult = await this._checkPermission(command.permissionLevel);
      
      if (!permissionResult.granted) {
        this.logger.warn(`Permission denied for command: ${intent}`);
        
        const result = {
          status: CommandExecutionStatus.PERMISSION_DENIED,
          message: permissionResult.message || 'Permission denied',
          timestamp: Date.now()
        };
        
        this._addToExecutionHistory(intent, options, result);
        this.performanceTracker.stopTracking(`execute_${intent}`);
        
        return result;
      }
      
      // Validate parameters
      const validationResult = this._validateParameters(command, options.entities);
      
      if (!validationResult.valid) {
        this.logger.warn(`Invalid parameters for command: ${intent}`);
        
        const result = {
          status: CommandExecutionStatus.INVALID_PARAMETERS,
          message: validationResult.message,
          missingParameters: validationResult.missingParameters,
          timestamp: Date.now()
        };
        
        this._addToExecutionHistory(intent, options, result);
        this.performanceTracker.stopTracking(`execute_${intent}`);
        
        return result;
      }
      
      // Execute command
      const executionId = uuidv4();
      
      // Create execution context
      const executionContext = {
        id: executionId,
        intent,
        entities: options.entities || {},
        context: options.context || {},
        sessionId: options.sessionId,
        rawText: options.rawText,
        timestamp: Date.now()
      };
      
      // Add to active executions
      this.activeExecutions.set(executionId, {
        intent,
        startTime: Date.now(),
        timeout: setTimeout(() => {
          this._handleExecutionTimeout(executionId);
        }, command.timeout)
      });
      
      // Execute command
      const result = await this._executeCommandInternal(command, executionContext);
      
      // Remove from active executions
      this._cleanupExecution(executionId);
      
      // Add to execution history
      this._addToExecutionHistory(intent, options, result);
      
      this.performanceTracker.stopTracking(`execute_${intent}`);
      
      return result;
    } catch (error) {
      this.performanceTracker.stopTracking(`execute_${intent}`);
      this.logger.error(`Failed to execute command for intent: ${intent}`, error);
      
      // Create error result
      const result = {
        status: CommandExecutionStatus.FAILURE,
        message: error.message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        timestamp: Date.now()
      };
      
      // Add to execution history
      this._addToExecutionHistory(intent, options, result);
      
      return result;
    }
  }
  
  /**
   * Cancel command execution
   * @param {string} executionId - Execution ID to cancel
   * @returns {Promise<boolean>} - True if cancellation successful
   * @throws {Error} If cancellation fails
   */
  async cancelExecution(executionId) {
    try {
      if (!this.initialized) {
        throw new Error('VoiceCommandRegistry not initialized');
      }
      
      if (!executionId) {
        throw new Error('Execution ID is required');
      }
      
      this.logger.debug(`Cancelling execution: ${executionId}`);
      
      // Check if execution exists
      if (!this.activeExecutions.has(executionId)) {
        this.logger.warn(`Execution not found: ${executionId}`);
        return false;
      }
      
      // Get execution
      const execution = this.activeExecutions.get(executionId);
      
      // Clean up execution
      this._cleanupExecution(executionId);
      
      // Add to execution history
      this._addToExecutionHistory(execution.intent, {}, {
        status: CommandExecutionStatus.CANCELLED,
        message: 'Execution cancelled',
        timestamp: Date.now()
      });
      
      this.logger.debug(`Execution cancelled: ${executionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel execution: ${executionId}`, error);
      throw error;
    }
  }
  
  /**
   * Get command information
   * @param {string} intent - Intent to get information for
   * @returns {Object|null} - Command information or null if not found
   */
  getCommandInfo(intent) {
    if (!this.initialized || !intent) {
      return null;
    }
    
    // Check if command exists
    if (!this.commands.has(intent)) {
      return null;
    }
    
    // Get command
    const command = this.commands.get(intent);
    
    // Return command info (without execute function)
    return {
      intent: command.intent,
      description: command.description,
      group: command.group,
      parameters: command.parameters,
      permissionLevel: command.permissionLevel,
      timeout: command.timeout
    };
  }
  
  /**
   * Get command groups
   * @returns {Object} - Command groups
   */
  getCommandGroups() {
    if (!this.initialized) {
      return {};
    }
    
    // Convert command groups map to object
    const groups = {};
    
    for (const [groupName, intents] of this.commandGroups.entries()) {
      groups[groupName] = intents.map(intent => this.getCommandInfo(intent));
    }
    
    return groups;
  }
  
  /**
   * Get execution history
   * @param {number} [limit] - Maximum number of history items to return
   * @returns {Array} - Execution history
   */
  getExecutionHistory(limit) {
    if (!this.initialized) {
      return [];
    }
    
    if (limit && limit > 0) {
      return this.executionHistory.slice(0, limit);
    }
    
    return [...this.executionHistory];
  }
  
  /**
   * Load configuration from config manager
   * @param {Object} options - Override options
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfiguration(options = {}) {
    // Get configuration from config manager
    const savedConfig = await this.configManager.getConfig('voiceCommandRegistry') || {};
    
    // Default configuration
    const defaultConfig = {
      // Command settings
      defaultCommandTimeout: 30000, // 30 seconds
      maxHistorySize: 100,
      
      // Permission settings
      requireAuthenticationForUserCommands: true,
      requireAuthenticationForAdminCommands: true,
      
      // Advanced settings
      enableCommandChaining: true,
      enableParameterValidation: true,
      enableCommandSuggestions: true
    };
    
    // Merge default with saved config and override options
    this.config = { ...defaultConfig, ...savedConfig, ...options };
    
    this.logger.debug('Configuration loaded', this.config);
  }
  
  /**
   * Register built-in commands
   * @private
   * @returns {Promise<void>}
   */
  async _registerBuiltInCommands() {
    try {
      this.logger.debug('Registering built-in commands');
      
      // Register help command
      await this.registerCommand('help', {
        description: 'Show available commands',
        group: 'system',
        permissionLevel: CommandPermissionLevel.PUBLIC,
        execute: async (context) => {
          const groups = this.getCommandGroups();
          
          return {
            status: CommandExecutionStatus.SUCCESS,
            message: 'Available commands',
            data: {
              groups
            }
          };
        }
      });
      
      // Register cancel command
      await this.registerCommand('cancel', {
        description: 'Cancel current operation',
        group: 'system',
        permissionLevel: CommandPermissionLevel.PUBLIC,
        execute: async (context) => {
          // Find active executions
          const activeExecutions = Array.from(this.activeExecutions.entries());
          
          if (activeExecutions.length === 0) {
            return {
              status: CommandExecutionStatus.SUCCESS,
              message: 'No active operations to cancel'
            };
          }
          
          // Cancel all active executions except this one
          const cancelledCount = await Promise.all(
            activeExecutions
              .filter(([id, execution]) => execution.intent !== 'cancel')
              .map(([id]) => this.cancelExecution(id))
          ).then(results => results.filter(Boolean).length);
          
          return {
            status: CommandExecutionStatus.SUCCESS,
            message: `Cancelled ${cancelledCount} operation(s)`
          };
        }
      });
      
      this.logger.debug('Built-in commands registered');
    } catch (error) {
      this.logger.error('Failed to register built-in commands', error);
      throw error;
    }
  }
  
  /**
   * Check permission for command execution
   * @param {string} permissionLevel - Permission level to check
   * @private
   * @returns {Promise<Object>} - Permission check result
   */
  async _checkPermission(permissionLevel) {
    try {
      // Public commands are always allowed
      if (permissionLevel === CommandPermissionLevel.PUBLIC) {
        return {
          granted: true
        };
      }
      
      // Check if authentication is required
      if (permissionLevel === CommandPermissionLevel.USER && 
          !this.config.requireAuthenticationForUserCommands) {
        return {
          granted: true
        };
      }
      
      // Check authentication
      const authResult = await this.securityManager.checkAuthentication();
      
      if (!authResult.authenticated) {
        return {
          granted: false,
          message: 'Authentication required'
        };
      }
      
      // Check permission level
      if (permissionLevel === CommandPermissionLevel.ADMIN && 
          !authResult.isAdmin && 
          this.config.requireAuthenticationForAdminCommands) {
        return {
          granted: false,
          message: 'Admin privileges required'
        };
      }
      
      if (permissionLevel === CommandPermissionLevel.SYSTEM && 
          !authResult.isSystem) {
        return {
          granted: false,
          message: 'System privileges required'
        };
      }
      
      return {
        granted: true
      };
    } catch (error) {
      this.logger.error('Permission check failed', error);
      
      return {
        granted: false,
        message: 'Permission check failed'
      };
    }
  }
  
  /**
   * Validate command parameters
   * @param {Object} command - Command to validate
   * @param {Object} entities - Entities extracted from the command
   * @private
   * @returns {Object} - Validation result
   */
  _validateParameters(command, entities = {}) {
    // Skip validation if disabled
    if (!this.config.enableParameterValidation) {
      return {
        valid: true
      };
    }
    
    // Check required parameters
    const missingParameters = [];
    
    for (const parameter of command.parameters) {
      if (parameter.required) {
        const entityType = parameter.entityType;
        const entityName = parameter.entityName;
        
        // Check if entity exists
        let found = false;
        
        if (entities[entityType]) {
          found = true;
        } else if (entityName && entities[entityName]) {
          found = true;
        }
        
        if (!found) {
          missingParameters.push(parameter);
        }
      }
    }
    
    if (missingParameters.length > 0) {
      return {
        valid: false,
        message: `Missing required parameters: ${missingParameters.map(p => p.name).join(', ')}`,
        missingParameters
      };
    }
    
    return {
      valid: true
    };
  }
  
  /**
   * Execute command internally
   * @param {Object} command - Command to execute
   * @param {Object} context - Execution context
   * @private
   * @returns {Promise<Object>} - Execution result
   */
  async _executeCommandInternal(command, context) {
    try {
      // Execute command
      const result = await command.execute(context);
      
      // Ensure result has status
      if (!result.status) {
        result.status = CommandExecutionStatus.SUCCESS;
      }
      
      // Add timestamp if not present
      if (!result.timestamp) {
        result.timestamp = Date.now();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Command execution failed: ${command.intent}`, error);
      
      return {
        status: CommandExecutionStatus.FAILURE,
        message: error.message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Handle execution timeout
   * @param {string} executionId - Execution ID that timed out
   * @private
   */
  _handleExecutionTimeout(executionId) {
    try {
      // Check if execution exists
      if (!this.activeExecutions.has(executionId)) {
        return;
      }
      
      this.logger.warn(`Execution timed out: ${executionId}`);
      
      // Get execution
      const execution = this.activeExecutions.get(executionId);
      
      // Clean up execution
      this._cleanupExecution(executionId);
      
      // Add to execution history
      this._addToExecutionHistory(execution.intent, {}, {
        status: CommandExecutionStatus.TIMEOUT,
        message: 'Execution timed out',
        timestamp: Date.now()
      });
      
      // Emit timeout event
      this.emit('executionTimeout', {
        executionId,
        intent: execution.intent,
        startTime: execution.startTime,
        duration: Date.now() - execution.startTime
      });
    } catch (error) {
      this.logger.error(`Failed to handle execution timeout: ${executionId}`, error);
    }
  }
  
  /**
   * Clean up execution
   * @param {string} executionId - Execution ID to clean up
   * @private
   */
  _cleanupExecution(executionId) {
    try {
      // Check if execution exists
      if (!this.activeExecutions.has(executionId)) {
        return;
      }
      
      // Get execution
      const execution = this.activeExecutions.get(executionId);
      
      // Clear timeout
      if (execution.timeout) {
        clearTimeout(execution.timeout);
      }
      
      // Remove from active executions
      this.activeExecutions.delete(executionId);
    } catch (error) {
      this.logger.error(`Failed to clean up execution: ${executionId}`, error);
    }
  }
  
  /**
   * Add to execution history
   * @param {string} intent - Intent that triggered the command
   * @param {Object} options - Execution options
   * @param {Object} result - Execution result
   * @private
   */
  _addToExecutionHistory(intent, options, result) {
    try {
      // Create history entry
      const entry = {
        intent,
        entities: options.entities,
        sessionId: options.sessionId,
        rawText: options.rawText,
        result,
        timestamp: Date.now()
      };
      
      // Add to history
      this.executionHistory.unshift(entry);
      
      // Limit history size
      if (this.executionHistory.length > this.config.maxHistorySize) {
        this.executionHistory = this.executionHistory.slice(0, this.config.maxHistorySize);
      }
      
      // Emit execution result event
      this.emit('executionResult', {
        intent,
        result,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Failed to add to execution history', error);
    }
  }
}

// Export constants and class
module.exports = {
  VoiceCommandRegistry,
  CommandExecutionStatus,
  CommandPermissionLevel
};
