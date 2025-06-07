/**
 * @fileoverview Tests for the Collaboration Manager
 * 
 * This file contains unit tests for the CollaborationManager class, which provides
 * collaborative decision-making capabilities for the Decision Intelligence Tentacle.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { CollaborationManager } = require('../../../../src/tentacles/decision_intelligence/collaboration/CollaborationManager');

describe('CollaborationManager', () => {
  let collaborationManager;
  let mockAideon;
  
  beforeEach(() => {
    // Mock Aideon system
    mockAideon = {
      config: {
        getNamespace: sinon.stub().returns({
          getNamespace: sinon.stub().returns({
            getNamespace: sinon.stub().returns({
              get: sinon.stub()
            })
          })
        })
      }
    };
    
    // Create CollaborationManager instance
    collaborationManager = new CollaborationManager(mockAideon);
    
    // Initialize
    return collaborationManager.initialize();
  });
  
  afterEach(() => {
    // Shutdown
    return collaborationManager.shutdown();
  });
  
  describe('Session Management', () => {
    it('should create a new session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Verify session
      expect(session).to.be.an('object');
      expect(session.id).to.be.a('string');
      expect(session.name).to.equal('Test Session');
      expect(session.ownerId).to.equal('user1');
      expect(session.status).to.equal('active');
    });
    
    it('should allow participants to join a session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      const result = collaborationManager.joinSession(session.id, 'user2');
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify participants
      const participants = collaborationManager.getParticipants(session.id);
      expect(participants).to.be.an('array');
      expect(participants.length).to.equal(2);
      expect(participants[0].id).to.equal('user1');
      expect(participants[1].id).to.equal('user2');
    });
    
    it('should allow participants to leave a session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Leave session
      const result = collaborationManager.leaveSession(session.id, 'user2');
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify participants
      const participants = collaborationManager.getParticipants(session.id);
      expect(participants).to.be.an('array');
      expect(participants.length).to.equal(1);
      expect(participants[0].id).to.equal('user1');
    });
    
    it('should not allow session owner to leave', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Try to leave session
      const result = collaborationManager.leaveSession(session.id, 'user1');
      
      // Verify result
      expect(result).to.be.false;
      
      // Verify participants
      const participants = collaborationManager.getParticipants(session.id);
      expect(participants).to.be.an('array');
      expect(participants.length).to.equal(1);
      expect(participants[0].id).to.equal('user1');
    });
    
    it('should allow session owner to end a session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // End session
      const result = collaborationManager.endSession(session.id, 'user1');
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.status).to.equal('ended');
    });
    
    it('should not allow non-owner to end a session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Try to end session
      const result = collaborationManager.endSession(session.id, 'user2');
      
      // Verify result
      expect(result).to.be.false;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.status).to.equal('active');
    });
  });
  
  describe('Role Management', () => {
    it('should define roles with permissions', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Define role
      const result = collaborationManager.roleManager.defineRole(session.id, 'editor', {
        manageDecisions: true,
        vote: true,
        comment: true
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.roles).to.be.an('object');
      expect(state.roles.editor).to.be.an('object');
      expect(state.roles.editor.permissions.manageDecisions).to.be.true;
      expect(state.roles.editor.permissions.vote).to.be.true;
      expect(state.roles.editor.permissions.comment).to.be.true;
    });
    
    it('should assign roles to participants', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Define role
      collaborationManager.roleManager.defineRole(session.id, 'editor', {
        manageDecisions: true,
        vote: true,
        comment: true
      });
      
      // Assign role
      const result = collaborationManager.roleManager.assignRole(session.id, 'user2', 'editor');
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify participants
      const participants = collaborationManager.getParticipants(session.id);
      const user2 = participants.find(p => p.id === 'user2');
      expect(user2.role).to.equal('editor');
    });
    
    it('should check permissions correctly', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Define role
      collaborationManager.roleManager.defineRole(session.id, 'editor', {
        manageDecisions: true,
        vote: true,
        comment: true
      });
      
      // Assign role
      collaborationManager.roleManager.assignRole(session.id, 'user2', 'editor');
      
      // Check permissions
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user2', 'manageDecisions')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user2', 'vote')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user2', 'comment')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user2', 'manageSession')).to.be.false;
      
      // Owner should have all permissions
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user1', 'manageSession')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user1', 'manageParticipants')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user1', 'manageDecisions')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user1', 'vote')).to.be.true;
      expect(collaborationManager.roleManager.hasPermission(session.id, 'user1', 'comment')).to.be.true;
    });
  });
  
  describe('Decision Management', () => {
    it('should add decisions to a session', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Add decision
      const result = collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.decisions).to.be.an('array');
      expect(state.decisions.length).to.equal(1);
      expect(state.decisions[0].title).to.equal('Test Decision');
      expect(state.decisions[0].options.length).to.equal(2);
    });
    
    it('should submit votes for decision options', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Add decision
      collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          id: 'decision1',
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Submit vote
      const result = collaborationManager.submitInput(session.id, 'user1', 'vote', {
        decisionId: 'decision1',
        optionId: 'option1',
        value: 0.8
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.decisions[0].votes).to.be.an('object');
      expect(state.decisions[0].votes.user1).to.be.an('object');
      expect(state.decisions[0].votes.user1.option1).to.equal(0.8);
    });
    
    it('should submit rankings for decision options', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Add decision
      collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          id: 'decision1',
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Submit ranking
      const result = collaborationManager.submitInput(session.id, 'user1', 'ranking', {
        decisionId: 'decision1',
        ranking: ['option1', 'option2']
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.decisions[0].rankings).to.be.an('object');
      expect(state.decisions[0].rankings.user1).to.be.an('array');
      expect(state.decisions[0].rankings.user1[0]).to.equal('option1');
      expect(state.decisions[0].rankings.user1[1]).to.equal('option2');
    });
    
    it('should submit feedback for decision options', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Add decision
      collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          id: 'decision1',
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Submit feedback
      const result = collaborationManager.submitInput(session.id, 'user1', 'feedback', {
        decisionId: 'decision1',
        optionId: 'option1',
        feedback: {
          text: 'This is a good option',
          rating: 4
        }
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.decisions[0].feedback).to.be.an('object');
      expect(state.decisions[0].feedback.option1).to.be.an('object');
      expect(state.decisions[0].feedback.option1.user1).to.be.an('object');
      expect(state.decisions[0].feedback.option1.user1.text).to.equal('This is a good option');
      expect(state.decisions[0].feedback.option1.user1.rating).to.equal(4);
    });
  });
  
  describe('Consensus Calculation', () => {
    it('should calculate consensus correctly', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Add decision
      collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          id: 'decision1',
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Submit votes
      collaborationManager.submitInput(session.id, 'user1', 'vote', {
        decisionId: 'decision1',
        optionId: 'option1',
        value: 0.8
      });
      
      collaborationManager.submitInput(session.id, 'user2', 'vote', {
        decisionId: 'decision1',
        optionId: 'option1',
        value: 0.7
      });
      
      // Calculate consensus
      const consensus = collaborationManager.calculateConsensus(session.id, 'decision1');
      
      // Verify consensus
      expect(consensus).to.be.an('object');
      expect(consensus.reached).to.be.true;
      expect(consensus.votesCount).to.equal(2);
      expect(consensus.participantsCount).to.equal(2);
      expect(consensus.participationRate).to.equal(1);
      expect(consensus.options).to.be.an('array');
      expect(consensus.options.length).to.equal(2);
      expect(consensus.highestOption).to.be.an('object');
      expect(consensus.highestOption.id).to.equal('option1');
      expect(consensus.highestOption.averageValue).to.equal(0.75);
    });
    
    it('should not reach consensus with insufficient participation', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join sessions
      collaborationManager.joinSession(session.id, 'user2');
      collaborationManager.joinSession(session.id, 'user3');
      
      // Add decision
      collaborationManager.submitInput(session.id, 'user1', 'decision', {
        decision: {
          id: 'decision1',
          title: 'Test Decision',
          description: 'This is a test decision',
          options: [
            { id: 'option1', title: 'Option 1' },
            { id: 'option2', title: 'Option 2' }
          ]
        }
      });
      
      // Submit vote (only 1 out of 3 participants)
      collaborationManager.submitInput(session.id, 'user1', 'vote', {
        decisionId: 'decision1',
        optionId: 'option1',
        value: 0.8
      });
      
      // Calculate consensus
      const consensus = collaborationManager.calculateConsensus(session.id, 'decision1');
      
      // Verify consensus
      expect(consensus).to.be.an('object');
      expect(consensus.reached).to.be.false;
      expect(consensus.votesCount).to.equal(1);
      expect(consensus.participantsCount).to.equal(3);
      expect(consensus.participationRate).to.be.approximately(0.33, 0.01);
    });
  });
  
  describe('Notification Management', () => {
    it('should send notifications to participants', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Send notification
      const result = collaborationManager.notificationManager.sendNotification(session.id, 'user2', {
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test notification'
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Get notifications
      const notifications = collaborationManager.notificationManager.getNotifications(session.id, 'user2');
      
      // Verify notifications
      expect(notifications).to.be.an('array');
      expect(notifications.length).to.equal(1);
      expect(notifications[0].type).to.equal('info');
      expect(notifications[0].title).to.equal('Test Notification');
      expect(notifications[0].message).to.equal('This is a test notification');
      expect(notifications[0].read).to.be.false;
    });
    
    it('should broadcast notifications to all participants', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join sessions
      collaborationManager.joinSession(session.id, 'user2');
      collaborationManager.joinSession(session.id, 'user3');
      
      // Broadcast notification
      const result = collaborationManager.notificationManager.broadcastNotification(session.id, {
        type: 'info',
        title: 'Test Broadcast',
        message: 'This is a test broadcast'
      });
      
      // Verify result
      expect(result).to.be.true;
      
      // Get notifications for each participant
      const notifications1 = collaborationManager.notificationManager.getNotifications(session.id, 'user1');
      const notifications2 = collaborationManager.notificationManager.getNotifications(session.id, 'user2');
      const notifications3 = collaborationManager.notificationManager.getNotifications(session.id, 'user3');
      
      // Verify notifications
      expect(notifications1.length).to.equal(1);
      expect(notifications2.length).to.equal(1);
      expect(notifications3.length).to.equal(1);
      
      expect(notifications1[0].title).to.equal('Test Broadcast');
      expect(notifications2[0].title).to.equal('Test Broadcast');
      expect(notifications3[0].title).to.equal('Test Broadcast');
    });
    
    it('should mark notifications as read', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Send notification
      collaborationManager.notificationManager.sendNotification(session.id, 'user1', {
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test notification'
      });
      
      // Get notifications
      const notifications = collaborationManager.notificationManager.getNotifications(session.id, 'user1');
      
      // Mark notification as read
      const result = collaborationManager.notificationManager.markNotificationRead(session.id, 'user1', notifications[0].id);
      
      // Verify result
      expect(result).to.be.true;
      
      // Get notifications again
      const updatedNotifications = collaborationManager.notificationManager.getNotifications(session.id, 'user1');
      
      // Verify notification is marked as read
      expect(updatedNotifications[0].read).to.be.true;
      
      // Get unread notifications
      const unreadNotifications = collaborationManager.notificationManager.getNotifications(session.id, 'user1', true);
      
      // Verify no unread notifications
      expect(unreadNotifications.length).to.equal(0);
    });
  });
  
  describe('Session Synchronization', () => {
    it('should synchronize session state', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Sync session
      const result = collaborationManager.syncSession(session.id);
      
      // Verify result
      expect(result).to.be.true;
      
      // Verify session state
      const state = collaborationManager.getSessionState(session.id);
      expect(state.lastSyncAt).to.be.a('number');
    });
    
    it('should mark inactive participants', () => {
      // Create session
      const session = collaborationManager.createSession('user1', 'Test Session');
      
      // Join session
      collaborationManager.joinSession(session.id, 'user2');
      
      // Get participants
      const participants = collaborationManager.getParticipants(session.id);
      const user2 = participants.find(p => p.id === 'user2');
      
      // Manually set last active time to 20 minutes ago
      user2.lastActiveAt = Date.now() - 20 * 60 * 1000;
      
      // Sync session
      collaborationManager.syncSession(session.id);
      
      // Get updated participants
      const updatedParticipants = collaborationManager.getParticipants(session.id);
      const updatedUser2 = updatedParticipants.find(p => p.id === 'user2');
      
      // Verify participant is marked as inactive
      expect(updatedUser2.status).to.equal('inactive');
    });
  });
});
