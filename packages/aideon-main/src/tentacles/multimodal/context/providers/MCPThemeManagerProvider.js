/**
 * @fileoverview MCPThemeManagerProvider for managing UI themes.
 * 
 * This module provides context management for UI themes, including
 * theme selection, customization, and dynamic theme switching.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const MCPUIContextProvider = require('./MCPUIContextProvider');

/**
 * Provider for managing UI themes.
 */
class MCPThemeManagerProvider extends MCPUIContextProvider {
  /**
   * Constructor for MCPThemeManagerProvider.
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize theme-specific properties
    this.currentTheme = null;
    this.availableThemes = new Map();
    this.customThemes = new Map();
    this.systemThemeDetection = options.systemThemeDetection !== false;
    this.defaultThemeId = options.defaultThemeId || 'light';
    
    // Set persistence for themes
    this.contextPersistence = true;
    
    this.logger.info('MCPThemeManagerProvider created');
  }
  
  /**
   * Register context types with MCP Context Manager.
   * @private
   * @returns {Promise<void>}
   */
  async _registerContextTypes() {
    try {
      this.logger.debug('Registering UI theme context types with MCP Context Manager');
      
      // Register context types
      this.contextTypes.add('ui.theme.current');
      this.contextTypes.add('ui.theme.customization');
      
      // Register with MCP Context Manager
      for (const contextType of this.contextTypes) {
        await this.mcpContextManager.registerContextProvider(contextType, this);
      }
      
      this.logger.debug('UI theme context types registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register UI theme context types: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Initialize the theme manager.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      // Call parent initialize
      const result = await super.initialize(options);
      if (!result) {
        return false;
      }
      
      // Register built-in themes
      if (options.builtInThemes) {
        for (const theme of options.builtInThemes) {
          await this.registerTheme(theme, { isBuiltIn: true });
        }
      } else {
        // Register default themes if no built-in themes provided
        await this._registerDefaultThemes();
      }
      
      // Load persisted themes
      if (this.contextPersistence) {
        await this._loadPersistedThemes();
      }
      
      // Detect system theme if enabled
      if (this.systemThemeDetection) {
        await this._detectSystemTheme();
      }
      
      // Set default theme if no current theme
      if (!this.currentTheme) {
        await this.setTheme(this.defaultThemeId);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize MCPThemeManagerProvider: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Register a theme.
   * @param {Object} theme Theme data
   * @param {Object} [options] Additional options
   * @param {boolean} [options.isBuiltIn=false] Whether this is a built-in theme
   * @returns {Promise<boolean>} True if registration was successful
   */
  async registerTheme(theme, options = {}) {
    try {
      this.logger.debug('Registering theme', { theme, options });
      
      // Validate theme
      if (!theme || !theme.themeId || !theme.name || !theme.colorScheme || !theme.colors) {
        throw new Error('Invalid theme: themeId, name, colorScheme, and colors are required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('registerTheme', async () => {
        // Create theme object
        const themeObject = {
          ...theme,
          isBuiltIn: options.isBuiltIn === true,
          timestamp: Date.now()
        };
        
        // Add to available themes
        this.availableThemes.set(theme.themeId, themeObject);
        
        // Emit theme registered event
        this.emit('themeRegistered', {
          themeId: theme.themeId,
          name: theme.name,
          isBuiltIn: themeObject.isBuiltIn
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to register theme: ${error.message}`, { error, theme });
      
      // Emit error event
      this.emit('error', {
        type: 'themeRegister',
        message: error.message,
        error,
        themeId: theme?.themeId
      });
      
      return false;
    }
  }
  
  /**
   * Set current theme.
   * @param {string} themeId Theme identifier
   * @returns {Promise<boolean>} True if setting was successful
   */
  async setTheme(themeId) {
    try {
      this.logger.debug(`Setting theme: ${themeId}`);
      
      // Validate theme ID
      if (!themeId) {
        throw new Error('Invalid theme ID: themeId is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('setTheme', async () => {
        // Check if theme exists
        if (!this.availableThemes.has(themeId) && !this.customThemes.has(themeId)) {
          throw new Error(`Theme not found: ${themeId}`);
        }
        
        // Get theme
        const theme = this.availableThemes.has(themeId) 
          ? this.availableThemes.get(themeId) 
          : this.customThemes.get(themeId);
        
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          themeId: theme.themeId,
          name: theme.name,
          colorScheme: theme.colorScheme,
          colors: theme.colors,
          typography: theme.typography,
          spacing: theme.spacing,
          isBuiltIn: theme.isBuiltIn
        };
        
        // Update current theme
        this.currentTheme = contextData;
        
        // Update context data
        await this._processContextUpdate('ui.theme.current', contextData, this.constructor.name);
        
        // Persist theme if enabled
        if (this.contextPersistence) {
          await this._persistContext('ui.theme.current');
        }
        
        // Emit theme changed event
        this.emit('themeChanged', {
          themeId: theme.themeId,
          name: theme.name,
          colorScheme: theme.colorScheme
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to set theme: ${error.message}`, { error, themeId });
      
      // Emit error event
      this.emit('error', {
        type: 'themeSet',
        message: error.message,
        error,
        themeId
      });
      
      return false;
    }
  }
  
  /**
   * Create custom theme.
   * @param {Object} customization Theme customization data
   * @returns {Promise<string|null>} Custom theme ID if creation was successful, null otherwise
   */
  async createCustomTheme(customization) {
    try {
      this.logger.debug('Creating custom theme', { customization });
      
      // Validate customization
      if (!customization || !customization.baseThemeId || !customization.customizations) {
        throw new Error('Invalid customization: baseThemeId and customizations are required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('createCustomTheme', async () => {
        // Check if base theme exists
        if (!this.availableThemes.has(customization.baseThemeId)) {
          throw new Error(`Base theme not found: ${customization.baseThemeId}`);
        }
        
        // Get base theme
        const baseTheme = this.availableThemes.get(customization.baseThemeId);
        
        // Generate custom theme ID
        const customThemeId = `custom_${Date.now()}`;
        
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          baseThemeId: customization.baseThemeId,
          customizations: customization.customizations,
          name: customization.name || `Custom ${baseTheme.name}`,
          author: customization.author || 'User',
          isShared: customization.isShared === true
        };
        
        // Create custom theme by merging base theme with customizations
        const customTheme = {
          themeId: customThemeId,
          name: contextData.name,
          colorScheme: baseTheme.colorScheme,
          colors: {
            ...baseTheme.colors,
            ...customization.customizations.colors
          },
          typography: {
            ...baseTheme.typography,
            ...customization.customizations.typography
          },
          spacing: {
            ...baseTheme.spacing,
            ...customization.customizations.spacing
          },
          isBuiltIn: false,
          isCustom: true,
          baseThemeId: customization.baseThemeId,
          timestamp: contextData.timestamp
        };
        
        // Add to custom themes
        this.customThemes.set(customThemeId, customTheme);
        
        // Update context data
        await this._processContextUpdate('ui.theme.customization', contextData, this.constructor.name);
        
        // Persist customization if enabled
        if (this.contextPersistence) {
          await this._persistContext('ui.theme.customization');
        }
        
        // Emit custom theme created event
        this.emit('customThemeCreated', {
          themeId: customThemeId,
          name: customTheme.name,
          baseThemeId: customization.baseThemeId
        });
        
        return customThemeId;
      });
    } catch (error) {
      this.logger.error(`Failed to create custom theme: ${error.message}`, { error, customization });
      
      // Emit error event
      this.emit('error', {
        type: 'customThemeCreate',
        message: error.message,
        error
      });
      
      return null;
    }
  }
  
  /**
   * Update custom theme.
   * @param {string} customThemeId Custom theme identifier
   * @param {Object} updates Theme updates
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateCustomTheme(customThemeId, updates) {
    try {
      this.logger.debug(`Updating custom theme: ${customThemeId}`, { updates });
      
      // Validate custom theme ID and updates
      if (!customThemeId || !updates) {
        throw new Error('Invalid parameters: customThemeId and updates are required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('updateCustomTheme', async () => {
        // Check if custom theme exists
        if (!this.customThemes.has(customThemeId)) {
          throw new Error(`Custom theme not found: ${customThemeId}`);
        }
        
        // Get custom theme
        const customTheme = this.customThemes.get(customThemeId);
        
        // Update custom theme
        const updatedTheme = {
          ...customTheme,
          name: updates.name || customTheme.name,
          colors: {
            ...customTheme.colors,
            ...(updates.colors || {})
          },
          typography: {
            ...customTheme.typography,
            ...(updates.typography || {})
          },
          spacing: {
            ...customTheme.spacing,
            ...(updates.spacing || {})
          },
          timestamp: Date.now()
        };
        
        // Update custom themes map
        this.customThemes.set(customThemeId, updatedTheme);
        
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: updatedTheme.timestamp,
          baseThemeId: customTheme.baseThemeId,
          customizations: {
            colors: updatedTheme.colors,
            typography: updatedTheme.typography,
            spacing: updatedTheme.spacing
          },
          name: updatedTheme.name,
          author: customTheme.author,
          isShared: customTheme.isShared
        };
        
        // Update context data
        await this._processContextUpdate('ui.theme.customization', contextData, this.constructor.name);
        
        // Persist customization if enabled
        if (this.contextPersistence) {
          await this._persistContext('ui.theme.customization');
        }
        
        // Update current theme if this is the active theme
        if (this.currentTheme && this.currentTheme.themeId === customThemeId) {
          await this.setTheme(customThemeId);
        }
        
        // Emit custom theme updated event
        this.emit('customThemeUpdated', {
          themeId: customThemeId,
          name: updatedTheme.name,
          updates
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to update custom theme: ${error.message}`, { error, customThemeId, updates });
      
      // Emit error event
      this.emit('error', {
        type: 'customThemeUpdate',
        message: error.message,
        error,
        customThemeId
      });
      
      return false;
    }
  }
  
  /**
   * Delete custom theme.
   * @param {string} customThemeId Custom theme identifier
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteCustomTheme(customThemeId) {
    try {
      this.logger.debug(`Deleting custom theme: ${customThemeId}`);
      
      // Validate custom theme ID
      if (!customThemeId) {
        throw new Error('Invalid custom theme ID: customThemeId is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('deleteCustomTheme', async () => {
        // Check if custom theme exists
        if (!this.customThemes.has(customThemeId)) {
          throw new Error(`Custom theme not found: ${customThemeId}`);
        }
        
        // Check if this is the current theme
        if (this.currentTheme && this.currentTheme.themeId === customThemeId) {
          // Switch to default theme
          await this.setTheme(this.defaultThemeId);
        }
        
        // Delete custom theme
        this.customThemes.delete(customThemeId);
        
        // Emit custom theme deleted event
        this.emit('customThemeDeleted', {
          themeId: customThemeId
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to delete custom theme: ${error.message}`, { error, customThemeId });
      
      // Emit error event
      this.emit('error', {
        type: 'customThemeDelete',
        message: error.message,
        error,
        customThemeId
      });
      
      return false;
    }
  }
  
  /**
   * Get available themes.
   * @param {Object} [options] Filter options
   * @param {boolean} [options.includeCustom=true] Whether to include custom themes
   * @param {boolean} [options.includeBuiltIn=true] Whether to include built-in themes
   * @param {string} [options.colorScheme] Filter by color scheme
   * @returns {Promise<Array<Object>>} Available themes
   */
  async getAvailableThemes(options = {}) {
    try {
      this.logger.debug('Getting available themes', { options });
      
      // Set default options
      const includeCustom = options.includeCustom !== false;
      const includeBuiltIn = options.includeBuiltIn !== false;
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getAvailableThemes', async () => {
        const themes = [];
        
        // Add built-in themes
        if (includeBuiltIn) {
          for (const theme of this.availableThemes.values()) {
            // Filter by color scheme if specified
            if (options.colorScheme && theme.colorScheme !== options.colorScheme) {
              continue;
            }
            
            themes.push({
              themeId: theme.themeId,
              name: theme.name,
              colorScheme: theme.colorScheme,
              isBuiltIn: true,
              isCustom: false
            });
          }
        }
        
        // Add custom themes
        if (includeCustom) {
          for (const theme of this.customThemes.values()) {
            // Filter by color scheme if specified
            if (options.colorScheme && theme.colorScheme !== options.colorScheme) {
              continue;
            }
            
            themes.push({
              themeId: theme.themeId,
              name: theme.name,
              colorScheme: theme.colorScheme,
              isBuiltIn: false,
              isCustom: true,
              baseThemeId: theme.baseThemeId
            });
          }
        }
        
        return themes;
      });
    } catch (error) {
      this.logger.error(`Failed to get available themes: ${error.message}`, { error, options });
      return [];
    }
  }
  
  /**
   * Get theme details.
   * @param {string} themeId Theme identifier
   * @returns {Promise<Object|null>} Theme details or null if not found
   */
  async getThemeDetails(themeId) {
    try {
      this.logger.debug(`Getting theme details: ${themeId}`);
      
      // Validate theme ID
      if (!themeId) {
        throw new Error('Invalid theme ID: themeId is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getThemeDetails', async () => {
        // Check if theme exists
        if (this.availableThemes.has(themeId)) {
          return this.availableThemes.get(themeId);
        }
        
        // Check if custom theme exists
        if (this.customThemes.has(themeId)) {
          return this.customThemes.get(themeId);
        }
        
        // Theme not found
        return null;
      });
    } catch (error) {
      this.logger.error(`Failed to get theme details: ${error.message}`, { error, themeId });
      return null;
    }
  }
  
  /**
   * Register default themes.
   * @private
   * @returns {Promise<void>}
   */
  async _registerDefaultThemes() {
    try {
      this.logger.debug('Registering default themes');
      
      // Register light theme
      await this.registerTheme({
        themeId: 'light',
        name: 'Light',
        colorScheme: 'light',
        colors: {
          primary: '#1976d2',
          secondary: '#dc004e',
          background: '#ffffff',
          surface: '#f5f5f5',
          error: '#f44336',
          text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.6)',
            disabled: 'rgba(0, 0, 0, 0.38)'
          }
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: 14,
          fontWeightLight: 300,
          fontWeightRegular: 400,
          fontWeightMedium: 500,
          fontWeightBold: 700
        },
        spacing: {
          unit: 8
        }
      }, { isBuiltIn: true });
      
      // Register dark theme
      await this.registerTheme({
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
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: 14,
          fontWeightLight: 300,
          fontWeightRegular: 400,
          fontWeightMedium: 500,
          fontWeightBold: 700
        },
        spacing: {
          unit: 8
        }
      }, { isBuiltIn: true });
      
      // Register high contrast theme
      await this.registerTheme({
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
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: 16,
          fontWeightLight: 400,
          fontWeightRegular: 500,
          fontWeightMedium: 600,
          fontWeightBold: 700
        },
        spacing: {
          unit: 10
        }
      }, { isBuiltIn: true });
      
      this.logger.debug('Default themes registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register default themes: ${error.message}`, { error });
    }
  }
  
  /**
   * Detect system theme.
   * @private
   * @returns {Promise<void>}
   */
  async _detectSystemTheme() {
    try {
      this.logger.debug('Detecting system theme');
      
      // This is a simplified implementation
      // In a production environment, this would detect the actual system theme
      
      // For now, we'll just use a simple check for preferred color scheme
      const prefersDarkMode = window && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Set theme based on system preference
      const themeId = prefersDarkMode ? 'dark' : 'light';
      
      // Set theme
      await this.setTheme(themeId);
      
      this.logger.debug(`System theme detected: ${themeId}`);
    } catch (error) {
      this.logger.error(`Failed to detect system theme: ${error.message}`, { error });
      
      // Fall back to default theme
      await this.setTheme(this.defaultThemeId);
    }
  }
  
  /**
   * Load persisted themes.
   * @private
   * @returns {Promise<void>}
   */
  async _loadPersistedThemes() {
    try {
      this.logger.debug('Loading persisted themes');
      
      // Skip if persistence is disabled
      if (!this.contextPersistence) {
        return;
      }
      
      // Load persisted current theme
      const persistedTheme = await this.mcpContextManager.loadPersistedContext('ui.theme.current');
      if (persistedTheme && persistedTheme.contextData) {
        this.currentTheme = persistedTheme.contextData;
      }
      
      // Load persisted custom themes
      const persistedCustomizations = await this.mcpContextManager.loadPersistedContext('ui.theme.customization');
      if (persistedCustomizations && persistedCustomizations.contextData) {
        // Process each persisted customization
        for (const customization of Array.isArray(persistedCustomizations.contextData) 
          ? persistedCustomizations.contextData 
          : [persistedCustomizations.contextData]) {
          
          // Skip if base theme doesn't exist
          if (!this.availableThemes.has(customization.baseThemeId)) {
            continue;
          }
          
          // Create custom theme
          await this.createCustomTheme(customization);
        }
      }
      
      this.logger.debug('Persisted themes loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load persisted themes: ${error.message}`, { error });
    }
  }
}

module.exports = MCPThemeManagerProvider;
