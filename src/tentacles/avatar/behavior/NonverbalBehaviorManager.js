/**
 * @fileoverview NonverbalBehaviorManager controls the avatar's nonverbal behaviors,
 * including facial expressions, gestures, posture, and other body language.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Manager for avatar nonverbal behaviors
 */
class NonverbalBehaviorManager {
  /**
   * Creates a new NonverbalBehaviorManager instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('NonverbalBehaviorManager');
    this.events = new EventEmitter();
    
    // Initialize behavior definitions
    this.behaviors = {
      facial: new Map(),
      gesture: new Map(),
      posture: new Map(),
      gaze: new Map(),
      proxemics: new Map()
    };
    
    // Initialize current behavior state
    this.currentState = {
      facial: {
        expression: 'neutral',
        intensity: 0.5,
        lastUpdated: Date.now()
      },
      gesture: {
        current: null,
        queue: [],
        lastUpdated: Date.now()
      },
      posture: {
        position: 'neutral',
        tension: 0.3,
        lastUpdated: Date.now()
      },
      gaze: {
        target: 'user',
        engagement: 0.7,
        lastUpdated: Date.now()
      },
      proxemics: {
        distance: 'personal',
        orientation: 'facing',
        lastUpdated: Date.now()
      }
    };
    
    // External context influences
    this.externalContext = {
      social: null,
      emotional: null,
      conversation: null
    };
    
    // Initialize configuration
    this.config = {
      enableMicroexpressions: true,
      enableIdleBehaviors: true,
      idleBehaviorFrequency: 0.3, // 0 (none) to 1 (frequent)
      expressionIntensityRange: [0.2, 0.8], // Min/max intensity
      culturalAdaptation: true,
      personalityInfluence: true,
      emotionalInfluence: true
    };
    
    // Behavior generation timers
    this.timers = {
      idle: null,
      microexpression: null
    };
    
    this.isInitialized = false;
    
    this.logger.info('NonverbalBehaviorManager created');
  }
  
  /**
   * Initializes the nonverbal behavior manager
   * 
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.configuration] - Manager configuration
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'nonverbal_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('NonverbalBehaviorManager already initialized');
        return;
      }
      
      this.logger.info('Initializing NonverbalBehaviorManager');
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Load default behaviors
      await this._loadDefaultBehaviors();
      
      // Start behavior generation timers if enabled
      if (this.config.enableIdleBehaviors) {
        this._startIdleBehaviorGeneration();
      }
      
      if (this.config.enableMicroexpressions) {
        this._startMicroexpressionGeneration();
      }
      
      this.isInitialized = true;
      this.events.emit('initialized');
      this.logger.info('NonverbalBehaviorManager initialized');
    } catch (error) {
      this.logger.error('Error initializing NonverbalBehaviorManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Generates nonverbal behaviors based on input context
   * 
   * @param {Object} context - Input context for behavior generation
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} Generated behaviors
   */
  async generateBehaviors(context, options = {}) {
    const lockKey = `generate_behaviors_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('NonverbalBehaviorManager not initialized');
      }
      
      this.logger.debug('Generating nonverbal behaviors', { 
        contextTypes: Object.keys(context) 
      });
      
      // Create behavior response object
      const behaviors = {
        facial: null,
        gesture: null,
        posture: null,
        gaze: null,
        proxemics: null
      };
      
      // Process emotional context
      if (context.emotional) {
        behaviors.facial = this._generateFacialExpression(context.emotional);
      }
      
      // Process conversational context
      if (context.conversation) {
        behaviors.gesture = this._generateGesture(context.conversation);
        behaviors.gaze = this._generateGaze(context.conversation);
      }
      
      // Process social context
      if (context.social) {
        behaviors.posture = this._generatePosture(context.social);
        behaviors.proxemics = this._generateProxemics(context.social);
      }
      
      // Apply cultural adaptations if enabled
      if (this.config.culturalAdaptation && context.social && context.social.culturalContext) {
        this._applyCulturalAdaptations(behaviors, context.social.culturalContext);
      }
      
      // Apply personality influence if enabled
      if (this.config.personalityInfluence && context.personality) {
        this._applyPersonalityInfluence(behaviors, context.personality);
      }
      
      // Update current state with new behaviors
      await this._updateBehaviorState(behaviors);
      
      // Emit event
      this.events.emit('behaviors_generated', behaviors);
      
      return behaviors;
    } catch (error) {
      this.logger.error('Error generating nonverbal behaviors', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Executes a specific nonverbal behavior
   * 
   * @param {string} behaviorType - Type of behavior (facial, gesture, posture, gaze, proxemics)
   * @param {string} behaviorId - Behavior identifier
   * @param {Object} [parameters] - Behavior parameters
   * @returns {Promise<Object>} Executed behavior
   */
  async executeBehavior(behaviorType, behaviorId, parameters = {}) {
    const lockKey = `execute_behavior_${behaviorType}_${behaviorId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('NonverbalBehaviorManager not initialized');
      }
      
      this.logger.debug('Executing nonverbal behavior', { 
        behaviorType, behaviorId 
      });
      
      // Validate behavior type
      if (!this.behaviors[behaviorType]) {
        throw new Error(`Invalid behavior type: ${behaviorType}`);
      }
      
      // Get behavior definition
      const behaviorDef = this.behaviors[behaviorType].get(behaviorId);
      if (!behaviorDef) {
        throw new Error(`Behavior not found: ${behaviorType}/${behaviorId}`);
      }
      
      // Create behavior execution object
      const behavior = {
        type: behaviorType,
        id: behaviorId,
        name: behaviorDef.name,
        parameters: {
          ...behaviorDef.defaultParameters,
          ...parameters
        },
        timestamp: Date.now()
      };
      
      // Update current state based on behavior type
      await this._updateBehaviorState({
        [behaviorType]: behavior
      });
      
      // Emit event
      this.events.emit('behavior_executed', behavior);
      
      return behavior;
    } catch (error) {
      this.logger.error('Error executing nonverbal behavior', { 
        error, behaviorType, behaviorId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current nonverbal behavior state
   * 
   * @returns {Object} Current behavior state
   */
  getCurrentState() {
    return JSON.parse(JSON.stringify(this.currentState));
  }
  
  /**
   * Registers a new nonverbal behavior definition
   * 
   * @param {string} behaviorType - Type of behavior (facial, gesture, posture, gaze, proxemics)
   * @param {Object} behavior - Behavior definition
   * @returns {Promise<Object>} Registered behavior
   */
  async registerBehavior(behaviorType, behavior) {
    const lockKey = `register_behavior_${behaviorType}_${behavior.id}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('NonverbalBehaviorManager not initialized');
      }
      
      this.logger.debug('Registering nonverbal behavior', { 
        behaviorType, behaviorId: behavior.id 
      });
      
      // Validate behavior type
      if (!this.behaviors[behaviorType]) {
        throw new Error(`Invalid behavior type: ${behaviorType}`);
      }
      
      // Validate behavior
      this._validateBehavior(behavior);
      
      // Add timestamps
      const registeredBehavior = {
        ...behavior,
        created: Date.now(),
        lastUpdated: Date.now()
      };
      
      // Store behavior
      this.behaviors[behaviorType].set(behavior.id, registeredBehavior);
      
      // Emit event
      this.events.emit('behavior_registered', {
        type: behaviorType,
        behavior: registeredBehavior
      });
      
      return registeredBehavior;
    } catch (error) {
      this.logger.error('Error registering nonverbal behavior', { 
        error, behaviorType, behaviorId: behavior.id 
      });
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
        throw new Error('NonverbalBehaviorManager not initialized');
      }
      
      this.logger.debug('Updating external context', { contextType });
      
      // Validate context type
      if (!['social', 'emotional', 'conversation'].includes(contextType)) {
        throw new Error(`Invalid external context type: ${contextType}`);
      }
      
      // Update external context
      this.externalContext[contextType] = {
        ...contextData,
        lastUpdated: Date.now()
      };
      
      // Generate behaviors based on updated context
      if (options && options.generateBehaviors) {
        await this.generateBehaviors(this.externalContext);
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
    const lockKey = 'update_nonverbal_config';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('NonverbalBehaviorManager not initialized');
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
      
      // Handle timer changes
      if (oldConfig.enableIdleBehaviors !== this.config.enableIdleBehaviors) {
        if (this.config.enableIdleBehaviors) {
          this._startIdleBehaviorGeneration();
        } else {
          this._stopIdleBehaviorGeneration();
        }
      }
      
      if (oldConfig.enableMicroexpressions !== this.config.enableMicroexpressions) {
        if (this.config.enableMicroexpressions) {
          this._startMicroexpressionGeneration();
        } else {
          this._stopMicroexpressionGeneration();
        }
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
   * Shuts down the nonverbal behavior manager
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = 'nonverbal_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('NonverbalBehaviorManager not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down NonverbalBehaviorManager');
      
      // Stop timers
      this._stopIdleBehaviorGeneration();
      this._stopMicroexpressionGeneration();
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('NonverbalBehaviorManager shut down');
    } catch (error) {
      this.logger.error('Error shutting down NonverbalBehaviorManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Loads default nonverbal behaviors
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultBehaviors() {
    this.logger.debug('Loading default nonverbal behaviors');
    
    // Load default facial expressions
    await this._loadDefaultFacialExpressions();
    
    // Load default gestures
    await this._loadDefaultGestures();
    
    // Load default postures
    await this._loadDefaultPostures();
    
    // Load default gaze behaviors
    await this._loadDefaultGazeBehaviors();
    
    // Load default proxemic behaviors
    await this._loadDefaultProxemicBehaviors();
  }
  
  /**
   * Loads default facial expressions
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultFacialExpressions() {
    // Basic emotions (Ekman's six basic emotions plus neutral)
    await this.registerBehavior('facial', {
      id: 'neutral',
      name: 'Neutral Expression',
      description: 'Relaxed, neutral facial expression',
      defaultParameters: {
        intensity: 0.5,
        duration: 1000
      },
      emotionalMapping: {
        valence: 0,
        arousal: 0.1,
        dominance: 0.5
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'happiness',
      name: 'Happy Expression',
      description: 'Smile with raised cheeks and crinkled eyes',
      defaultParameters: {
        intensity: 0.7,
        duration: 2000
      },
      emotionalMapping: {
        valence: 0.8,
        arousal: 0.6,
        dominance: 0.6
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'sadness',
      name: 'Sad Expression',
      description: 'Downturned mouth, raised inner eyebrows, drooping eyelids',
      defaultParameters: {
        intensity: 0.6,
        duration: 2500
      },
      emotionalMapping: {
        valence: -0.7,
        arousal: 0.3,
        dominance: 0.2
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'anger',
      name: 'Angry Expression',
      description: 'Lowered eyebrows, intense gaze, compressed lips',
      defaultParameters: {
        intensity: 0.7,
        duration: 2000
      },
      emotionalMapping: {
        valence: -0.8,
        arousal: 0.8,
        dominance: 0.8
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'fear',
      name: 'Fearful Expression',
      description: 'Raised eyebrows, widened eyes, open mouth',
      defaultParameters: {
        intensity: 0.7,
        duration: 1500
      },
      emotionalMapping: {
        valence: -0.7,
        arousal: 0.9,
        dominance: 0.1
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'disgust',
      name: 'Disgusted Expression',
      description: 'Wrinkled nose, raised upper lip, lowered eyebrows',
      defaultParameters: {
        intensity: 0.6,
        duration: 1800
      },
      emotionalMapping: {
        valence: -0.6,
        arousal: 0.5,
        dominance: 0.4
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'surprise',
      name: 'Surprised Expression',
      description: 'Raised eyebrows, widened eyes, open mouth',
      defaultParameters: {
        intensity: 0.8,
        duration: 1200
      },
      emotionalMapping: {
        valence: 0.1,
        arousal: 0.9,
        dominance: 0.3
      }
    });
    
    // Complex expressions
    await this.registerBehavior('facial', {
      id: 'confusion',
      name: 'Confused Expression',
      description: 'Furrowed brow, slight head tilt, pursed lips',
      defaultParameters: {
        intensity: 0.6,
        duration: 2000
      },
      emotionalMapping: {
        valence: -0.2,
        arousal: 0.4,
        dominance: 0.3
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'interest',
      name: 'Interested Expression',
      description: 'Raised eyebrows, slight smile, focused eyes',
      defaultParameters: {
        intensity: 0.6,
        duration: 2000
      },
      emotionalMapping: {
        valence: 0.5,
        arousal: 0.6,
        dominance: 0.5
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'contemplation',
      name: 'Contemplative Expression',
      description: 'Slight frown, eyes looking up or to the side, relaxed mouth',
      defaultParameters: {
        intensity: 0.5,
        duration: 2500
      },
      emotionalMapping: {
        valence: 0.1,
        arousal: 0.3,
        dominance: 0.6
      }
    });
    
    // Microexpressions
    await this.registerBehavior('facial', {
      id: 'micro_surprise',
      name: 'Surprise Microexpression',
      description: 'Brief widening of eyes and raised eyebrows',
      defaultParameters: {
        intensity: 0.5,
        duration: 300
      },
      emotionalMapping: {
        valence: 0.1,
        arousal: 0.7,
        dominance: 0.3
      }
    });
    
    await this.registerBehavior('facial', {
      id: 'micro_doubt',
      name: 'Doubt Microexpression',
      description: 'Brief one-sided lip raise or eyebrow raise',
      defaultParameters: {
        intensity: 0.4,
        duration: 250
      },
      emotionalMapping: {
        valence: -0.3,
        arousal: 0.4,
        dominance: 0.4
      }
    });
  }
  
  /**
   * Loads default gestures
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultGestures() {
    // Hand gestures
    await this.registerBehavior('gesture', {
      id: 'nod',
      name: 'Head Nod',
      description: 'Vertical head movement indicating agreement or acknowledgment',
      defaultParameters: {
        intensity: 0.6,
        repetitions: 2,
        speed: 0.7
      },
      conversationalMapping: {
        function: 'agreement',
        timing: 'response'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'head_shake',
      name: 'Head Shake',
      description: 'Horizontal head movement indicating disagreement or negation',
      defaultParameters: {
        intensity: 0.6,
        repetitions: 2,
        speed: 0.7
      },
      conversationalMapping: {
        function: 'disagreement',
        timing: 'response'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'hand_wave',
      name: 'Hand Wave',
      description: 'Waving hand as a greeting or farewell',
      defaultParameters: {
        intensity: 0.7,
        repetitions: 3,
        speed: 0.6
      },
      conversationalMapping: {
        function: 'greeting',
        timing: 'opening'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'pointing',
      name: 'Pointing Gesture',
      description: 'Extending index finger to indicate direction or object',
      defaultParameters: {
        intensity: 0.7,
        duration: 1500,
        direction: 'forward'
      },
      conversationalMapping: {
        function: 'reference',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'thinking',
      name: 'Thinking Gesture',
      description: 'Hand on chin or cheek, contemplative pose',
      defaultParameters: {
        intensity: 0.6,
        duration: 3000,
        hand: 'right'
      },
      conversationalMapping: {
        function: 'contemplation',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'open_palms',
      name: 'Open Palms Gesture',
      description: 'Showing open palms to indicate honesty or openness',
      defaultParameters: {
        intensity: 0.7,
        duration: 2000,
        height: 'mid'
      },
      conversationalMapping: {
        function: 'emphasis',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gesture', {
      id: 'shrug',
      name: 'Shoulder Shrug',
      description: 'Raising shoulders to indicate uncertainty or lack of knowledge',
      defaultParameters: {
        intensity: 0.6,
        duration: 1500
      },
      conversationalMapping: {
        function: 'uncertainty',
        timing: 'response'
      }
    });
    
    // Cultural gestures
    await this.registerBehavior('gesture', {
      id: 'bow',
      name: 'Bow',
      description: 'Bowing from the waist, common in Eastern cultures',
      defaultParameters: {
        intensity: 0.7,
        duration: 2000,
        depth: 'medium'
      },
      conversationalMapping: {
        function: 'greeting',
        timing: 'opening'
      },
      culturalContext: 'eastern'
    });
    
    await this.registerBehavior('gesture', {
      id: 'handshake',
      name: 'Handshake',
      description: 'Extending hand for a handshake, common in Western cultures',
      defaultParameters: {
        intensity: 0.7,
        duration: 2000,
        firmness: 'medium'
      },
      conversationalMapping: {
        function: 'greeting',
        timing: 'opening'
      },
      culturalContext: 'western'
    });
  }
  
  /**
   * Loads default postures
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultPostures() {
    await this.registerBehavior('posture', {
      id: 'neutral',
      name: 'Neutral Posture',
      description: 'Balanced, relaxed standing or sitting position',
      defaultParameters: {
        tension: 0.3,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.5,
        dominance: 0.5
      }
    });
    
    await this.registerBehavior('posture', {
      id: 'formal',
      name: 'Formal Posture',
      description: 'Upright, attentive posture with straight back',
      defaultParameters: {
        tension: 0.6,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.9,
        dominance: 0.7
      }
    });
    
    await this.registerBehavior('posture', {
      id: 'relaxed',
      name: 'Relaxed Posture',
      description: 'Casual, comfortable posture with slight slouch',
      defaultParameters: {
        tension: 0.2,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.2,
        dominance: 0.4
      }
    });
    
    await this.registerBehavior('posture', {
      id: 'attentive',
      name: 'Attentive Posture',
      description: 'Leaning slightly forward, engaged and focused',
      defaultParameters: {
        tension: 0.5,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.6,
        dominance: 0.5
      }
    });
    
    await this.registerBehavior('posture', {
      id: 'dominant',
      name: 'Dominant Posture',
      description: 'Expanded posture taking up more space, projecting confidence',
      defaultParameters: {
        tension: 0.5,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.7,
        dominance: 0.9
      }
    });
    
    await this.registerBehavior('posture', {
      id: 'submissive',
      name: 'Submissive Posture',
      description: 'Contracted posture taking up less space, projecting deference',
      defaultParameters: {
        tension: 0.4,
        duration: -1 // Indefinite
      },
      socialMapping: {
        formality: 0.6,
        dominance: 0.1
      }
    });
  }
  
  /**
   * Loads default gaze behaviors
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultGazeBehaviors() {
    await this.registerBehavior('gaze', {
      id: 'direct',
      name: 'Direct Gaze',
      description: 'Looking directly at the user or conversation partner',
      defaultParameters: {
        intensity: 0.7,
        duration: 3000,
        target: 'user'
      },
      conversationalMapping: {
        function: 'engagement',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gaze', {
      id: 'averted',
      name: 'Averted Gaze',
      description: 'Looking away from the user, often during thinking',
      defaultParameters: {
        intensity: 0.6,
        duration: 2000,
        direction: 'up'
      },
      conversationalMapping: {
        function: 'thinking',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gaze', {
      id: 'scanning',
      name: 'Scanning Gaze',
      description: 'Looking around the environment, taking in surroundings',
      defaultParameters: {
        intensity: 0.5,
        duration: 3000,
        pattern: 'horizontal'
      },
      conversationalMapping: {
        function: 'environmental_awareness',
        timing: 'transition'
      }
    });
    
    await this.registerBehavior('gaze', {
      id: 'referential',
      name: 'Referential Gaze',
      description: 'Looking at an object or direction being referenced',
      defaultParameters: {
        intensity: 0.7,
        duration: 1500,
        target: 'reference'
      },
      conversationalMapping: {
        function: 'reference',
        timing: 'during'
      }
    });
    
    await this.registerBehavior('gaze', {
      id: 'mutual',
      name: 'Mutual Gaze',
      description: 'Sustained eye contact during important moments',
      defaultParameters: {
        intensity: 0.8,
        duration: 4000,
        target: 'user'
      },
      conversationalMapping: {
        function: 'connection',
        timing: 'key_moment'
      }
    });
  }
  
  /**
   * Loads default proxemic behaviors
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultProxemicBehaviors() {
    await this.registerBehavior('proxemics', {
      id: 'intimate',
      name: 'Intimate Distance',
      description: 'Very close distance (0-18 inches)',
      defaultParameters: {
        distance: 0.2, // 0-1 scale
        orientation: 'facing'
      },
      socialMapping: {
        relationshipType: 'intimate',
        formality: 0.1
      }
    });
    
    await this.registerBehavior('proxemics', {
      id: 'personal',
      name: 'Personal Distance',
      description: 'Comfortable conversational distance (1.5-4 feet)',
      defaultParameters: {
        distance: 0.4, // 0-1 scale
        orientation: 'facing'
      },
      socialMapping: {
        relationshipType: 'personal',
        formality: 0.4
      }
    });
    
    await this.registerBehavior('proxemics', {
      id: 'social',
      name: 'Social Distance',
      description: 'Professional interaction distance (4-12 feet)',
      defaultParameters: {
        distance: 0.7, // 0-1 scale
        orientation: 'angled'
      },
      socialMapping: {
        relationshipType: 'professional',
        formality: 0.7
      }
    });
    
    await this.registerBehavior('proxemics', {
      id: 'public',
      name: 'Public Distance',
      description: 'Public speaking or presentation distance (12+ feet)',
      defaultParameters: {
        distance: 0.9, // 0-1 scale
        orientation: 'facing'
      },
      socialMapping: {
        relationshipType: 'public',
        formality: 0.9
      }
    });
  }
  
  /**
   * Generates a facial expression based on emotional context
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context information
   * @returns {Object} Facial expression behavior
   */
  _generateFacialExpression(emotionalContext) {
    if (!emotionalContext || !emotionalContext.emotionalState) {
      return null;
    }
    
    const { valence, arousal, dominance } = emotionalContext.emotionalState;
    
    // Find the closest matching expression based on emotional dimensions
    let closestExpression = null;
    let minDistance = Infinity;
    
    for (const expression of this.behaviors.facial.values()) {
      // Skip microexpressions for primary expression
      if (expression.id.startsWith('micro_')) {
        continue;
      }
      
      if (expression.emotionalMapping) {
        const mapping = expression.emotionalMapping;
        
        // Calculate distance in emotional space
        let distance = 0;
        let dimensions = 0;
        
        if (valence !== undefined && mapping.valence !== undefined) {
          distance += Math.pow(valence - mapping.valence, 2);
          dimensions++;
        }
        
        if (arousal !== undefined && mapping.arousal !== undefined) {
          distance += Math.pow(arousal - mapping.arousal, 2);
          dimensions++;
        }
        
        if (dominance !== undefined && mapping.dominance !== undefined) {
          distance += Math.pow(dominance - mapping.dominance, 2);
          dimensions++;
        }
        
        if (dimensions > 0) {
          distance = Math.sqrt(distance / dimensions);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestExpression = expression;
          }
        }
      }
    }
    
    // If no matching expression found, default to neutral
    if (!closestExpression) {
      closestExpression = this.behaviors.facial.get('neutral');
    }
    
    // Calculate intensity based on arousal and config limits
    let intensity = 0.5;
    if (arousal !== undefined) {
      intensity = arousal * 0.7 + 0.3;
    }
    
    // Clamp intensity to configured range
    const [minIntensity, maxIntensity] = this.config.expressionIntensityRange;
    intensity = Math.max(minIntensity, Math.min(maxIntensity, intensity));
    
    // Create behavior object
    return {
      type: 'facial',
      id: closestExpression.id,
      name: closestExpression.name,
      parameters: {
        ...closestExpression.defaultParameters,
        intensity
      },
      emotionalSource: {
        valence,
        arousal,
        dominance
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Generates a gesture based on conversational context
   * 
   * @private
   * @param {Object} conversationContext - Conversational context information
   * @returns {Object} Gesture behavior
   */
  _generateGesture(conversationContext) {
    if (!conversationContext) {
      return null;
    }
    
    const { function: convFunction, phase, emphasis } = conversationContext;
    
    // Map conversation function to gesture function
    let gestureFunction = convFunction;
    if (convFunction === 'inform') gestureFunction = 'emphasis';
    if (convFunction === 'question') gestureFunction = 'reference';
    if (convFunction === 'acknowledge') gestureFunction = 'agreement';
    
    // Map conversation phase to gesture timing
    let gestureTiming = 'during';
    if (phase === 'start') gestureTiming = 'opening';
    if (phase === 'end') gestureTiming = 'closing';
    
    // Find matching gestures
    const matchingGestures = [];
    
    for (const gesture of this.behaviors.gesture.values()) {
      if (gesture.conversationalMapping) {
        const mapping = gesture.conversationalMapping;
        
        if (mapping.function === gestureFunction && 
            mapping.timing === gestureTiming) {
          matchingGestures.push(gesture);
        }
      }
    }
    
    // If no matching gestures, return null
    if (matchingGestures.length === 0) {
      return null;
    }
    
    // Select a gesture (randomly if multiple match)
    const selectedGesture = matchingGestures[
      Math.floor(Math.random() * matchingGestures.length)
    ];
    
    // Calculate intensity based on emphasis
    let intensity = selectedGesture.defaultParameters.intensity || 0.5;
    if (emphasis !== undefined) {
      intensity = emphasis * 0.6 + 0.4;
    }
    
    // Create behavior object
    return {
      type: 'gesture',
      id: selectedGesture.id,
      name: selectedGesture.name,
      parameters: {
        ...selectedGesture.defaultParameters,
        intensity
      },
      conversationalSource: {
        function: convFunction,
        phase,
        emphasis
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Generates a posture based on social context
   * 
   * @private
   * @param {Object} socialContext - Social context information
   * @returns {Object} Posture behavior
   */
  _generatePosture(socialContext) {
    if (!socialContext) {
      return null;
    }
    
    const { formality, relationshipType, dominance } = socialContext;
    
    // Find the closest matching posture based on social dimensions
    let closestPosture = null;
    let minDistance = Infinity;
    
    for (const posture of this.behaviors.posture.values()) {
      if (posture.socialMapping) {
        const mapping = posture.socialMapping;
        
        // Calculate distance in social space
        let distance = 0;
        let dimensions = 0;
        
        if (formality !== undefined && mapping.formality !== undefined) {
          distance += Math.pow(formality - mapping.formality, 2);
          dimensions++;
        }
        
        if (dominance !== undefined && mapping.dominance !== undefined) {
          distance += Math.pow(dominance - mapping.dominance, 2);
          dimensions++;
        }
        
        if (dimensions > 0) {
          distance = Math.sqrt(distance / dimensions);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestPosture = posture;
          }
        }
      }
    }
    
    // If no matching posture found, default to neutral
    if (!closestPosture) {
      closestPosture = this.behaviors.posture.get('neutral');
    }
    
    // Calculate tension based on formality and dominance
    let tension = closestPosture.defaultParameters.tension || 0.3;
    if (formality !== undefined && dominance !== undefined) {
      tension = formality * 0.5 + dominance * 0.3 + 0.2;
    }
    
    // Create behavior object
    return {
      type: 'posture',
      id: closestPosture.id,
      name: closestPosture.name,
      parameters: {
        ...closestPosture.defaultParameters,
        tension
      },
      socialSource: {
        formality,
        relationshipType,
        dominance
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Generates a gaze behavior based on conversational context
   * 
   * @private
   * @param {Object} conversationContext - Conversational context information
   * @returns {Object} Gaze behavior
   */
  _generateGaze(conversationContext) {
    if (!conversationContext) {
      return null;
    }
    
    const { function: convFunction, phase, engagement } = conversationContext;
    
    // Map conversation function to gaze function
    let gazeFunction = 'engagement';
    if (convFunction === 'inform') gazeFunction = 'engagement';
    if (convFunction === 'question') gazeFunction = 'connection';
    if (convFunction === 'thinking') gazeFunction = 'thinking';
    if (convFunction === 'reference') gazeFunction = 'reference';
    
    // Map conversation phase to gaze timing
    let gazeTiming = 'during';
    if (phase === 'start') gazeTiming = 'opening';
    if (phase === 'end') gazeTiming = 'closing';
    if (phase === 'transition') gazeTiming = 'transition';
    
    // Find matching gaze behaviors
    const matchingGazes = [];
    
    for (const gaze of this.behaviors.gaze.values()) {
      if (gaze.conversationalMapping) {
        const mapping = gaze.conversationalMapping;
        
        if (mapping.function === gazeFunction) {
          matchingGazes.push(gaze);
        }
      }
    }
    
    // If no matching gaze behaviors, default to direct
    if (matchingGazes.length === 0) {
      const directGaze = this.behaviors.gaze.get('direct');
      if (directGaze) {
        matchingGazes.push(directGaze);
      }
    }
    
    // If still no matching gaze behaviors, return null
    if (matchingGazes.length === 0) {
      return null;
    }
    
    // Select a gaze behavior (randomly if multiple match)
    const selectedGaze = matchingGazes[
      Math.floor(Math.random() * matchingGazes.length)
    ];
    
    // Calculate intensity based on engagement
    let intensity = selectedGaze.defaultParameters.intensity || 0.7;
    if (engagement !== undefined) {
      intensity = engagement * 0.8 + 0.2;
    }
    
    // Create behavior object
    return {
      type: 'gaze',
      id: selectedGaze.id,
      name: selectedGaze.name,
      parameters: {
        ...selectedGaze.defaultParameters,
        intensity
      },
      conversationalSource: {
        function: convFunction,
        phase,
        engagement
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Generates a proxemic behavior based on social context
   * 
   * @private
   * @param {Object} socialContext - Social context information
   * @returns {Object} Proxemic behavior
   */
  _generateProxemics(socialContext) {
    if (!socialContext) {
      return null;
    }
    
    const { formality, relationshipType } = socialContext;
    
    // Find the closest matching proxemic behavior based on social dimensions
    let closestProxemic = null;
    let minDistance = Infinity;
    
    for (const proxemic of this.behaviors.proxemics.values()) {
      if (proxemic.socialMapping) {
        const mapping = proxemic.socialMapping;
        
        // Exact match on relationship type is important
        if (relationshipType && 
            mapping.relationshipType && 
            mapping.relationshipType !== relationshipType) {
          continue;
        }
        
        // Calculate distance in social space
        let distance = 0;
        let dimensions = 0;
        
        if (formality !== undefined && mapping.formality !== undefined) {
          distance += Math.pow(formality - mapping.formality, 2);
          dimensions++;
        }
        
        if (dimensions > 0) {
          distance = Math.sqrt(distance / dimensions);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestProxemic = proxemic;
          }
        }
      }
    }
    
    // If no matching proxemic behavior found, default to personal
    if (!closestProxemic) {
      closestProxemic = this.behaviors.proxemics.get('personal');
    }
    
    // Create behavior object
    return {
      type: 'proxemics',
      id: closestProxemic.id,
      name: closestProxemic.name,
      parameters: {
        ...closestProxemic.defaultParameters
      },
      socialSource: {
        formality,
        relationshipType
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Applies cultural adaptations to behaviors
   * 
   * @private
   * @param {Object} behaviors - Behaviors to adapt
   * @param {string} culturalContext - Cultural context
   */
  _applyCulturalAdaptations(behaviors, culturalContext) {
    if (!culturalContext) {
      return;
    }
    
    // Apply Western cultural adaptations
    if (culturalContext === 'western') {
      // More direct gaze
      if (behaviors.gaze) {
        behaviors.gaze.parameters.intensity = 
          Math.min(1, (behaviors.gaze.parameters.intensity || 0.7) * 1.2);
      }
      
      // More expansive gestures
      if (behaviors.gesture) {
        behaviors.gesture.parameters.intensity = 
          Math.min(1, (behaviors.gesture.parameters.intensity || 0.7) * 1.1);
      }
      
      // Replace bow with handshake if appropriate
      if (behaviors.gesture && behaviors.gesture.id === 'bow') {
        const handshake = this.behaviors.gesture.get('handshake');
        if (handshake) {
          behaviors.gesture = {
            type: 'gesture',
            id: 'handshake',
            name: handshake.name,
            parameters: {
              ...handshake.defaultParameters
            },
            conversationalSource: behaviors.gesture.conversationalSource,
            timestamp: Date.now()
          };
        }
      }
    }
    
    // Apply Eastern cultural adaptations
    else if (culturalContext === 'eastern') {
      // Less direct gaze
      if (behaviors.gaze) {
        behaviors.gaze.parameters.intensity = 
          Math.max(0, (behaviors.gaze.parameters.intensity || 0.7) * 0.8);
        
        // More frequent gaze aversion during conversation
        if (behaviors.gaze.id === 'direct') {
          behaviors.gaze.parameters.duration = 
            (behaviors.gaze.parameters.duration || 3000) * 0.7;
        }
      }
      
      // More restrained gestures
      if (behaviors.gesture) {
        behaviors.gesture.parameters.intensity = 
          Math.max(0, (behaviors.gesture.parameters.intensity || 0.7) * 0.9);
      }
      
      // Replace handshake with bow if appropriate
      if (behaviors.gesture && behaviors.gesture.id === 'handshake') {
        const bow = this.behaviors.gesture.get('bow');
        if (bow) {
          behaviors.gesture = {
            type: 'gesture',
            id: 'bow',
            name: bow.name,
            parameters: {
              ...bow.defaultParameters
            },
            conversationalSource: behaviors.gesture.conversationalSource,
            timestamp: Date.now()
          };
        }
      }
    }
  }
  
  /**
   * Applies personality influence to behaviors
   * 
   * @private
   * @param {Object} behaviors - Behaviors to adapt
   * @param {Object} personalityContext - Personality context
   */
  _applyPersonalityInfluence(behaviors, personalityContext) {
    if (!personalityContext || !personalityContext.traits) {
      return;
    }
    
    const traits = personalityContext.traits;
    
    // Extraversion influences gesture intensity and frequency
    if (traits.extraversion !== undefined) {
      if (behaviors.gesture) {
        behaviors.gesture.parameters.intensity = 
          this._blendValue(
            behaviors.gesture.parameters.intensity || 0.7,
            0.4 + traits.extraversion * 0.6,
            0.3
          );
      }
      
      if (behaviors.gaze) {
        behaviors.gaze.parameters.intensity = 
          this._blendValue(
            behaviors.gaze.parameters.intensity || 0.7,
            0.4 + traits.extraversion * 0.6,
            0.2
          );
      }
    }
    
    // Neuroticism influences facial expression intensity
    if (traits.neuroticism !== undefined) {
      if (behaviors.facial) {
        // Higher neuroticism can lead to more intense expressions
        behaviors.facial.parameters.intensity = 
          this._blendValue(
            behaviors.facial.parameters.intensity || 0.6,
            0.4 + traits.neuroticism * 0.6,
            0.2
          );
      }
    }
    
    // Agreeableness influences posture and proxemics
    if (traits.agreeableness !== undefined) {
      if (behaviors.posture) {
        // Higher agreeableness leads to more open, relaxed posture
        behaviors.posture.parameters.tension = 
          this._blendValue(
            behaviors.posture.parameters.tension || 0.5,
            0.7 - traits.agreeableness * 0.4,
            0.2
          );
      }
      
      if (behaviors.proxemics) {
        // Higher agreeableness leads to closer distance
        behaviors.proxemics.parameters.distance = 
          this._blendValue(
            behaviors.proxemics.parameters.distance || 0.5,
            0.7 - traits.agreeableness * 0.4,
            0.1
          );
      }
    }
  }
  
  /**
   * Updates the current behavior state
   * 
   * @private
   * @param {Object} behaviors - New behaviors
   * @returns {Promise<void>}
   */
  async _updateBehaviorState(behaviors) {
    // Update facial expression
    if (behaviors.facial) {
      this.currentState.facial = {
        expression: behaviors.facial.id,
        intensity: behaviors.facial.parameters.intensity,
        lastUpdated: Date.now()
      };
    }
    
    // Update gesture
    if (behaviors.gesture) {
      this.currentState.gesture = {
        current: behaviors.gesture,
        queue: this.currentState.gesture.queue,
        lastUpdated: Date.now()
      };
    }
    
    // Update posture
    if (behaviors.posture) {
      this.currentState.posture = {
        position: behaviors.posture.id,
        tension: behaviors.posture.parameters.tension,
        lastUpdated: Date.now()
      };
    }
    
    // Update gaze
    if (behaviors.gaze) {
      this.currentState.gaze = {
        target: behaviors.gaze.parameters.target || 'user',
        engagement: behaviors.gaze.parameters.intensity || 0.7,
        lastUpdated: Date.now()
      };
    }
    
    // Update proxemics
    if (behaviors.proxemics) {
      this.currentState.proxemics = {
        distance: behaviors.proxemics.id,
        orientation: behaviors.proxemics.parameters.orientation || 'facing',
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Starts idle behavior generation
   * 
   * @private
   */
  _startIdleBehaviorGeneration() {
    if (this.timers.idle) {
      clearInterval(this.timers.idle);
    }
    
    // Calculate interval based on frequency
    const baseInterval = 10000; // 10 seconds
    const interval = baseInterval / (this.config.idleBehaviorFrequency || 0.3);
    
    this.timers.idle = setInterval(() => {
      this._generateIdleBehavior();
    }, interval);
    
    this.logger.debug('Started idle behavior generation', { interval });
  }
  
  /**
   * Stops idle behavior generation
   * 
   * @private
   */
  _stopIdleBehaviorGeneration() {
    if (this.timers.idle) {
      clearInterval(this.timers.idle);
      this.timers.idle = null;
      this.logger.debug('Stopped idle behavior generation');
    }
  }
  
  /**
   * Generates an idle behavior
   * 
   * @private
   */
  _generateIdleBehavior() {
    if (!this.isInitialized) {
      return;
    }
    
    // Randomly select an idle behavior type
    const behaviorTypes = ['gesture', 'gaze', 'facial'];
    const selectedType = behaviorTypes[Math.floor(Math.random() * behaviorTypes.length)];
    
    try {
      switch (selectedType) {
        case 'gesture':
          this._generateIdleGesture();
          break;
        case 'gaze':
          this._generateIdleGaze();
          break;
        case 'facial':
          this._generateIdleFacial();
          break;
      }
    } catch (error) {
      this.logger.error('Error generating idle behavior', { error });
    }
  }
  
  /**
   * Generates an idle gesture
   * 
   * @private
   */
  _generateIdleGesture() {
    // Idle gestures: small movements, adjustments, etc.
    const idleGestures = ['nod', 'thinking'];
    
    // Randomly select an idle gesture
    const gestureId = idleGestures[Math.floor(Math.random() * idleGestures.length)];
    const gesture = this.behaviors.gesture.get(gestureId);
    
    if (gesture) {
      // Create a low-intensity version of the gesture
      const idleGesture = {
        type: 'gesture',
        id: gesture.id,
        name: gesture.name,
        parameters: {
          ...gesture.defaultParameters,
          intensity: 0.3, // Low intensity for idle
          duration: gesture.defaultParameters.duration || 1500
        },
        timestamp: Date.now()
      };
      
      // Update current state
      this.currentState.gesture = {
        current: idleGesture,
        queue: this.currentState.gesture.queue,
        lastUpdated: Date.now()
      };
      
      // Emit event
      this.events.emit('idle_behavior', idleGesture);
    }
  }
  
  /**
   * Generates an idle gaze behavior
   * 
   * @private
   */
  _generateIdleGaze() {
    // Idle gaze: looking around, brief aversions, etc.
    const idleGazes = ['averted', 'scanning'];
    
    // Randomly select an idle gaze
    const gazeId = idleGazes[Math.floor(Math.random() * idleGazes.length)];
    const gaze = this.behaviors.gaze.get(gazeId);
    
    if (gaze) {
      // Create a brief version of the gaze
      const idleGaze = {
        type: 'gaze',
        id: gaze.id,
        name: gaze.name,
        parameters: {
          ...gaze.defaultParameters,
          duration: (gaze.defaultParameters.duration || 2000) * 0.7
        },
        timestamp: Date.now()
      };
      
      // Update current state
      this.currentState.gaze = {
        target: idleGaze.parameters.target || 'environment',
        engagement: idleGaze.parameters.intensity || 0.5,
        lastUpdated: Date.now()
      };
      
      // Emit event
      this.events.emit('idle_behavior', idleGaze);
      
      // Schedule return to user gaze after the duration
      setTimeout(() => {
        this.currentState.gaze = {
          target: 'user',
          engagement: 0.7,
          lastUpdated: Date.now()
        };
      }, idleGaze.parameters.duration);
    }
  }
  
  /**
   * Generates an idle facial expression
   * 
   * @private
   */
  _generateIdleFacial() {
    // Idle facial expressions: subtle changes, blinks, etc.
    const idleFacials = ['neutral', 'interest'];
    
    // Randomly select an idle facial expression
    const facialId = idleFacials[Math.floor(Math.random() * idleFacials.length)];
    const facial = this.behaviors.facial.get(facialId);
    
    if (facial) {
      // Create a subtle version of the expression
      const idleFacial = {
        type: 'facial',
        id: facial.id,
        name: facial.name,
        parameters: {
          ...facial.defaultParameters,
          intensity: 0.4 // Subtle intensity for idle
        },
        timestamp: Date.now()
      };
      
      // Update current state
      this.currentState.facial = {
        expression: idleFacial.id,
        intensity: idleFacial.parameters.intensity,
        lastUpdated: Date.now()
      };
      
      // Emit event
      this.events.emit('idle_behavior', idleFacial);
    }
  }
  
  /**
   * Starts microexpression generation
   * 
   * @private
   */
  _startMicroexpressionGeneration() {
    if (this.timers.microexpression) {
      clearInterval(this.timers.microexpression);
    }
    
    // Microexpressions are rare, so use a long interval
    const interval = 30000; // 30 seconds
    
    this.timers.microexpression = setInterval(() => {
      // Only 20% chance of generating a microexpression each interval
      if (Math.random() < 0.2) {
        this._generateMicroexpression();
      }
    }, interval);
    
    this.logger.debug('Started microexpression generation', { interval });
  }
  
  /**
   * Stops microexpression generation
   * 
   * @private
   */
  _stopMicroexpressionGeneration() {
    if (this.timers.microexpression) {
      clearInterval(this.timers.microexpression);
      this.timers.microexpression = null;
      this.logger.debug('Stopped microexpression generation');
    }
  }
  
  /**
   * Generates a microexpression
   * 
   * @private
   */
  _generateMicroexpression() {
    if (!this.isInitialized) {
      return;
    }
    
    // Get all microexpressions
    const microexpressions = [];
    for (const [id, expression] of this.behaviors.facial.entries()) {
      if (id.startsWith('micro_')) {
        microexpressions.push(expression);
      }
    }
    
    if (microexpressions.length === 0) {
      return;
    }
    
    // Randomly select a microexpression
    const microexpression = microexpressions[
      Math.floor(Math.random() * microexpressions.length)
    ];
    
    // Create the microexpression behavior
    const microBehavior = {
      type: 'facial',
      id: microexpression.id,
      name: microexpression.name,
      parameters: {
        ...microexpression.defaultParameters
      },
      timestamp: Date.now()
    };
    
    // Store the current expression to restore after microexpression
    const currentExpression = {
      expression: this.currentState.facial.expression,
      intensity: this.currentState.facial.intensity
    };
    
    // Update current state
    this.currentState.facial = {
      expression: microBehavior.id,
      intensity: microBehavior.parameters.intensity,
      lastUpdated: Date.now()
    };
    
    // Emit event
    this.events.emit('microexpression', microBehavior);
    
    // Restore previous expression after microexpression duration
    setTimeout(() => {
      this.currentState.facial = {
        expression: currentExpression.expression,
        intensity: currentExpression.intensity,
        lastUpdated: Date.now()
      };
    }, microBehavior.parameters.duration);
  }
  
  /**
   * Blends a current value towards a target value based on weight
   *
   * @private
   * @param {number} currentValue - The current value
   * @param {number} targetValue - The target value
   * @param {number} weight - The weight of the target value (0-1)
   * @returns {number} The blended value
   */
  _blendValue(currentValue, targetValue, weight) {
    return currentValue * (1 - weight) + targetValue * weight;
  }
  
  /**
   * Validates a behavior definition
   *
   * @private
   * @param {Object} behavior - Behavior to validate
   * @throws {Error} If validation fails
   */
  _validateBehavior(behavior) {
    // Check required fields
    if (!behavior.id) {
      throw new Error('Behavior must have an ID');
    }
    if (!behavior.name) {
      throw new Error('Behavior must have a name');
    }
    if (!behavior.defaultParameters) {
      throw new Error('Behavior must have default parameters');
    }
  }
}

module.exports = { NonverbalBehaviorManager };
