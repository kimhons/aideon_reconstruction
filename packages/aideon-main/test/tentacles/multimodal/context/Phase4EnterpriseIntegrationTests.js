/**
 * @fileoverview Integration tests for MCP Phase 4 Enterprise Integration and Scaling.
 * 
 * This module provides comprehensive tests for the Phase 4 components:
 * - TeamContextSharingManager
 * - EnterpriseContextConnector
 * - ContextSynchronizationService
 * - ContextComplianceManager
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const { describe, it, before, beforeEach, after, afterEach } = require('mocha');

// Import mocks
const MockLogger = require('./mocks/MockLogger');
const MockConfigService = require('./mocks/MockConfigService');
const MockPerformanceMonitor = require('./mocks/MockPerformanceMonitor');
const MockSecurityManager = require('./mocks/MockSecurityManager');
const MockMCPContextManager = require('./mocks/MockMCPContextManager');
const EnhancedAsyncLockAdapter = require('./mocks/EnhancedAsyncLockAdapter');
const CoreDependencies = require('./mocks/CoreDependencies');

// Import components to test
const TeamContextSharingManager = require('../../../../../../src/tentacles/multimodal/context/providers/TeamContextSharingManager');
const EnterpriseContextConnector = require('../../../../../../src/tentacles/multimodal/context/providers/EnterpriseContextConnector');
const ContextSynchronizationService = require('../../../../../../src/tentacles/multimodal/context/providers/ContextSynchronizationService');
const ContextComplianceManager = require('../../../../../../src/tentacles/multimodal/context/providers/ContextComplianceManager');
const EnterpriseSourceAdapter = require('../../../../../../src/tentacles/multimodal/context/providers/adapters/EnterpriseSourceAdapter');
const SharePointAdapter = require('../../../../../../src/tentacles/multimodal/context/providers/adapters/SharePointAdapter');
const ConfluenceAdapter = require('../../../../../../src/tentacles/multimodal/context/providers/adapters/ConfluenceAdapter');
const FederatedQueryEngine = require('../../../../../../src/tentacles/multimodal/context/providers/query/FederatedQueryEngine');
const TaxonomyMappingSystem = require('../../../../../../src/tentacles/multimodal/context/providers/taxonomy/TaxonomyMappingSystem');

// Import Phase 3 components needed for integration
const ContextFusionEngine = require('../../../../../../src/tentacles/multimodal/context/providers/ContextFusionEngine');
const ContextPrioritizationSystem = require('../../../../../../src/tentacles/multimodal/context/providers/ContextPrioritizationSystem');
const ContextCompressionManager = require('../../../../../../src/tentacles/multimodal/context/providers/ContextCompressionManager');
const ContextSecurityManager = require('../../../../../../src/tentacles/multimodal/context/providers/ContextSecurityManager');
const ContextAnalyticsEngine = require('../../../../../../src/tentacles/multimodal/context/providers/ContextAnalyticsEngine');

describe('MCP Phase 4 Enterprise Integration Tests', function() {
  // Common test dependencies
  let dependencies;
  let lockAdapter;
  let logger;
  let configService;
  let performanceMonitor;
  let mcpContextManager;
  let contextSecurityManager;
  let contextCompressionManager;
  
  // Phase 3 components
  let fusionEngine;
  let prioritizationSystem;
  let analyticsEngine;
  
  // Phase 4 components
  let teamContextSharingManager;
  let enterpriseContextConnector;
  let contextSynchronizationService;
  let contextComplianceManager;
  let federatedQueryEngine;
  let taxonomyMappingSystem;
  
  // Enterprise adapters
  let sharePointAdapter;
  let confluenceAdapter;
  
  // Test data
  const testUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['user', 'developer']
  };
  
  const testDevices = [
    { id: 'device-1', name: 'Desktop', type: 'desktop', capabilities: { contextTypePriorities: { 'user.preferences': 10 } } },
    { id: 'device-2', name: 'Mobile', type: 'mobile', capabilities: { contextTypePriorities: { 'user.history': 10 } } }
  ];
  
  const testWorkspace = {
    id: 'workspace-1',
    name: 'Test Workspace',
    description: 'Test workspace for integration tests',
    members: [
      { userId: 'user-123', role: 'owner' },
      { userId: 'user-456', role: 'editor' }
    ]
  };
  
  const testCompliancePolicy = {
    id: 'policy-1',
    name: 'GDPR Compliance',
    type: 'GDPR',
    contextTypes: ['user.profile', 'user.preferences'],
    rules: {
      filterPII: true,
      piiFields: ['email', 'phone', 'address']
    }
  };
  
  // Setup before all tests
  before(function() {
    // Create dependencies
    logger = new MockLogger();
    configService = new MockConfigService();
    performanceMonitor = new MockPerformanceMonitor();
    lockAdapter = new EnhancedAsyncLockAdapter();
    mcpContextManager = new MockMCPContextManager();
    
    // Configure mock services
    configService.setConfig('teamContextSharing', {
      maxWorkspacesPerUser: 10,
      maxMembersPerWorkspace: 50,
      defaultRole: 'viewer'
    });
    
    configService.setConfig('enterpriseContextConnector', {
      maxConcurrentQueries: 3,
      defaultTimeout: 5000
    });
    
    configService.setConfig('contextSynchronizationService', {
      syncIntervalSeconds: 300,
      maxOfflineChanges: 100
    });
    
    configService.setConfig('contextComplianceManager', {
      defaultPolicyLevel: 'strict',
      maxAuditLogSize: 100
    });
    
    configService.setConfig('compliancePolicies', [testCompliancePolicy]);
    
    // Create core dependencies object
    dependencies = new CoreDependencies({
      logger,
      configService,
      performanceMonitor,
      lockAdapter
    });
  });
  
  // Setup before each test
  beforeEach(async function() {
    // Initialize Phase 3 components
    contextSecurityManager = new ContextSecurityManager({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      lockAdapter
    });
    
    contextCompressionManager = new ContextCompressionManager({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      lockAdapter
    });
    
    fusionEngine = new ContextFusionEngine({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      lockAdapter
    });
    
    prioritizationSystem = new ContextPrioritizationSystem({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextFusionEngine: fusionEngine,
      lockAdapter
    });
    
    analyticsEngine = new ContextAnalyticsEngine({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextPrioritizationSystem: prioritizationSystem,
      lockAdapter
    });
    
    // Initialize Phase 3 components
    await contextSecurityManager.initialize();
    await contextCompressionManager.initialize();
    await fusionEngine.initialize();
    await prioritizationSystem.initialize();
    await analyticsEngine.initialize();
    
    // Initialize Phase 4 components
    
    // 1. Team Context Sharing Manager
    teamContextSharingManager = new TeamContextSharingManager({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextSecurityManager,
      lockAdapter
    });
    
    // 2. Enterprise Context Connector
    federatedQueryEngine = new FederatedQueryEngine({
      logger,
      performanceMonitor,
      contextSecurityManager,
      configService
    });
    
    taxonomyMappingSystem = new TaxonomyMappingSystem({
      logger,
      performanceMonitor,
      configService
    });
    
    enterpriseContextConnector = new EnterpriseContextConnector({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextSecurityManager,
      federatedQueryEngine,
      taxonomyMappingSystem,
      lockAdapter
    });
    
    // 3. Context Synchronization Service
    contextSynchronizationService = new ContextSynchronizationService({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextSecurityManager,
      contextCompressionManager,
      lockAdapter
    });
    
    // 4. Context Compliance Manager
    contextComplianceManager = new ContextComplianceManager({
      logger,
      performanceMonitor,
      configService,
      mcpContextManager,
      contextSecurityManager,
      lockAdapter
    });
    
    // Initialize enterprise adapters
    sharePointAdapter = new SharePointAdapter(
      { siteUrl: 'https://example.sharepoint.com', type: 'sharepoint' },
      { logger, performanceMonitor, contextSecurityManager }
    );
    
    confluenceAdapter = new ConfluenceAdapter(
      { baseUrl: 'https://example.atlassian.net/wiki', type: 'confluence' },
      { logger, performanceMonitor, contextSecurityManager }
    );
    
    // Initialize Phase 4 components
    await teamContextSharingManager.initialize();
    await enterpriseContextConnector.initialize();
    await contextSynchronizationService.initialize();
    await contextComplianceManager.initialize();
    
    // Connect adapters
    await sharePointAdapter.connect();
    await confluenceAdapter.connect();
    
    // Authenticate adapters
    await sharePointAdapter.authenticate({ type: 'app', clientId: 'test-client', clientSecret: 'test-secret' });
    await confluenceAdapter.authenticate({ type: 'token', token: 'test-token' });
    
    // Register adapters with enterprise context connector
    await enterpriseContextConnector.registerAdapter('sharepoint', sharePointAdapter);
    await enterpriseContextConnector.registerAdapter('confluence', confluenceAdapter);
  });
  
  // Cleanup after each test
  afterEach(async function() {
    // Disconnect adapters
    await sharePointAdapter.disconnect();
    await confluenceAdapter.disconnect();
  });
  
  // TeamContextSharingManager Tests
  describe('TeamContextSharingManager', function() {
    it('should create a workspace', async function() {
      const workspace = await teamContextSharingManager.createWorkspace({
        name: testWorkspace.name,
        description: testWorkspace.description,
        createdBy: testUser.id
      });
      
      assert.ok(workspace.id, 'Workspace should have an ID');
      assert.strictEqual(workspace.name, testWorkspace.name, 'Workspace name should match');
      assert.strictEqual(workspace.description, testWorkspace.description, 'Workspace description should match');
      assert.strictEqual(workspace.members.length, 1, 'Workspace should have one member (creator)');
      assert.strictEqual(workspace.members[0].userId, testUser.id, 'Creator should be a member');
      assert.strictEqual(workspace.members[0].role, 'owner', 'Creator should be an owner');
    });
    
    it('should add a member to a workspace', async function() {
      // Create workspace
      const workspace = await teamContextSharingManager.createWorkspace({
        name: testWorkspace.name,
        description: testWorkspace.description,
        createdBy: testUser.id
      });
      
      // Add member
      const updatedWorkspace = await teamContextSharingManager.addWorkspaceMember(
        workspace.id,
        'user-456',
        'editor',
        { requestedBy: testUser.id }
      );
      
      assert.strictEqual(updatedWorkspace.members.length, 2, 'Workspace should have two members');
      const newMember = updatedWorkspace.members.find(m => m.userId === 'user-456');
      assert.ok(newMember, 'New member should exist');
      assert.strictEqual(newMember.role, 'editor', 'New member should have editor role');
    });
    
    it('should share context with workspace members', async function() {
      // Create workspace
      const workspace = await teamContextSharingManager.createWorkspace({
        name: testWorkspace.name,
        description: testWorkspace.description,
        createdBy: testUser.id
      });
      
      // Add member
      await teamContextSharingManager.addWorkspaceMember(
        workspace.id,
        'user-456',
        'editor',
        { requestedBy: testUser.id }
      );
      
      // Share context
      const contextType = 'project.status';
      const contextData = { status: 'in-progress', completion: 75, lastUpdate: Date.now() };
      
      const shareResult = await teamContextSharingManager.shareContext(
        workspace.id,
        contextType,
        contextData,
        { sharedBy: testUser.id }
      );
      
      assert.ok(shareResult.success, 'Context sharing should succeed');
      assert.strictEqual(shareResult.contextType, contextType, 'Context type should match');
      assert.strictEqual(shareResult.recipientCount, 2, 'Context should be shared with both members');
      
      // Verify context is accessible to members
      const accessResult = await teamContextSharingManager.checkContextAccess(
        'user-456',
        contextType,
        'read'
      );
      
      assert.ok(accessResult.hasAccess, 'Member should have access to shared context');
    });
  });
  
  // EnterpriseContextConnector Tests
  describe('EnterpriseContextConnector', function() {
    it('should execute federated query across multiple sources', async function() {
      // Execute federated query
      const query = {
        type: 'search',
        query: 'project documentation'
      };
      
      const result = await enterpriseContextConnector.executeQuery(query);
      
      assert.ok(result.items, 'Query result should have items');
      assert.ok(Array.isArray(result.items), 'Items should be an array');
      assert.ok(result.sources, 'Query result should have sources');
      assert.strictEqual(result.sources.length, 2, 'Query should use both sources');
      
      // Verify sources in results
      const sourceTypes = result.sources.map(s => s.type);
      assert.ok(sourceTypes.includes('sharepoint'), 'Results should include SharePoint source');
      assert.ok(sourceTypes.includes('confluence'), 'Results should include Confluence source');
    });
    
    it('should map enterprise taxonomy to internal representation', async function() {
      // Get taxonomy from SharePoint
      const enterpriseTaxonomy = await sharePointAdapter.getTaxonomy();
      
      // Map taxonomy
      const mappedTaxonomy = await enterpriseContextConnector.mapTaxonomy(
        'sharepoint',
        enterpriseTaxonomy
      );
      
      assert.ok(mappedTaxonomy.categories, 'Mapped taxonomy should have categories');
      assert.ok(mappedTaxonomy.concepts, 'Mapped taxonomy should have concepts');
      assert.ok(mappedTaxonomy.source, 'Mapped taxonomy should have source info');
      assert.strictEqual(mappedTaxonomy.source.type, 'sharepoint', 'Source type should be SharePoint');
    });
    
    it('should register and use custom adapters', async function() {
      // Create custom adapter
      class CustomAdapter extends EnterpriseSourceAdapter {
        constructor(config, dependencies) {
          super(config, dependencies);
          this._setCapabilities({
            search: true,
            taxonomyAccess: true
          });
        }
        
        async connect() {
          this._setConnected(true, { id: 'custom-connection' });
          return true;
        }
        
        async disconnect() {
          this._setConnected(false);
          return true;
        }
        
        async authenticate() {
          this._setAuthenticated(true);
          return true;
        }
        
        async executeQuery(query) {
          return {
            value: [
              { id: 'custom-1', title: 'Custom Result 1' },
              { id: 'custom-2', title: 'Custom Result 2' }
            ],
            totalCount: 2
          };
        }
        
        async getTaxonomy() {
          return {
            id: 'custom-taxonomy',
            name: 'Custom Taxonomy',
            terms: [
              { id: 'term-1', name: 'Custom Term 1' }
            ]
          };
        }
      }
      
      // Create instance
      const customAdapter = new CustomAdapter(
        { type: 'custom' },
        { logger, performanceMonitor, contextSecurityManager }
      );
      
      // Connect and authenticate
      await customAdapter.connect();
      await customAdapter.authenticate();
      
      // Register with connector
      await enterpriseContextConnector.registerAdapter('custom', customAdapter);
      
      // Execute query including custom adapter
      const query = {
        type: 'search',
        query: 'test'
      };
      
      const result = await enterpriseContextConnector.executeQuery(query);
      
      // Verify custom adapter results are included
      const customSource = result.sources.find(s => s.type === 'custom');
      assert.ok(customSource, 'Results should include custom source');
      
      // Disconnect custom adapter
      await customAdapter.disconnect();
    });
  });
  
  // ContextSynchronizationService Tests
  describe('ContextSynchronizationService', function() {
    it('should register devices', async function() {
      // Register devices
      const device1Result = await contextSynchronizationService.registerDevice(testDevices[0]);
      const device2Result = await contextSynchronizationService.registerDevice(testDevices[1]);
      
      assert.ok(device1Result.success, 'Device 1 registration should succeed');
      assert.ok(device2Result.success, 'Device 2 registration should succeed');
      assert.strictEqual(device1Result.status, 'registered', 'Device 1 should have registered status');
      assert.strictEqual(device2Result.status, 'registered', 'Device 2 should have registered status');
      
      // Get sync status
      const status1 = await contextSynchronizationService.getSyncStatus(testDevices[0].id);
      const status2 = await contextSynchronizationService.getSyncStatus(testDevices[1].id);
      
      assert.strictEqual(status1.deviceId, testDevices[0].id, 'Status should have correct device ID');
      assert.strictEqual(status2.deviceId, testDevices[1].id, 'Status should have correct device ID');
      assert.strictEqual(status1.status, 'active', 'Device 1 should be active');
      assert.strictEqual(status2.status, 'active', 'Device 2 should be active');
    });
    
    it('should synchronize context between devices', async function() {
      // Register devices
      await contextSynchronizationService.registerDevice(testDevices[0]);
      await contextSynchronizationService.registerDevice(testDevices[1]);
      
      // Create context changes for device 1
      const device1Changes = [
        {
          id: 'change-1',
          contextType: 'user.preferences',
          contextData: { theme: 'dark', fontSize: 14 },
          timestamp: Date.now()
        }
      ];
      
      // Synchronize device 1
      const syncResult = await contextSynchronizationService.synchronize(
        testDevices[0].id,
        { changes: device1Changes }
      );
      
      assert.ok(syncResult.success, 'Synchronization should succeed');
      assert.ok(syncResult.timestamp, 'Sync result should have timestamp');
      
      // Synchronize device 2 (should get changes from device 1)
      const syncResult2 = await contextSynchronizationService.synchronize(
        testDevices[1].id,
        { changes: [], lastSyncTimestamp: 0 }
      );
      
      assert.ok(syncResult2.success, 'Synchronization should succeed');
      assert.ok(syncResult2.changes, 'Sync result should have changes');
      assert.ok(syncResult2.changes.length > 0, 'Device 2 should receive changes');
      
      // Verify received changes
      const receivedChange = syncResult2.changes.find(c => c.contextType === 'user.preferences');
      assert.ok(receivedChange, 'Device 2 should receive user preferences');
    });
    
    it('should handle offline changes', async function() {
      // Register devices
      await contextSynchronizationService.registerDevice(testDevices[0]);
      
      // Queue offline changes
      const offlineChanges = [
        {
          id: 'offline-1',
          contextType: 'user.history',
          contextData: { lastPage: 'dashboard', visitTime: Date.now() },
          timestamp: Date.now()
        }
      ];
      
      const queueResult = await contextSynchronizationService.queueOfflineChanges(
        testDevices[0].id,
        offlineChanges
      );
      
      assert.ok(queueResult, 'Queuing offline changes should succeed');
      
      // Get offline changes
      const retrievedChanges = await contextSynchronizationService.getOfflineChanges(testDevices[0].id);
      
      assert.strictEqual(retrievedChanges.length, 1, 'Should retrieve one offline change');
      assert.strictEqual(retrievedChanges[0].id, 'offline-1', 'Change ID should match');
      
      // Clear offline changes
      const clearResult = await contextSynchronizationService.clearOfflineChanges(testDevices[0].id);
      
      assert.ok(clearResult, 'Clearing offline changes should succeed');
      
      // Verify changes are cleared
      const remainingChanges = await contextSynchronizationService.getOfflineChanges(testDevices[0].id);
      assert.strictEqual(remainingChanges.length, 0, 'No offline changes should remain');
    });
  });
  
  // ContextComplianceManager Tests
  describe('ContextComplianceManager', function() {
    it('should load compliance policies', async function() {
      // Reload policies
      const result = await contextComplianceManager.loadPolicies();
      
      assert.ok(result, 'Loading policies should succeed');
      
      // Add a new policy
      const newPolicy = {
        id: 'policy-2',
        name: 'HIPAA Compliance',
        type: 'HIPAA',
        contextTypes: ['health.records'],
        rules: {
          filterPII: true,
          piiFields: ['diagnosis', 'medication']
        }
      };
      
      const addResult = await contextComplianceManager.setPolicy(newPolicy);
      
      assert.ok(addResult, 'Adding policy should succeed');
    });
    
    it('should filter PII data based on compliance policies', async function() {
      // Create context with PII
      const contextType = 'user.profile';
      const contextData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        preferences: { theme: 'light' }
      };
      
      // Check compliance
      const result = await contextComplianceManager.checkCompliance(
        contextType,
        contextData,
        { userId: testUser.id }
      );
      
      assert.strictEqual(result.compliant, false, 'Data should not be compliant due to PII');
      assert.ok(result.violations.length > 0, 'Should have compliance violations');
      assert.strictEqual(result.filteredData.email, '[REDACTED]', 'Email should be redacted');
      assert.strictEqual(result.filteredData.phone, '[REDACTED]', 'Phone should be redacted');
      assert.strictEqual(result.filteredData.name, 'John Doe', 'Name should not be redacted');
      assert.deepStrictEqual(result.filteredData.preferences, { theme: 'light' }, 'Preferences should not be redacted');
    });
    
    it('should log audit events', async function() {
      // Perform some operations that generate audit events
      await contextComplianceManager.checkCompliance(
        'user.profile',
        { name: 'Test User', email: 'test@example.com' },
        { userId: testUser.id }
      );
      
      // Get audit log
      const auditLog = await contextComplianceManager.getAuditLog();
      
      assert.ok(auditLog.length > 0, 'Audit log should have entries');
      
      // Find compliance check event
      const complianceEvent = auditLog.find(e => e.eventType === 'complianceCheck');
      
      assert.ok(complianceEvent, 'Should have compliance check event');
      assert.strictEqual(complianceEvent.details.contextType, 'user.profile', 'Event should reference correct context type');
      assert.strictEqual(complianceEvent.details.userId, testUser.id, 'Event should reference user ID');
    });
  });
  
  // Integration Tests across all Phase 4 components
  describe('Phase 4 Cross-Component Integration', function() {
    it('should integrate team sharing with compliance filtering', async function() {
      // Create workspace
      const workspace = await teamContextSharingManager.createWorkspace({
        name: 'Compliance Test Workspace',
        description: 'Testing compliance with sharing',
        createdBy: testUser.id
      });
      
      // Add member
      await teamContextSharingManager.addWorkspaceMember(
        workspace.id,
        'user-456',
        'editor',
        { requestedBy: testUser.id }
      );
      
      // Create context with PII
      const contextType = 'user.profile';
      const contextData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        preferences: { theme: 'light' }
      };
      
      // Share context (should trigger compliance filtering)
      const shareResult = await teamContextSharingManager.shareContext(
        workspace.id,
        contextType,
        contextData,
        { 
          sharedBy: testUser.id,
          complianceCheck: true // Enable compliance check
        }
      );
      
      assert.ok(shareResult.success, 'Context sharing should succeed');
      assert.ok(shareResult.filtered, 'Context should be filtered');
      
      // Verify filtered context was shared
      const sharedContext = await mcpContextManager.getContext(contextType);
      assert.strictEqual(sharedContext.email, '[REDACTED]', 'Shared email should be redacted');
      assert.strictEqual(sharedContext.phone, '[REDACTED]', 'Shared phone should be redacted');
    });
    
    it('should integrate enterprise context with synchronization', async function() {
      // Register device
      await contextSynchronizationService.registerDevice(testDevices[0]);
      
      // Query enterprise sources
      const queryResult = await enterpriseContextConnector.executeQuery({
        type: 'search',
        query: 'project documentation'
      });
      
      // Extract first result
      const firstResult = queryResult.items[0];
      
      // Create context from enterprise data
      const contextType = 'enterprise.document';
      const contextData = {
        id: firstResult.id,
        title: firstResult.title,
        url: firstResult.url,
        source: firstResult.sourceType,
        retrieved: Date.now()
      };
      
      // Publish context
      await mcpContextManager.publishContext(contextType, contextData);
      
      // Synchronize device (should get enterprise context)
      const syncResult = await contextSynchronizationService.synchronize(
        testDevices[0].id,
        { changes: [], lastSyncTimestamp: 0 }
      );
      
      assert.ok(syncResult.success, 'Synchronization should succeed');
      
      // Find enterprise context in sync changes
      const enterpriseChange = syncResult.changes.find(c => c.contextType === contextType);
      assert.ok(enterpriseChange, 'Device should receive enterprise context');
    });
    
    it('should integrate all Phase 4 components in a complete workflow', async function() {
      // 1. Register devices
      await contextSynchronizationService.registerDevice(testDevices[0]);
      await contextSynchronizationService.registerDevice(testDevices[1]);
      
      // 2. Create workspace
      const workspace = await teamContextSharingManager.createWorkspace({
        name: 'Integration Workspace',
        description: 'Complete integration test',
        createdBy: testUser.id
      });
      
      // 3. Add member
      await teamContextSharingManager.addWorkspaceMember(
        workspace.id,
        'user-456',
        'editor',
        { requestedBy: testUser.id }
      );
      
      // 4. Query enterprise sources
      const queryResult = await enterpriseContextConnector.executeQuery({
        type: 'search',
        query: 'project status'
      });
      
      // 5. Map enterprise taxonomy
      const enterpriseTaxonomy = await sharePointAdapter.getTaxonomy();
      const mappedTaxonomy = await enterpriseContextConnector.mapTaxonomy(
        'sharepoint',
        enterpriseTaxonomy
      );
      
      // 6. Create context from enterprise data and taxonomy
      const contextType = 'project.status';
      const contextData = {
        title: 'Project Status Report',
        status: 'in-progress',
        completion: 75,
        lastUpdate: Date.now(),
        categories: mappedTaxonomy.categories.slice(0, 2),
        source: queryResult.items[0].sourceId,
        owner: testUser.id,
        team: workspace.members.map(m => m.userId),
        confidential: true
      };
      
      // 7. Check compliance before sharing
      const complianceResult = await contextComplianceManager.checkCompliance(
        contextType,
        contextData,
        { userId: testUser.id }
      );
      
      // 8. Share filtered context with workspace
      const shareResult = await teamContextSharingManager.shareContext(
        workspace.id,
        contextType,
        complianceResult.filteredData, // Use compliance-filtered data
        { sharedBy: testUser.id }
      );
      
      assert.ok(shareResult.success, 'Context sharing should succeed');
      
      // 9. Synchronize devices
      const syncResult1 = await contextSynchronizationService.synchronize(
        testDevices[0].id,
        { changes: [], lastSyncTimestamp: 0 }
      );
      
      const syncResult2 = await contextSynchronizationService.synchronize(
        testDevices[1].id,
        { changes: [], lastSyncTimestamp: 0 }
      );
      
      assert.ok(syncResult1.success, 'Device 1 synchronization should succeed');
      assert.ok(syncResult2.success, 'Device 2 synchronization should succeed');
      
      // 10. Verify both devices received shared context
      const device1Change = syncResult1.changes.find(c => c.contextType === contextType);
      const device2Change = syncResult2.changes.find(c => c.contextType === contextType);
      
      assert.ok(device1Change, 'Device 1 should receive project status');
      assert.ok(device2Change, 'Device 2 should receive project status');
    });
  });
});
