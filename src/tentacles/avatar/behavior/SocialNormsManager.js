/**
 * @fileoverview SocialNormsManager determines appropriate social behavior based on context,
 * managing social norms, cultural considerations, and relationship dynamics.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Manager for social norms and contextual behavior
 */
class SocialNormsManager {
  /**
   * Creates a new SocialNormsManager instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('SocialNormsManager');
    this.events = new EventEmitter();
    
    // Initialize social norms database
    this.socialNorms = new Map();
    this.culturalContexts = new Map();
    this.relationshipTypes = new Map();
    this.socialSettings = new Map();
    
    // Initialize current context
    this.currentSocialContext = {
      formality: 0.5, // Default to neutral formality (0-1 scale)
      relationshipType: null,
      setting: null,
      culturalContext: null,
      lastUpdated: Date.now()
    };
    
    // External context influences
    this.externalContext = {
      emotional: null,
      personality: null,
      environmental: null
    };
    
    // Initialize configuration
    this.config = {
      defaultFormality: 0.5,
      defaultCulturalContext: 'neutral',
      enableCulturalAdaptation: true,
      enableRelationshipTracking: true,
      contextPersistenceDuration: 3600000 // 1 hour in milliseconds
    };
    
    this.isInitialized = false;
    
    this.logger.info('SocialNormsManager created');
  }
  
  /**
   * Initializes the social norms manager
   * 
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.configuration] - Manager configuration
   * @param {Object} [options.initialContext] - Initial social context
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'social_norms_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('SocialNormsManager already initialized');
        return;
      }
      
      this.logger.info('Initializing SocialNormsManager');
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Load initial social context if provided
      if (options.initialContext) {
        this.currentSocialContext = {
          ...this.currentSocialContext,
          ...options.initialContext,
          lastUpdated: Date.now()
        };
      }
      
      // Load default social norms
      await this._loadDefaultSocialNorms();
      
      this.isInitialized = true;
      this.events.emit('initialized');
      this.logger.info('SocialNormsManager initialized');
    } catch (error) {
      this.logger.error('Error initializing SocialNormsManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Determines social context based on interaction data
   * 
   * @param {Object} interactionData - Interaction data
   * @param {Object} [previousContext] - Previous social context
   * @param {Object} [options] - Context determination options
   * @returns {Promise<Object>} Determined social context
   */
  async determineSocialContext(interactionData, previousContext = null, options = {}) {
    const lockKey = `determine_context_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Determining social context', { 
        interactionTypes: Object.keys(interactionData) 
      });
      
      // Start with previous context or current context
      const startingContext = previousContext || { ...this.currentSocialContext };
      
      // Create new context object
      const newContext = { ...startingContext };
      
      // Step 1: Analyze interaction for explicit context indicators
      const explicitContext = this._extractExplicitContextIndicators(interactionData);
      
      // Step 2: Analyze interaction for implicit context clues
      const implicitContext = await this._analyzeImplicitContextClues(interactionData);
      
      // Step 3: Determine formality level
      newContext.formality = this._determineFormality(
        interactionData,
        explicitContext.formality,
        implicitContext.formality,
        startingContext.formality
      );
      
      // Step 4: Determine relationship type
      if (explicitContext.relationshipType) {
        newContext.relationshipType = explicitContext.relationshipType;
      } else if (implicitContext.relationshipType && this.config.enableRelationshipTracking) {
        newContext.relationshipType = implicitContext.relationshipType;
      }
      
      // Step 5: Determine social setting
      if (explicitContext.setting) {
        newContext.setting = explicitContext.setting;
      } else if (implicitContext.setting) {
        newContext.setting = implicitContext.setting;
      }
      
      // Step 6: Determine cultural context
      if (explicitContext.culturalContext) {
        newContext.culturalContext = explicitContext.culturalContext;
      } else if (implicitContext.culturalContext && this.config.enableCulturalAdaptation) {
        newContext.culturalContext = implicitContext.culturalContext;
      } else if (!newContext.culturalContext) {
        newContext.culturalContext = this.config.defaultCulturalContext;
      }
      
      // Step 7: Apply external context influences
      this._applyExternalContextInfluences(newContext);
      
      // Step 8: Update timestamp
      newContext.lastUpdated = Date.now();
      
      // Step 9: Check for significant changes
      const hasSignificantChanges = this._hasSignificantContextChanges(
        startingContext,
        newContext
      );
      
      // Update current context if this isn't just a preview
      if (!options.previewOnly) {
        this.currentSocialContext = newContext;
        
        // Emit event if significant changes occurred
        if (hasSignificantChanges) {
          this.events.emit('social_context_changed', newContext);
        }
      }
      
      return newContext;
    } catch (error) {
      this.logger.error('Error determining social context', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets applicable social norms for the current context
   * 
   * @param {Object} [context] - Social context to use (defaults to current)
   * @param {Object} [options] - Retrieval options
   * @returns {Promise<Array<Object>>} Applicable social norms
   */
  async getApplicableSocialNorms(context = null, options = {}) {
    const lockKey = `get_norms_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      // Use provided context or current context
      const socialContext = context || this.currentSocialContext;
      
      this.logger.debug('Getting applicable social norms', { 
        formality: socialContext.formality,
        relationshipType: socialContext.relationshipType,
        setting: socialContext.setting,
        culturalContext: socialContext.culturalContext
      });
      
      const applicableNorms = [];
      
      // Get all norms
      for (const norm of this.socialNorms.values()) {
        // Skip if norm is for a different cultural context
        if (norm.culturalContext && 
            norm.culturalContext !== socialContext.culturalContext &&
            norm.culturalContext !== 'universal') {
          continue;
        }
        
        // Skip if norm is for a different relationship type
        if (norm.relationshipType && 
            socialContext.relationshipType &&
            norm.relationshipType !== socialContext.relationshipType &&
            norm.relationshipType !== 'any') {
          continue;
        }
        
        // Skip if norm is for a different setting
        if (norm.setting && 
            socialContext.setting &&
            norm.setting !== socialContext.setting &&
            norm.setting !== 'any') {
          continue;
        }
        
        // Skip if norm is for a different formality level
        if (norm.formalityRange) {
          const [min, max] = norm.formalityRange;
          if (socialContext.formality < min || socialContext.formality > max) {
            continue;
          }
        }
        
        // Norm is applicable
        applicableNorms.push(norm);
      }
      
      // Sort by priority (higher first)
      applicableNorms.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      return applicableNorms;
    } catch (error) {
      this.logger.error('Error getting applicable social norms', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current social context
   * 
   * @returns {Object} Current social context
   */
  getCurrentSocialContext() {
    return { ...this.currentSocialContext };
  }
  
  /**
   * Updates the current social context
   * 
   * @param {Object} contextUpdates - Context updates
   * @param {Object} [options] - Update options
   * @returns {Promise<Object>} Updated context
   */
  async updateSocialContext(contextUpdates, options = {}) {
    const lockKey = `update_context_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Updating social context', { 
        updateKeys: Object.keys(contextUpdates) 
      });
      
      // Get current context
      const currentContext = { ...this.currentSocialContext };
      
      // Create updated context
      const updatedContext = {
        ...currentContext,
        ...contextUpdates,
        lastUpdated: Date.now()
      };
      
      // Check for significant changes
      const hasSignificantChanges = this._hasSignificantContextChanges(
        currentContext,
        updatedContext
      );
      
      // Update current context
      this.currentSocialContext = updatedContext;
      
      // Emit event if significant changes occurred
      if (hasSignificantChanges) {
        this.events.emit('social_context_changed', updatedContext);
      }
      
      return updatedContext;
    } catch (error) {
      this.logger.error('Error updating social context', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Registers a new social norm
   * 
   * @param {Object} norm - Social norm definition
   * @returns {Promise<Object>} Registered norm
   */
  async registerSocialNorm(norm) {
    const lockKey = `register_norm_${norm.id}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Registering social norm', { normId: norm.id });
      
      // Validate norm
      this._validateSocialNorm(norm);
      
      // Add timestamps
      const registeredNorm = {
        ...norm,
        created: Date.now(),
        lastUpdated: Date.now()
      };
      
      // Store norm
      this.socialNorms.set(norm.id, registeredNorm);
      
      // Emit event
      this.events.emit('norm_registered', registeredNorm);
      
      return registeredNorm;
    } catch (error) {
      this.logger.error('Error registering social norm', { error, normId: norm.id });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates an existing social norm
   * 
   * @param {string} normId - Norm identifier
   * @param {Object} updates - Norm updates
   * @returns {Promise<Object>} Updated norm
   */
  async updateSocialNorm(normId, updates) {
    const lockKey = `update_norm_${normId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Updating social norm', { normId });
      
      // Check if norm exists
      if (!this.socialNorms.has(normId)) {
        throw new Error(`Social norm with ID ${normId} not found`);
      }
      
      // Get existing norm
      const existingNorm = this.socialNorms.get(normId);
      
      // Create updated norm
      const updatedNorm = {
        ...existingNorm,
        ...updates,
        id: normId, // Ensure ID doesn't change
        lastUpdated: Date.now()
      };
      
      // Validate updated norm
      this._validateSocialNorm(updatedNorm);
      
      // Update norm in storage
      this.socialNorms.set(normId, updatedNorm);
      
      // Emit event
      this.events.emit('norm_updated', updatedNorm);
      
      return updatedNorm;
    } catch (error) {
      this.logger.error('Error updating social norm', { error, normId });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates external context information
   * 
   * @param {string} contextType - Type of external context
   * @param {Object} contextData - Context data
   * @returns {Promise<void>}
   */
  async updateExternalContext(contextType, contextData) {
    const lockKey = `update_external_context_${contextType}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Updating external context', { contextType });
      
      // Validate context type
      if (!['emotional', 'personality', 'environmental'].includes(contextType)) {
        throw new Error(`Invalid external context type: ${contextType}`);
      }
      
      // Update external context
      this.externalContext[contextType] = {
        ...contextData,
        lastUpdated: Date.now()
      };
      
      // Check if this should trigger a context update
      const shouldUpdateContext = this._shouldUpdateContextFromExternal(
        contextType,
        contextData
      );
      
      if (shouldUpdateContext) {
        // Create a new social context with external influences applied
        const updatedContext = { ...this.currentSocialContext };
        this._applyExternalContextInfluences(updatedContext);
        
        // Check for significant changes
        const hasSignificantChanges = this._hasSignificantContextChanges(
          this.currentSocialContext,
          updatedContext
        );
        
        if (hasSignificantChanges) {
          // Update current context
          this.currentSocialContext = {
            ...updatedContext,
            lastUpdated: Date.now()
          };
          
          // Emit event
          this.events.emit('social_context_changed', this.currentSocialContext);
        }
      }
    } catch (error) {
      this.logger.error('Error updating external context', { error, contextType });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates manager configuration
   * 
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(configUpdates) {
    const lockKey = 'update_social_norms_config';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('SocialNormsManager not initialized');
      }
      
      this.logger.debug('Updating configuration', { 
        updateKeys: Object.keys(configUpdates) 
      });
      
      // Update configuration
      this.config = {
        ...this.config,
        ...configUpdates
      };
      
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
   * Shuts down the social norms manager
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = 'social_norms_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('SocialNormsManager not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down SocialNormsManager');
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('SocialNormsManager shut down');
    } catch (error) {
      this.logger.error('Error shutting down SocialNormsManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Loads default social norms
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultSocialNorms() {
    this.logger.debug('Loading default social norms');
    
    // Define default cultural contexts
    this.culturalContexts.set('neutral', {
      id: 'neutral',
      name: 'Neutral',
      description: 'Culturally neutral context'
    });
    
    this.culturalContexts.set('western', {
      id: 'western',
      name: 'Western',
      description: 'Western cultural context'
    });
    
    this.culturalContexts.set('eastern', {
      id: 'eastern',
      name: 'Eastern',
      description: 'Eastern cultural context'
    });
    
    // Define default relationship types
    this.relationshipTypes.set('professional', {
      id: 'professional',
      name: 'Professional',
      description: 'Professional relationship',
      defaultFormality: 0.8
    });
    
    this.relationshipTypes.set('casual', {
      id: 'casual',
      name: 'Casual',
      description: 'Casual relationship',
      defaultFormality: 0.3
    });
    
    this.relationshipTypes.set('formal', {
      id: 'formal',
      name: 'Formal',
      description: 'Formal relationship',
      defaultFormality: 0.9
    });
    
    // Define default social settings
    this.socialSettings.set('business', {
      id: 'business',
      name: 'Business',
      description: 'Business setting',
      defaultFormality: 0.8
    });
    
    this.socialSettings.set('casual', {
      id: 'casual',
      name: 'Casual',
      description: 'Casual setting',
      defaultFormality: 0.3
    });
    
    this.socialSettings.set('formal', {
      id: 'formal',
      name: 'Formal',
      description: 'Formal setting',
      defaultFormality: 0.9
    });
    
    // Define default social norms
    
    // Universal greeting norm
    await this.registerSocialNorm({
      id: 'greeting_universal',
      name: 'Universal Greeting',
      description: 'Respond to greetings appropriately',
      culturalContext: 'universal',
      relationshipType: 'any',
      setting: 'any',
      formalityRange: [0, 1],
      priority: 80,
      behaviors: [
        {
          type: 'verbal',
          action: 'respond_to_greeting',
          parameters: {
            match_formality: true
          }
        },
        {
          type: 'nonverbal',
          action: 'acknowledge_greeting',
          parameters: {
            match_formality: true
          }
        }
      ]
    });
    
    // Formal introduction norm
    await this.registerSocialNorm({
      id: 'formal_introduction',
      name: 'Formal Introduction',
      description: 'Use formal introductions in professional settings',
      culturalContext: 'universal',
      relationshipType: 'professional',
      setting: 'business',
      formalityRange: [0.7, 1],
      priority: 75,
      behaviors: [
        {
          type: 'verbal',
          action: 'use_titles',
          parameters: {
            always: true
          }
        },
        {
          type: 'verbal',
          action: 'use_full_name',
          parameters: {
            always: true
          }
        },
        {
          type: 'nonverbal',
          action: 'formal_gesture',
          parameters: {
            type: 'handshake'
          }
        }
      ]
    });
    
    // Casual conversation norm
    await this.registerSocialNorm({
      id: 'casual_conversation',
      name: 'Casual Conversation',
      description: 'Use casual language in informal settings',
      culturalContext: 'universal',
      relationshipType: 'casual',
      setting: 'casual',
      formalityRange: [0, 0.4],
      priority: 70,
      behaviors: [
        {
          type: 'verbal',
          action: 'use_contractions',
          parameters: {
            frequency: 'high'
          }
        },
        {
          type: 'verbal',
          action: 'use_informal_language',
          parameters: {
            level: 'moderate'
          }
        },
        {
          type: 'nonverbal',
          action: 'relaxed_posture',
          parameters: {
            level: 'moderate'
          }
        }
      ]
    });
    
    // Western business norm
    await this.registerSocialNorm({
      id: 'western_business',
      name: 'Western Business Etiquette',
      description: 'Follow Western business etiquette',
      culturalContext: 'western',
      relationshipType: 'professional',
      setting: 'business',
      formalityRange: [0.6, 1],
      priority: 65,
      behaviors: [
        {
          type: 'verbal',
          action: 'direct_communication',
          parameters: {
            level: 'high'
          }
        },
        {
          type: 'nonverbal',
          action: 'maintain_eye_contact',
          parameters: {
            level: 'moderate'
          }
        },
        {
          type: 'nonverbal',
          action: 'firm_handshake',
          parameters: {
            when: 'greeting'
          }
        }
      ]
    });
    
    // Eastern business norm
    await this.registerSocialNorm({
      id: 'eastern_business',
      name: 'Eastern Business Etiquette',
      description: 'Follow Eastern business etiquette',
      culturalContext: 'eastern',
      relationshipType: 'professional',
      setting: 'business',
      formalityRange: [0.6, 1],
      priority: 65,
      behaviors: [
        {
          type: 'verbal',
          action: 'indirect_communication',
          parameters: {
            level: 'moderate'
          }
        },
        {
          type: 'verbal',
          action: 'use_honorifics',
          parameters: {
            always: true
          }
        },
        {
          type: 'nonverbal',
          action: 'bow',
          parameters: {
            when: 'greeting',
            depth: 'formality_based'
          }
        }
      ]
    });
    
    // Respect personal space norm
    await this.registerSocialNorm({
      id: 'personal_space',
      name: 'Respect Personal Space',
      description: 'Maintain appropriate personal space',
      culturalContext: 'universal',
      relationshipType: 'any',
      setting: 'any',
      formalityRange: [0, 1],
      priority: 90,
      behaviors: [
        {
          type: 'nonverbal',
          action: 'maintain_distance',
          parameters: {
            distance: 'culture_based'
          }
        }
      ]
    });
    
    // Active listening norm
    await this.registerSocialNorm({
      id: 'active_listening',
      name: 'Active Listening',
      description: 'Show active listening behaviors',
      culturalContext: 'universal',
      relationshipType: 'any',
      setting: 'any',
      formalityRange: [0, 1],
      priority: 85,
      behaviors: [
        {
          type: 'nonverbal',
          action: 'nodding',
          parameters: {
            frequency: 'moderate'
          }
        },
        {
          type: 'verbal',
          action: 'acknowledgment_tokens',
          parameters: {
            frequency: 'formality_based'
          }
        },
        {
          type: 'nonverbal',
          action: 'maintain_eye_contact',
          parameters: {
            level: 'culture_based'
          }
        }
      ]
    });
  }
  
  /**
   * Extracts explicit context indicators from interaction data
   * 
   * @private
   * @param {Object} interactionData - Interaction data
   * @returns {Object} Explicit context indicators
   */
  _extractExplicitContextIndicators(interactionData) {
    const result = {
      formality: null,
      relationshipType: null,
      setting: null,
      culturalContext: null
    };
    
    // Check for explicit context in metadata
    if (interactionData.metadata && interactionData.metadata.context) {
      const contextMetadata = interactionData.metadata.context;
      
      if (contextMetadata.formality !== undefined) {
        result.formality = contextMetadata.formality;
      }
      
      if (contextMetadata.relationshipType) {
        result.relationshipType = contextMetadata.relationshipType;
      }
      
      if (contextMetadata.setting) {
        result.setting = contextMetadata.setting;
      }
      
      if (contextMetadata.culturalContext) {
        result.culturalContext = contextMetadata.culturalContext;
      }
    }
    
    // Check for explicit context in text content
    if (interactionData.text && interactionData.text.content) {
      const text = interactionData.text.content.toLowerCase();
      
      // Check for explicit formality indicators
      if (text.includes('formal setting') || text.includes('formal occasion')) {
        result.formality = 0.8;
      } else if (text.includes('casual setting') || text.includes('informal occasion')) {
        result.formality = 0.3;
      }
      
      // Check for explicit relationship indicators
      if (text.includes('professional relationship') || text.includes('business relationship')) {
        result.relationshipType = 'professional';
      } else if (text.includes('casual relationship') || text.includes('friendly relationship')) {
        result.relationshipType = 'casual';
      }
      
      // Check for explicit setting indicators
      if (text.includes('business meeting') || text.includes('work environment')) {
        result.setting = 'business';
      } else if (text.includes('casual gathering') || text.includes('informal setting')) {
        result.setting = 'casual';
      } else if (text.includes('formal event') || text.includes('ceremony')) {
        result.setting = 'formal';
      }
    }
    
    return result;
  }
  
  /**
   * Analyzes implicit context clues from interaction data
   * 
   * @private
   * @param {Object} interactionData - Interaction data
   * @returns {Promise<Object>} Implicit context clues
   */
  async _analyzeImplicitContextClues(interactionData) {
    const result = {
      formality: null,
      relationshipType: null,
      setting: null,
      culturalContext: null
    };
    
    // Analyze text content for formality
    if (interactionData.text && interactionData.text.content) {
      const text = interactionData.text.content;
      result.formality = this._analyzeTextFormality(text);
      
      // Try to infer relationship type from text
      result.relationshipType = this._inferRelationshipFromText(text);
      
      // Try to infer setting from text
      result.setting = this._inferSettingFromText(text);
    }
    
    // Analyze nonverbal cues for formality
    if (interactionData.nonverbal) {
      const nonverbalFormality = this._analyzeNonverbalFormality(interactionData.nonverbal);
      
      // If we have both text and nonverbal formality, average them
      if (result.formality !== null && nonverbalFormality !== null) {
        result.formality = (result.formality + nonverbalFormality) / 2;
      } else if (nonverbalFormality !== null) {
        result.formality = nonverbalFormality;
      }
    }
    
    return result;
  }
  
  /**
   * Analyzes text content for formality level
   * 
   * @private
   * @param {string} text - Text content
   * @returns {number|null} Formality level or null if undetermined
   */
  _analyzeTextFormality(text) {
    if (!text) {
      return null;
    }
    
    let formalityScore = 0.5; // Start neutral
    let scoreCount = 0;
    
    // Convert to lowercase for case-insensitive analysis
    const lowerText = text.toLowerCase();
    
    // Check for contractions (informal)
    const contractions = lowerText.match(/\b\w+'(s|t|re|ve|ll|d)\b/g) || [];
    if (contractions.length > 0) {
      formalityScore -= 0.05 * Math.min(contractions.length, 5);
      scoreCount++;
    }
    
    // Check for slang and informal expressions
    const slangTerms = [
      'gonna', 'wanna', 'gotta', 'dunno', 'yeah', 'nope', 'cool',
      'awesome', 'stuff', 'kinda', 'sorta', 'y\'all', 'ain\'t'
    ];
    
    let slangCount = 0;
    for (const term of slangTerms) {
      if (lowerText.includes(term)) {
        slangCount++;
      }
    }
    
    if (slangCount > 0) {
      formalityScore -= 0.1 * Math.min(slangCount, 3);
      scoreCount++;
    }
    
    // Check for formal language markers
    const formalTerms = [
      'would you', 'could you', 'may i', 'shall we', 'i would like to',
      'please', 'thank you', 'sincerely', 'regards', 'respectfully'
    ];
    
    let formalCount = 0;
    for (const term of formalTerms) {
      if (lowerText.includes(term)) {
        formalCount++;
      }
    }
    
    if (formalCount > 0) {
      formalityScore += 0.1 * Math.min(formalCount, 3);
      scoreCount++;
    }
    
    // Check for honorifics and titles (formal)
    const honorifics = [
      'mr.', 'mrs.', 'ms.', 'dr.', 'professor', 'sir', 'madam',
      'your excellency', 'honorable'
    ];
    
    let honorificCount = 0;
    for (const honorific of honorifics) {
      if (lowerText.includes(honorific)) {
        honorificCount++;
      }
    }
    
    if (honorificCount > 0) {
      formalityScore += 0.15 * Math.min(honorificCount, 2);
      scoreCount++;
    }
    
    // Check sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      // Calculate average sentence length (longer = more formal)
      const avgLength = text.length / sentences.length;
      if (avgLength > 20) {
        formalityScore += 0.1;
      } else if (avgLength < 10) {
        formalityScore -= 0.1;
      }
      scoreCount++;
    }
    
    // If we don't have enough signals, return null
    if (scoreCount < 2) {
      return null;
    }
    
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, formalityScore));
  }
  
  /**
   * Analyzes nonverbal cues for formality level
   * 
   * @private
   * @param {Object} nonverbalData - Nonverbal data
   * @returns {number|null} Formality level or null if undetermined
   */
  _analyzeNonverbalFormality(nonverbalData) {
    if (!nonverbalData) {
      return null;
    }
    
    let formalityScore = 0.5; // Start neutral
    let scoreCount = 0;
    
    // Check posture
    if (nonverbalData.posture) {
      if (nonverbalData.posture === 'erect' || nonverbalData.posture === 'formal') {
        formalityScore += 0.2;
      } else if (nonverbalData.posture === 'relaxed' || nonverbalData.posture === 'slouched') {
        formalityScore -= 0.2;
      }
      scoreCount++;
    }
    
    // Check gestures
    if (nonverbalData.gestures) {
      const formalGestures = ['handshake', 'bow', 'nod', 'hand_on_heart'];
      const informalGestures = ['wave', 'high_five', 'fist_bump', 'thumbs_up'];
      
      for (const gesture of formalGestures) {
        if (nonverbalData.gestures.includes(gesture)) {
          formalityScore += 0.1;
          scoreCount++;
        }
      }
      
      for (const gesture of informalGestures) {
        if (nonverbalData.gestures.includes(gesture)) {
          formalityScore -= 0.1;
          scoreCount++;
        }
      }
    }
    
    // Check facial expressions
    if (nonverbalData.facial) {
      const formalExpressions = ['neutral', 'slight_smile', 'attentive'];
      const informalExpressions = ['big_grin', 'wink', 'laugh', 'silly'];
      
      for (const expression of formalExpressions) {
        if (nonverbalData.facial.includes(expression)) {
          formalityScore += 0.1;
          scoreCount++;
        }
      }
      
      for (const expression of informalExpressions) {
        if (nonverbalData.facial.includes(expression)) {
          formalityScore -= 0.1;
          scoreCount++;
        }
      }
    }
    
    // If we don't have enough signals, return null
    if (scoreCount < 1) {
      return null;
    }
    
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, formalityScore));
  }
  
  /**
   * Infers relationship type from text content
   * 
   * @private
   * @param {string} text - Text content
   * @returns {string|null} Relationship type or null if undetermined
   */
  _inferRelationshipFromText(text) {
    if (!text) {
      return null;
    }
    
    const lowerText = text.toLowerCase();
    
    // Professional relationship indicators
    const professionalIndicators = [
      'colleague', 'coworker', 'boss', 'manager', 'employee',
      'client', 'customer', 'business', 'work', 'project',
      'meeting', 'deadline', 'report', 'presentation'
    ];
    
    // Casual relationship indicators
    const casualIndicators = [
      'friend', 'buddy', 'pal', 'mate', 'hang out',
      'fun', 'party', 'weekend', 'game', 'movie',
      'drinks', 'dinner', 'lunch', 'coffee'
    ];
    
    // Formal relationship indicators
    const formalIndicators = [
      'sir', 'madam', 'mr', 'mrs', 'ms', 'dr',
      'professor', 'director', 'chairman', 'president',
      'honor', 'pleasure', 'formal', 'ceremony'
    ];
    
    let professionalCount = 0;
    let casualCount = 0;
    let formalCount = 0;
    
    // Count indicators
    for (const indicator of professionalIndicators) {
      if (lowerText.includes(indicator)) {
        professionalCount++;
      }
    }
    
    for (const indicator of casualIndicators) {
      if (lowerText.includes(indicator)) {
        casualCount++;
      }
    }
    
    for (const indicator of formalIndicators) {
      if (lowerText.includes(indicator)) {
        formalCount++;
      }
    }
    
    // Determine relationship type based on highest count
    if (professionalCount > casualCount && professionalCount > formalCount) {
      return 'professional';
    } else if (casualCount > professionalCount && casualCount > formalCount) {
      return 'casual';
    } else if (formalCount > professionalCount && formalCount > casualCount) {
      return 'formal';
    }
    
    // If no clear winner or not enough signals, return null
    return null;
  }
  
  /**
   * Infers social setting from text content
   * 
   * @private
   * @param {string} text - Text content
   * @returns {string|null} Social setting or null if undetermined
   */
  _inferSettingFromText(text) {
    if (!text) {
      return null;
    }
    
    const lowerText = text.toLowerCase();
    
    // Business setting indicators
    const businessIndicators = [
      'office', 'meeting', 'conference', 'presentation', 'client',
      'project', 'deadline', 'report', 'business', 'work',
      'company', 'corporate', 'professional', 'interview'
    ];
    
    // Casual setting indicators
    const casualIndicators = [
      'home', 'party', 'bar', 'restaurant', 'cafe',
      'coffee shop', 'park', 'beach', 'movie', 'game',
      'weekend', 'evening', 'hangout', 'casual'
    ];
    
    // Formal setting indicators
    const formalIndicators = [
      'ceremony', 'event', 'gala', 'reception', 'dinner',
      'conference', 'formal', 'official', 'function', 'banquet',
      'award', 'celebration', 'inauguration', 'opening'
    ];
    
    let businessCount = 0;
    let casualCount = 0;
    let formalCount = 0;
    
    // Count indicators
    for (const indicator of businessIndicators) {
      if (lowerText.includes(indicator)) {
        businessCount++;
      }
    }
    
    for (const indicator of casualIndicators) {
      if (lowerText.includes(indicator)) {
        casualCount++;
      }
    }
    
    for (const indicator of formalIndicators) {
      if (lowerText.includes(indicator)) {
        formalCount++;
      }
    }
    
    // Determine setting based on highest count
    if (businessCount > casualCount && businessCount > formalCount) {
      return 'business';
    } else if (casualCount > businessCount && casualCount > formalCount) {
      return 'casual';
    } else if (formalCount > businessCount && formalCount > casualCount) {
      return 'formal';
    }
    
    // If no clear winner or not enough signals, return null
    return null;
  }
  
  /**
   * Determines formality level based on various inputs
   * 
   * @private
   * @param {Object} interactionData - Interaction data
   * @param {number|null} explicitFormality - Explicitly specified formality
   * @param {number|null} implicitFormality - Implicitly detected formality
   * @param {number} previousFormality - Previous formality level
   * @returns {number} Determined formality level
   */
  _determineFormality(
    interactionData,
    explicitFormality,
    implicitFormality,
    previousFormality
  ) {
    // If explicit formality is provided, use it
    if (explicitFormality !== null) {
      return explicitFormality;
    }
    
    // Start with previous formality
    let formality = previousFormality;
    
    // If implicit formality is detected, blend with previous
    if (implicitFormality !== null) {
      // Blend with 70% weight to new formality, 30% to previous
      formality = implicitFormality * 0.7 + previousFormality * 0.3;
    }
    
    // Apply relationship type influence if available
    if (this.currentSocialContext.relationshipType) {
      const relationshipType = this.relationshipTypes.get(
        this.currentSocialContext.relationshipType
      );
      
      if (relationshipType && relationshipType.defaultFormality !== undefined) {
        // Blend with 20% weight to relationship default
        formality = formality * 0.8 + relationshipType.defaultFormality * 0.2;
      }
    }
    
    // Apply setting influence if available
    if (this.currentSocialContext.setting) {
      const setting = this.socialSettings.get(
        this.currentSocialContext.setting
      );
      
      if (setting && setting.defaultFormality !== undefined) {
        // Blend with 20% weight to setting default
        formality = formality * 0.8 + setting.defaultFormality * 0.2;
      }
    }
    
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, formality));
  }
  
  /**
   * Applies external context influences to social context
   * 
   * @private
   * @param {Object} context - Social context to modify
   */
  _applyExternalContextInfluences(context) {
    // Apply emotional context influence
    if (this.externalContext.emotional) {
      const emotional = this.externalContext.emotional;
      
      // If emotional state has valence, use it to influence formality
      if (emotional.emotionalState && 
          emotional.emotionalState.valence !== undefined) {
        
        const valence = emotional.emotionalState.valence;
        
        // Very negative emotions tend to increase formality
        if (valence < -0.5) {
          context.formality = context.formality * 0.9 + 0.8 * 0.1;
        }
        // Very positive emotions can slightly decrease formality
        else if (valence > 0.7) {
          context.formality = context.formality * 0.9 + 0.4 * 0.1;
        }
      }
    }
    
    // Apply personality context influence
    if (this.externalContext.personality) {
      const personality = this.externalContext.personality;
      
      // If personality has formality preference, use it
      if (personality.preferences && 
          personality.preferences.formalityPreference !== undefined) {
        
        const preference = personality.preferences.formalityPreference;
        
        // Blend with 10% weight to personality preference
        context.formality = context.formality * 0.9 + preference * 0.1;
      }
    }
    
    // Apply environmental context influence
    if (this.externalContext.environmental) {
      const environmental = this.externalContext.environmental;
      
      // If environment has a setting, use it
      if (environmental.setting && !context.setting) {
        context.setting = environmental.setting;
      }
    }
  }
  
  /**
   * Checks if external context update should trigger social context update
   * 
   * @private
   * @param {string} contextType - Type of external context
   * @param {Object} contextData - Context data
   * @returns {boolean} Whether social context should be updated
   */
  _shouldUpdateContextFromExternal(contextType, contextData) {
    // Emotional context with significant changes should trigger update
    if (contextType === 'emotional') {
      if (contextData.emotionalState && 
          contextData.emotionalState.valence !== undefined) {
        
        // Get previous emotional context
        const previousEmotional = this.externalContext.emotional;
        
        // If no previous context, or significant valence change
        if (!previousEmotional || 
            !previousEmotional.emotionalState ||
            Math.abs(contextData.emotionalState.valence - 
                    previousEmotional.emotionalState.valence) > 0.3) {
          return true;
        }
      }
    }
    
    // Environmental context with setting change should trigger update
    if (contextType === 'environmental') {
      if (contextData.setting) {
        // Get previous environmental context
        const previousEnvironmental = this.externalContext.environmental;
        
        // If no previous context, or setting changed
        if (!previousEnvironmental || 
            !previousEnvironmental.setting ||
            contextData.setting !== previousEnvironmental.setting) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Checks if there are significant changes between two social contexts
   * 
   * @private
   * @param {Object} oldContext - Old social context
   * @param {Object} newContext - New social context
   * @returns {boolean} Whether there are significant changes
   */
  _hasSignificantContextChanges(oldContext, newContext) {
    // Check formality change
    if (Math.abs(newContext.formality - oldContext.formality) > 0.2) {
      return true;
    }
    
    // Check relationship type change
    if (newContext.relationshipType !== oldContext.relationshipType) {
      return true;
    }
    
    // Check setting change
    if (newContext.setting !== oldContext.setting) {
      return true;
    }
    
    // Check cultural context change
    if (newContext.culturalContext !== oldContext.culturalContext) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Validates a social norm definition
   * 
   * @private
   * @param {Object} norm - Social norm to validate
   * @throws {Error} If validation fails
   */
  _validateSocialNorm(norm) {
    // Check required fields
    if (!norm.id) {
      throw new Error('Social norm must have an ID');
    }
    if (!norm.name) {
      throw new Error('Social norm must have a name');
    }
    if (!norm.behaviors || !Array.isArray(norm.behaviors) || norm.behaviors.length === 0) {
      throw new Error('Social norm must have at least one behavior');
    }
    
    // Validate behaviors
    for (let i = 0; i < norm.behaviors.length; i++) {
      const behavior = norm.behaviors[i];
      if (!behavior.type) {
        throw new Error(`Behavior ${i} must have a type`);
      }
      if (!behavior.action) {
        throw new Error(`Behavior ${i} must have an action`);
      }
    }
    
    // Validate formality range if provided
    if (norm.formalityRange) {
      if (!Array.isArray(norm.formalityRange) || norm.formalityRange.length !== 2) {
        throw new Error('Formality range must be an array with two elements');
      }
      
      const [min, max] = norm.formalityRange;
      if (min < 0 || max > 1 || min > max) {
        throw new Error('Formality range must be between 0 and 1, with min <= max');
      }
    }
  }
}

module.exports = { SocialNormsManager };
