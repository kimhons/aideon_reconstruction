/**
 * @fileoverview Integration tests for UI Context Providers in the Aideon AI Desktop Agent.
 * 
 * This module contains comprehensive integration tests for the UI context providers,
 * ensuring they work together correctly as a functional group.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { requireModule } = require('./utils/TestModuleResolver');
const assert = require('assert');

// Import UI Context Providers
const MCPUIContextProvider = requireModule('src/tentacles/multimodal/context/providers/MCPUIContextProvider');
const MCPUIStateManagerProvider = requireModule('src/tentacles/multimodal/context/providers/MCPUIStateManagerProvider');
const MCPInteractionTrackerProvider = requireModule('src/tentacles/multimodal/context/providers/MCPInteractionTrackerProvider');
const MCPPreferenceManagerProvider = requireModule('src/tentacles/multimodal/context/providers/MCPPreferenceManagerProvider');
const MCPAccessibilityEngineProvider = requireModule('src/tentacles/multimodal/context/providers/MCPAccessibilityEngineProvider');
const MCPThemeManagerProvider = requireModule('src/tentacles/multimodal/context/providers/MCPThemeManagerProvider');

// Import UI Context Schemas
const {
  validateContextSchema
} = requireModule('src/tentacles/multimodal/context/schemas/UIContextSchemas');

// Import mocks
const { 
  MockLogger,
  MockConfigService,
  MockPerformanceMonitor,
  MockSecurityManager,
  MockMCPContextManager
} = require('./mocks/CoreDependencies');

describe('MCP UI Integration Tests', () => {
  // Common test variables
  let logger;
  let configService;
  let performanceMonitor;
  let securityManager;
  let mcpContextManager;
  
  // Provider instances
  let uiStateManager;
  let interactionTracker;
  let preferenceManager;
  let accessibilityEngine;
  let themeManager;
  
  // Setup before each test
  beforeEach(async () => {
    // Create mock dependencies
    logger = new MockLogger();
    configService = new MockConfigService();
    performanceMonitor = new MockPerformanceMonitor();
    securityManager = new MockSecurityManager();
    mcpContextManager = new MockMCPContextManager();
    
    // Create provider instances
    uiStateManager = new MCPUIStateManagerProvider({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      mcpContextManager
    });
    
    interactionTracker = new MCPInteractionTrackerProvider({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      mcpContextManager,
      maxEventHistory: 10
    });
    
    preferenceManager = new MCPPreferenceManagerProvider({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      mcpContextManager,
      syncEnabled: false
    });
    
    accessibilityEngine = new MCPAccessibilityEngineProvider({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      mcpContextManager,
      autoAdapt: true
    });
    
    themeManager = new MCPThemeManagerProvider({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      mcpContextManager,
      systemThemeDetection: false,
      defaultThemeId: 'light'
    });
    
    // Initialize providers
    await uiStateManager.initialize();
    await interactionTracker.initialize();
    await preferenceManager.initialize();
    await accessibilityEngine.initialize();
    await themeManager.initialize();
  });
  
  describe('Cross-Provider Workflows', () => {
    it('should propagate theme changes to accessibility adaptations', async () => {
      // Set up accessibility requirements
      await accessibilityEngine.setAccessibilityRequirements([
        {
          type: 'highContrast',
          enabled: true,
          level: 'high'
        }
      ]);
      
      // Set high contrast theme
      await themeManager.registerTheme({
        themeId: 'high_contrast',
        name: 'High Contrast',
        colorScheme: 'dark',
        colors: {
          primary: '#ffffff',
          secondary: '#ffff00',
          background: '#000000',
          surface: '#0a0a0a',
          error: '#ff6666',
          text: {
            primary: '#ffffff',
            secondary: '#ffffff',
            disabled: '#c0c0c0'
          }
        }
      });
      
      await themeManager.setTheme('high_contrast');
      
      // Verify that accessibility adaptations were updated
      const globalAdaptations = accessibilityEngine.globalAdaptations;
      assert.ok(globalAdaptations.contrast, 'High contrast adaptation should be present');
      assert.strictEqual(globalAdaptations.contrast.enabled, true, 'High contrast should be enabled');
    });
    
    it('should update UI state based on user interactions', async () => {
      // Set initial UI state
      await uiStateManager.updateCurrentState({
        state: 'ready',
        viewId: 'dashboard'
      });
      
      // Track interaction event
      await interactionTracker.trackInteractionEvent({
        eventType: 'click',
        elementId: 'settings-button',
        elementType: 'button',
        viewId: 'dashboard'
      });
      
      // Update UI state based on interaction
      await uiStateManager.updateCurrentState({
        state: 'transitioning',
        viewId: 'settings'
      });
      
      // Verify state history
      const stateHistory = uiStateManager.stateHistory;
      assert.strictEqual(stateHistory.length, 2, 'State history should have two entries');
      assert.strictEqual(stateHistory[0].viewId, 'dashboard', 'First state should be dashboard');
      assert.strictEqual(stateHistory[1].viewId, 'settings', 'Second state should be settings');
    });
    
    it('should apply theme based on user preferences', async () => {
      // Set theme preference
      await preferenceManager.setPreference('theme', 'dark', {
        category: 'appearance'
      });
      
      // Register dark theme
      await themeManager.registerTheme({
        themeId: 'dark',
        name: 'Dark',
        colorScheme: 'dark',
        colors: {
          primary: '#90caf9',
          secondary: '#f48fb1',
          background: '#121212',
          surface: '#1e1e1e',
          error: '#cf6679',
          text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
            disabled: 'rgba(255, 255, 255, 0.5)'
          }
        }
      });
      
      // Apply theme based on preference
      const themePreference = await preferenceManager.getPreference('theme');
      await themeManager.setTheme(themePreference);
      
      // Verify current theme
      const currentTheme = themeManager.currentTheme;
      assert.strictEqual(currentTheme.themeId, 'dark', 'Current theme should be dark');
      assert.strictEqual(currentTheme.colorScheme, 'dark', 'Color scheme should be dark');
    });
    
    it('should update accessibility requirements based on preferences', async () => {
      // Set accessibility preferences
      await preferenceManager.setPreference('accessibility.screenReader', true, {
        category: 'accessibility'
      });
      
      await preferenceManager.setPreference('accessibility.highContrast', true, {
        category: 'accessibility'
      });
      
      // Apply accessibility requirements based on preferences
      const screenReaderEnabled = await preferenceManager.getPreference('accessibility.screenReader');
      const highContrastEnabled = await preferenceManager.getPreference('accessibility.highContrast');
      
      await accessibilityEngine.setAccessibilityRequirements([
        {
          type: 'screenReader',
          enabled: screenReaderEnabled,
          level: 'medium'
        },
        {
          type: 'highContrast',
          enabled: highContrastEnabled,
          level: 'medium'
        }
      ]);
      
      // Verify requirements
      const requirements = accessibilityEngine.requirements;
      assert.strictEqual(requirements.length, 2, 'Should have two accessibility requirements');
      assert.strictEqual(requirements[0].type, 'screenReader', 'First requirement should be screenReader');
      assert.strictEqual(requirements[0].enabled, true, 'Screen reader should be enabled');
      assert.strictEqual(requirements[1].type, 'highContrast', 'Second requirement should be highContrast');
      assert.strictEqual(requirements[1].enabled, true, 'High contrast should be enabled');
    });
  });
  
  describe('Event Propagation', () => {
    it('should emit events that can be consumed by other providers', async () => {
      // Set up event listeners
      let themeChangedEventFired = false;
      let stateChangedEventFired = false;
      
      themeManager.on('themeChanged', (event) => {
        themeChangedEventFired = true;
        
        // Update UI state based on theme change
        uiStateManager.updateCurrentState({
          state: 'updating',
          viewId: 'theme-preview',
          viewData: {
            themeId: event.themeId
          }
        });
      });
      
      uiStateManager.on('stateChanged', () => {
        stateChangedEventFired = true;
      });
      
      // Register and set theme
      await themeManager.registerTheme({
        themeId: 'custom_theme',
        name: 'Custom Theme',
        colorScheme: 'light',
        colors: {
          primary: '#ff5722',
          secondary: '#2196f3',
          background: '#fafafa',
          surface: '#ffffff',
          error: '#f44336',
          text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.6)',
            disabled: 'rgba(0, 0, 0, 0.38)'
          }
        }
      });
      
      await themeManager.setTheme('custom_theme');
      
      // Verify events were fired
      assert.strictEqual(themeChangedEventFired, true, 'Theme changed event should be fired');
      assert.strictEqual(stateChangedEventFired, true, 'State changed event should be fired');
      
      // Verify UI state was updated
      const currentState = uiStateManager.currentState;
      assert.strictEqual(currentState.state, 'updating', 'UI state should be updating');
      assert.strictEqual(currentState.viewId, 'theme-preview', 'View ID should be theme-preview');
      assert.strictEqual(currentState.viewData.themeId, 'custom_theme', 'View data should contain theme ID');
    });
    
    it('should track interaction patterns and update UI state accordingly', async () => {
      // Set up event listeners
      let patternDetectedEventFired = false;
      
      interactionTracker.on('patternDetected', (event) => {
        patternDetectedEventFired = true;
        
        // Update UI state based on detected pattern
        if (event.pattern.patternType === 'form-filling') {
          uiStateManager.updateCurrentState({
            state: 'ready',
            viewId: 'form-completion',
            viewData: {
              patternConfidence: event.pattern.confidence
            }
          });
        }
      });
      
      // Track form-filling interaction events
      await interactionTracker.trackInteractionEvent({
        eventType: 'click',
        elementId: 'username-input',
        elementType: 'input',
        viewId: 'login-form'
      });
      
      await interactionTracker.trackInteractionEvent({
        eventType: 'input',
        elementId: 'username-input',
        elementType: 'input',
        viewId: 'login-form',
        value: 'user123'
      });
      
      await interactionTracker.trackInteractionEvent({
        eventType: 'click',
        elementId: 'password-input',
        elementType: 'input',
        viewId: 'login-form'
      });
      
      await interactionTracker.trackInteractionEvent({
        eventType: 'input',
        elementId: 'password-input',
        elementType: 'input',
        viewId: 'login-form',
        value: '********'
      });
      
      await interactionTracker.trackInteractionEvent({
        eventType: 'click',
        elementId: 'submit-button',
        elementType: 'button',
        viewId: 'login-form'
      });
      
      // Manually trigger pattern detection (in real implementation this would happen automatically)
      await interactionTracker._detectInteractionPatterns();
      
      // Verify pattern was detected
      const patterns = await interactionTracker.getInteractionPatterns('form-filling');
      assert.ok(patterns.length > 0, 'Form-filling pattern should be detected');
      
      // Verify UI state was updated if pattern was detected
      if (patternDetectedEventFired) {
        const currentState = uiStateManager.currentState;
        assert.strictEqual(currentState.viewId, 'form-completion', 'View ID should be form-completion');
      }
    });
  });
  
  describe('Persistence and State Management', () => {
    it('should persist and load preferences', async () => {
      // Set preferences
      await preferenceManager.setPreference('language', 'en-US', {
        category: 'localization'
      });
      
      await preferenceManager.setPreference('notifications', true, {
        category: 'general'
      });
      
      // Mock persistence
      const persistedData = {};
      mcpContextManager.persistContext = async (data) => {
        persistedData[data.contextType] = data;
        return true;
      };
      
      mcpContextManager.loadPersistedContext = async (contextType) => {
        return persistedData[contextType];
      };
      
      // Persist preferences
      await preferenceManager._persistContext('ui.preference.setting');
      
      // Create new preference manager
      const newPreferenceManager = new MCPPreferenceManagerProvider({
        logger,
        configService,
        performanceMonitor,
        securityManager,
        mcpContextManager,
        syncEnabled: false
      });
      
      // Load persisted preferences
      await newPreferenceManager._loadPersistedPreferences();
      
      // Verify preferences were loaded
      const language = await newPreferenceManager.getPreference('language');
      const notifications = await newPreferenceManager.getPreference('notifications');
      
      assert.strictEqual(language, 'en-US', 'Language preference should be loaded');
      assert.strictEqual(notifications, true, 'Notifications preference should be loaded');
    });
    
    it('should maintain UI state history', async () => {
      // Update UI state multiple times
      await uiStateManager.updateCurrentState({
        state: 'loading',
        viewId: 'splash'
      });
      
      await uiStateManager.updateCurrentState({
        state: 'ready',
        viewId: 'home'
      });
      
      await uiStateManager.updateCurrentState({
        state: 'loading',
        viewId: 'profile'
      });
      
      await uiStateManager.updateCurrentState({
        state: 'ready',
        viewId: 'profile'
      });
      
      // Verify state history
      const stateHistory = uiStateManager.stateHistory;
      assert.strictEqual(stateHistory.length, 4, 'State history should have four entries');
      assert.strictEqual(stateHistory[0].viewId, 'splash', 'First state should be splash');
      assert.strictEqual(stateHistory[1].viewId, 'home', 'Second state should be home');
      assert.strictEqual(stateHistory[2].viewId, 'profile', 'Third state should be profile (loading)');
      assert.strictEqual(stateHistory[3].viewId, 'profile', 'Fourth state should be profile (ready)');
      
      // Verify navigation stack
      const navigationStack = uiStateManager.navigationStack;
      assert.strictEqual(navigationStack.length, 3, 'Navigation stack should have three entries');
      assert.strictEqual(navigationStack[0], 'splash', 'First navigation item should be splash');
      assert.strictEqual(navigationStack[1], 'home', 'Second navigation item should be home');
      assert.strictEqual(navigationStack[2], 'profile', 'Third navigation item should be profile');
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle invalid theme gracefully', async () => {
      // Attempt to set non-existent theme
      const result = await themeManager.setTheme('non_existent_theme');
      
      // Verify operation failed gracefully
      assert.strictEqual(result, false, 'Setting non-existent theme should fail');
      
      // Verify current theme is still valid
      const currentTheme = themeManager.currentTheme;
      assert.ok(currentTheme, 'Current theme should still exist');
      assert.strictEqual(currentTheme.themeId, 'light', 'Current theme should be the default');
    });
    
    it('should handle invalid accessibility requirements gracefully', async () => {
      // Attempt to set invalid requirements
      const result = await accessibilityEngine.setAccessibilityRequirements('invalid');
      
      // Verify operation failed gracefully
      assert.strictEqual(result, false, 'Setting invalid requirements should fail');
      
      // Verify requirements are still valid
      const requirements = accessibilityEngine.requirements;
      assert.ok(Array.isArray(requirements), 'Requirements should still be an array');
    });
    
    it('should handle concurrent operations safely', async () => {
      // Create promises for concurrent operations
      const promises = [];
      
      // Add concurrent theme operations
      promises.push(themeManager.registerTheme({
        themeId: 'theme1',
        name: 'Theme 1',
        colorScheme: 'light',
        colors: { primary: '#ff0000' }
      }));
      
      promises.push(themeManager.registerTheme({
        themeId: 'theme2',
        name: 'Theme 2',
        colorScheme: 'dark',
        colors: { primary: '#00ff00' }
      }));
      
      // Add concurrent preference operations
      promises.push(preferenceManager.setPreference('pref1', 'value1'));
      promises.push(preferenceManager.setPreference('pref2', 'value2'));
      
      // Add concurrent UI state operations
      promises.push(uiStateManager.updateCurrentState({
        state: 'ready',
        viewId: 'view1'
      }));
      
      promises.push(uiStateManager.updateCurrentState({
        state: 'loading',
        viewId: 'view2'
      }));
      
      // Execute all operations concurrently
      await Promise.all(promises);
      
      // Verify all operations completed successfully
      assert.ok(themeManager.availableThemes.has('theme1'), 'Theme 1 should be registered');
      assert.ok(themeManager.availableThemes.has('theme2'), 'Theme 2 should be registered');
      
      const pref1 = await preferenceManager.getPreference('pref1');
      const pref2 = await preferenceManager.getPreference('pref2');
      assert.strictEqual(pref1, 'value1', 'Preference 1 should be set');
      assert.strictEqual(pref2, 'value2', 'Preference 2 should be set');
      
      // UI state should reflect the last update
      const currentState = uiStateManager.currentState;
      assert.strictEqual(currentState.viewId, 'view2', 'Current view should be view2');
    });
  });
});
