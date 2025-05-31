/**
 * @fileoverview BehaviorSystemManager serves as the central coordinator for the Avatar Behavior System,
 * managing all behavior-related components and providing a unified interface for behavior control.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Central manager for the Avatar Behavior System
 */
class BehaviorSystemManager {
  /**
   * Creates a new BehaviorSystemManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.behaviorRuleEngine - Behavior rule engine component
   * @param {Object} options.socialNormsManager - Social norms manager component
   * @param {Object} options.conversationStyleManager - Conversation style manager component
   * @param {Object} options.nonverbalBehaviorManager - Nonverbal behavior manager component
   * @param {Object} options.behaviorPersistenceManager - Behavior persistence manager component
   * @param {Object} options.behaviorIntegrationManager - Behavior integration manager component
   * @param {Object} [options.mcpContextManager=null] - MCP context manager for context integration
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options) {
    // Validate required components
    if (!options.behaviorRuleEngine) {
      throw new Error('BehaviorRuleEngine must be provided');
    }
    if (!options.socialNormsManager) {
      throw new Error('SocialNormsManager must be provided');
    }
    if (!options.conversationStyleManager) {
      throw new Error('ConversationStyleManager must be provided');
    }
    if (!options.nonverbalBehaviorManager) {
      throw new Error('NonverbalBehaviorManager must be provided');
    }
    if (!options.behaviorPersistenceManager) {
      throw new Error('BehaviorPersistenceManager must be provided');
    }
    if (!options.behaviorIntegrationManager) {
      throw new Error('BehaviorIntegrationManager must be provided');
    }
    
    // Store component references
    this.behaviorRuleEngine = options.behaviorRuleEngine;
    this.socialNormsManager = options.socialNormsManager;
    this.conversationStyleManager = options.conversationStyleManager;
    this.nonverbalBehaviorManager = options.nonverbalBehaviorManager;
    this.behaviorPersistenceManager = options.behaviorPersistenceManager;
    this.behaviorIntegrationManager = options.behaviorIntegrationManager;
    
    // Initialize utilities
    this.mcpContextManager = options.mcpContextManager || null;
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('BehaviorSystemManager');
    this.events = new EventEmitter();
    
    // Initialize state
    this.currentBehaviorState = {
      activeRules: [],
      socialContext: null,
      conversationStyle: null,
      nonverbalState: null,
      lastUpdated: Date.now()
    };
    
    this.isInitialized = false;
    this.subscriptionIds = [];
    
    this.logger.info('BehaviorSystemManager created');
  }
  
  /**
   * Initializes the behavior system
   * 
   * @param {Object} [options] - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'behavior_system_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('BehaviorSystemManager already initialized');
        return;
      }
      
      this.logger.info('Initializing BehaviorSystemManager');
      
      // Initialize all components
      await this.behaviorRuleEngine.initialize();
      await this.socialNormsManager.initialize();
      await this.conversationStyleManager.initialize();
      await this.nonverbalBehaviorManager.initialize();
      await this.behaviorPersistenceManager.initialize();
      await this.behaviorIntegrationManager.initialize();
      
      // Load persisted behavior state if available
      const persistedState = await this.behaviorPersistenceManager.loadBehaviorState();
      if (persistedState) {
        this.logger.debug('Loaded persisted behavior state');
        this.currentBehaviorState = {
          ...this.currentBehaviorState,
          ...persistedState,
          lastUpdated: Date.now()
        };
      }
      
      // Register with MCP context system if available
      if (this.mcpContextManager) {
        this.logger.debug('Registering with MCP context system');
        this.mcpContextManager.registerContextProvider('behavior', this);
        
        // Subscribe to relevant context types
        this._subscribeToContextUpdates();
      }
      
      // Set up event listeners between components
      this._setupEventListeners();
      
      this.isInitialized = true;
      this.events.emit('initialized');
      this.logger.info('BehaviorSystemManager initialized');
    } catch (error) {
      this.logger.error('Error initializing BehaviorSystemManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Processes an interaction and generates appropriate behavior
   * 
   * @param {Object} interactionData - Interaction data
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} Generated behavior
   */
  async processBehaviorRequest(interactionData, options = {}) {
    const lockKey = `behavior_request_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorSystemManager not initialized');
      }
      
      this.logger.debug('Processing behavior request', { 
        interactionTypes: Object.keys(interactionData) 
      });
      
      // Step 1: Determine social context
      const socialContext = await this.socialNormsManager.determineSocialContext(
        interactionData,
        this.currentBehaviorState.socialContext
      );
      
      // Step 2: Apply behavior rules
      const applicableRules = await this.behaviorRuleEngine.evaluateRules(
        interactionData,
        socialContext
      );
      
      // Step 3: Determine conversation style
      const conversationStyle = await this.conversationStyleManager.determineStyle(
        interactionData,
        socialContext,
        applicableRules
      );
      
      // Step 4: Generate nonverbal behavior
      const nonverbalBehavior = await this.nonverbalBehaviorManager.generateBehavior(
        interactionData,
        socialContext,
        conversationStyle
      );
      
      // Step 5: Integrate all behavior aspects
      const integratedBehavior = await this.behaviorIntegrationManager.integrateBehavior({
        rules: applicableRules,
        socialContext,
        conversationStyle,
        nonverbalBehavior
      });
      
      // Step 6: Update current state
      this.currentBehaviorState = {
        activeRules: applicableRules,
        socialContext,
        conversationStyle,
        nonverbalState: nonverbalBehavior,
        lastUpdated: Date.now()
      };
      
      // Step 7: Persist state if needed
      if (options.persistState !== false) {
        await this.behaviorPersistenceManager.saveBehaviorState(this.currentBehaviorState);
      }
      
      // Step 8: Publish to MCP if available
      if (this.mcpContextManager) {
        this.mcpContextManager.publishContext('behavior', {
          behaviorState: this.currentBehaviorState,
          generatedBehavior: integratedBehavior,
          timestamp: Date.now()
        });
      }
      
      // Emit event for subscribers
      this.events.emit('behavior_generated', integratedBehavior);
      
      return integratedBehavior;
    } catch (error) {
      this.logger.error('Error processing behavior request', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current behavior state
   * 
   * @returns {Object} Current behavior state
   */
  getCurrentBehaviorState() {
    return { ...this.currentBehaviorState };
  }
  
  /**
   * Updates behavior configuration
   * 
   * @param {Object} configUpdates - Configuration updates
   * @param {Object} [options] - Update options
   * @returns {Promise<Object>} Updated configuration
   */
  async updateBehaviorConfig(configUpdates, options = {}) {
    const lockKey = `behavior_config_update_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorSystemManager not initialized');
      }
      
      this.logger.debug('Updating behavior configuration', { 
        updateTypes: Object.keys(configUpdates) 
      });
      
      const updates = {};
      
      // Update rule engine configuration if provided
      if (configUpdates.ruleEngine) {
        updates.ruleEngine = await this.behaviorRuleEngine.updateConfiguration(
          configUpdates.ruleEngine
        );
      }
      
      // Update social norms configuration if provided
      if (configUpdates.socialNorms) {
        updates.socialNorms = await this.socialNormsManager.updateConfiguration(
          configUpdates.socialNorms
        );
      }
      
      // Update conversation style configuration if provided
      if (configUpdates.conversationStyle) {
        updates.conversationStyle = await this.conversationStyleManager.updateConfiguration(
          configUpdates.conversationStyle
        );
      }
      
      // Update nonverbal behavior configuration if provided
      if (configUpdates.nonverbalBehavior) {
        updates.nonverbalBehavior = await this.nonverbalBehaviorManager.updateConfiguration(
          configUpdates.nonverbalBehavior
        );
      }
      
      // Persist configuration updates if needed
      if (options.persistConfig !== false) {
        await this.behaviorPersistenceManager.saveConfiguration(updates);
      }
      
      // Emit event for subscribers
      this.events.emit('config_updated', updates);
      
      return updates;
    } catch (error) {
      this.logger.error('Error updating behavior configuration', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Registers a custom behavior rule
   * 
   * @param {Object} rule - Rule definition
   * @param {Object} [options] - Registration options
   * @returns {Promise<Object>} Registered rule
   */
  async registerBehaviorRule(rule, options = {}) {
    const lockKey = `register_rule_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorSystemManager not initialized');
      }
      
      this.logger.debug('Registering behavior rule', { ruleId: rule.id });
      
      // Register rule with the rule engine
      const registeredRule = await this.behaviorRuleEngine.registerRule(rule);
      
      // Persist rule if needed
      if (options.persistRule !== false) {
        await this.behaviorPersistenceManager.saveRule(registeredRule);
      }
      
      // Emit event for subscribers
      this.events.emit('rule_registered', registeredRule);
      
      return registeredRule;
    } catch (error) {
      this.logger.error('Error registering behavior rule', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
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
   * Shuts down the behavior system
   * 
   * @param {Object} [options] - Shutdown options
   * @returns {Promise<void>}
   */
  async shutdown(options = {}) {
    const lockKey = 'behavior_system_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('BehaviorSystemManager not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down BehaviorSystemManager');
      
      // Persist final state if needed
      if (options.persistFinalState !== false) {
        await this.behaviorPersistenceManager.saveBehaviorState(this.currentBehaviorState);
      }
      
      // Unsubscribe from MCP context updates
      if (this.mcpContextManager) {
        this._unsubscribeFromContextUpdates();
      }
      
      // Shut down all components
      await this.behaviorIntegrationManager.shutdown();
      await this.behaviorPersistenceManager.shutdown();
      await this.nonverbalBehaviorManager.shutdown();
      await this.conversationStyleManager.shutdown();
      await this.socialNormsManager.shutdown();
      await this.behaviorRuleEngine.shutdown();
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('BehaviorSystemManager shut down');
    } catch (error) {
      this.logger.error('Error shutting down BehaviorSystemManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Sets up event listeners between components
   * 
   * @private
   */
  _setupEventListeners() {
    // Listen for rule engine events
    this.behaviorRuleEngine.on('rules_updated', (updatedRules) => {
      this.logger.debug('Rules updated in rule engine');
      this.events.emit('rules_updated', updatedRules);
    });
    
    // Listen for social norms manager events
    this.socialNormsManager.on('social_context_changed', (newContext) => {
      this.logger.debug('Social context changed');
      this.currentBehaviorState.socialContext = newContext;
      this.events.emit('social_context_changed', newContext);
    });
    
    // Listen for conversation style manager events
    this.conversationStyleManager.on('style_changed', (newStyle) => {
      this.logger.debug('Conversation style changed');
      this.currentBehaviorState.conversationStyle = newStyle;
      this.events.emit('conversation_style_changed', newStyle);
    });
    
    // Listen for nonverbal behavior manager events
    this.nonverbalBehaviorManager.on('behavior_changed', (newBehavior) => {
      this.logger.debug('Nonverbal behavior changed');
      this.currentBehaviorState.nonverbalState = newBehavior;
      this.events.emit('nonverbal_behavior_changed', newBehavior);
    });
    
    // Listen for persistence manager events
    this.behaviorPersistenceManager.on('state_saved', (savedState) => {
      this.logger.debug('Behavior state saved');
      this.events.emit('state_saved', savedState);
    });
  }
  
  /**
   * Subscribes to relevant MCP context updates
   * 
   * @private
   */
  _subscribeToContextUpdates() {
    if (!this.mcpContextManager) {
      return;
    }
    
    // Subscribe to emotional context
    const emotionalSubscriptionId = this.mcpContextManager.subscribeToContext(
      'emotional',
      (emotionalContext) => {
        this.logger.debug('Received emotional context update');
        this._handleEmotionalContextUpdate(emotionalContext);
      }
    );
    this.subscriptionIds.push(emotionalSubscriptionId);
    
    // Subscribe to personality context
    const personalitySubscriptionId = this.mcpContextManager.subscribeToContext(
      'personality',
      (personalityContext) => {
        this.logger.debug('Received personality context update');
        this._handlePersonalityContextUpdate(personalityContext);
      }
    );
    this.subscriptionIds.push(personalitySubscriptionId);
    
    // Subscribe to environmental context
    const environmentalSubscriptionId = this.mcpContextManager.subscribeToContext(
      'environmental',
      (environmentalContext) => {
        this.logger.debug('Received environmental context update');
        this._handleEnvironmentalContextUpdate(environmentalContext);
      }
    );
    this.subscriptionIds.push(environmentalSubscriptionId);
  }
  
  /**
   * Unsubscribes from MCP context updates
   * 
   * @private
   */
  _unsubscribeFromContextUpdates() {
    if (!this.mcpContextManager) {
      return;
    }
    
    this.subscriptionIds.forEach(id => {
      this.mcpContextManager.unsubscribeFromContext(id);
    });
    
    this.subscriptionIds = [];
  }
  
  /**
   * Handles emotional context updates from MCP
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context data
   */
  _handleEmotionalContextUpdate(emotionalContext) {
    if (!emotionalContext || !emotionalContext.emotionalState) {
      return;
    }
    
    // Update social norms manager with emotional context
    this.socialNormsManager.updateExternalContext('emotional', emotionalContext);
    
    // Update conversation style manager with emotional context
    this.conversationStyleManager.updateEmotionalContext(emotionalContext);
    
    // Update nonverbal behavior manager with emotional context
    this.nonverbalBehaviorManager.updateEmotionalState(emotionalContext.emotionalState);
  }
  
  /**
   * Handles personality context updates from MCP
   * 
   * @private
   * @param {Object} personalityContext - Personality context data
   */
  _handlePersonalityContextUpdate(personalityContext) {
    if (!personalityContext) {
      return;
    }
    
    // Update social norms manager with personality context
    this.socialNormsManager.updateExternalContext('personality', personalityContext);
    
    // Update conversation style manager with personality context
    this.conversationStyleManager.updatePersonalityContext(personalityContext);
    
    // Update nonverbal behavior manager with personality context
    this.nonverbalBehaviorManager.updatePersonalityContext(personalityContext);
  }
  
  /**
   * Handles environmental context updates from MCP
   * 
   * @private
   * @param {Object} environmentalContext - Environmental context data
   */
  _handleEnvironmentalContextUpdate(environmentalContext) {
    if (!environmentalContext) {
      return;
    }
    
    // Update social norms manager with environmental context
    this.socialNormsManager.updateExternalContext('environmental', environmentalContext);
    
    // Update nonverbal behavior manager with environmental context
    this.nonverbalBehaviorManager.updateEnvironmentalContext(environmentalContext);
  }
}

module.exports = { BehaviorSystemManager };
