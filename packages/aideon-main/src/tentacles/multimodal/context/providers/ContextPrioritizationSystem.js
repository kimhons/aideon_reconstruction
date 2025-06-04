/**
 * @fileoverview ContextPrioritizationSystem for ranking context by importance.
 * 
 * This module provides functionality for prioritizing context based on relevance,
 * recency, and importance to optimize decision-making across the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../../input/utils/EnhancedAsyncLockAdapter');

/**
 * ContextPrioritizationSystem ranks context by importance, relevance, and utility.
 */
class ContextPrioritizationSystem extends EventEmitter {
  /**
   * Constructor for ContextPrioritizationSystem.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.securityManager Security manager for access control
   * @param {Object} options.mcpContextManager MCP Context Manager instance
   * @param {Object} options.contextFusionEngine Context Fusion Engine instance
   */
  constructor(options = {}) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for ContextPrioritizationSystem');
    if (!options.logger) throw new Error('Logger is required for ContextPrioritizationSystem');
    if (!options.configService) throw new Error('ConfigService is required for ContextPrioritizationSystem');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for ContextPrioritizationSystem');
    if (!options.securityManager) throw new Error('SecurityManager is required for ContextPrioritizationSystem');
    if (!options.mcpContextManager) throw new Error('MCPContextManager is required for ContextPrioritizationSystem');
    if (!options.contextFusionEngine) throw new Error('ContextFusionEngine is required for ContextPrioritizationSystem');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.mcpContextManager = options.mcpContextManager;
    this.contextFusionEngine = options.contextFusionEngine;
    
    // Initialize state
    this.initialized = false;
    this.priorityScores = new Map();
    this.priorityFactors = new Map();
    this.contextRelevance = new Map();
    this.userAttention = new Map();
    this.taskRelevance = new Map();
    this.temporalDecayRates = new Map();
    this.lastAccessTimes = new Map();
    
    // Default configuration
    this.config = {
      decayInterval: 60000, // 1 minute
      baseDecayRate: 0.05,  // 5% per interval
      minPriority: 0.1,     // Minimum priority score
      maxPriority: 1.0,     // Maximum priority score
      defaultPriority: 0.5, // Default priority score
      priorityFactors: {
        recency: 0.3,       // Weight for recency
        relevance: 0.4,     // Weight for relevance
        confidence: 0.2,    // Weight for confidence
        userAttention: 0.1  // Weight for user attention
      }
    };
    
    // Create lock adapter for thread safety
    this.lockAdapter = new EnhancedAsyncLockAdapter();
    
    // Initialize locks with bound function wrappers
    this.locks = {
      priority: (name, fn) => this.lockAdapter.withLock(name, fn),
      decay: (name, fn) => this.lockAdapter.withLock(name, fn),
      update: (name, fn) => this.lockAdapter.withLock(name, fn)
    };
    
    this.logger.info('ContextPrioritizationSystem created');
  }
  
  /**
   * Initialize the context prioritization system.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing ContextPrioritizationSystem');
      
      // Apply custom configuration if provided
      if (options.config) {
        this.config = { ...this.config, ...options.config };
      }
      
      // Load configuration from config service
      const configuredPriorityFactors = this.configService.get('context.prioritization.factors');
      if (configuredPriorityFactors) {
        this.config.priorityFactors = { ...this.config.priorityFactors, ...configuredPriorityFactors };
      }
      
      // Initialize priority factors
      this._initializePriorityFactors();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Start temporal decay process
      this._startTemporalDecay();
      
      // Register with MCP Context Manager
      await this.mcpContextManager.registerContextProvider('prioritization', this);
      
      this.initialized = true;
      this.logger.info('ContextPrioritizationSystem initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ContextPrioritizationSystem: ${error.message}`, { error });
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
   * Initialize priority factors.
   * @private
   */
  _initializePriorityFactors() {
    try {
      this.logger.debug('Initializing priority factors');
      
      // Set default priority factors
      for (const [factor, weight] of Object.entries(this.config.priorityFactors)) {
        this.priorityFactors.set(factor, weight);
      }
      
      this.logger.debug('Priority factors initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize priority factors: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up event listeners for context updates.
   * @private
   */
  _setupEventListeners() {
    try {
      this.logger.debug('Setting up event listeners for context updates');
      
      // Listen for context fusion events
      this.contextFusionEngine.on('contextFused', this._handleContextFused.bind(this));
      
      // Listen for context update events from MCP Context Manager
      this.mcpContextManager.on('contextUpdated', this._handleContextUpdate.bind(this));
      
      // Listen for context request events from MCP Context Manager
      this.mcpContextManager.on('contextRequested', this._handleContextRequest.bind(this));
      
      // Listen for user attention events
      this.mcpContextManager.on('userAttentionUpdated', this._handleUserAttentionUpdate.bind(this));
      
      // Listen for task events
      this.mcpContextManager.on('taskUpdated', this._handleTaskUpdate.bind(this));
      
      this.logger.debug('Event listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up event listeners: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Calculate priority score for a context type.
   * @param {string} contextType Context type to calculate priority for
   * @returns {Promise<number>} Priority score between 0 and 1
   */
  async calculatePriorityScore(contextType) {
    try {
      this.logger.debug(`Calculating priority score for context type: ${contextType}`);
      
      // Use lock to ensure thread safety
      return await this.locks.priority('calculatePriorityScore', async () => {
        // Get existing priority score or use default
        let priorityScore = this.priorityScores.get(contextType) || this.config.defaultPriority;
        
        // Get factor values
        const recency = this._calculateRecencyFactor(contextType);
        const relevance = this._calculateRelevanceFactor(contextType);
        const confidence = await this._calculateConfidenceFactor(contextType);
        const userAttention = this._calculateUserAttentionFactor(contextType);
        
        // Apply weights to factors
        const weightedRecency = recency * (this.priorityFactors.get('recency') || this.config.priorityFactors.recency);
        const weightedRelevance = relevance * (this.priorityFactors.get('relevance') || this.config.priorityFactors.relevance);
        const weightedConfidence = confidence * (this.priorityFactors.get('confidence') || this.config.priorityFactors.confidence);
        const weightedUserAttention = userAttention * (this.priorityFactors.get('userAttention') || this.config.priorityFactors.userAttention);
        
        // Calculate combined score
        priorityScore = weightedRecency + weightedRelevance + weightedConfidence + weightedUserAttention;
        
        // Ensure score is within bounds
        priorityScore = Math.max(this.config.minPriority, Math.min(this.config.maxPriority, priorityScore));
        
        // Update priority score
        this.priorityScores.set(contextType, priorityScore);
        
        // Emit priority updated event
        this.emit('priorityUpdated', {
          contextType,
          priorityScore,
          factors: {
            recency,
            relevance,
            confidence,
            userAttention
          },
          timestamp: Date.now()
        });
        
        this.logger.debug(`Priority score calculated for ${contextType}: ${priorityScore}`);
        
        return priorityScore;
      });
    } catch (error) {
      this.logger.error(`Failed to calculate priority score: ${error.message}`, { error, contextType });
      return this.config.defaultPriority;
    }
  }
  
  /**
   * Calculate recency factor for priority score.
   * @private
   * @param {string} contextType Context type
   * @returns {number} Recency factor between 0 and 1
   */
  _calculateRecencyFactor(contextType) {
    const lastAccessTime = this.lastAccessTimes.get(contextType);
    if (!lastAccessTime) {
      return 0.5; // Default for unknown recency
    }
    
    const now = Date.now();
    const elapsed = now - lastAccessTime;
    const decayRate = this.temporalDecayRates.get(contextType) || this.config.baseDecayRate;
    
    // Calculate decay based on elapsed time
    const decayIntervals = elapsed / this.config.decayInterval;
    const decayFactor = Math.pow(1 - decayRate, decayIntervals);
    
    return decayFactor;
  }
  
  /**
   * Calculate relevance factor for priority score.
   * @private
   * @param {string} contextType Context type
   * @returns {number} Relevance factor between 0 and 1
   */
  _calculateRelevanceFactor(contextType) {
    return this.contextRelevance.get(contextType) || 0.5;
  }
  
  /**
   * Calculate confidence factor for priority score.
   * @private
   * @param {string} contextType Context type
   * @returns {Promise<number>} Confidence factor between 0 and 1
   */
  async _calculateConfidenceFactor(contextType) {
    try {
      const confidenceScore = this.contextFusionEngine.getConfidenceScore(contextType);
      return confidenceScore;
    } catch (error) {
      this.logger.error(`Failed to get confidence score: ${error.message}`, { error, contextType });
      return 0.5; // Default confidence
    }
  }
  
  /**
   * Calculate user attention factor for priority score.
   * @private
   * @param {string} contextType Context type
   * @returns {number} User attention factor between 0 and 1
   */
  _calculateUserAttentionFactor(contextType) {
    return this.userAttention.get(contextType) || 0.5;
  }
  
  /**
   * Start temporal decay process.
   * @private
   */
  _startTemporalDecay() {
    try {
      this.logger.debug('Starting temporal decay process');
      
      // Set up interval for temporal decay
      this.decayInterval = setInterval(() => {
        this._applyTemporalDecay().catch(error => {
          this.logger.error(`Error in temporal decay: ${error.message}`, { error });
        });
      }, this.config.decayInterval);
      
      this.logger.debug('Temporal decay process started successfully');
    } catch (error) {
      this.logger.error(`Failed to start temporal decay process: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Apply temporal decay to priority scores.
   * @private
   * @returns {Promise<void>}
   */
  async _applyTemporalDecay() {
    try {
      this.logger.debug('Applying temporal decay to priority scores');
      
      // Use lock to ensure thread safety
      await this.locks.decay('applyTemporalDecay', async () => {
        const now = Date.now();
        
        // Apply decay to each context type
        for (const [contextType, score] of this.priorityScores.entries()) {
          // Get last access time
          const lastAccess = this.lastAccessTimes.get(contextType) || now;
          
          // Calculate time since last access
          const timeSinceAccess = now - lastAccess;
          
          // Get decay rate for this context type
          const decayRate = this.temporalDecayRates.get(contextType) || this.config.baseDecayRate;
          
          // Calculate decay factor based on time since last access
          const intervals = Math.floor(timeSinceAccess / this.config.decayInterval);
          const decayFactor = Math.pow(1 - decayRate, intervals);
          
          // Apply decay
          const newScore = Math.max(
            this.config.minPriority,
            score * decayFactor
          );
          
          // Update priority score
          this.priorityScores.set(contextType, newScore);
        }
        
        // Emit event
        this.emit('priorityDecayed', {
          timestamp: now
        });
      });
      
      this.logger.debug('Temporal decay applied successfully');
    } catch (error) {
      this.logger.error(`Failed to apply temporal decay: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handle context fused events.
   * @private
   * @param {Object} event Context fused event
   */
  async _handleContextFused(event) {
    try {
      this.logger.debug(`Handling context fused event for types: ${event.contextTypes.join(', ')}`);
      
      // Get fused context
      const fusedContext = this.contextFusionEngine.getFusedContext();
      
      // Update priority scores for fused context
      await this.updatePriorityScores('fusion.unified', fusedContext);
      
      // Update priority scores for individual modalities
      for (const modalType of ['text', 'visual', 'audio', 'interaction']) {
        const modalContext = this.contextFusionEngine.getFusedContext(modalType);
        if (modalContext) {
          await this.updatePriorityScores(`fusion.${modalType}`, modalContext);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle context fused event: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context update events from MCP Context Manager.
   * @private
   * @param {Object} event Context update event
   */
  async _handleContextUpdate(event) {
    try {
      this.logger.debug(`Handling context update for type: ${event.contextType}`);
      
      // Update last access time
      this.lastAccessTimes.set(event.contextType, Date.now());
      
      // Update priority score if not from fusion engine
      if (!event.contextType.startsWith('fusion.')) {
        await this.updatePriorityScores(event.contextType, event.contextData);
      }
    } catch (error) {
      this.logger.error(`Failed to handle context update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context request events from MCP Context Manager.
   * @private
   * @param {Object} event Context request event
   */
  async _handleContextRequest(event) {
    try {
      // Check if this is a request for priority scores
      if (event.contextType === 'priority.scores' || event.contextType.startsWith('priority.')) {
        this.logger.debug(`Handling context request for type: ${event.contextType}`);
        
        // Process context request
        await this._processContextRequest(event.contextType, event.requestId, event.source);
      }
    } catch (error) {
      this.logger.error(`Failed to handle context request: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Process context request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processContextRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.priority('processContextRequest', async () => {
        this.logger.debug(`Processing context request for type: ${contextType}`);
        
        let contextData = null;
        
        if (contextType === 'priority.scores') {
          // Return all priority scores
          contextData = Object.fromEntries(this.priorityScores);
        } else if (contextType.startsWith('priority.')) {
          // Extract the specific context type
          const specificType = contextType.substring(9); // Remove 'priority.' prefix
          contextData = this.priorityScores.get(specificType);
        }
        
        // Update last access time
        this.lastAccessTimes.set(contextType, Date.now());
        
        // Respond to request
        await this.mcpContextManager.respondToContextRequest(requestId, {
          contextType,
          contextData,
          timestamp: Date.now(),
          source: 'ContextPrioritizationSystem'
        });
        
        this.logger.debug(`Context request processed for type: ${contextType}`);
      });
    } catch (error) {
      this.logger.error(`Failed to process context request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Handle user attention update events.
   * @private
   * @param {Object} event User attention update event
   */
  async _handleUserAttentionUpdate(event) {
    try {
      this.logger.debug(`Handling user attention update for focus: ${event.focus}`);
      
      // Update user attention
      await this.updateUserAttention(event.focus, event.data);
    } catch (error) {
      this.logger.error(`Failed to handle user attention update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle task update events.
   * @private
   * @param {Object} event Task update event
   */
  async _handleTaskUpdate(event) {
    try {
      this.logger.debug(`Handling task update for task: ${event.taskId}`);
      
      // Update task relevance
      await this.updateTaskRelevance(event.taskId, event.data);
    } catch (error) {
      this.logger.error(`Failed to handle task update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Update priority scores for a context type.
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<number>} Updated priority score
   */
  async updatePriorityScores(contextType, contextData) {
    try {
      this.logger.debug(`Updating priority score for context type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('priorityScoreUpdate');
      
      // Use lock to ensure thread safety
      return await this.locks.update('updatePriorityScores', async () => {
        // Calculate priority score
        const priorityScore = await this._calculatePriorityScore(contextType, contextData);
        
        // Update priority score
        this.priorityScores.set(contextType, priorityScore);
        
        // Update last access time
        this.lastAccessTimes.set(contextType, Date.now());
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('priorityUpdated', {
          contextType,
          priorityScore,
          timestamp: Date.now()
        });
        
        this.logger.debug(`Priority score updated for context type: ${contextType}, score: ${priorityScore}`);
        
        return priorityScore;
      });
    } catch (error) {
      this.logger.error(`Failed to update priority score: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Calculate priority score for a context type.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<number>} Priority score
   */
  async _calculatePriorityScore(contextType, contextData) {
    try {
      // Initialize score components
      const scoreComponents = {
        recency: 0,
        relevance: 0,
        confidence: 0,
        userAttention: 0
      };
      
      // Calculate recency score
      const now = Date.now();
      const lastAccess = this.lastAccessTimes.get(contextType) || now;
      const timeSinceAccess = now - lastAccess;
      const recencyScore = Math.max(0, 1 - (timeSinceAccess / (24 * 60 * 60 * 1000))); // Decay over 24 hours
      scoreComponents.recency = recencyScore;
      
      // Calculate relevance score
      const relevanceScore = this.contextRelevance.get(contextType) || 0.5;
      scoreComponents.relevance = relevanceScore;
      
      // Calculate confidence score
      let confidenceScore = 0.5; // Default confidence
      if (contextType.startsWith('fusion.')) {
        // Get confidence from fusion engine
        confidenceScore = this.contextFusionEngine.getConfidenceScore(contextType.substring(7)) || 0.5;
      }
      scoreComponents.confidence = confidenceScore;
      
      // Calculate user attention score
      const userAttentionScore = this.userAttention.get(contextType) || 0.3;
      scoreComponents.userAttention = userAttentionScore;
      
      // Calculate weighted score
      let weightedScore = 0;
      let totalWeight = 0;
      
      for (const [factor, score] of Object.entries(scoreComponents)) {
        const weight = this.priorityFactors.get(factor) || 0;
        weightedScore += score * weight;
        totalWeight += weight;
      }
      
      // Normalize score
      const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : this.config.defaultPriority;
      
      // Clamp score to valid range
      return Math.max(this.config.minPriority, Math.min(this.config.maxPriority, normalizedScore));
    } catch (error) {
      this.logger.error(`Failed to calculate priority score: ${error.message}`, { error, contextType });
      return this.config.defaultPriority;
    }
  }
  
  /**
   * Update user attention for a context type.
   * @param {string} contextType Context type
   * @param {Object} attentionData Attention data
   * @returns {Promise<number>} Updated attention score
   */
  async updateUserAttention(contextType, attentionData) {
    try {
      this.logger.debug(`Updating user attention for context type: ${contextType}`);
      
      // Use lock to ensure thread safety
      return await this.locks.update('updateUserAttention', async () => {
        // Calculate attention score
        const attentionScore = attentionData.score || 0.5;
        
        // Update user attention
        this.userAttention.set(contextType, attentionScore);
        
        // Update priority score
        await this.updatePriorityScores(contextType, {});
        
        this.logger.debug(`User attention updated for context type: ${contextType}, score: ${attentionScore}`);
        
        return attentionScore;
      });
    } catch (error) {
      this.logger.error(`Failed to update user attention: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Update task relevance for a context type.
   * @param {string} taskId Task ID
   * @param {Object} taskData Task data
   * @returns {Promise<Map<string, number>>} Updated task relevance scores
   */
  async updateTaskRelevance(taskId, taskData) {
    try {
      this.logger.debug(`Updating task relevance for task: ${taskId}`);
      
      // Use lock to ensure thread safety
      return await this.locks.update('updateTaskRelevance', async () => {
        // Get context types relevant to this task
        const relevantTypes = taskData.relevantContextTypes || [];
        
        // Update task relevance for each context type
        for (const contextType of relevantTypes) {
          // Get current relevance
          const currentRelevance = this.contextRelevance.get(contextType) || 0.5;
          
          // Calculate new relevance (boost for active tasks)
          const newRelevance = taskData.active ? Math.min(1.0, currentRelevance + 0.2) : currentRelevance;
          
          // Update context relevance
          this.contextRelevance.set(contextType, newRelevance);
          
          // Update priority score
          await this.updatePriorityScores(contextType, {});
        }
        
        this.logger.debug(`Task relevance updated for task: ${taskId}`);
        
        return this.contextRelevance;
      });
    } catch (error) {
      this.logger.error(`Failed to update task relevance: ${error.message}`, { error, taskId });
      throw error;
    }
  }
  
  /**
   * Update context usage statistics.
   * @param {string} contextType Context type
   * @param {Object} usageData Usage data
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContextUsage(contextType, usageData) {
    try {
      this.logger.debug(`Updating context usage for type: ${contextType}`);
      
      // Use lock to ensure thread safety
      return await this.locks.update('updateContextUsage', async () => {
        // Update last access time
        this.lastAccessTimes.set(contextType, usageData.timestamp || Date.now());
        
        // Update relevance based on usage frequency
        if (usageData.frequency) {
          const currentRelevance = this.contextRelevance.get(contextType) || 0.5;
          const frequencyFactor = Math.min(1.0, usageData.frequency / 10); // Normalize frequency
          const newRelevance = Math.min(1.0, currentRelevance + (frequencyFactor * 0.1));
          this.contextRelevance.set(contextType, newRelevance);
        }
        
        // Update priority score
        await this.updatePriorityScores(contextType, {});
        
        this.logger.debug(`Context usage updated for type: ${contextType}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to update context usage: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Get priority score for a context type.
   * @param {string} contextType Context type
   * @returns {number} Priority score
   */
  getPriorityScore(contextType) {
    try {
      this.logger.debug(`Getting priority score for context type: ${contextType}`);
      
      // Update last access time
      this.lastAccessTimes.set(contextType, Date.now());
      
      // Get priority score
      const score = this.priorityScores.get(contextType);
      
      return score || this.config.defaultPriority;
    } catch (error) {
      this.logger.error(`Failed to get priority score: ${error.message}`, { error, contextType });
      return this.config.defaultPriority;
    }
  }
  
  /**
   * Get all priority scores.
   * @returns {Object} Priority scores
   */
  getAllPriorityScores() {
    try {
      this.logger.debug('Getting all priority scores');
      
      // Convert priority scores map to object
      return Object.fromEntries(this.priorityScores);
    } catch (error) {
      this.logger.error(`Failed to get all priority scores: ${error.message}`, { error });
      return {};
    }
  }
  
  /**
   * Set temporal decay rate for a context type.
   * @param {string} contextType Context type
   * @param {number} decayRate Decay rate (0-1)
   * @returns {boolean} True if setting was successful
   */
  setTemporalDecayRate(contextType, decayRate) {
    try {
      this.logger.debug(`Setting temporal decay rate for context type: ${contextType}`);
      
      // Validate decay rate
      if (decayRate < 0 || decayRate > 1) {
        throw new Error('Decay rate must be between 0 and 1');
      }
      
      // Set decay rate
      this.temporalDecayRates.set(contextType, decayRate);
      
      this.logger.debug(`Temporal decay rate set for context type: ${contextType}, rate: ${decayRate}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set temporal decay rate: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Dispose of resources.
   * @returns {Promise<boolean>} True if disposal was successful
   */
  async dispose() {
    try {
      this.logger.info('Disposing ContextPrioritizationSystem');
      
      // Clear decay interval
      if (this.decayInterval) {
        clearInterval(this.decayInterval);
      }
      
      // Remove event listeners
      this.contextFusionEngine.removeAllListeners('contextFused');
      this.mcpContextManager.removeAllListeners('contextUpdated');
      this.mcpContextManager.removeAllListeners('contextRequested');
      this.mcpContextManager.removeAllListeners('userAttentionUpdated');
      this.mcpContextManager.removeAllListeners('taskUpdated');
      
      // Clean up resources
      this.priorityScores.clear();
      this.priorityFactors.clear();
      this.contextRelevance.clear();
      this.userAttention.clear();
      this.taskRelevance.clear();
      this.temporalDecayRates.clear();
      this.lastAccessTimes.clear();
      
      this.logger.info('ContextPrioritizationSystem disposed successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to dispose ContextPrioritizationSystem: ${error.message}`, { error });
      return false;
    }
  }
}

module.exports = ContextPrioritizationSystem;
