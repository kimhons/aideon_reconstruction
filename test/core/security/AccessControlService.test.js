/**
 * @fileoverview Tests for AccessControlService
 * 
 * This file contains comprehensive tests for the AccessControlService implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { AccessControlService } = require('../../../src/core/security/AccessControlService');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

describe('AccessControlService', () => {
  let service;
  let mockConfig;
  let mockAuth;
  let mockEvents;
  
  beforeEach(() => {
    // Create mocks
    mockConfig = {
      get: sinon.stub().returns([]),
      set: sinon.stub().resolves()
    };
    
    mockAuth = {
      isAdmin: sinon.stub().resolves(true),
      getUserAttribute: sinon.stub().resolves(null),
      setUserAttribute: sinon.stub().resolves()
    };
    
    mockEvents = new EventEmitter();
    sinon.spy(mockEvents, 'emit');
    
    // Create service instance
    service = new AccessControlService({
      tentacleId: 'test-tentacle',
      config: mockConfig,
      auth: mockAuth,
      events: mockEvents
    });
    
    // Stub logger to prevent console output during tests
    sinon.stub(Logger.prototype, 'info');
    sinon.stub(Logger.prototype, 'warn');
    sinon.stub(Logger.prototype, 'error');
  });
  
  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });
  
  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(service.tentacleId).to.equal('test-tentacle');
      expect(service.config).to.equal(mockConfig);
      expect(service.auth).to.equal(mockAuth);
      expect(service.events).to.equal(mockEvents);
      expect(service.initialized).to.be.false;
      expect(service.adminOnly).to.be.true;
      expect(service.inviteEnabled).to.be.true;
      expect(service.inviteCodes).to.be.instanceOf(Map);
      expect(service.inviteCodes.size).to.equal(0);
    });
  });
  
  describe('Initialize', () => {
    it('should initialize and load invite codes', async () => {
      const mockInviteCodes = [
        {
          code: 'TEST-CODE-1',
          createdBy: 'admin1',
          createdAt: Date.now(),
          expiresAt: Date.now() + 86400000,
          maxUses: 1,
          uses: 0
        }
      ];
      
      mockConfig.get.withArgs('inviteCodes', []).returns(mockInviteCodes);
      mockConfig.get.withArgs('adminOnly', true).returns(false);
      mockConfig.get.withArgs('inviteEnabled', true).returns(true);
      
      await service.initialize();
      
      expect(service.initialized).to.be.true;
      expect(service.adminOnly).to.be.false;
      expect(service.inviteEnabled).to.be.true;
      expect(service.inviteCodes.size).to.equal(1);
      expect(service.inviteCodes.has('TEST-CODE-1')).to.be.true;
    });
    
    it('should not re-initialize if already initialized', async () => {
      service.initialized = true;
      
      await service.initialize();
      
      expect(mockConfig.get).not.to.have.been.called;
    });
    
    it('should handle initialization errors', async () => {
      const error = new Error('Initialization error');
      mockConfig.get.throws(error);
      
      try {
        await service.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(service.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
  });
  
  describe('Access Control', () => {
    beforeEach(async () => {
      service.initialized = true;
    });
    
    describe('hasAccess', () => {
      it('should grant access to admin users', async () => {
        mockAuth.isAdmin.resolves(true);
        
        const result = await service.hasAccess('admin1');
        
        expect(result).to.be.true;
        expect(mockAuth.isAdmin).to.have.been.calledWith('admin1');
      });
      
      it('should deny access to non-admin users when admin-only and invites disabled', async () => {
        mockAuth.isAdmin.resolves(false);
        service.adminOnly = true;
        service.inviteEnabled = false;
        
        const result = await service.hasAccess('user1');
        
        expect(result).to.be.false;
      });
      
      it('should grant access to users with valid invite codes', async () => {
        mockAuth.isAdmin.resolves(false);
        mockAuth.getUserAttribute.resolves('TEST-CODE-1');
        
        const now = Date.now();
        service.inviteCodes.set('TEST-CODE-1', {
          code: 'TEST-CODE-1',
          expiresAt: now + 86400000
        });
        
        const result = await service.hasAccess('user1');
        
        expect(result).to.be.true;
        expect(mockAuth.getUserAttribute).to.have.been.calledWith('user1', 'test-tentacleInviteCode');
      });
      
      it('should deny access to users with expired invite codes', async () => {
        mockAuth.isAdmin.resolves(false);
        mockAuth.getUserAttribute.resolves('TEST-CODE-1');
        
        const now = Date.now();
        service.inviteCodes.set('TEST-CODE-1', {
          code: 'TEST-CODE-1',
          expiresAt: now - 1000 // Expired
        });
        
        const result = await service.hasAccess('user1');
        
        expect(result).to.be.false;
      });
      
      it('should throw error if not initialized', async () => {
        service.initialized = false;
        
        try {
          await service.hasAccess('user1');
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Access control service is not initialized');
        }
      });
    });
    
    describe('generateInviteCode', () => {
      it('should generate a valid invite code', async () => {
        const options = { maxUses: 5, expiresIn: 172800000 };
        
        const result = await service.generateInviteCode('admin1', options);
        
        expect(result).to.have.property('code');
        expect(result.code).to.include('TE-'); // Prefix from tentacleId
        expect(result).to.have.property('expiresAt');
        expect(result).to.have.property('maxUses', 5);
        expect(service.inviteCodes.has(result.code)).to.be.true;
        expect(mockConfig.set).to.have.been.called;
        expect(mockEvents.emit).to.have.been.calledWith('invite:generated');
      });
      
      it('should use default values when options not provided', async () => {
        const result = await service.generateInviteCode('admin1');
        
        expect(result).to.have.property('maxUses', 1);
        const invite = service.inviteCodes.get(result.code);
        expect(invite).to.have.property('maxUses', 1);
        expect(invite).to.have.property('metadata').that.deep.equals({});
      });
      
      it('should throw error if user is not admin', async () => {
        mockAuth.isAdmin.resolves(false);
        
        try {
          await service.generateInviteCode('user1');
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Only admin users can generate invite codes');
          expect(service.inviteCodes.size).to.equal(0);
        }
      });
      
      it('should throw error if invite generation is disabled', async () => {
        service.inviteEnabled = false;
        
        try {
          await service.generateInviteCode('admin1');
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Invite code generation is disabled');
          expect(service.inviteCodes.size).to.equal(0);
        }
      });
    });
    
    describe('redeemInviteCode', () => {
      beforeEach(() => {
        const now = Date.now();
        service.inviteCodes.set('TEST-CODE-1', {
          code: 'TEST-CODE-1',
          createdBy: 'admin1',
          createdAt: now - 86400000,
          expiresAt: now + 86400000,
          maxUses: 1,
          uses: 0
        });
        
        service.inviteCodes.set('TEST-CODE-2', {
          code: 'TEST-CODE-2',
          createdBy: 'admin1',
          createdAt: now - 86400000,
          expiresAt: now - 1000, // Expired
          maxUses: 1,
          uses: 0
        });
        
        service.inviteCodes.set('TEST-CODE-3', {
          code: 'TEST-CODE-3',
          createdBy: 'admin1',
          createdAt: now - 86400000,
          expiresAt: now + 86400000,
          maxUses: 1,
          uses: 1 // Already used
        });
      });
      
      it('should successfully redeem a valid invite code', async () => {
        const result = await service.redeemInviteCode('user1', 'TEST-CODE-1');
        
        expect(result).to.be.true;
        expect(service.inviteCodes.get('TEST-CODE-1').uses).to.equal(1);
        expect(mockAuth.setUserAttribute).to.have.been.calledWith(
          'user1',
          'test-tentacleInviteCode',
          'TEST-CODE-1'
        );
        expect(mockConfig.set).to.have.been.called;
        expect(mockEvents.emit).to.have.been.calledWith('invite:redeemed');
      });
      
      it('should fail to redeem an expired invite code', async () => {
        const result = await service.redeemInviteCode('user1', 'TEST-CODE-2');
        
        expect(result).to.be.false;
        expect(service.inviteCodes.get('TEST-CODE-2').uses).to.equal(0);
        expect(mockAuth.setUserAttribute).not.to.have.been.called;
      });
      
      it('should fail to redeem a fully used invite code', async () => {
        const result = await service.redeemInviteCode('user1', 'TEST-CODE-3');
        
        expect(result).to.be.false;
        expect(service.inviteCodes.get('TEST-CODE-3').uses).to.equal(1);
        expect(mockAuth.setUserAttribute).not.to.have.been.called;
      });
      
      it('should fail to redeem a non-existent invite code', async () => {
        const result = await service.redeemInviteCode('user1', 'NON-EXISTENT');
        
        expect(result).to.be.false;
        expect(mockAuth.setUserAttribute).not.to.have.been.called;
      });
      
      it('should throw error if invite redemption is disabled', async () => {
        service.inviteEnabled = false;
        
        try {
          await service.redeemInviteCode('user1', 'TEST-CODE-1');
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Invite code redemption is disabled');
          expect(service.inviteCodes.get('TEST-CODE-1').uses).to.equal(0);
          expect(mockAuth.setUserAttribute).not.to.have.been.called;
        }
      });
    });
    
    describe('getActiveInviteCount', () => {
      beforeEach(() => {
        const now = Date.now();
        service.inviteCodes.set('TEST-CODE-1', {
          code: 'TEST-CODE-1',
          expiresAt: now + 86400000 // Active
        });
        
        service.inviteCodes.set('TEST-CODE-2', {
          code: 'TEST-CODE-2',
          expiresAt: now - 1000 // Expired
        });
        
        service.inviteCodes.set('TEST-CODE-3', {
          code: 'TEST-CODE-3',
          expiresAt: now + 86400000 // Active
        });
      });
      
      it('should return the correct count of active invite codes', () => {
        const count = service.getActiveInviteCount();
        
        expect(count).to.equal(2);
      });
      
      it('should throw error if not initialized', () => {
        service.initialized = false;
        
        try {
          service.getActiveInviteCount();
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Access control service is not initialized');
        }
      });
    });
  });
});
