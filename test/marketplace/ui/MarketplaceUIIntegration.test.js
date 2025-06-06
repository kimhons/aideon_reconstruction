/**
 * @fileoverview Integration test for Marketplace UI components.
 * This file validates the integration between all UI components
 * and ensures proper user flows and interactions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MarketplaceUI } = require('../../../src/marketplace/ui/MarketplaceUI');
const { MarketplaceBrowser } = require('../../../src/marketplace/ui/browser/MarketplaceBrowser');
const { TentacleDetailView } = require('../../../src/marketplace/ui/browser/TentacleDetailView');
const { InstallationManager } = require('../../../src/marketplace/ui/installation/InstallationManager');
const { UserDashboard } = require('../../../src/marketplace/ui/dashboard/UserDashboard');
const { MarketplaceCore } = require('../../../src/marketplace/MarketplaceCore');
const { TentacleRegistry } = require('../../../src/core/tentacles/TentacleRegistry');
const { MonetizationCore } = require('../../../src/marketplace/monetization/core/MonetizationCore');
const { Logger } = require('../../../src/core/logging/Logger');

// Mock dependencies
jest.mock('../../../src/marketplace/MarketplaceCore');
jest.mock('../../../src/core/tentacles/TentacleRegistry');
jest.mock('../../../src/marketplace/monetization/core/MonetizationCore');
jest.mock('../../../src/core/logging/Logger');

describe('Marketplace UI Integration', () => {
  let marketplaceCore;
  let tentacleRegistry;
  let monetizationCore;
  let marketplaceUI;
  let marketplaceBrowser;
  let tentacleDetailView;
  let installationManager;
  let userDashboard;
  let container;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create mock dependencies
    marketplaceCore = new MarketplaceCore();
    tentacleRegistry = new TentacleRegistry();
    monetizationCore = new MonetizationCore();
    
    // Create UI components
    installationManager = new InstallationManager({
      marketplaceCore,
      tentacleRegistry,
      config: { defaultInstallLocation: '/tentacles' }
    });
    
    marketplaceBrowser = new MarketplaceBrowser({
      marketplaceCore,
      config: { defaultPageSize: 12 }
    });
    
    tentacleDetailView = new TentacleDetailView({
      marketplaceCore,
      installationManager,
      config: {}
    });
    
    userDashboard = new UserDashboard({
      marketplaceCore,
      installationManager,
      monetizationCore,
      config: {}
    });
    
    marketplaceUI = new MarketplaceUI({
      container,
      marketplaceCore,
      config: { defaultTheme: 'light' }
    });
    
    // Initialize components
    await installationManager.initialize();
    await marketplaceBrowser.initialize();
    await tentacleDetailView.initialize();
    await userDashboard.initialize();
    await marketplaceUI.initialize();
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  test('All components initialize successfully', () => {
    expect(installationManager.initialized).toBe(true);
    expect(marketplaceBrowser.initialized).toBe(true);
    expect(tentacleDetailView.initialized).toBe(true);
    expect(userDashboard.initialized).toBe(true);
    expect(marketplaceUI.initialized).toBe(true);
  });

  test('MarketplaceUI can navigate between pages', () => {
    // Initial state should be home
    expect(marketplaceUI.state.currentPage).toBe('home');
    
    // Navigate to browse
    marketplaceUI.navigateTo('browse');
    expect(marketplaceUI.state.currentPage).toBe('browse');
    
    // Navigate to tentacle detail
    marketplaceUI.navigateTo('tentacle', { tentacleId: 'devmaster' });
    expect(marketplaceUI.state.currentPage).toBe('tentacle');
    expect(marketplaceUI.state.currentPageParams.tentacleId).toBe('devmaster');
    
    // Navigate to user dashboard
    marketplaceUI.navigateTo('user_dashboard');
    expect(marketplaceUI.state.currentPage).toBe('user_dashboard');
    
    // Navigate back to home
    marketplaceUI.navigateTo('home');
    expect(marketplaceUI.state.currentPage).toBe('home');
  });

  test('MarketplaceBrowser can search and filter tentacles', async () => {
    // Mock search results
    const mockTentacles = [
      { id: 'test-tentacle', name: 'Test Tentacle' }
    ];
    marketplaceBrowser.loadTentacles = jest.fn().mockResolvedValue(mockTentacles);
    
    // Search for tentacles
    await marketplaceBrowser.search('test');
    expect(marketplaceBrowser.state.searchQuery).toBe('test');
    expect(marketplaceBrowser.loadTentacles).toHaveBeenCalled();
    
    // Apply filters
    await marketplaceBrowser.applyFilters({ category: 'development', price: 'paid' });
    expect(marketplaceBrowser.state.filters.category).toBe('development');
    expect(marketplaceBrowser.state.filters.price).toBe('paid');
    expect(marketplaceBrowser.loadTentacles).toHaveBeenCalled();
  });

  test('TentacleDetailView can load tentacle details', async () => {
    // Mock tentacle details
    const mockTentacle = {
      id: 'devmaster',
      name: 'DevMaster',
      description: 'Test description'
    };
    tentacleDetailView._checkIfInstalled = jest.fn().mockResolvedValue(false);
    tentacleDetailView._checkIfPurchased = jest.fn().mockResolvedValue(true);
    tentacleDetailView._loadReviews = jest.fn().mockResolvedValue([]);
    
    // Load tentacle details
    await tentacleDetailView.loadTentacle('devmaster');
    expect(tentacleDetailView.state.tentacleId).toBe('devmaster');
    expect(tentacleDetailView.state.tentacle).toBeTruthy();
    expect(tentacleDetailView.state.isInstalled).toBe(false);
    expect(tentacleDetailView.state.isPurchased).toBe(true);
  });

  test('InstallationManager can install and uninstall tentacles', async () => {
    // Mock installation process
    installationManager._processNextInQueue = jest.fn();
    
    // Queue tentacle for installation
    const installPromise = installationManager.installTentacle('devmaster');
    expect(installationManager.installationQueue.length).toBe(1);
    expect(installationManager.installationQueue[0].tentacleId).toBe('devmaster');
    expect(installationManager._processNextInQueue).toHaveBeenCalled();
    
    // Mock successful installation
    const queueItem = installationManager.installationQueue[0];
    queueItem.resolve({ success: true, tentacleId: 'devmaster' });
    
    // Verify installation result
    const result = await installPromise;
    expect(result.success).toBe(true);
    expect(result.tentacleId).toBe('devmaster');
    
    // Mock installed tentacles
    installationManager.installedTentacles.set('devmaster', {
      id: 'devmaster',
      name: 'DevMaster',
      version: '1.0.0',
      status: 'active'
    });
    
    // Uninstall tentacle
    const uninstallResult = await installationManager.uninstallTentacle('devmaster');
    expect(uninstallResult.success).toBe(true);
    expect(installationManager.installedTentacles.has('devmaster')).toBe(false);
  });

  test('UserDashboard can manage tentacles and licenses', async () => {
    // Mock installed tentacles
    userDashboard._loadInstalledTentacles = jest.fn().mockResolvedValue([
      { id: 'devmaster', name: 'DevMaster', version: '1.0.0', status: 'active' }
    ]);
    
    // Mock purchased tentacles
    userDashboard._loadPurchasedTentacles = jest.fn().mockResolvedValue([
      { id: 'devmaster', name: 'DevMaster', purchaseDate: '2025-06-01', price: 49.99 }
    ]);
    
    // Mock licenses
    userDashboard._loadLicenses = jest.fn().mockResolvedValue([
      { id: 'license-1', tentacleId: 'devmaster', licenseKey: 'DM-1234', status: 'active' }
    ]);
    
    // Load user data
    await userDashboard.loadUserData();
    expect(userDashboard.state.installedTentacles.length).toBe(1);
    expect(userDashboard.state.purchasedTentacles.length).toBe(1);
    expect(userDashboard.state.licenses.length).toBe(1);
    
    // Activate license
    const activationResult = await userDashboard.activateLicense('NEW-1234');
    expect(activationResult.success).toBe(true);
    expect(userDashboard.state.licenses.length).toBe(2);
    
    // Deactivate license
    const deactivationResult = await userDashboard.deactivateLicense('license-1');
    expect(deactivationResult.success).toBe(true);
    expect(userDashboard.state.licenses[0].status).toBe('inactive');
  });

  test('Components communicate through events', () => {
    // Setup event listeners
    const tentacleSelectedHandler = jest.fn();
    const installationStartedHandler = jest.fn();
    
    marketplaceBrowser.events.on('tentacle:selected', tentacleSelectedHandler);
    installationManager.events.on('installation:started', installationStartedHandler);
    
    // Trigger tentacle selection
    marketplaceBrowser.events.emit('tentacle:selected', { tentacleId: 'devmaster' });
    expect(tentacleSelectedHandler).toHaveBeenCalledWith({ tentacleId: 'devmaster' });
    
    // Trigger installation started
    installationManager.events.emit('installation:started', { tentacleId: 'devmaster' });
    expect(installationStartedHandler).toHaveBeenCalledWith({ tentacleId: 'devmaster' });
  });

  test('Full user flow: browse, view, install, and manage tentacles', async () => {
    // Mock dependencies and methods
    marketplaceBrowser.getTentacleDetails = jest.fn().mockResolvedValue({
      id: 'devmaster',
      name: 'DevMaster',
      description: 'Test description'
    });
    
    tentacleDetailView.loadTentacle = jest.fn().mockResolvedValue({
      id: 'devmaster',
      name: 'DevMaster',
      description: 'Test description'
    });
    
    installationManager.installTentacle = jest.fn().mockResolvedValue({
      success: true,
      tentacleId: 'devmaster'
    });
    
    userDashboard._loadInstalledTentacles = jest.fn().mockResolvedValue([
      { id: 'devmaster', name: 'DevMaster', version: '1.0.0', status: 'active' }
    ]);
    
    // 1. Navigate to browse page
    marketplaceUI.navigateTo('browse');
    expect(marketplaceUI.state.currentPage).toBe('browse');
    
    // 2. Select a tentacle
    const tentacleId = 'devmaster';
    marketplaceBrowser.events.emit('tentacle:selected', { tentacleId });
    
    // 3. Navigate to tentacle detail page
    marketplaceUI.navigateTo('tentacle', { tentacleId });
    expect(marketplaceUI.state.currentPage).toBe('tentacle');
    expect(marketplaceUI.state.currentPageParams.tentacleId).toBe(tentacleId);
    
    // 4. Install the tentacle
    await tentacleDetailView.installTentacle();
    expect(installationManager.installTentacle).toHaveBeenCalledWith(tentacleId);
    
    // 5. Navigate to user dashboard
    marketplaceUI.navigateTo('user_dashboard');
    expect(marketplaceUI.state.currentPage).toBe('user_dashboard');
    
    // 6. Refresh installed tentacles
    await userDashboard.loadUserData();
    expect(userDashboard.state.installedTentacles.length).toBe(1);
    expect(userDashboard.state.installedTentacles[0].id).toBe(tentacleId);
  });

  test('All components can be shut down properly', async () => {
    // Shut down all components
    await userDashboard.shutdown();
    await tentacleDetailView.shutdown();
    await marketplaceBrowser.shutdown();
    await installationManager.shutdown();
    await marketplaceUI.shutdown();
    
    // Verify shutdown
    expect(userDashboard.initialized).toBe(false);
    expect(tentacleDetailView.initialized).toBe(false);
    expect(marketplaceBrowser.initialized).toBe(false);
    expect(installationManager.initialized).toBe(false);
    expect(marketplaceUI.initialized).toBe(false);
  });
});
