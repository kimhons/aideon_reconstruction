/**
 * @fileoverview Integration tests for Marketplace UI components
 * Tests the integration between all UI components and their dependencies
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import components to test
const { MarketplaceUI } = require('../../../src/marketplace/ui/MarketplaceUI');
const { MarketplaceBrowser } = require('../../../src/marketplace/ui/browser/MarketplaceBrowser');
const { TentacleDetailView } = require('../../../src/marketplace/ui/browser/TentacleDetailView');
const { InstallationManager } = require('../../../src/marketplace/ui/installation/InstallationManager');
const { UserDashboard } = require('../../../src/marketplace/ui/dashboard/UserDashboard');

// Import mocked dependencies
const { MarketplaceCore } = require('../../../src/marketplace/MarketplaceCore');
const { MonetizationCore } = require('../../../src/marketplace/monetization/core/MonetizationCore');
const { TentacleRegistry } = require('../../../src/core/tentacles/TentacleRegistry');

describe('Marketplace UI Integration Tests', () => {
  let marketplaceCore;
  let monetizationCore;
  let tentacleRegistry;
  let marketplaceUI;
  
  beforeEach(() => {
    // Set up mocked dependencies
    marketplaceCore = new MarketplaceCore();
    monetizationCore = new MonetizationCore();
    tentacleRegistry = new TentacleRegistry();
    
    // Create MarketplaceUI instance with mocked dependencies
    marketplaceUI = new MarketplaceUI({
      marketplaceCore,
      monetizationCore,
      tentacleRegistry,
      config: {
        defaultTheme: 'light',
        enableAnalytics: false
      }
    });
  });
  
  afterEach(async () => {
    // Clean up after each test
    if (marketplaceUI && marketplaceUI.initialized) {
      await marketplaceUI.shutdown();
    }
  });
  
  test('MarketplaceUI initializes successfully', async () => {
    // Initialize MarketplaceUI
    const result = await marketplaceUI.initialize();
    
    // Verify initialization was successful
    expect(result).toBe(true);
    expect(marketplaceUI.initialized).toBe(true);
    expect(marketplaceUI.browser).toBeDefined();
    expect(marketplaceUI.installationManager).toBeDefined();
    expect(marketplaceUI.dashboard).toBeDefined();
  });
  
  test('MarketplaceBrowser loads tentacles successfully', async () => {
    // Initialize MarketplaceUI
    await marketplaceUI.initialize();
    
    // Load tentacles
    const tentacles = await marketplaceUI.browser.loadTentacles();
    
    // Verify tentacles were loaded
    expect(tentacles).toBeDefined();
    expect(Array.isArray(tentacles)).toBe(true);
    expect(tentacles.length).toBeGreaterThan(0);
  });
  
  test('TentacleDetailView loads tentacle details successfully', async () => {
    // Initialize MarketplaceUI
    await marketplaceUI.initialize();
    
    // Load tentacle details
    const tentacleId = 'devmaster';
    const tentacle = await marketplaceUI.browser.detailView.loadTentacle(tentacleId);
    
    // Verify tentacle details were loaded
    expect(tentacle).toBeDefined();
    expect(tentacle.id).toBe(tentacleId);
    expect(tentacle.name).toBeDefined();
    expect(tentacle.description).toBeDefined();
  });
  
  test('InstallationManager installs tentacle successfully', async () => {
    // Initialize MarketplaceUI
    await marketplaceUI.initialize();
    
    // Install tentacle
    const tentacleId = 'data-wizard';
    const result = await marketplaceUI.installationManager.installTentacle(tentacleId);
    
    // Verify installation was successful
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.tentacleId).toBe(tentacleId);
    
    // Verify tentacle is now installed
    const isInstalled = marketplaceUI.installationManager.isTentacleInstalled(tentacleId);
    expect(isInstalled).toBe(true);
  });
  
  test('UserDashboard loads user data successfully', async () => {
    // Initialize MarketplaceUI
    await marketplaceUI.initialize();
    
    // Load user data
    const userData = await marketplaceUI.dashboard.loadUserData();
    
    // Verify user data was loaded
    expect(userData).toBeDefined();
    expect(userData.installedTentacles).toBeDefined();
    expect(userData.purchasedTentacles).toBeDefined();
    expect(userData.licenses).toBeDefined();
    expect(userData.subscriptions).toBeDefined();
  });
  
  test('Full user flow: browse, view details, install, and manage tentacle', async () => {
    // Initialize MarketplaceUI
    await marketplaceUI.initialize();
    
    // 1. Browse tentacles
    const tentacles = await marketplaceUI.browser.loadTentacles();
    expect(tentacles.length).toBeGreaterThan(0);
    
    // 2. Search for a specific tentacle
    const searchResults = await marketplaceUI.browser.search('data');
    expect(searchResults.length).toBeGreaterThan(0);
    const tentacleId = searchResults[0].id;
    
    // 3. View tentacle details
    const tentacle = await marketplaceUI.browser.detailView.loadTentacle(tentacleId);
    expect(tentacle.id).toBe(tentacleId);
    
    // 4. Install the tentacle
    const installResult = await marketplaceUI.installationManager.installTentacle(tentacleId);
    expect(installResult.success).toBe(true);
    
    // 5. Verify it appears in the user dashboard
    const userData = await marketplaceUI.dashboard.loadUserData();
    const installedTentacle = userData.installedTentacles.find(t => t.id === tentacleId);
    expect(installedTentacle).toBeDefined();
    
    // 6. Uninstall the tentacle
    const uninstallResult = await marketplaceUI.installationManager.uninstallTentacle(tentacleId);
    expect(uninstallResult.success).toBe(true);
    
    // 7. Verify it's removed from installed tentacles
    const isStillInstalled = marketplaceUI.installationManager.isTentacleInstalled(tentacleId);
    expect(isStillInstalled).toBe(false);
  });
});
