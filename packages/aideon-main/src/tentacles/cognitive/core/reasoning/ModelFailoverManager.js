/**
 * @fileoverview Model Failover Manager for the Reasoning Engine.
 * 
 * This component provides robust failover capabilities between different LLM adapters
 * to ensure high availability and reliability of the reasoning engine. It monitors
 * adapter health, detects failures, and automatically routes requests to alternative
 * adapters based on configurable policies.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Model Failover Manager for the Reasoning Engine.
 */
class ModelFailoverManager extends EventEmitter {
  /**
   * Constructor for ModelFailoverManager.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.modelStrategyManager Model strategy manager
   * @param {Object} options.performanceAnalyzer Performance analyzer
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.storageManager Storage manager for persisting failover logs
   */
  constructor(options) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for ModelFailoverManager');
    if (!options.logger) throw new Error('Logger is required for ModelFailoverManager');
    if (!options.configService) throw new Error('ConfigService is required for ModelFailoverManager');
    if (!options.modelStrategyManager) throw new Error('ModelStrategyManager is required for ModelFailoverManager');
    if (!options.performanceAnalyzer) throw new Error('PerformanceAnalyzer is required for ModelFailoverManager');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for ModelFailoverManager');
    if (!options.storageManager) throw new Error('StorageManager is required for ModelFailoverManager');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.modelStrategyManager = options.modelStrategyManager;
    this.performanceAnalyzer = options.performanceAnalyzer;
    this.performanceMonitor = options.performanceMonitor;
    this.storageManager = options.storageManager;
    
    // Initialize failover state
    this.initialized = false;
    this.running = false;
    this.adapters = new Map();
    this.adapterHealth = new Map();
    this.failoverPolicies = new Map();
    this.failoverGroups = new Map();
    this.failoverHistory = [];
    this.config = null;
    this.healthCheckInterval = null;
    this.metrics = {
      totalFailovers: 0,
      successfulFailovers: 0,
      failedFailovers: 0,
      failoversByAdapter: {},
      failoversByReason: {},
      averageFailoverLatency: 0,
      totalFailoverLatency: 0,
      lastFailoverTimestamp: null
    };
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startHealthChecks = this.startHealthChecks.bind(this);
    this.stopHealthChecks = this.stopHealthChecks.bind(this);
    this.getFailoverTarget = this.getFailoverTarget.bind(this);
    this.executeFailover = this.executeFailover.bind(this);
    this.getFailoverHistory = this.getFailoverHistory.bind(this);
    this.getAdapterHealth = this.getAdapterHealth.bind(this);
    this.updateAdapterHealth = this.updateAdapterHealth.bind(this);
    this.getFailoverMetrics = this.getFailoverMetrics.bind(this);
    this._runHealthCheck = this._runHealthCheck.bind(this);
    this._evaluateAdapterHealth = this._evaluateAdapterHealth.bind(this);
    this._determineFailoverTarget = this._determineFailoverTarget.bind(this);
    this._logFailoverEvent = this._logFailoverEvent.bind(this);
    this._persistFailoverLogs = this._persistFailoverLogs.bind(this);
    this._loadFailoverHistory = this._loadFailoverHistory.bind(this);
    this._setupFailoverListeners = this._setupFailoverListeners.bind(this);
    
    this.logger.info('ModelFailoverManager created');
  }
  
  /**
   * Initialize the failover manager.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing ModelFailoverManager');
      this.performanceMonitor.startTimer('modelFailoverManager.initialize');
      
      // Load configuration
      this.config = await this.configService.getFailoverConfig();
      if (!this.config) {
        throw new Error('Failed to load configuration for ModelFailoverManager');
      }
      
      // Get available adapters from model strategy manager
      const availableAdapters = await this.modelStrategyManager.getAvailableAdapters();
      for (const adapter of availableAdapters) {
        this.adapters.set(adapter.id, adapter);
        
        // Initialize adapter health
        this.adapterHealth.set(adapter.id, {
          available: false,
          lastCheckTimestamp: null,
          consecutiveFailures: 0,
          status: 'unknown',
          errorMessage: null,
          metrics: {
            successRate: 0,
            averageLatency: 0,
            errorRate: 0
          },
          capabilities: adapter.getCapabilities()
        });
        
        // Initialize failover metrics
        this.metrics.failoversByAdapter[adapter.id] = 0;
      }
      
      // Load failover policies
      await this._loadFailoverPolicies();
      
      // Load failover groups
      await this._loadFailoverGroups();
      
      // Load failover history
      await this._loadFailoverHistory();
      
      // Set up failover listeners
      this._setupFailoverListeners();
      
      this.initialized = true;
      
      this.performanceMonitor.stopTimer('modelFailoverManager.initialize');
      this.logger.info('ModelFailoverManager initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('modelFailoverManager.initialize');
      this.logger.error(`Failed to initialize ModelFailoverManager: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Load failover policies from configuration.
   * @private
   * @returns {Promise<void>}
   */
  async _loadFailoverPolicies() {
    try {
      this.logger.info('Loading failover policies');
      
      // Clear existing policies
      this.failoverPolicies.clear();
      
      // Load policies from configuration
      const policies = this.config.failoverPolicies || [];
      
      for (const policy of policies) {
        this.failoverPolicies.set(policy.id, {
          id: policy.id,
          name: policy.name,
          description: policy.description,
          priority: policy.priority || 0,
          conditions: policy.conditions || [],
          actions: policy.actions || [],
          enabled: policy.enabled !== false
        });
      }
      
      // If no policies defined, create default policy
      if (this.failoverPolicies.size === 0) {
        const defaultPolicy = {
          id: 'default',
          name: 'Default Failover Policy',
          description: 'Default policy for handling adapter failures',
          priority: 0,
          conditions: [
            {
              type: 'availability',
              value: false
            }
          ],
          actions: [
            {
              type: 'failover',
              target: 'next_in_group'
            }
          ],
          enabled: true
        };
        
        this.failoverPolicies.set(defaultPolicy.id, defaultPolicy);
      }
      
      this.logger.info(`Loaded ${this.failoverPolicies.size} failover policies`);
    } catch (error) {
      this.logger.error(`Failed to load failover policies: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Load failover groups from configuration.
   * @private
   * @returns {Promise<void>}
   */
  async _loadFailoverGroups() {
    try {
      this.logger.info('Loading failover groups');
      
      // Clear existing groups
      this.failoverGroups.clear();
      
      // Load groups from configuration
      const groups = this.config.failoverGroups || [];
      
      for (const group of groups) {
        this.failoverGroups.set(group.id, {
          id: group.id,
          name: group.name,
          description: group.description,
          adapters: group.adapters || [],
          priority: group.priority || 0,
          enabled: group.enabled !== false
        });
      }
      
      // If no groups defined, create default group with all adapters
      if (this.failoverGroups.size === 0) {
        const defaultGroup = {
          id: 'default',
          name: 'Default Failover Group',
          description: 'Default group containing all adapters',
          adapters: Array.from(this.adapters.keys()),
          priority: 0,
          enabled: true
        };
        
        this.failoverGroups.set(defaultGroup.id, defaultGroup);
      }
      
      this.logger.info(`Loaded ${this.failoverGroups.size} failover groups`);
    } catch (error) {
      this.logger.error(`Failed to load failover groups: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Start periodic health checks.
   * @param {Object} [options] Health check options
   * @param {number} [options.interval] Health check interval in milliseconds
   * @returns {Promise<boolean>} True if health checks started successfully
   */
  async startHealthChecks(options = {}) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    if (this.running) {
      this.logger.warn('ModelFailoverManager health checks are already running');
      return true;
    }
    
    try {
      this.logger.info('Starting ModelFailoverManager health checks');
      
      // Set health check interval
      const interval = options.interval || this.config.healthCheckInterval || 60000; // 1 minute default
      
      // Run initial health check
      await this._runHealthCheck();
      
      // Set up periodic health checks
      this.healthCheckInterval = setInterval(this._runHealthCheck, interval);
      
      this.running = true;
      this.logger.info(`ModelFailoverManager health checks started with interval: ${interval}ms`);
      
      // Emit started event
      this.emit('healthChecksStarted', {
        timestamp: Date.now(),
        interval
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start ModelFailoverManager health checks: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'healthCheckStart',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Stop periodic health checks.
   * @returns {Promise<boolean>} True if health checks stopped successfully
   */
  async stopHealthChecks() {
    if (!this.running) {
      this.logger.warn('ModelFailoverManager health checks are not running');
      return true;
    }
    
    try {
      this.logger.info('Stopping ModelFailoverManager health checks');
      
      // Clear health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      this.running = false;
      this.logger.info('ModelFailoverManager health checks stopped');
      
      // Emit stopped event
      this.emit('healthChecksStopped', {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop ModelFailoverManager health checks: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'healthCheckStop',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Get failover target for a given adapter.
   * @param {string} adapterId Adapter ID
   * @param {Object} [options] Failover options
   * @param {string} [options.reason] Reason for failover
   * @param {string} [options.taskType] Type of task being processed
   * @param {Object} [options.context] Task context
   * @returns {Promise<string|null>} Target adapter ID or null if no suitable target found
   */
  async getFailoverTarget(adapterId, options = {}) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    try {
      this.logger.info(`Getting failover target for adapter: ${adapterId}`, { options });
      this.performanceMonitor.startTimer('modelFailoverManager.getFailoverTarget');
      
      // Check if adapter exists
      if (!this.adapters.has(adapterId)) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Determine failover target
      const target = await this._determineFailoverTarget(adapterId, options);
      
      this.performanceMonitor.stopTimer('modelFailoverManager.getFailoverTarget');
      
      if (target) {
        this.logger.info(`Failover target for ${adapterId}: ${target}`);
      } else {
        this.logger.warn(`No failover target found for ${adapterId}`);
      }
      
      return target;
    } catch (error) {
      this.performanceMonitor.stopTimer('modelFailoverManager.getFailoverTarget');
      this.logger.error(`Failed to get failover target for adapter ${adapterId}: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'getFailoverTarget',
        adapterId,
        message: error.message,
        error,
        options
      });
      
      return null;
    }
  }
  
  /**
   * Execute failover from one adapter to another.
   * @param {string} sourceAdapterId Source adapter ID
   * @param {string} targetAdapterId Target adapter ID
   * @param {Object} [options] Failover options
   * @param {string} [options.reason] Reason for failover
   * @param {string} [options.taskType] Type of task being processed
   * @param {Object} [options.context] Task context
   * @returns {Promise<boolean>} True if failover was successful
   */
  async executeFailover(sourceAdapterId, targetAdapterId, options = {}) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    try {
      this.logger.info(`Executing failover from ${sourceAdapterId} to ${targetAdapterId}`, { options });
      this.performanceMonitor.startTimer('modelFailoverManager.executeFailover');
      
      // Check if adapters exist
      if (!this.adapters.has(sourceAdapterId)) {
        throw new Error(`Source adapter not found: ${sourceAdapterId}`);
      }
      
      if (!this.adapters.has(targetAdapterId)) {
        throw new Error(`Target adapter not found: ${targetAdapterId}`);
      }
      
      // Check if target adapter is available
      const targetHealth = this.adapterHealth.get(targetAdapterId);
      if (!targetHealth || !targetHealth.available) {
        throw new Error(`Target adapter ${targetAdapterId} is not available`);
      }
      
      // Update metrics
      this.metrics.totalFailovers++;
      this.metrics.failoversByAdapter[sourceAdapterId] = (this.metrics.failoversByAdapter[sourceAdapterId] || 0) + 1;
      
      const reason = options.reason || 'unknown';
      this.metrics.failoversByReason[reason] = (this.metrics.failoversByReason[reason] || 0) + 1;
      
      // Log failover event
      const startTime = Date.now();
      await this._logFailoverEvent({
        sourceAdapterId,
        targetAdapterId,
        reason,
        taskType: options.taskType,
        context: options.context,
        timestamp: startTime,
        successful: true
      });
      
      const duration = Date.now() - startTime;
      
      // Update latency metrics
      this.metrics.totalFailoverLatency += duration;
      this.metrics.averageFailoverLatency = this.metrics.totalFailoverLatency / this.metrics.totalFailovers;
      this.metrics.lastFailoverTimestamp = Date.now();
      this.metrics.successfulFailovers++;
      
      this.performanceMonitor.stopTimer('modelFailoverManager.executeFailover');
      
      // Emit failover event
      this.emit('failover', {
        sourceAdapterId,
        targetAdapterId,
        reason,
        taskType: options.taskType,
        timestamp: Date.now(),
        duration
      });
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('modelFailoverManager.executeFailover');
      this.logger.error(`Failed to execute failover from ${sourceAdapterId} to ${targetAdapterId}: ${error.message}`, { error });
      
      // Update metrics
      this.metrics.failedFailovers++;
      
      // Log failover event
      await this._logFailoverEvent({
        sourceAdapterId,
        targetAdapterId,
        reason: options.reason || 'unknown',
        taskType: options.taskType,
        context: options.context,
        timestamp: Date.now(),
        successful: false,
        error: error.message
      });
      
      // Emit error event
      this.emit('error', {
        type: 'executeFailover',
        sourceAdapterId,
        targetAdapterId,
        message: error.message,
        error,
        options
      });
      
      return false;
    }
  }
  
  /**
   * Get failover history.
   * @param {Object} [options] History options
   * @param {number} [options.limit] Maximum number of history entries to return
   * @param {string} [options.adapterId] Filter history by adapter ID
   * @returns {Promise<Array<Object>>} Failover history
   */
  async getFailoverHistory(options = {}) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    try {
      this.logger.info('Getting failover history', { options });
      
      let history = [...this.failoverHistory];
      
      // Filter by adapter ID if provided
      if (options.adapterId) {
        history = history.filter(entry => 
          entry.sourceAdapterId === options.adapterId || 
          entry.targetAdapterId === options.adapterId
        );
      }
      
      // Sort by timestamp (newest first)
      history.sort((a, b) => b.timestamp - a.timestamp);
      
      // Limit results if specified
      if (options.limit && options.limit > 0) {
        history = history.slice(0, options.limit);
      }
      
      return history;
    } catch (error) {
      this.logger.error(`Failed to get failover history: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get health status for a specific adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<Object>} Adapter health status
   */
  async getAdapterHealth(adapterId) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    if (!adapterId) {
      throw new Error('Adapter ID is required');
    }
    
    try {
      this.logger.info('Getting adapter health', { adapterId });
      
      // Check if adapter exists
      if (!this.adapters.has(adapterId)) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Get adapter health
      const health = this.adapterHealth.get(adapterId);
      if (!health) {
        throw new Error(`Health status not found for adapter: ${adapterId}`);
      }
      
      return { ...health };
    } catch (error) {
      this.logger.error(`Failed to get adapter health: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Update health status for a specific adapter.
   * @param {string} adapterId Adapter ID
   * @param {Object} health Health status update
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateAdapterHealth(adapterId, health) {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    if (!adapterId) {
      throw new Error('Adapter ID is required');
    }
    
    if (!health) {
      throw new Error('Health status is required');
    }
    
    try {
      this.logger.info('Updating adapter health', { adapterId, health });
      
      // Check if adapter exists
      if (!this.adapters.has(adapterId)) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Get current health
      const currentHealth = this.adapterHealth.get(adapterId);
      if (!currentHealth) {
        throw new Error(`Health status not found for adapter: ${adapterId}`);
      }
      
      // Update health
      const updatedHealth = {
        ...currentHealth,
        ...health,
        lastCheckTimestamp: Date.now()
      };
      
      // Check if availability changed
      const availabilityChanged = currentHealth.available !== updatedHealth.available;
      
      // Update adapter health
      this.adapterHealth.set(adapterId, updatedHealth);
      
      // Emit health update event
      this.emit('healthUpdate', {
        adapterId,
        health: updatedHealth,
        availabilityChanged,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to update adapter health: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'updateAdapterHealth',
        adapterId,
        message: error.message,
        error,
        health
      });
      
      return false;
    }
  }
  
  /**
   * Get failover metrics.
   * @returns {Promise<Object>} Failover metrics
   */
  async getFailoverMetrics() {
    if (!this.initialized) {
      throw new Error('ModelFailoverManager is not initialized');
    }
    
    try {
      this.logger.info('Getting failover metrics');
      
      return { ...this.metrics };
    } catch (error) {
      this.logger.error(`Failed to get failover metrics: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Run health check on all adapters.
   * @private
   * @returns {Promise<void>}
   */
  async _runHealthCheck() {
    try {
      this.logger.info('Running health check on all adapters');
      this.performanceMonitor.startTimer('modelFailoverManager.runHealthCheck');
      
      // Check each adapter
      for (const [adapterId, adapter] of this.adapters.entries()) {
        try {
          // Get current health
          const currentHealth = this.adapterHealth.get(adapterId);
          
          // Check if adapter is available
          const isAvailable = await adapter.isAvailable();
          
          // Get adapter metrics from performance analyzer
          let metrics = {};
          try {
            const adapterMetrics = await this.performanceAnalyzer.getAdapterMetrics(adapterId);
            metrics = {
              successRate: adapterMetrics.totalRequests > 0 ? 
                adapterMetrics.successfulRequests / adapterMetrics.totalRequests : 0,
              averageLatency: adapterMetrics.averageLatency || 0,
              errorRate: adapterMetrics.totalRequests > 0 ? 
                adapterMetrics.failedRequests / adapterMetrics.totalRequests : 0
            };
          } catch (metricsError) {
            this.logger.warn(`Failed to get metrics for adapter ${adapterId}: ${metricsError.message}`);
          }
          
          // Update consecutive failures
          let consecutiveFailures = currentHealth.consecutiveFailures;
          if (isAvailable) {
            consecutiveFailures = 0;
          } else {
            consecutiveFailures++;
          }
          
          // Evaluate adapter health
          const status = this._evaluateAdapterHealth(isAvailable, consecutiveFailures, metrics);
          
          // Update adapter health
          await this.updateAdapterHealth(adapterId, {
            available: isAvailable,
            consecutiveFailures,
            status,
            errorMessage: isAvailable ? null : 'Adapter not available',
            metrics
          });
          
        } catch (adapterError) {
          this.logger.error(`Health check failed for adapter ${adapterId}: ${adapterError.message}`, { adapterError });
          
          // Update adapter health
          const currentHealth = this.adapterHealth.get(adapterId);
          const consecutiveFailures = (currentHealth.consecutiveFailures || 0) + 1;
          const status = this._evaluateAdapterHealth(false, consecutiveFailures, currentHealth.metrics);
          
          await this.updateAdapterHealth(adapterId, {
            available: false,
            consecutiveFailures,
            status,
            errorMessage: adapterError.message
          });
        }
      }
      
      this.performanceMonitor.stopTimer('modelFailoverManager.runHealthCheck');
      this.logger.info('Health check completed');
    } catch (error) {
      this.performanceMonitor.stopTimer('modelFailoverManager.runHealthCheck');
      this.logger.error(`Health check failed: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'healthCheck',
        message: error.message,
        error
      });
    }
  }
  
  /**
   * Evaluate adapter health status.
   * @private
   * @param {boolean} isAvailable Whether adapter is available
   * @param {number} consecutiveFailures Number of consecutive failures
   * @param {Object} metrics Adapter metrics
   * @returns {string} Health status
   */
  _evaluateAdapterHealth(isAvailable, consecutiveFailures, metrics) {
    if (!isAvailable) {
      if (consecutiveFailures >= this.config.criticalFailureThreshold || 5) {
        return 'critical';
      } else if (consecutiveFailures >= this.config.warningFailureThreshold || 2) {
        return 'warning';
      } else {
        return 'degraded';
      }
    }
    
    // Check metrics
    if (metrics) {
      const errorRateThreshold = this.config.errorRateThreshold || 0.1;
      const latencyThreshold = this.config.latencyThreshold || 2000;
      
      if (metrics.errorRate > errorRateThreshold || metrics.averageLatency > latencyThreshold) {
        return 'degraded';
      }
    }
    
    return 'healthy';
  }
  
  /**
   * Determine failover target for a given adapter.
   * @private
   * @param {string} adapterId Adapter ID
   * @param {Object} options Failover options
   * @returns {Promise<string|null>} Target adapter ID or null if no suitable target found
   */
  async _determineFailoverTarget(adapterId, options) {
    try {
      // Find adapter's failover group
      let adapterGroup = null;
      let adapterIndex = -1;
      
      for (const [groupId, group] of this.failoverGroups.entries()) {
        if (group.enabled && group.adapters.includes(adapterId)) {
          adapterGroup = group;
          adapterIndex = group.adapters.indexOf(adapterId);
          break;
        }
      }
      
      if (!adapterGroup) {
        this.logger.warn(`No failover group found for adapter ${adapterId}`);
        return null;
      }
      
      // Find applicable policy
      let applicablePolicy = null;
      
      // Sort policies by priority (highest first)
      const sortedPolicies = Array.from(this.failoverPolicies.values())
        .filter(policy => policy.enabled)
        .sort((a, b) => b.priority - a.priority);
      
      for (const policy of sortedPolicies) {
        // Check if policy conditions match
        let conditionsMatch = true;
        
        for (const condition of policy.conditions) {
          if (condition.type === 'availability') {
            const adapterHealth = this.adapterHealth.get(adapterId);
            if (adapterHealth.available !== condition.value) {
              conditionsMatch = false;
              break;
            }
          } else if (condition.type === 'error_rate') {
            const adapterHealth = this.adapterHealth.get(adapterId);
            if (!adapterHealth.metrics || adapterHealth.metrics.errorRate < condition.value) {
              conditionsMatch = false;
              break;
            }
          } else if (condition.type === 'consecutive_failures') {
            const adapterHealth = this.adapterHealth.get(adapterId);
            if (adapterHealth.consecutiveFailures < condition.value) {
              conditionsMatch = false;
              break;
            }
          } else if (condition.type === 'reason' && options.reason) {
            if (options.reason !== condition.value) {
              conditionsMatch = false;
              break;
            }
          } else if (condition.type === 'task_type' && options.taskType) {
            if (options.taskType !== condition.value) {
              conditionsMatch = false;
              break;
            }
          }
        }
        
        if (conditionsMatch) {
          applicablePolicy = policy;
          break;
        }
      }
      
      if (!applicablePolicy) {
        this.logger.warn(`No applicable failover policy found for adapter ${adapterId}`);
        return null;
      }
      
      // Apply policy actions
      for (const action of applicablePolicy.actions) {
        if (action.type === 'failover') {
          if (action.target === 'next_in_group') {
            // Find next available adapter in group
            const adapters = adapterGroup.adapters;
            for (let i = 1; i <= adapters.length; i++) {
              const nextIndex = (adapterIndex + i) % adapters.length;
              const nextAdapterId = adapters[nextIndex];
              
              // Skip original adapter
              if (nextAdapterId === adapterId) {
                continue;
              }
              
              // Check if adapter is available
              const adapterHealth = this.adapterHealth.get(nextAdapterId);
              if (adapterHealth && adapterHealth.available && adapterHealth.status !== 'critical') {
                return nextAdapterId;
              }
            }
          } else if (action.target === 'best_performer') {
            // Find best performing adapter in group
            let bestAdapterId = null;
            let bestScore = -Infinity;
            
            for (const candidateId of adapterGroup.adapters) {
              // Skip original adapter
              if (candidateId === adapterId) {
                continue;
              }
              
              // Check if adapter is available
              const adapterHealth = this.adapterHealth.get(candidateId);
              if (!adapterHealth || !adapterHealth.available || adapterHealth.status === 'critical') {
                continue;
              }
              
              // Calculate performance score
              const metrics = adapterHealth.metrics || {};
              const successRate = metrics.successRate || 0;
              const errorRate = metrics.errorRate || 1;
              const latency = metrics.averageLatency || 10000;
              
              // Score formula: higher success rate, lower error rate, lower latency is better
              const score = (successRate * 0.5) - (errorRate * 0.3) - (latency / 10000 * 0.2);
              
              if (score > bestScore) {
                bestScore = score;
                bestAdapterId = candidateId;
              }
            }
            
            if (bestAdapterId) {
              return bestAdapterId;
            }
          } else if (action.target === 'specific' && action.adapterId) {
            // Check if specific adapter is available
            const adapterHealth = this.adapterHealth.get(action.adapterId);
            if (adapterHealth && adapterHealth.available && adapterHealth.status !== 'critical') {
              return action.adapterId;
            }
          } else if (action.target === 'fallback_chain' && action.adapters) {
            // Try adapters in specified order
            for (const candidateId of action.adapters) {
              // Skip original adapter
              if (candidateId === adapterId) {
                continue;
              }
              
              // Check if adapter is available
              const adapterHealth = this.adapterHealth.get(candidateId);
              if (adapterHealth && adapterHealth.available && adapterHealth.status !== 'critical') {
                return candidateId;
              }
            }
          }
        }
      }
      
      // No suitable target found
      return null;
    } catch (error) {
      this.logger.error(`Failed to determine failover target for adapter ${adapterId}: ${error.message}`, { error });
      return null;
    }
  }
  
  /**
   * Log failover event.
   * @private
   * @param {Object} event Failover event
   * @returns {Promise<void>}
   */
  async _logFailoverEvent(event) {
    try {
      // Add event to history
      this.failoverHistory.push(event);
      
      // Limit history size
      if (this.failoverHistory.length > this.config.maxHistorySize || 1000) {
        this.failoverHistory = this.failoverHistory.slice(-this.config.maxHistorySize || -1000);
      }
      
      // Persist failover logs
      await this._persistFailoverLogs();
    } catch (error) {
      this.logger.error(`Failed to log failover event: ${error.message}`, { error });
      // Non-fatal error, continue without logging
    }
  }
  
  /**
   * Persist failover logs to storage.
   * @private
   * @returns {Promise<void>}
   */
  async _persistFailoverLogs() {
    try {
      // Prepare data to persist
      const data = {
        timestamp: Date.now(),
        metrics: this.metrics,
        history: this.failoverHistory.slice(-100) // Last 100 events
      };
      
      // Generate filename with timestamp
      const filename = `failover_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      // Persist to storage
      await this.storageManager.saveFailoverLogs('model_failover', filename, data);
    } catch (error) {
      this.logger.error(`Failed to persist failover logs: ${error.message}`, { error });
      // Non-fatal error, continue without persisting
    }
  }
  
  /**
   * Load failover history from storage.
   * @private
   * @returns {Promise<void>}
   */
  async _loadFailoverHistory() {
    try {
      // Get latest logs file
      const files = await this.storageManager.listFailoverLogs('model_failover');
      if (files.length === 0) {
        this.logger.info('No previous failover logs found');
        return;
      }
      
      // Sort files by timestamp (newest first)
      files.sort((a, b) => b.timestamp - a.timestamp);
      
      // Load latest file
      const latestFile = files[0];
      const data = await this.storageManager.loadFailoverLogs('model_failover', latestFile.filename);
      
      // Update metrics and history with loaded data
      if (data) {
        if (data.metrics) {
          this.metrics = {
            ...this.metrics,
            ...data.metrics
          };
        }
        
        if (data.history) {
          this.failoverHistory = data.history;
          this.logger.info(`Loaded failover history with ${data.history.length} entries`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load failover history: ${error.message}`, { error });
      // Non-fatal error, continue with empty history
    }
  }
  
  /**
   * Set up failover listeners for adapters.
   * @private
   * @returns {void}
   */
  _setupFailoverListeners() {
    try {
      this.logger.info('Setting up failover listeners');
      
      // Listen for adapter availability changes
      for (const [adapterId, adapter] of this.adapters.entries()) {
        if (adapter instanceof EventEmitter) {
          adapter.on('availabilityChanged', async (event) => {
            try {
              // Update adapter health
              await this.updateAdapterHealth(adapterId, {
                available: event.available,
                lastCheckTimestamp: Date.now(),
                errorMessage: event.available ? null : 'Adapter reported unavailability'
              });
              
              // If adapter became unavailable, check if failover is needed
              if (!event.available) {
                this.logger.warn(`Adapter ${adapterId} became unavailable, checking for failover options`);
                
                // Get failover target
                const target = await this.getFailoverTarget(adapterId, {
                  reason: 'availability_change'
                });
                
                if (target) {
                  this.logger.info(`Initiating failover from ${adapterId} to ${target} due to availability change`);
                  
                  // Execute failover
                  await this.executeFailover(adapterId, target, {
                    reason: 'availability_change'
                  });
                }
              }
            } catch (error) {
              this.logger.error(`Error handling availability change for adapter ${adapterId}: ${error.message}`, { error });
            }
          });
          
          adapter.on('error', async (errorEvent) => {
            try {
              // Get current health
              const currentHealth = this.adapterHealth.get(adapterId);
              const consecutiveFailures = (currentHealth.consecutiveFailures || 0) + 1;
              
              // Update adapter health
              await this.updateAdapterHealth(adapterId, {
                consecutiveFailures,
                errorMessage: errorEvent.message
              });
              
              // Check if failover threshold reached
              if (consecutiveFailures >= this.config.failoverErrorThreshold || 3) {
                this.logger.warn(`Adapter ${adapterId} reached error threshold (${consecutiveFailures} consecutive errors), checking for failover options`);
                
                // Get failover target
                const target = await this.getFailoverTarget(adapterId, {
                  reason: 'error_threshold',
                  taskType: errorEvent.taskType
                });
                
                if (target) {
                  this.logger.info(`Initiating failover from ${adapterId} to ${target} due to error threshold`);
                  
                  // Execute failover
                  await this.executeFailover(adapterId, target, {
                    reason: 'error_threshold',
                    taskType: errorEvent.taskType
                  });
                }
              }
            } catch (error) {
              this.logger.error(`Error handling error event for adapter ${adapterId}: ${error.message}`, { error });
            }
          });
        }
      }
      
      this.logger.info('Failover listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up failover listeners: ${error.message}`, { error });
      // Non-fatal error, continue without listeners
    }
  }
  
  /**
   * Shutdown the failover manager.
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down ModelFailoverManager');
      
      // Stop health checks if running
      if (this.running) {
        await this.stopHealthChecks();
      }
      
      // Persist final failover logs
      await this._persistFailoverLogs();
      
      this.initialized = false;
      this.logger.info('ModelFailoverManager shut down successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down ModelFailoverManager: ${error.message}`, { error });
      return false;
    }
  }
}

module.exports = ModelFailoverManager;
