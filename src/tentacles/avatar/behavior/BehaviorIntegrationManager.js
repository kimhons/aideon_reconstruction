/**
 * @fileoverview BehaviorIntegrationManager coordinates the integration of all behavior
 * components, ensuring cohesive avatar behavior across different systems and contexts.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Manager for avatar behavior integration
 */
class BehaviorIntegrationManager {
  /**
   * Creates a new BehaviorIntegrationManager instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   * @param {Object} [options.behaviorSystemManager=null] - BehaviorSystemManager instance
   * @param {Object} [options.behaviorRuleEngine=null] - BehaviorRuleEngine instance
   * @param {Object} [options.socialNormsManager=null] - SocialNormsManager instance
   * @param {Object} [options.conversationStyleManager=null] - ConversationStyleManager instance
   * @param {Object} [options.nonverbalBehaviorManager=null] - NonverbalBehaviorManager instance
   * @param {Object} [options.behaviorPersistenceManager=null] - BehaviorPersistenceManager instance
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('BehaviorIntegrationManager');
    this.events = new EventEmitter();
    
    // Component references
    this.behaviorSystemManager = options.behaviorSystemManager || null;
    this.behaviorRuleEngine = options.behaviorRuleEngine || null;
    this.socialNormsManager = options.socialNormsManager || null;
    this.conversationStyleManager = options.conversationStyleManager || null;
    this.nonverbalBehaviorManager = options.nonverbalBehaviorManager || null;
    this.behaviorPersistenceManager = options.behaviorPersistenceManager || null;
    
    // External system integrations
    this.externalIntegrations = new Map();
    
    // Integration state
    this.integrationState = {
      activeIntegrations: [],
      lastIntegrationEvent: null,
      pendingContextUpdates: new Map()
    };
    
    // Configuration
    this.config = {
      enableEmotionalInfluence: true,
      enablePersonalityInfluence: true,
      enableSocialInfluence: true,
      enableCrossComponentSync: true,
      behaviorPrioritization: 'weighted', // 'weighted', 'rule-based', 'context-driven'
      integrationFrequency: 'high', // 'low', 'medium', 'high', 'real-time'
      conflictResolutionStrategy: 'priority', // 'priority', 'blend', 'context-dependent'
      loggingLevel: 'info' // 'error', 'warn', 'info', 'debug'
    };
    
    // Integration timers
    this.timers = {
      contextSync: null
    };
    
    this.isInitialized = false;
    
    this.logger.info('BehaviorIntegrationManager created');
  }
  
  /**
   * Initializes the behavior integration manager
   * 
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.configuration] - Manager configuration
   * @param {Object} [options.components] - Component references
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'behavior_integration_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('BehaviorIntegrationManager already initialized');
        return;
      }
      
      this.logger.info('Initializing BehaviorIntegrationManager');
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Set component references if provided
      if (options.components) {
        if (options.components.behaviorSystemManager) {
          this.behaviorSystemManager = options.components.behaviorSystemManager;
        }
        if (options.components.behaviorRuleEngine) {
          this.behaviorRuleEngine = options.components.behaviorRuleEngine;
        }
        if (options.components.socialNormsManager) {
          this.socialNormsManager = options.components.socialNormsManager;
        }
        if (options.components.conversationStyleManager) {
          this.conversationStyleManager = options.components.conversationStyleManager;
        }
        if (options.components.nonverbalBehaviorManager) {
          this.nonverbalBehaviorManager = options.components.nonverbalBehaviorManager;
        }
        if (options.components.behaviorPersistenceManager) {
          this.behaviorPersistenceManager = options.components.behaviorPersistenceManager;
        }
      }
      
      // Validate required components
      this._validateComponents();
      
      // Register event listeners for components
      this._registerComponentEventListeners();
      
      // Start context synchronization if enabled
      if (this.config.enableCrossComponentSync) {
        this._startContextSynchronization();
      }
      
      this.isInitialized = true;
      this.events.emit('initialized');
      this.logger.info('BehaviorIntegrationManager initialized');
    } catch (error) {
      this.logger.error('Error initializing BehaviorIntegrationManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Integrates behavior components for a specific context
   * 
   * @param {string} userId - User identifier
   * @param {Object} context - Integration context
   * @param {Object} [options] - Integration options
   * @returns {Promise<Object>} Integrated behavior response
   */
  async integrateBehaviors(userId, context, options = {}) {
    const lockKey = `integrate_behaviors_${userId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Integrating behaviors', { 
        userId, contextTypes: Object.keys(context) 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }
      
      // Process context through behavior rule engine
      let processedContext = context;
      if (this.behaviorRuleEngine) {
        processedContext = await this.behaviorRuleEngine.processContext(userId, context);
      }
      
      // Apply social norms if available
      if (this.socialNormsManager && this.config.enableSocialInfluence) {
        processedContext = await this._applySocialNorms(userId, processedContext);
      }
      
      // Create integrated behavior response
      const integratedBehavior = {
        userId,
        timestamp: Date.now(),
        conversationStyle: null,
        nonverbalBehavior: null,
        socialContext: null,
        emotionalState: null,
        metadata: {
          integrationStrategy: this.config.behaviorPrioritization,
          conflictResolution: this.config.conflictResolutionStrategy,
          contextTypes: Object.keys(processedContext)
        }
      };
      
      // Integrate conversation style
      if (this.conversationStyleManager) {
        integratedBehavior.conversationStyle = await this._integrateConversationStyle(
          userId, processedContext
        );
      }
      
      // Integrate nonverbal behavior
      if (this.nonverbalBehaviorManager) {
        integratedBehavior.nonverbalBehavior = await this._integrateNonverbalBehavior(
          userId, processedContext
        );
      }
      
      // Extract social context
      if (processedContext.social) {
        integratedBehavior.socialContext = processedContext.social;
      }
      
      // Extract emotional state
      if (processedContext.emotional) {
        integratedBehavior.emotionalState = processedContext.emotional.emotionalState;
      }
      
      // Resolve conflicts if any
      await this._resolveConflicts(integratedBehavior);
      
      // Persist behavior if persistence manager is available
      if (this.behaviorPersistenceManager) {
        await this._persistIntegratedBehavior(userId, integratedBehavior);
      }
      
      // Update integration state
      this.integrationState.lastIntegrationEvent = {
        userId,
        timestamp: Date.now(),
        contextTypes: Object.keys(processedContext)
      };
      
      // Emit event
      this.events.emit('behaviors_integrated', integratedBehavior);
      
      return integratedBehavior;
    } catch (error) {
      this.logger.error('Error integrating behaviors', { 
        error, userId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Registers an external system integration
   * 
   * @param {string} systemId - External system identifier
   * @param {Object} integration - Integration configuration
   * @returns {Promise<Object>} Registered integration
   */
  async registerExternalIntegration(systemId, integration) {
    const lockKey = `register_integration_${systemId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Registering external integration', { systemId });
      
      // Validate inputs
      if (!systemId) {
        throw new Error('System ID is required');
      }
      if (!integration || typeof integration !== 'object') {
        throw new Error('Integration configuration must be an object');
      }
      
      // Validate integration configuration
      this._validateIntegrationConfig(integration);
      
      // Create integration object with metadata
      const registeredIntegration = {
        id: systemId,
        ...integration,
        registered: Date.now(),
        lastUpdated: Date.now(),
        status: 'active'
      };
      
      // Store integration
      this.externalIntegrations.set(systemId, registeredIntegration);
      
      // Update integration state
      this.integrationState.activeIntegrations.push(systemId);
      
      // Emit event
      this.events.emit('integration_registered', {
        systemId,
        integration: registeredIntegration
      });
      
      return registeredIntegration;
    } catch (error) {
      this.logger.error('Error registering external integration', { 
        error, systemId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Unregisters an external system integration
   * 
   * @param {string} systemId - External system identifier
   * @returns {Promise<boolean>} Whether unregistration was successful
   */
  async unregisterExternalIntegration(systemId) {
    const lockKey = `unregister_integration_${systemId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Unregistering external integration', { systemId });
      
      // Check if integration exists
      if (!this.externalIntegrations.has(systemId)) {
        return false;
      }
      
      // Remove integration
      this.externalIntegrations.delete(systemId);
      
      // Update integration state
      const index = this.integrationState.activeIntegrations.indexOf(systemId);
      if (index !== -1) {
        this.integrationState.activeIntegrations.splice(index, 1);
      }
      
      // Emit event
      this.events.emit('integration_unregistered', { systemId });
      
      return true;
    } catch (error) {
      this.logger.error('Error unregistering external integration', { 
        error, systemId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Processes context update from an external system
   * 
   * @param {string} systemId - External system identifier
   * @param {string} userId - User identifier
   * @param {Object} contextUpdate - Context update data
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processExternalContextUpdate(systemId, userId, contextUpdate, options = {}) {
    const lockKey = `process_context_${systemId}_${userId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Processing external context update', { 
        systemId, userId, contextTypes: Object.keys(contextUpdate) 
      });
      
      // Validate inputs
      if (!systemId) {
        throw new Error('System ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!contextUpdate || typeof contextUpdate !== 'object') {
        throw new Error('Context update must be an object');
      }
      
      // Check if integration exists
      if (!this.externalIntegrations.has(systemId)) {
        throw new Error(`External integration not found: ${systemId}`);
      }
      
      // Get integration configuration
      const integration = this.externalIntegrations.get(systemId);
      
      // Create context update entry
      const updateEntry = {
        systemId,
        userId,
        timestamp: Date.now(),
        contextTypes: Object.keys(contextUpdate),
        data: contextUpdate,
        status: 'pending',
        priority: integration.priority || 'medium'
      };
      
      // Store pending update
      if (!this.integrationState.pendingContextUpdates.has(userId)) {
        this.integrationState.pendingContextUpdates.set(userId, []);
      }
      this.integrationState.pendingContextUpdates.get(userId).push(updateEntry);
      
      // Process update immediately if requested
      let result = { status: 'queued' };
      if (options.processImmediately) {
        result = await this._processContextUpdate(userId, updateEntry);
      }
      
      // Emit event
      this.events.emit('external_context_received', {
        systemId,
        userId,
        contextTypes: Object.keys(contextUpdate)
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error processing external context update', { 
        error, systemId, userId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Synchronizes context across all behavior components
   * 
   * @param {string} userId - User identifier
   * @param {Object} [options] - Synchronization options
   * @returns {Promise<Object>} Sync result
   */
  async synchronizeContext(userId, options = {}) {
    const lockKey = `sync_context_${userId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Synchronizing context across components', { userId });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Process any pending context updates
      await this._processPendingContextUpdates(userId);
      
      // Collect current context from all components
      const collectedContext = await this._collectComponentContext(userId);
      
      // Create sync result
      const syncResult = {
        userId,
        timestamp: Date.now(),
        syncedComponents: Object.keys(collectedContext),
        contextUpdates: {}
      };
      
      // Distribute context to components
      if (this.conversationStyleManager && collectedContext.emotional) {
        await this.conversationStyleManager.updateExternalContext(
          'emotional', collectedContext.emotional
        );
        syncResult.contextUpdates.conversationStyle = ['emotional'];
      }
      
      if (this.conversationStyleManager && collectedContext.social) {
        await this.conversationStyleManager.updateExternalContext(
          'social', collectedContext.social
        );
        syncResult.contextUpdates.conversationStyle = 
          [...(syncResult.contextUpdates.conversationStyle || []), 'social'];
      }
      
      if (this.nonverbalBehaviorManager && collectedContext.emotional) {
        await this.nonverbalBehaviorManager.updateExternalContext(
          'emotional', collectedContext.emotional
        );
        syncResult.contextUpdates.nonverbalBehavior = ['emotional'];
      }
      
      if (this.nonverbalBehaviorManager && collectedContext.conversation) {
        await this.nonverbalBehaviorManager.updateExternalContext(
          'conversation', collectedContext.conversation
        );
        syncResult.contextUpdates.nonverbalBehavior = 
          [...(syncResult.contextUpdates.nonverbalBehavior || []), 'conversation'];
      }
      
      if (this.nonverbalBehaviorManager && collectedContext.social) {
        await this.nonverbalBehaviorManager.updateExternalContext(
          'social', collectedContext.social
        );
        syncResult.contextUpdates.nonverbalBehavior = 
          [...(syncResult.contextUpdates.nonverbalBehavior || []), 'social'];
      }
      
      // Emit event
      this.events.emit('context_synchronized', syncResult);
      
      return syncResult;
    } catch (error) {
      this.logger.error('Error synchronizing context', { 
        error, userId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets integration state
   * 
   * @returns {Object} Current integration state
   */
  getIntegrationState() {
    return {
      activeIntegrations: [...this.integrationState.activeIntegrations],
      lastIntegrationEvent: this.integrationState.lastIntegrationEvent,
      pendingUpdatesCount: Array.from(this.integrationState.pendingContextUpdates.values())
        .reduce((total, updates) => total + updates.length, 0)
    };
  }
  
  /**
   * Updates manager configuration
   * 
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(configUpdates) {
    const lockKey = 'update_behavior_integration_config';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorIntegrationManager not initialized');
      }
      
      this.logger.debug('Updating configuration', { 
        updateKeys: Object.keys(configUpdates) 
      });
      
      const oldConfig = { ...this.config };
      
      // Update configuration
      this.config = {
        ...this.config,
        ...configUpdates
      };
      
      // Handle cross-component sync changes
      if (oldConfig.enableCrossComponentSync !== this.config.enableCrossComponentSync) {
        if (this.config.enableCrossComponentSync) {
          this._startContextSynchronization();
        } else {
          this._stopContextSynchronization();
        }
      }
      
      // Update logger level if changed
      if (oldConfig.loggingLevel !== this.config.loggingLevel) {
        this.logger.setLevel(this.config.loggingLevel);
      }
      
      // Emit event
      this.events.emit('config_updated', this.config);
      
      return { ...this.config };
    } catch (error) {
      this.logger.error('Error updating configuration', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets current manager configuration
   * 
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Registers an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  
  /**
   * Shuts down the behavior integration manager
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = 'behavior_integration_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('BehaviorIntegrationManager not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down BehaviorIntegrationManager');
      
      // Stop context synchronization
      this._stopContextSynchronization();
      
      // Unregister component event listeners
      this._unregisterComponentEventListeners();
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('BehaviorIntegrationManager shut down');
    } catch (error) {
      this.logger.error('Error shutting down BehaviorIntegrationManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Validates required components
   * 
   * @private
   * @throws {Error} If required components are missing
   */
  _validateComponents() {
    // BehaviorSystemManager is required
    if (!this.behaviorSystemManager) {
      throw new Error('BehaviorSystemManager is required');
    }
    
    // Log warnings for missing optional components
    if (!this.behaviorRuleEngine) {
      this.logger.warn('BehaviorRuleEngine not provided, rule-based behavior processing will be limited');
    }
    
    if (!this.socialNormsManager) {
      this.logger.warn('SocialNormsManager not provided, social norm enforcement will be disabled');
    }
    
    if (!this.conversationStyleManager) {
      this.logger.warn('ConversationStyleManager not provided, conversation style integration will be disabled');
    }
    
    if (!this.nonverbalBehaviorManager) {
      this.logger.warn('NonverbalBehaviorManager not provided, nonverbal behavior integration will be disabled');
    }
    
    if (!this.behaviorPersistenceManager) {
      this.logger.warn('BehaviorPersistenceManager not provided, behavior persistence will be disabled');
    }
  }
  
  /**
   * Registers event listeners for components
   * 
   * @private
   */
  _registerComponentEventListeners() {
    // BehaviorSystemManager events
    if (this.behaviorSystemManager) {
      this.behaviorSystemManager.on('behavior_updated', this._handleBehaviorSystemUpdate.bind(this));
    }
    
    // BehaviorRuleEngine events
    if (this.behaviorRuleEngine) {
      this.behaviorRuleEngine.on('rules_applied', this._handleRulesApplied.bind(this));
    }
    
    // SocialNormsManager events
    if (this.socialNormsManager) {
      this.socialNormsManager.on('norm_applied', this._handleNormApplied.bind(this));
    }
    
    // ConversationStyleManager events
    if (this.conversationStyleManager) {
      this.conversationStyleManager.on('style_adapted', this._handleStyleAdapted.bind(this));
    }
    
    // NonverbalBehaviorManager events
    if (this.nonverbalBehaviorManager) {
      this.nonverbalBehaviorManager.on('behaviors_generated', this._handleBehaviorsGenerated.bind(this));
    }
    
    this.logger.debug('Component event listeners registered');
  }
  
  /**
   * Unregisters event listeners for components
   * 
   * @private
   */
  _unregisterComponentEventListeners() {
    // BehaviorSystemManager events
    if (this.behaviorSystemManager) {
      this.behaviorSystemManager.off('behavior_updated', this._handleBehaviorSystemUpdate.bind(this));
    }
    
    // BehaviorRuleEngine events
    if (this.behaviorRuleEngine) {
      this.behaviorRuleEngine.off('rules_applied', this._handleRulesApplied.bind(this));
    }
    
    // SocialNormsManager events
    if (this.socialNormsManager) {
      this.socialNormsManager.off('norm_applied', this._handleNormApplied.bind(this));
    }
    
    // ConversationStyleManager events
    if (this.conversationStyleManager) {
      this.conversationStyleManager.off('style_adapted', this._handleStyleAdapted.bind(this));
    }
    
    // NonverbalBehaviorManager events
    if (this.nonverbalBehaviorManager) {
      this.nonverbalBehaviorManager.off('behaviors_generated', this._handleBehaviorsGenerated.bind(this));
    }
    
    this.logger.debug('Component event listeners unregistered');
  }
  
  /**
   * Starts context synchronization
   * 
   * @private
   */
  _startContextSynchronization() {
    if (this.timers.contextSync) {
      clearInterval(this.timers.contextSync);
    }
    
    // Determine sync interval based on integration frequency
    let interval = 60000; // Default: 1 minute (medium)
    
    if (this.config.integrationFrequency === 'low') {
      interval = 300000; // 5 minutes
    } else if (this.config.integrationFrequency === 'high') {
      interval = 15000; // 15 seconds
    } else if (this.config.integrationFrequency === 'real-time') {
      interval = 5000; // 5 seconds
    }
    
    this.timers.contextSync = setInterval(async () => {
      try {
        // Process pending context updates for all users
        for (const userId of this.integrationState.pendingContextUpdates.keys()) {
          await this._processPendingContextUpdates(userId);
        }
      } catch (error) {
        this.logger.error('Error in context synchronization', { error });
      }
    }, interval);
    
    this.logger.debug('Context synchronization started', { interval });
  }
  
  /**
   * Stops context synchronization
   * 
   * @private
   */
  _stopContextSynchronization() {
    if (this.timers.contextSync) {
      clearInterval(this.timers.contextSync);
      this.timers.contextSync = null;
      this.logger.debug('Context synchronization stopped');
    }
  }
  
  /**
   * Applies social norms to context
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {Object} context - Context to apply norms to
   * @returns {Promise<Object>} Context with norms applied
   */
  async _applySocialNorms(userId, context) {
    try {
      if (!this.socialNormsManager) {
        return context;
      }
      
      // Extract social context if available
      const socialContext = context.social || {};
      
      // Apply norms
      const normsResult = await this.socialNormsManager.applyNorms(
        userId, socialContext, { contextData: context }
      );
      
      // Update context with norm-adjusted social context
      return {
        ...context,
        social: normsResult.adjustedContext
      };
    } catch (error) {
      this.logger.error('Error applying social norms', { error, userId });
      return context;
    }
  }
  
  /**
   * Integrates conversation style
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {Object} context - Integration context
   * @returns {Promise<Object>} Integrated conversation style
   */
  async _integrateConversationStyle(userId, context) {
    try {
      if (!this.conversationStyleManager) {
        return null;
      }
      
      // Update external context in conversation style manager
      if (context.emotional && this.config.enableEmotionalInfluence) {
        await this.conversationStyleManager.updateExternalContext(
          'emotional', context.emotional
        );
      }
      
      if (context.social && this.config.enableSocialInfluence) {
        await this.conversationStyleManager.updateExternalContext(
          'social', context.social
        );
      }
      
      if (context.personality && this.config.enablePersonalityInfluence) {
        await this.conversationStyleManager.updateExternalContext(
          'personality', context.personality
        );
      }
      
      // Adapt style based on updated context
      const adaptedStyle = await this.conversationStyleManager.adaptStyle();
      
      return adaptedStyle;
    } catch (error) {
      this.logger.error('Error integrating conversation style', { error, userId });
      return null;
    }
  }
  
  /**
   * Integrates nonverbal behavior
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {Object} context - Integration context
   * @returns {Promise<Object>} Integrated nonverbal behavior
   */
  async _integrateNonverbalBehavior(userId, context) {
    try {
      if (!this.nonverbalBehaviorManager) {
        return null;
      }
      
      // Generate behaviors based on context
      const behaviors = await this.nonverbalBehaviorManager.generateBehaviors(context);
      
      return behaviors;
    } catch (error) {
      this.logger.error('Error integrating nonverbal behavior', { error, userId });
      return null;
    }
  }
  
  /**
   * Resolves conflicts between behavior components
   * 
   * @private
   * @param {Object} integratedBehavior - Integrated behavior to resolve conflicts in
   * @returns {Promise<void>}
   */
  async _resolveConflicts(integratedBehavior) {
    try {
      // No conflicts to resolve if components are missing
      if (!integratedBehavior.conversationStyle || !integratedBehavior.nonverbalBehavior) {
        return;
      }
      
      // Apply conflict resolution strategy
      if (this.config.conflictResolutionStrategy === 'priority') {
        this._applyPriorityBasedResolution(integratedBehavior);
      } else if (this.config.conflictResolutionStrategy === 'blend') {
        this._applyBlendingResolution(integratedBehavior);
      } else if (this.config.conflictResolutionStrategy === 'context-dependent') {
        this._applyContextDependentResolution(integratedBehavior);
      }
    } catch (error) {
      this.logger.error('Error resolving conflicts', { error });
    }
  }
  
  /**
   * Applies priority-based conflict resolution
   * 
   * @private
   * @param {Object} integratedBehavior - Integrated behavior to resolve conflicts in
   */
  _applyPriorityBasedResolution(integratedBehavior) {
    // Example: If emotional context has high intensity, prioritize nonverbal behavior
    if (integratedBehavior.emotionalState && 
        Math.abs(integratedBehavior.emotionalState.valence) > 0.7) {
      
      // Adjust conversation style to be more aligned with nonverbal behavior
      if (integratedBehavior.conversationStyle && 
          integratedBehavior.conversationStyle.parameters) {
        
        // Increase emotional expression in conversation style
        integratedBehavior.conversationStyle.parameters.emotionalExpression = 
          Math.max(0.7, integratedBehavior.conversationStyle.parameters.emotionalExpression || 0.5);
      }
    }
    
    // Example: In formal social contexts, prioritize conversation style
    if (integratedBehavior.socialContext && 
        integratedBehavior.socialContext.formality > 0.7) {
      
      // Adjust nonverbal behavior to be more aligned with conversation style
      if (integratedBehavior.nonverbalBehavior && 
          integratedBehavior.nonverbalBehavior.facial) {
        
        // Reduce intensity of facial expressions
        integratedBehavior.nonverbalBehavior.facial.parameters.intensity = 
          Math.min(0.5, integratedBehavior.nonverbalBehavior.facial.parameters.intensity || 0.7);
      }
    }
  }
  
  /**
   * Applies blending-based conflict resolution
   * 
   * @private
   * @param {Object} integratedBehavior - Integrated behavior to resolve conflicts in
   */
  _applyBlendingResolution(integratedBehavior) {
    // Example: Blend emotional expression between conversation and nonverbal
    if (integratedBehavior.conversationStyle && 
        integratedBehavior.conversationStyle.parameters &&
        integratedBehavior.nonverbalBehavior && 
        integratedBehavior.nonverbalBehavior.facial) {
      
      const conversationEmotionLevel = 
        integratedBehavior.conversationStyle.parameters.emotionalExpression || 0.5;
      
      const nonverbalEmotionLevel = 
        integratedBehavior.nonverbalBehavior.facial.parameters.intensity || 0.7;
      
      // Calculate blended value
      const blendedEmotionLevel = (conversationEmotionLevel + nonverbalEmotionLevel) / 2;
      
      // Apply blended values
      integratedBehavior.conversationStyle.parameters.emotionalExpression = blendedEmotionLevel;
      integratedBehavior.nonverbalBehavior.facial.parameters.intensity = blendedEmotionLevel;
    }
  }
  
  /**
   * Applies context-dependent conflict resolution
   * 
   * @private
   * @param {Object} integratedBehavior - Integrated behavior to resolve conflicts in
   */
  _applyContextDependentResolution(integratedBehavior) {
    // Example: Use social context to determine resolution strategy
    if (integratedBehavior.socialContext) {
      const formality = integratedBehavior.socialContext.formality || 0.5;
      
      if (formality > 0.7) {
        // In formal contexts, use priority-based resolution
        this._applyPriorityBasedResolution(integratedBehavior);
      } else {
        // In informal contexts, use blending resolution
        this._applyBlendingResolution(integratedBehavior);
      }
    } else {
      // Default to blending if no social context
      this._applyBlendingResolution(integratedBehavior);
    }
  }
  
  /**
   * Persists integrated behavior
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {Object} integratedBehavior - Integrated behavior to persist
   * @returns {Promise<void>}
   */
  async _persistIntegratedBehavior(userId, integratedBehavior) {
    try {
      if (!this.behaviorPersistenceManager) {
        return;
      }
      
      // Record behavior history
      await this.behaviorPersistenceManager.recordHistory(
        userId, 'integrated_behavior', integratedBehavior
      );
      
      // Store conversation style preference if significant change
      if (integratedBehavior.conversationStyle) {
        const currentPreference = await this.behaviorPersistenceManager.getPreference(
          userId, 'conversation_style'
        );
        
        // Check if preference exists and is significantly different
        if (!currentPreference || 
            this._isSignificantStyleChange(
              currentPreference.data, integratedBehavior.conversationStyle
            )) {
          await this.behaviorPersistenceManager.storePreference(
            userId, 'conversation_style', integratedBehavior.conversationStyle
          );
        }
      }
    } catch (error) {
      this.logger.error('Error persisting integrated behavior', { error, userId });
    }
  }
  
  /**
   * Processes pending context updates for a user
   * 
   * @private
   * @param {string} userId - User identifier
   * @returns {Promise<void>}
   */
  async _processPendingContextUpdates(userId) {
    try {
      // Check if user has pending updates
      if (!this.integrationState.pendingContextUpdates.has(userId) || 
          this.integrationState.pendingContextUpdates.get(userId).length === 0) {
        return;
      }
      
      // Get pending updates
      const pendingUpdates = this.integrationState.pendingContextUpdates.get(userId);
      
      // Sort by priority and timestamp
      pendingUpdates.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        return a.timestamp - b.timestamp;
      });
      
      // Process updates
      for (const update of pendingUpdates) {
        await this._processContextUpdate(userId, update);
      }
      
      // Clear processed updates
      this.integrationState.pendingContextUpdates.set(userId, []);
    } catch (error) {
      this.logger.error('Error processing pending context updates', { error, userId });
    }
  }
  
  /**
   * Processes a single context update
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {Object} update - Context update entry
   * @returns {Promise<Object>} Processing result
   */
  async _processContextUpdate(userId, update) {
    try {
      // Mark update as processing
      update.status = 'processing';
      
      // Get integration configuration
      const integration = this.externalIntegrations.get(update.systemId);
      
      // Apply context mapping if defined
      let mappedContext = { ...update.data };
      if (integration.contextMapping) {
        mappedContext = this._applyContextMapping(update.data, integration.contextMapping);
      }
      
      // Distribute context to appropriate components
      if (mappedContext.emotional && this.config.enableEmotionalInfluence) {
        if (this.conversationStyleManager) {
          await this.conversationStyleManager.updateExternalContext(
            'emotional', mappedContext.emotional
          );
        }
        
        if (this.nonverbalBehaviorManager) {
          await this.nonverbalBehaviorManager.updateExternalContext(
            'emotional', mappedContext.emotional
          );
        }
      }
      
      if (mappedContext.social && this.config.enableSocialInfluence) {
        if (this.conversationStyleManager) {
          await this.conversationStyleManager.updateExternalContext(
            'social', mappedContext.social
          );
        }
        
        if (this.nonverbalBehaviorManager) {
          await this.nonverbalBehaviorManager.updateExternalContext(
            'social', mappedContext.social
          );
        }
        
        if (this.socialNormsManager) {
          await this.socialNormsManager.updateContext(
            userId, mappedContext.social
          );
        }
      }
      
      if (mappedContext.conversation) {
        if (this.nonverbalBehaviorManager) {
          await this.nonverbalBehaviorManager.updateExternalContext(
            'conversation', mappedContext.conversation
          );
        }
      }
      
      if (mappedContext.personality && this.config.enablePersonalityInfluence) {
        if (this.conversationStyleManager) {
          await this.conversationStyleManager.updateExternalContext(
            'personality', mappedContext.personality
          );
        }
      }
      
      // Mark update as processed
      update.status = 'processed';
      update.processedAt = Date.now();
      
      return {
        status: 'processed',
        timestamp: update.processedAt,
        contextTypes: Object.keys(mappedContext)
      };
    } catch (error) {
      this.logger.error('Error processing context update', { error, userId, update });
      
      // Mark update as failed
      update.status = 'failed';
      update.error = error.message;
      
      return {
        status: 'failed',
        error: error.message
      };
    }
  }
  
  /**
   * Applies context mapping
   * 
   * @private
   * @param {Object} context - Original context
   * @param {Object} mapping - Context mapping configuration
   * @returns {Object} Mapped context
   */
  _applyContextMapping(context, mapping) {
    const mappedContext = {};
    
    // Apply mapping for each context type
    for (const [targetType, sourceConfig] of Object.entries(mapping)) {
      if (sourceConfig.sourceType && context[sourceConfig.sourceType]) {
        // Create target context object
        mappedContext[targetType] = {};
        
        // Apply field mappings
        if (sourceConfig.fieldMappings) {
          for (const [targetField, sourceField] of Object.entries(sourceConfig.fieldMappings)) {
            if (context[sourceConfig.sourceType][sourceField] !== undefined) {
              mappedContext[targetType][targetField] = context[sourceConfig.sourceType][sourceField];
            }
          }
        }
        
        // Apply transformations
        if (sourceConfig.transformations) {
          for (const [targetField, transform] of Object.entries(sourceConfig.transformations)) {
            if (transform.type === 'scale' && 
                context[sourceConfig.sourceType][transform.sourceField] !== undefined) {
              
              const sourceValue = context[sourceConfig.sourceType][transform.sourceField];
              const sourceMin = transform.sourceRange?.[0] || 0;
              const sourceMax = transform.sourceRange?.[1] || 1;
              const targetMin = transform.targetRange?.[0] || 0;
              const targetMax = transform.targetRange?.[1] || 1;
              
              // Scale value from source range to target range
              const scaledValue = targetMin + (sourceValue - sourceMin) * 
                (targetMax - targetMin) / (sourceMax - sourceMin);
              
              mappedContext[targetType][targetField] = scaledValue;
            }
          }
        }
      }
    }
    
    // Include unmapped context types
    for (const [type, data] of Object.entries(context)) {
      if (!Object.values(mapping).some(m => m.sourceType === type)) {
        mappedContext[type] = data;
      }
    }
    
    return mappedContext;
  }
  
  /**
   * Collects context from all components
   * 
   * @private
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Collected context
   */
  async _collectComponentContext(userId) {
    const collectedContext = {};
    
    try {
      // Collect emotional context if available
      if (this.behaviorSystemManager.getEmotionalContext) {
        const emotionalContext = await this.behaviorSystemManager.getEmotionalContext(userId);
        if (emotionalContext) {
          collectedContext.emotional = emotionalContext;
        }
      }
      
      // Collect social context if available
      if (this.socialNormsManager) {
        const socialContext = await this.socialNormsManager.getCurrentContext(userId);
        if (socialContext) {
          collectedContext.social = socialContext;
        }
      }
      
      // Collect conversation context if available
      if (this.conversationStyleManager) {
        const conversationStyle = this.conversationStyleManager.getCurrentStyle();
        if (conversationStyle) {
          collectedContext.conversation = {
            style: conversationStyle.id,
            parameters: conversationStyle.parameters
          };
        }
      }
      
      // Collect personality context if available
      if (this.behaviorSystemManager.getPersonalityContext) {
        const personalityContext = await this.behaviorSystemManager.getPersonalityContext(userId);
        if (personalityContext) {
          collectedContext.personality = personalityContext;
        }
      }
    } catch (error) {
      this.logger.error('Error collecting component context', { error, userId });
    }
    
    return collectedContext;
  }
  
  /**
   * Checks if there is a significant change in conversation style
   * 
   * @private
   * @param {Object} oldStyle - Old conversation style
   * @param {Object} newStyle - New conversation style
   * @returns {boolean} Whether there is a significant change
   */
  _isSignificantStyleChange(oldStyle, newStyle) {
    if (!oldStyle || !newStyle) {
      return true;
    }
    
    // Check if style ID changed
    if (oldStyle.id !== newStyle.id) {
      return true;
    }
    
    // Check if parameters changed significantly
    if (oldStyle.parameters && newStyle.parameters) {
      for (const key in newStyle.parameters) {
        if (oldStyle.parameters[key] === undefined || 
            Math.abs(newStyle.parameters[key] - oldStyle.parameters[key]) > 0.2) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Validates integration configuration
   * 
   * @private
   * @param {Object} integration - Integration configuration
   * @throws {Error} If validation fails
   */
  _validateIntegrationConfig(integration) {
    // Check required fields
    if (!integration.name) {
      throw new Error('Integration name is required');
    }
    
    if (!integration.version) {
      throw new Error('Integration version is required');
    }
    
    // Validate priority if provided
    if (integration.priority && 
        !['low', 'medium', 'high'].includes(integration.priority)) {
      throw new Error('Invalid priority: must be low, medium, or high');
    }
    
    // Validate context mapping if provided
    if (integration.contextMapping) {
      for (const [targetType, mapping] of Object.entries(integration.contextMapping)) {
        if (!mapping.sourceType) {
          throw new Error(`Source type is required for mapping to ${targetType}`);
        }
      }
    }
  }
  
  /**
   * Handles behavior system update event
   * 
   * @private
   * @param {Object} event - Event data
   */
  _handleBehaviorSystemUpdate(event) {
    this.logger.debug('Behavior system update received', { 
      userId: event.userId, 
      updateType: event.updateType 
    });
    
    // Trigger context synchronization if cross-component sync is enabled
    if (this.config.enableCrossComponentSync && event.userId) {
      this.synchronizeContext(event.userId).catch(error => {
        this.logger.error('Error synchronizing context after behavior system update', { error });
      });
    }
  }
  
  /**
   * Handles rules applied event
   * 
   * @private
   * @param {Object} event - Event data
   */
  _handleRulesApplied(event) {
    this.logger.debug('Rules applied event received', { 
      userId: event.userId, 
      ruleCount: event.appliedRules?.length 
    });
  }
  
  /**
   * Handles norm applied event
   * 
   * @private
   * @param {Object} event - Event data
   */
  _handleNormApplied(event) {
    this.logger.debug('Norm applied event received', { 
      userId: event.userId, 
      normId: event.normId 
    });
  }
  
  /**
   * Handles style adapted event
   * 
   * @private
   * @param {Object} event - Event data
   */
  _handleStyleAdapted(event) {
    this.logger.debug('Style adapted event received', { 
      styleId: event.id 
    });
  }
  
  /**
   * Handles behaviors generated event
   * 
   * @private
   * @param {Object} event - Event data
   */
  _handleBehaviorsGenerated(event) {
    this.logger.debug('Behaviors generated event received', { 
      behaviorTypes: Object.keys(event).filter(key => 
        key !== 'type' && event[key] !== null
      )
    });
  }
}

module.exports = { BehaviorIntegrationManager };
