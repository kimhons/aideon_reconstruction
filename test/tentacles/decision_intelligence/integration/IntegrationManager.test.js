/**
 * @fileoverview Integration tests for the Decision Intelligence Tentacle
 * 
 * This file contains integration tests for the Decision Intelligence Tentacle,
 * testing the interaction between advanced ML models, domain-specific frameworks,
 * and collaborative decision-making features.
 */

// Import Jest testing utilities
const { IntegrationManager } = require('../../../../src/tentacles/decision_intelligence/integration/IntegrationManager');
const { AdvancedMLModelsManager } = require('../../../../src/tentacles/decision_intelligence/advanced_ml/AdvancedMLModelsManager');
const { DomainFrameworkRegistry } = require('../../../../src/tentacles/decision_intelligence/domain_frameworks/DomainFrameworkRegistry');
const { CollaborationManager } = require('../../../../src/tentacles/decision_intelligence/collaboration/CollaborationManager');

// Jest test suite
describe('Decision Intelligence Tentacle Integration', () => {
  let mockAideon;
  let integrationManager;
  
  beforeEach(() => {
    // Mock Aideon system
    mockAideon = {
      config: {
        getNamespace: jest.fn().mockReturnValue({
          getNamespace: jest.fn().mockReturnValue({
            getNamespace: jest.fn().mockReturnValue({
              get: jest.fn()
            })
          })
        })
      }
    };
    
    // Create integration manager
    integrationManager = new IntegrationManager(mockAideon);
    
    // Mock component managers
    integrationManager.mlManager = new AdvancedMLModelsManager(mockAideon);
    integrationManager.domainRegistry = new DomainFrameworkRegistry(mockAideon);
    integrationManager.collaborationManager = new CollaborationManager(mockAideon);
    
    // Mock initialization
    jest.spyOn(integrationManager.mlManager, 'initialize').mockResolvedValue();
    jest.spyOn(integrationManager.domainRegistry, 'initialize').mockResolvedValue();
    jest.spyOn(integrationManager.collaborationManager, 'initialize').mockResolvedValue();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  // Basic test to verify Jest is running
  test('should exist as an object', () => {
    expect(integrationManager).toBeDefined();
  });
  
  test('should initialize successfully', async () => {
    // Initialize integration manager
    await integrationManager.initialize();
    
    // Verify initialization
    expect(integrationManager.initialized).toBe(true);
    expect(integrationManager.mlManager.initialize).toHaveBeenCalled();
    expect(integrationManager.domainRegistry.initialize).toHaveBeenCalled();
    expect(integrationManager.collaborationManager.initialize).toHaveBeenCalled();
  });
});
