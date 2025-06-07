/**
 * @fileoverview Collaboration Manager for the Decision Intelligence Tentacle
 * 
 * This module provides collaborative decision-making capabilities, allowing multiple
 * users to participate in decision processes with role-based permissions, real-time
 * synchronization, and consensus-building mechanisms.
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');

/**
 * Collaboration Manager for collaborative decision-making
 */
class CollaborationManager {
  /**
   * Creates a new instance of the Collaboration Manager
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('CollaborationManager');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      maxParticipants: config.maxParticipants || 10,
      defaultSessionTimeout: config.defaultSessionTimeout || 3600, // 1 hour in seconds
      consensusThreshold: config.consensusThreshold || 0.7, // 70% agreement required for consensus
      autoSyncInterval: config.autoSyncInterval || 5000, // 5 seconds
      ...config
    };
    
    // State
    this.sessions = new Map();
    this.participants = new Map();
    this.syncIntervals = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.createSession = this.createSession.bind(this);
    this.joinSession = this.joinSession.bind(this);
    this.leaveSession = this.leaveSession.bind(this);
    this.endSession = this.endSession.bind(this);
    this.submitInput = this.submitInput.bind(this);
    this.getSessionState = this.getSessionState.bind(this);
    this.getParticipants = this.getParticipants.bind(this);
    this.calculateConsensus = this.calculateConsensus.bind(this);
    this.syncSession = this.syncSession.bind(this);
  }
  
  /**
   * Initializes the Collaboration Manager
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Collaboration Manager');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize components
      this.roleManager = this._createRoleManager();
      this.consensusEngine = this._createConsensusEngine();
      this.synchronizer = this._createSynchronizer();
      this.notificationManager = this._createNotificationManager();
      
      this.initialized = true;
      this.logger.info('Collaboration Manager initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'collaborationManager' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('collaboration');
      
      if (config) {
        this.config.maxParticipants = config.get('maxParticipants') || this.config.maxParticipants;
        this.config.defaultSessionTimeout = config.get('defaultSessionTimeout') || this.config.defaultSessionTimeout;
        this.config.consensusThreshold = config.get('consensusThreshold') || this.config.consensusThreshold;
        this.config.autoSyncInterval = config.get('autoSyncInterval') || this.config.autoSyncInterval;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Creates a role manager
   * @private
   * @returns {Object} Role manager
   */
  _createRoleManager() {
    this.logger.info('Creating role manager');
    
    return {
      /**
       * Defines a role with permissions
       * @param {string} sessionId Session ID
       * @param {string} roleName Role name
       * @param {Object} permissions Role permissions
       * @returns {boolean} Success flag
       */
      defineRole: (sessionId, roleName, permissions) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Initialize roles if not exists
          if (!session.roles) {
            session.roles = new Map();
          }
          
          // Define role
          session.roles.set(roleName, {
            name: roleName,
            permissions,
            createdAt: Date.now()
          });
          
          this.logger.info('Role defined', { sessionId, roleName, permissions });
          
          // Emit role defined event
          this.events.emit('roleDefinedEvent', { sessionId, roleName, permissions });
          
          return true;
        } catch (error) {
          this.logger.error('Error defining role', error);
          return false;
        }
      },
      
      /**
       * Assigns a role to a participant
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} roleName Role name
       * @returns {boolean} Success flag
       */
      assignRole: (sessionId, participantId, roleName) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if role exists
          if (!session.roles || !session.roles.has(roleName)) {
            this.logger.error('Role not found', { sessionId, roleName });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Assign role
          participant.role = roleName;
          
          this.logger.info('Role assigned', { sessionId, participantId, roleName });
          
          // Emit role assigned event
          this.events.emit('roleAssignedEvent', { sessionId, participantId, roleName });
          
          return true;
        } catch (error) {
          this.logger.error('Error assigning role', error);
          return false;
        }
      },
      
      /**
       * Checks if a participant has a permission
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} permission Permission to check
       * @returns {boolean} Has permission flag
       */
      hasPermission: (sessionId, participantId, permission) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Check if participant is the session owner
          if (participant.id === session.ownerId) {
            return true; // Session owner has all permissions
          }
          
          // Check if participant has a role
          if (!participant.role) {
            return false;
          }
          
          // Check if role exists
          if (!session.roles || !session.roles.has(participant.role)) {
            return false;
          }
          
          // Get role permissions
          const role = session.roles.get(participant.role);
          
          // Check permission
          return role.permissions[permission] === true;
        } catch (error) {
          this.logger.error('Error checking permission', error);
          return false;
        }
      }
    };
  }
  
  /**
   * Creates a consensus engine
   * @private
   * @returns {Object} Consensus engine
   */
  _createConsensusEngine() {
    this.logger.info('Creating consensus engine', { threshold: this.config.consensusThreshold });
    
    return {
      /**
       * Submits a vote for a decision option
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} decisionId Decision ID
       * @param {string} optionId Option ID
       * @param {number} value Vote value (0-1)
       * @returns {boolean} Success flag
       */
      submitVote: (sessionId, participantId, decisionId, optionId, value) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Check if decision exists
          if (!session.decisions || !session.decisions.has(decisionId)) {
            this.logger.error('Decision not found', { sessionId, decisionId });
            return false;
          }
          
          const decision = session.decisions.get(decisionId);
          
          // Check if option exists
          if (!decision.options.some(option => option.id === optionId)) {
            this.logger.error('Option not found', { sessionId, decisionId, optionId });
            return false;
          }
          
          // Initialize votes if not exists
          if (!decision.votes) {
            decision.votes = new Map();
          }
          
          // Initialize participant votes if not exists
          if (!decision.votes.has(participantId)) {
            decision.votes.set(participantId, new Map());
          }
          
          // Submit vote
          decision.votes.get(participantId).set(optionId, value);
          
          this.logger.info('Vote submitted', { sessionId, participantId, decisionId, optionId, value });
          
          // Emit vote submitted event
          this.events.emit('voteSubmittedEvent', { sessionId, participantId, decisionId, optionId, value });
          
          // Check if consensus is reached
          const consensus = this.calculateConsensus(sessionId, decisionId);
          
          if (consensus.reached) {
            this.logger.info('Consensus reached', { sessionId, decisionId, consensus });
            
            // Emit consensus reached event
            this.events.emit('consensusReachedEvent', { sessionId, decisionId, consensus });
          }
          
          return true;
        } catch (error) {
          this.logger.error('Error submitting vote', error);
          return false;
        }
      },
      
      /**
       * Submits a preference ranking for decision options
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} decisionId Decision ID
       * @param {Array<string>} ranking Ordered list of option IDs
       * @returns {boolean} Success flag
       */
      submitRanking: (sessionId, participantId, decisionId, ranking) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Check if decision exists
          if (!session.decisions || !session.decisions.has(decisionId)) {
            this.logger.error('Decision not found', { sessionId, decisionId });
            return false;
          }
          
          const decision = session.decisions.get(decisionId);
          
          // Validate ranking
          const validOptionIds = decision.options.map(option => option.id);
          const isValidRanking = ranking.every(optionId => validOptionIds.includes(optionId)) && 
                                ranking.length === validOptionIds.length;
          
          if (!isValidRanking) {
            this.logger.error('Invalid ranking', { sessionId, decisionId, ranking, validOptionIds });
            return false;
          }
          
          // Initialize rankings if not exists
          if (!decision.rankings) {
            decision.rankings = new Map();
          }
          
          // Submit ranking
          decision.rankings.set(participantId, ranking);
          
          this.logger.info('Ranking submitted', { sessionId, participantId, decisionId, ranking });
          
          // Emit ranking submitted event
          this.events.emit('rankingSubmittedEvent', { sessionId, participantId, decisionId, ranking });
          
          // Aggregate rankings
          const aggregatedRanking = this._aggregateRankings(decision.rankings);
          decision.aggregatedRanking = aggregatedRanking;
          
          this.logger.info('Rankings aggregated', { sessionId, decisionId, aggregatedRanking });
          
          // Emit rankings aggregated event
          this.events.emit('rankingsAggregatedEvent', { sessionId, decisionId, aggregatedRanking });
          
          return true;
        } catch (error) {
          this.logger.error('Error submitting ranking', error);
          return false;
        }
      },
      
      /**
       * Submits feedback for a decision option
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} decisionId Decision ID
       * @param {string} optionId Option ID
       * @param {Object} feedback Feedback object
       * @returns {boolean} Success flag
       */
      submitFeedback: (sessionId, participantId, decisionId, optionId, feedback) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Check if decision exists
          if (!session.decisions || !session.decisions.has(decisionId)) {
            this.logger.error('Decision not found', { sessionId, decisionId });
            return false;
          }
          
          const decision = session.decisions.get(decisionId);
          
          // Check if option exists
          if (!decision.options.some(option => option.id === optionId)) {
            this.logger.error('Option not found', { sessionId, decisionId, optionId });
            return false;
          }
          
          // Initialize feedback if not exists
          if (!decision.feedback) {
            decision.feedback = new Map();
          }
          
          // Initialize option feedback if not exists
          if (!decision.feedback.has(optionId)) {
            decision.feedback.set(optionId, new Map());
          }
          
          // Submit feedback
          decision.feedback.get(optionId).set(participantId, {
            ...feedback,
            timestamp: Date.now()
          });
          
          this.logger.info('Feedback submitted', { sessionId, participantId, decisionId, optionId, feedback });
          
          // Emit feedback submitted event
          this.events.emit('feedbackSubmittedEvent', { sessionId, participantId, decisionId, optionId, feedback });
          
          return true;
        } catch (error) {
          this.logger.error('Error submitting feedback', error);
          return false;
        }
      }
    };
  }
  
  /**
   * Aggregates rankings using Borda count method
   * @private
   * @param {Map<string, Array<string>>} rankings Map of participant IDs to rankings
   * @returns {Array<string>} Aggregated ranking
   */
  _aggregateRankings(rankings) {
    try {
      if (rankings.size === 0) {
        return [];
      }
      
      // Get all option IDs from the first ranking
      const firstRanking = Array.from(rankings.values())[0];
      const optionIds = [...firstRanking];
      
      // Calculate Borda count for each option
      const scores = new Map();
      
      for (const optionId of optionIds) {
        scores.set(optionId, 0);
      }
      
      for (const ranking of rankings.values()) {
        for (let i = 0; i < ranking.length; i++) {
          const optionId = ranking[i];
          const score = ranking.length - i; // Higher score for higher rank
          scores.set(optionId, scores.get(optionId) + score);
        }
      }
      
      // Sort options by score
      return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by score in descending order
        .map(entry => entry[0]); // Extract option IDs
    } catch (error) {
      this.logger.error('Error aggregating rankings', error);
      return [];
    }
  }
  
  /**
   * Creates a synchronizer
   * @private
   * @returns {Object} Synchronizer
   */
  _createSynchronizer() {
    this.logger.info('Creating synchronizer', { interval: this.config.autoSyncInterval });
    
    return {
      /**
       * Starts auto-sync for a session
       * @param {string} sessionId Session ID
       * @returns {boolean} Success flag
       */
      startAutoSync: (sessionId) => {
        try {
          if (this.syncIntervals.has(sessionId)) {
            this.logger.info('Auto-sync already started', { sessionId });
            return true;
          }
          
          const interval = setInterval(() => {
            this.syncSession(sessionId);
          }, this.config.autoSyncInterval);
          
          this.syncIntervals.set(sessionId, interval);
          
          this.logger.info('Auto-sync started', { sessionId, interval: this.config.autoSyncInterval });
          
          return true;
        } catch (error) {
          this.logger.error('Error starting auto-sync', error);
          return false;
        }
      },
      
      /**
       * Stops auto-sync for a session
       * @param {string} sessionId Session ID
       * @returns {boolean} Success flag
       */
      stopAutoSync: (sessionId) => {
        try {
          if (!this.syncIntervals.has(sessionId)) {
            this.logger.info('Auto-sync not started', { sessionId });
            return true;
          }
          
          clearInterval(this.syncIntervals.get(sessionId));
          this.syncIntervals.delete(sessionId);
          
          this.logger.info('Auto-sync stopped', { sessionId });
          
          return true;
        } catch (error) {
          this.logger.error('Error stopping auto-sync', error);
          return false;
        }
      },
      
      /**
       * Synchronizes a session
       * @param {string} sessionId Session ID
       * @returns {boolean} Success flag
       */
      syncSession: (sessionId) => {
        return this.syncSession(sessionId);
      }
    };
  }
  
  /**
   * Creates a notification manager
   * @private
   * @returns {Object} Notification manager
   */
  _createNotificationManager() {
    this.logger.info('Creating notification manager');
    
    return {
      /**
       * Sends a notification to a participant
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {Object} notification Notification object
       * @returns {boolean} Success flag
       */
      sendNotification: (sessionId, participantId, notification) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if participant exists
          const participant = session.participants.find(p => p.id === participantId);
          
          if (!participant) {
            this.logger.error('Participant not found', { sessionId, participantId });
            return false;
          }
          
          // Initialize notifications if not exists
          if (!session.notifications) {
            session.notifications = new Map();
          }
          
          // Initialize participant notifications if not exists
          if (!session.notifications.has(participantId)) {
            session.notifications.set(participantId, []);
          }
          
          // Add notification
          session.notifications.get(participantId).push({
            ...notification,
            id: this._generateId(),
            timestamp: Date.now(),
            read: false
          });
          
          this.logger.info('Notification sent', { sessionId, participantId, notification });
          
          // Emit notification sent event
          this.events.emit('notificationSentEvent', { sessionId, participantId, notification });
          
          return true;
        } catch (error) {
          this.logger.error('Error sending notification', error);
          return false;
        }
      },
      
      /**
       * Sends a notification to all participants in a session
       * @param {string} sessionId Session ID
       * @param {Object} notification Notification object
       * @returns {boolean} Success flag
       */
      broadcastNotification: (sessionId, notification) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          let success = true;
          
          for (const participant of session.participants) {
            const result = this.notificationManager.sendNotification(sessionId, participant.id, notification);
            success = success && result;
          }
          
          this.logger.info('Notification broadcasted', { sessionId, notification });
          
          return success;
        } catch (error) {
          this.logger.error('Error broadcasting notification', error);
          return false;
        }
      },
      
      /**
       * Marks a notification as read
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {string} notificationId Notification ID
       * @returns {boolean} Success flag
       */
      markNotificationRead: (sessionId, participantId, notificationId) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return false;
          }
          
          // Check if notifications exist
          if (!session.notifications || !session.notifications.has(participantId)) {
            this.logger.error('Notifications not found', { sessionId, participantId });
            return false;
          }
          
          // Find notification
          const notifications = session.notifications.get(participantId);
          const notification = notifications.find(n => n.id === notificationId);
          
          if (!notification) {
            this.logger.error('Notification not found', { sessionId, participantId, notificationId });
            return false;
          }
          
          // Mark as read
          notification.read = true;
          
          this.logger.info('Notification marked as read', { sessionId, participantId, notificationId });
          
          return true;
        } catch (error) {
          this.logger.error('Error marking notification as read', error);
          return false;
        }
      },
      
      /**
       * Gets notifications for a participant
       * @param {string} sessionId Session ID
       * @param {string} participantId Participant ID
       * @param {boolean} unreadOnly Whether to get only unread notifications
       * @returns {Array<Object>} Notifications
       */
      getNotifications: (sessionId, participantId, unreadOnly = false) => {
        try {
          const session = this.sessions.get(sessionId);
          
          if (!session) {
            this.logger.error('Session not found', { sessionId });
            return [];
          }
          
          // Check if notifications exist
          if (!session.notifications || !session.notifications.has(participantId)) {
            return [];
          }
          
          // Get notifications
          const notifications = session.notifications.get(participantId);
          
          // Filter unread if needed
          return unreadOnly ? notifications.filter(n => !n.read) : notifications;
        } catch (error) {
          this.logger.error('Error getting notifications', error);
          return [];
        }
      }
    };
  }
  
  /**
   * Generates a unique ID
   * @private
   * @returns {string} Unique ID
   */
  _generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Creates a new collaborative decision session
   * @param {string} ownerId Owner ID
   * @param {string} name Session name
   * @param {Object} options Session options
   * @returns {Object} Session object
   */
  createSession(ownerId, name, options = {}) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Creating session', { ownerId, name, options });
    
    try {
      // Generate session ID
      const sessionId = this._generateId();
      
      // Create session
      const session = {
        id: sessionId,
        name,
        ownerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: options.timeout ? Date.now() + options.timeout * 1000 : null,
        status: 'active',
        participants: [
          {
            id: ownerId,
            joinedAt: Date.now(),
            role: 'owner',
            status: 'active'
          }
        ],
        decisions: new Map(),
        roles: new Map(),
        notifications: new Map(),
        ...options
      };
      
      // Add default roles
      session.roles.set('owner', {
        name: 'owner',
        permissions: {
          manageSession: true,
          manageParticipants: true,
          manageDecisions: true,
          vote: true,
          comment: true
        },
        createdAt: Date.now()
      });
      
      session.roles.set('participant', {
        name: 'participant',
        permissions: {
          vote: true,
          comment: true
        },
        createdAt: Date.now()
      });
      
      session.roles.set('observer', {
        name: 'observer',
        permissions: {
          comment: true
        },
        createdAt: Date.now()
      });
      
      // Store session
      this.sessions.set(sessionId, session);
      
      // Store participant
      this.participants.set(ownerId, {
        id: ownerId,
        sessions: [sessionId]
      });
      
      // Start auto-sync
      this.synchronizer.startAutoSync(sessionId);
      
      this.logger.info('Session created', { sessionId, ownerId, name });
      
      // Emit session created event
      this.events.emit('sessionCreatedEvent', { sessionId, ownerId, name });
      
      return {
        id: sessionId,
        name,
        ownerId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        status: session.status
      };
    } catch (error) {
      this.logger.error('Error creating session', error);
      throw error;
    }
  }
  
  /**
   * Joins a collaborative decision session
   * @param {string} sessionId Session ID
   * @param {string} participantId Participant ID
   * @param {Object} options Join options
   * @returns {boolean} Success flag
   */
  joinSession(sessionId, participantId, options = {}) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Joining session', { sessionId, participantId, options });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Check if session is active
      if (session.status !== 'active') {
        this.logger.error('Session is not active', { sessionId, status: session.status });
        return false;
      }
      
      // Check if session is expired
      if (session.expiresAt && session.expiresAt < Date.now()) {
        session.status = 'expired';
        this.logger.error('Session is expired', { sessionId, expiresAt: session.expiresAt });
        return false;
      }
      
      // Check if participant is already in session
      const existingParticipant = session.participants.find(p => p.id === participantId);
      
      if (existingParticipant) {
        // Update participant status
        existingParticipant.status = 'active';
        existingParticipant.lastActiveAt = Date.now();
        
        this.logger.info('Participant already in session, status updated', { sessionId, participantId });
        
        // Emit participant updated event
        this.events.emit('participantUpdatedEvent', { sessionId, participantId, status: 'active' });
        
        return true;
      }
      
      // Check if session is full
      if (session.participants.length >= this.config.maxParticipants) {
        this.logger.error('Session is full', { sessionId, maxParticipants: this.config.maxParticipants });
        return false;
      }
      
      // Add participant to session
      session.participants.push({
        id: participantId,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        role: options.role || 'participant',
        status: 'active'
      });
      
      // Update session
      session.updatedAt = Date.now();
      
      // Store participant
      if (!this.participants.has(participantId)) {
        this.participants.set(participantId, {
          id: participantId,
          sessions: [sessionId]
        });
      } else {
        const participant = this.participants.get(participantId);
        
        if (!participant.sessions.includes(sessionId)) {
          participant.sessions.push(sessionId);
        }
      }
      
      this.logger.info('Participant joined session', { sessionId, participantId, role: options.role || 'participant' });
      
      // Emit participant joined event
      this.events.emit('participantJoinedEvent', { sessionId, participantId, role: options.role || 'participant' });
      
      // Send notification to session owner
      this.notificationManager.sendNotification(sessionId, session.ownerId, {
        type: 'participant_joined',
        title: 'New Participant',
        message: `Participant ${participantId} joined the session`,
        severity: 'info'
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error joining session', error);
      return false;
    }
  }
  
  /**
   * Leaves a collaborative decision session
   * @param {string} sessionId Session ID
   * @param {string} participantId Participant ID
   * @returns {boolean} Success flag
   */
  leaveSession(sessionId, participantId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Leaving session', { sessionId, participantId });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Find participant
      const participantIndex = session.participants.findIndex(p => p.id === participantId);
      
      if (participantIndex === -1) {
        this.logger.error('Participant not found in session', { sessionId, participantId });
        return false;
      }
      
      // Check if participant is the owner
      if (session.ownerId === participantId) {
        this.logger.error('Session owner cannot leave, must end session instead', { sessionId, participantId });
        return false;
      }
      
      // Remove participant from session
      session.participants.splice(participantIndex, 1);
      
      // Update session
      session.updatedAt = Date.now();
      
      // Update participant
      if (this.participants.has(participantId)) {
        const participant = this.participants.get(participantId);
        participant.sessions = participant.sessions.filter(id => id !== sessionId);
        
        if (participant.sessions.length === 0) {
          this.participants.delete(participantId);
        }
      }
      
      this.logger.info('Participant left session', { sessionId, participantId });
      
      // Emit participant left event
      this.events.emit('participantLeftEvent', { sessionId, participantId });
      
      // Send notification to session owner
      this.notificationManager.sendNotification(sessionId, session.ownerId, {
        type: 'participant_left',
        title: 'Participant Left',
        message: `Participant ${participantId} left the session`,
        severity: 'info'
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error leaving session', error);
      return false;
    }
  }
  
  /**
   * Ends a collaborative decision session
   * @param {string} sessionId Session ID
   * @param {string} participantId Participant ID
   * @returns {boolean} Success flag
   */
  endSession(sessionId, participantId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Ending session', { sessionId, participantId });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Check if participant is the owner
      if (session.ownerId !== participantId) {
        this.logger.error('Only session owner can end session', { sessionId, participantId, ownerId: session.ownerId });
        return false;
      }
      
      // Update session status
      session.status = 'ended';
      session.updatedAt = Date.now();
      session.endedAt = Date.now();
      
      // Stop auto-sync
      this.synchronizer.stopAutoSync(sessionId);
      
      // Update participants
      for (const participant of session.participants) {
        if (this.participants.has(participant.id)) {
          const p = this.participants.get(participant.id);
          p.sessions = p.sessions.filter(id => id !== sessionId);
          
          if (p.sessions.length === 0) {
            this.participants.delete(participant.id);
          }
        }
      }
      
      this.logger.info('Session ended', { sessionId, participantId });
      
      // Emit session ended event
      this.events.emit('sessionEndedEvent', { sessionId, participantId });
      
      // Send notification to all participants
      this.notificationManager.broadcastNotification(sessionId, {
        type: 'session_ended',
        title: 'Session Ended',
        message: 'The session has been ended by the owner',
        severity: 'info'
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error ending session', error);
      return false;
    }
  }
  
  /**
   * Submits input to a collaborative decision session
   * @param {string} sessionId Session ID
   * @param {string} participantId Participant ID
   * @param {string} inputType Input type
   * @param {Object} inputData Input data
   * @returns {boolean} Success flag
   */
  submitInput(sessionId, participantId, inputType, inputData) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Submitting input', { sessionId, participantId, inputType });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Check if session is active
      if (session.status !== 'active') {
        this.logger.error('Session is not active', { sessionId, status: session.status });
        return false;
      }
      
      // Check if participant is in session
      const participant = session.participants.find(p => p.id === participantId);
      
      if (!participant) {
        this.logger.error('Participant not found in session', { sessionId, participantId });
        return false;
      }
      
      // Process input based on type
      let result = false;
      
      switch (inputType) {
        case 'vote':
          // Check permission
          if (!this.roleManager.hasPermission(sessionId, participantId, 'vote')) {
            this.logger.error('Participant does not have vote permission', { sessionId, participantId });
            return false;
          }
          
          result = this.consensusEngine.submitVote(
            sessionId,
            participantId,
            inputData.decisionId,
            inputData.optionId,
            inputData.value
          );
          break;
        case 'ranking':
          // Check permission
          if (!this.roleManager.hasPermission(sessionId, participantId, 'vote')) {
            this.logger.error('Participant does not have vote permission', { sessionId, participantId });
            return false;
          }
          
          result = this.consensusEngine.submitRanking(
            sessionId,
            participantId,
            inputData.decisionId,
            inputData.ranking
          );
          break;
        case 'feedback':
          // Check permission
          if (!this.roleManager.hasPermission(sessionId, participantId, 'comment')) {
            this.logger.error('Participant does not have comment permission', { sessionId, participantId });
            return false;
          }
          
          result = this.consensusEngine.submitFeedback(
            sessionId,
            participantId,
            inputData.decisionId,
            inputData.optionId,
            inputData.feedback
          );
          break;
        case 'decision':
          // Check permission
          if (!this.roleManager.hasPermission(sessionId, participantId, 'manageDecisions')) {
            this.logger.error('Participant does not have manage decisions permission', { sessionId, participantId });
            return false;
          }
          
          result = this._addDecision(sessionId, inputData.decision);
          break;
        default:
          this.logger.error('Unknown input type', { sessionId, participantId, inputType });
          return false;
      }
      
      if (result) {
        // Update participant last active time
        participant.lastActiveAt = Date.now();
        
        // Update session
        session.updatedAt = Date.now();
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error submitting input', error);
      return false;
    }
  }
  
  /**
   * Adds a decision to a session
   * @private
   * @param {string} sessionId Session ID
   * @param {Object} decision Decision object
   * @returns {boolean} Success flag
   */
  _addDecision(sessionId, decision) {
    try {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Initialize decisions if not exists
      if (!session.decisions) {
        session.decisions = new Map();
      }
      
      // Generate decision ID if not provided
      const decisionId = decision.id || this._generateId();
      
      // Add decision
      session.decisions.set(decisionId, {
        id: decisionId,
        title: decision.title,
        description: decision.description,
        options: decision.options,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        votes: new Map(),
        rankings: new Map(),
        feedback: new Map()
      });
      
      this.logger.info('Decision added', { sessionId, decisionId, decision });
      
      // Emit decision added event
      this.events.emit('decisionAddedEvent', { sessionId, decisionId, decision });
      
      // Send notification to all participants
      this.notificationManager.broadcastNotification(sessionId, {
        type: 'decision_added',
        title: 'New Decision',
        message: `A new decision "${decision.title}" has been added`,
        severity: 'info'
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error adding decision', error);
      return false;
    }
  }
  
  /**
   * Gets the current state of a collaborative decision session
   * @param {string} sessionId Session ID
   * @returns {Object} Session state
   */
  getSessionState(sessionId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Getting session state', { sessionId });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return null;
      }
      
      // Convert decisions map to array
      const decisions = Array.from(session.decisions.entries()).map(([id, decision]) => {
        // Convert votes map to object
        const votes = {};
        
        for (const [participantId, participantVotes] of decision.votes.entries()) {
          votes[participantId] = {};
          
          for (const [optionId, value] of participantVotes.entries()) {
            votes[participantId][optionId] = value;
          }
        }
        
        // Convert rankings map to object
        const rankings = {};
        
        for (const [participantId, ranking] of decision.rankings.entries()) {
          rankings[participantId] = ranking;
        }
        
        // Convert feedback map to object
        const feedback = {};
        
        if (decision.feedback) {
          for (const [optionId, optionFeedback] of decision.feedback.entries()) {
            feedback[optionId] = {};
            
            for (const [participantId, participantFeedback] of optionFeedback.entries()) {
              feedback[optionId][participantId] = participantFeedback;
            }
          }
        }
        
        return {
          id,
          title: decision.title,
          description: decision.description,
          options: decision.options,
          createdAt: decision.createdAt,
          updatedAt: decision.updatedAt,
          status: decision.status,
          votes,
          rankings,
          feedback,
          aggregatedRanking: decision.aggregatedRanking
        };
      });
      
      // Convert roles map to object
      const roles = {};
      
      for (const [roleName, role] of session.roles.entries()) {
        roles[roleName] = role;
      }
      
      return {
        id: session.id,
        name: session.name,
        ownerId: session.ownerId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        status: session.status,
        participants: session.participants,
        decisions,
        roles
      };
    } catch (error) {
      this.logger.error('Error getting session state', error);
      return null;
    }
  }
  
  /**
   * Gets participants in a collaborative decision session
   * @param {string} sessionId Session ID
   * @returns {Array<Object>} Participants
   */
  getParticipants(sessionId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Getting participants', { sessionId });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return [];
      }
      
      return session.participants;
    } catch (error) {
      this.logger.error('Error getting participants', error);
      return [];
    }
  }
  
  /**
   * Calculates consensus for a decision
   * @param {string} sessionId Session ID
   * @param {string} decisionId Decision ID
   * @returns {Object} Consensus result
   */
  calculateConsensus(sessionId, decisionId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    this.logger.info('Calculating consensus', { sessionId, decisionId });
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return { reached: false };
      }
      
      // Check if decision exists
      if (!session.decisions || !session.decisions.has(decisionId)) {
        this.logger.error('Decision not found', { sessionId, decisionId });
        return { reached: false };
      }
      
      const decision = session.decisions.get(decisionId);
      
      // Check if votes exist
      if (!decision.votes || decision.votes.size === 0) {
        return {
          reached: false,
          votesCount: 0,
          participantsCount: session.participants.length,
          threshold: this.config.consensusThreshold
        };
      }
      
      // Calculate votes for each option
      const optionVotes = new Map();
      
      for (const option of decision.options) {
        optionVotes.set(option.id, {
          id: option.id,
          title: option.title,
          totalVotes: 0,
          averageValue: 0,
          participantsVoted: 0
        });
      }
      
      // Process votes
      for (const [participantId, participantVotes] of decision.votes.entries()) {
        for (const [optionId, value] of participantVotes.entries()) {
          if (optionVotes.has(optionId)) {
            const optionVote = optionVotes.get(optionId);
            optionVote.totalVotes += value;
            optionVote.participantsVoted++;
          }
        }
      }
      
      // Calculate average values
      for (const [optionId, optionVote] of optionVotes.entries()) {
        if (optionVote.participantsVoted > 0) {
          optionVote.averageValue = optionVote.totalVotes / optionVote.participantsVoted;
        }
      }
      
      // Find option with highest average value
      let highestOption = null;
      let highestValue = -1;
      
      for (const [optionId, optionVote] of optionVotes.entries()) {
        if (optionVote.averageValue > highestValue) {
          highestValue = optionVote.averageValue;
          highestOption = optionVote;
        }
      }
      
      // Calculate participation rate
      const participationRate = decision.votes.size / session.participants.length;
      
      // Check if consensus is reached
      const consensusReached = participationRate >= this.config.consensusThreshold && highestValue >= 0.7;
      
      return {
        reached: consensusReached,
        votesCount: decision.votes.size,
        participantsCount: session.participants.length,
        participationRate,
        threshold: this.config.consensusThreshold,
        options: Array.from(optionVotes.values()),
        highestOption: highestOption
      };
    } catch (error) {
      this.logger.error('Error calculating consensus', error);
      return { reached: false };
    }
  }
  
  /**
   * Synchronizes a collaborative decision session
   * @param {string} sessionId Session ID
   * @returns {boolean} Success flag
   */
  syncSession(sessionId) {
    if (!this.initialized) {
      throw new Error('Collaboration Manager not initialized');
    }
    
    try {
      // Get session
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        this.logger.error('Session not found', { sessionId });
        return false;
      }
      
      // Check if session is active
      if (session.status !== 'active') {
        this.logger.debug('Session is not active, skipping sync', { sessionId, status: session.status });
        return false;
      }
      
      // Check if session is expired
      if (session.expiresAt && session.expiresAt < Date.now()) {
        session.status = 'expired';
        this.logger.info('Session expired', { sessionId, expiresAt: session.expiresAt });
        
        // Emit session expired event
        this.events.emit('sessionExpiredEvent', { sessionId });
        
        // Send notification to all participants
        this.notificationManager.broadcastNotification(sessionId, {
          type: 'session_expired',
          title: 'Session Expired',
          message: 'The session has expired',
          severity: 'info'
        });
        
        return false;
      }
      
      // Check for inactive participants
      const now = Date.now();
      const inactivityThreshold = 15 * 60 * 1000; // 15 minutes
      
      for (const participant of session.participants) {
        if (participant.status === 'active' && 
            participant.lastActiveAt && 
            now - participant.lastActiveAt > inactivityThreshold) {
          // Mark participant as inactive
          participant.status = 'inactive';
          
          this.logger.info('Participant marked as inactive', { sessionId, participantId: participant.id });
          
          // Emit participant updated event
          this.events.emit('participantUpdatedEvent', { sessionId, participantId: participant.id, status: 'inactive' });
        }
      }
      
      // Check for decisions that need consensus calculation
      if (session.decisions) {
        for (const [decisionId, decision] of session.decisions.entries()) {
          if (decision.status === 'active') {
            const consensus = this.calculateConsensus(sessionId, decisionId);
            
            if (consensus.reached && !decision.consensusReached) {
              // Mark decision as consensus reached
              decision.consensusReached = true;
              decision.consensusResult = consensus;
              decision.updatedAt = now;
              
              this.logger.info('Consensus reached for decision', { sessionId, decisionId, consensus });
              
              // Emit consensus reached event
              this.events.emit('consensusReachedEvent', { sessionId, decisionId, consensus });
              
              // Send notification to all participants
              this.notificationManager.broadcastNotification(sessionId, {
                type: 'consensus_reached',
                title: 'Consensus Reached',
                message: `Consensus has been reached for decision "${decision.title}"`,
                severity: 'success'
              });
            }
          }
        }
      }
      
      // Update session
      session.lastSyncAt = now;
      
      this.logger.debug('Session synchronized', { sessionId });
      
      return true;
    } catch (error) {
      this.logger.error('Error synchronizing session', error);
      return false;
    }
  }
  
  /**
   * Shuts down the Collaboration Manager
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Collaboration Manager');
    
    try {
      // Stop all auto-sync intervals
      for (const [sessionId, interval] of this.syncIntervals.entries()) {
        clearInterval(interval);
      }
      
      this.syncIntervals.clear();
      
      // Mark all sessions as ended
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.status === 'active') {
          session.status = 'ended';
          session.updatedAt = Date.now();
          session.endedAt = Date.now();
          
          // Emit session ended event
          this.events.emit('sessionEndedEvent', { sessionId, reason: 'shutdown' });
        }
      }
      
      this.initialized = false;
      this.logger.info('Collaboration Manager shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'collaborationManager' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
}

module.exports = { CollaborationManager };
