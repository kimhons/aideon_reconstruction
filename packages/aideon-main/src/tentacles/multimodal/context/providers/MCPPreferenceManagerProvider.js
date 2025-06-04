/**
 * @fileoverview MCPPreferenceManagerProvider for managing UI preferences.
 * 
 * This module provides context management for UI preferences, including
 * user settings, default values, and preference synchronization.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const MCPUIContextProvider = require('./MCPUIContextProvider');

/**
 * Provider for managing UI preferences.
 */
class MCPPreferenceManagerProvider extends MCPUIContextProvider {
  /**
   * Constructor for MCPPreferenceManagerProvider.
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize preference-specific properties
    this.preferences = new Map();
    this.defaultPreferences = new Map();
    this.preferenceCategories = new Set();
    this.syncEnabled = options.syncEnabled !== false;
    this.offlineStorage = options.offlineStorage !== false;
    
    // Set persistence for preferences
    this.contextPersistence = true;
    
    this.logger.info('MCPPreferenceManagerProvider created');
  }
  
  /**
   * Register context types with MCP Context Manager.
   * @private
   * @returns {Promise<void>}
   */
  async _registerContextTypes() {
    try {
      this.logger.debug('Registering UI preference context types with MCP Context Manager');
      
      // Register context types
      this.contextTypes.add('ui.preference.setting');
      this.contextTypes.add('ui.preference.default');
      
      // Register with MCP Context Manager
      for (const contextType of this.contextTypes) {
        await this.mcpContextManager.registerContextProvider(contextType, this);
      }
      
      this.logger.debug('UI preference context types registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register UI preference context types: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Initialize the preference manager.
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
      
      // Load default preferences
      if (options.defaultPreferences) {
        await this.setDefaultPreferences(options.defaultPreferences);
      }
      
      // Load persisted preferences
      if (this.contextPersistence) {
        await this._loadPersistedPreferences();
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize MCPPreferenceManagerProvider: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Set a preference value.
   * @param {string} preferenceId Preference identifier
   * @param {*} value Preference value
   * @param {Object} [options] Additional options
   * @param {string} [options.category] Preference category
   * @param {string} [options.scope='user'] Preference scope
   * @returns {Promise<boolean>} True if setting was successful
   */
  async setPreference(preferenceId, value, options = {}) {
    try {
      this.logger.debug(`Setting preference: ${preferenceId}`, { value, options });
      
      // Validate preference ID
      if (!preferenceId) {
        throw new Error('Invalid preference ID: preferenceId is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('setPreference', async () => {
        // Get default value if available
        const defaultValue = this.defaultPreferences.has(preferenceId) 
          ? this.defaultPreferences.get(preferenceId).value 
          : undefined;
        
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          preferenceId,
          category: options.category || 'general',
          value,
          defaultValue,
          scope: options.scope || 'user',
          metadata: options.metadata || {}
        };
        
        // Add category to set
        this.preferenceCategories.add(contextData.category);
        
        // Update preferences map
        this.preferences.set(preferenceId, {
          value,
          category: contextData.category,
          scope: contextData.scope,
          timestamp: contextData.timestamp,
          metadata: contextData.metadata
        });
        
        // Update context data
        await this._processContextUpdate('ui.preference.setting', contextData, this.constructor.name);
        
        // Persist preference if enabled
        if (this.contextPersistence) {
          await this._persistContext('ui.preference.setting');
        }
        
        // Sync preference if enabled
        if (this.syncEnabled && options.sync !== false) {
          await this._syncPreference(preferenceId, contextData);
        }
        
        // Emit preference changed event
        this.emit('preferenceChanged', {
          preferenceId,
          value,
          previousValue: contextData.previousValue,
          category: contextData.category,
          scope: contextData.scope
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to set preference: ${error.message}`, { error, preferenceId, value });
      
      // Emit error event
      this.emit('error', {
        type: 'preferenceSet',
        message: error.message,
        error,
        preferenceId
      });
      
      return false;
    }
  }
  
  /**
   * Get a preference value.
   * @param {string} preferenceId Preference identifier
   * @returns {Promise<*>} Preference value or default value if not set
   */
  async getPreference(preferenceId) {
    try {
      this.logger.debug(`Getting preference: ${preferenceId}`);
      
      // Validate preference ID
      if (!preferenceId) {
        throw new Error('Invalid preference ID: preferenceId is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getPreference', async () => {
        // Check if preference exists
        if (this.preferences.has(preferenceId)) {
          return this.preferences.get(preferenceId).value;
        }
        
        // Check if default preference exists
        if (this.defaultPreferences.has(preferenceId)) {
          return this.defaultPreferences.get(preferenceId).value;
        }
        
        // Return null if preference doesn't exist
        return null;
      });
    } catch (error) {
      this.logger.error(`Failed to get preference: ${error.message}`, { error, preferenceId });
      return null;
    }
  }
  
  /**
   * Set default preferences.
   * @param {Object} defaults Default preferences object
   * @param {Object} [options] Additional options
   * @param {string} [options.userTier] User tier
   * @param {string} [options.platform] Platform
   * @param {string} [options.version] Application version
   * @returns {Promise<boolean>} True if setting was successful
   */
  async setDefaultPreferences(defaults, options = {}) {
    try {
      this.logger.debug('Setting default preferences', { defaults, options });
      
      // Validate defaults
      if (!defaults || typeof defaults !== 'object') {
        throw new Error('Invalid defaults: defaults must be an object');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('setDefaultPreferences', async () => {
        // Create context data
        const contextData = {
          version: '1.0.0',
          timestamp: Date.now(),
          defaults,
          userTier: options.userTier,
          platform: options.platform,
          version: options.version
        };
        
        // Update default preferences map
        for (const [preferenceId, value] of Object.entries(defaults)) {
          this.defaultPreferences.set(preferenceId, {
            value,
            userTier: options.userTier,
            platform: options.platform,
            version: options.version,
            timestamp: contextData.timestamp
          });
        }
        
        // Update context data
        await this._processContextUpdate('ui.preference.default', contextData, this.constructor.name);
        
        // Persist default preferences if enabled
        if (this.contextPersistence) {
          await this._persistContext('ui.preference.default');
        }
        
        // Emit default preferences changed event
        this.emit('defaultPreferencesChanged', {
          defaults,
          userTier: options.userTier,
          platform: options.platform,
          version: options.version
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to set default preferences: ${error.message}`, { error, defaults });
      
      // Emit error event
      this.emit('error', {
        type: 'defaultPreferencesSet',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Get preferences by category.
   * @param {string} category Preference category
   * @returns {Promise<Object>} Object with preference IDs as keys and values as values
   */
  async getPreferencesByCategory(category) {
    try {
      this.logger.debug(`Getting preferences by category: ${category}`);
      
      // Validate category
      if (!category) {
        throw new Error('Invalid category: category is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getPreferencesByCategory', async () => {
        const result = {};
        
        // Get preferences in category
        for (const [preferenceId, preference] of this.preferences.entries()) {
          if (preference.category === category) {
            result[preferenceId] = preference.value;
          }
        }
        
        // Get default preferences in category if not already set
        for (const [preferenceId, defaultPreference] of this.defaultPreferences.entries()) {
          if (!result.hasOwnProperty(preferenceId) && defaultPreference.category === category) {
            result[preferenceId] = defaultPreference.value;
          }
        }
        
        return result;
      });
    } catch (error) {
      this.logger.error(`Failed to get preferences by category: ${error.message}`, { error, category });
      return {};
    }
  }
  
  /**
   * Reset preferences to defaults.
   * @param {string} [category] Optional category to reset
   * @returns {Promise<boolean>} True if reset was successful
   */
  async resetPreferences(category) {
    try {
      this.logger.debug('Resetting preferences to defaults', { category });
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('resetPreferences', async () => {
        // Get preferences to reset
        const preferencesToReset = new Set();
        
        if (category) {
          // Reset preferences in specific category
          for (const [preferenceId, preference] of this.preferences.entries()) {
            if (preference.category === category) {
              preferencesToReset.add(preferenceId);
            }
          }
        } else {
          // Reset all preferences
          for (const preferenceId of this.preferences.keys()) {
            preferencesToReset.add(preferenceId);
          }
        }
        
        // Reset each preference
        for (const preferenceId of preferencesToReset) {
          // Get default value
          const defaultValue = this.defaultPreferences.has(preferenceId)
            ? this.defaultPreferences.get(preferenceId).value
            : null;
          
          if (defaultValue !== null) {
            // Set preference to default value
            await this.setPreference(preferenceId, defaultValue, {
              category: this.preferences.get(preferenceId).category,
              scope: this.preferences.get(preferenceId).scope,
              sync: true
            });
          } else {
            // Remove preference if no default value
            this.preferences.delete(preferenceId);
          }
        }
        
        // Emit preferences reset event
        this.emit('preferencesReset', {
          category,
          count: preferencesToReset.size
        });
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to reset preferences: ${error.message}`, { error, category });
      
      // Emit error event
      this.emit('error', {
        type: 'preferencesReset',
        message: error.message,
        error,
        category
      });
      
      return false;
    }
  }
  
  /**
   * Sync preference with remote storage.
   * @private
   * @param {string} preferenceId Preference identifier
   * @param {Object} contextData Preference context data
   * @returns {Promise<void>}
   */
  async _syncPreference(preferenceId, contextData) {
    try {
      this.logger.debug(`Syncing preference: ${preferenceId}`);
      
      // Skip if sync is disabled
      if (!this.syncEnabled) {
        return;
      }
      
      // Skip if preference scope is not user
      if (contextData.scope !== 'user') {
        return;
      }
      
      // Emit sync event
      this.emit('preferenceSyncing', {
        preferenceId,
        value: contextData.value
      });
      
      // In a real implementation, this would sync with a remote service
      // For now, we'll just simulate a successful sync
      
      // Emit sync complete event
      this.emit('preferenceSynced', {
        preferenceId,
        value: contextData.value,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error(`Failed to sync preference: ${error.message}`, { error, preferenceId });
      
      // Emit sync error event
      this.emit('preferenceSyncError', {
        preferenceId,
        error: error.message
      });
    }
  }
  
  /**
   * Load persisted preferences.
   * @private
   * @returns {Promise<void>}
   */
  async _loadPersistedPreferences() {
    try {
      this.logger.debug('Loading persisted preferences');
      
      // Skip if persistence is disabled
      if (!this.contextPersistence) {
        return;
      }
      
      // Load persisted preferences
      const persistedPreferences = await this.mcpContextManager.loadPersistedContext('ui.preference.setting');
      if (persistedPreferences && persistedPreferences.contextData) {
        // Process each persisted preference
        for (const [preferenceId, preference] of Object.entries(persistedPreferences.contextData)) {
          this.preferences.set(preferenceId, preference);
          
          // Add category to set
          if (preference.category) {
            this.preferenceCategories.add(preference.category);
          }
        }
      }
      
      // Load persisted default preferences
      const persistedDefaults = await this.mcpContextManager.loadPersistedContext('ui.preference.default');
      if (persistedDefaults && persistedDefaults.contextData && persistedDefaults.contextData.defaults) {
        // Process each persisted default preference
        for (const [preferenceId, value] of Object.entries(persistedDefaults.contextData.defaults)) {
          this.defaultPreferences.set(preferenceId, {
            value,
            userTier: persistedDefaults.contextData.userTier,
            platform: persistedDefaults.contextData.platform,
            version: persistedDefaults.contextData.version,
            timestamp: persistedDefaults.timestamp
          });
        }
      }
      
      this.logger.debug('Persisted preferences loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load persisted preferences: ${error.message}`, { error });
    }
  }
  
  /**
   * Export preferences to JSON.
   * @param {Object} [options] Export options
   * @param {boolean} [options.includeDefaults=false] Whether to include default preferences
   * @param {string} [options.category] Filter by category
   * @returns {Promise<Object>} Exported preferences
   */
  async exportPreferences(options = {}) {
    try {
      this.logger.debug('Exporting preferences', { options });
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('exportPreferences', async () => {
        const result = {
          preferences: {},
          metadata: {
            timestamp: Date.now(),
            version: '1.0.0'
          }
        };
        
        // Export user preferences
        for (const [preferenceId, preference] of this.preferences.entries()) {
          // Filter by category if specified
          if (options.category && preference.category !== options.category) {
            continue;
          }
          
          result.preferences[preferenceId] = {
            value: preference.value,
            category: preference.category,
            scope: preference.scope
          };
        }
        
        // Include default preferences if requested
        if (options.includeDefaults) {
          result.defaults = {};
          
          for (const [preferenceId, defaultPreference] of this.defaultPreferences.entries()) {
            // Filter by category if specified
            if (options.category && defaultPreference.category !== options.category) {
              continue;
            }
            
            result.defaults[preferenceId] = {
              value: defaultPreference.value,
              userTier: defaultPreference.userTier,
              platform: defaultPreference.platform,
              version: defaultPreference.version
            };
          }
        }
        
        return result;
      });
    } catch (error) {
      this.logger.error(`Failed to export preferences: ${error.message}`, { error, options });
      return { preferences: {}, metadata: { timestamp: Date.now(), error: error.message } };
    }
  }
  
  /**
   * Import preferences from JSON.
   * @param {Object} data Preferences data to import
   * @param {Object} [options] Import options
   * @param {boolean} [options.overwrite=false] Whether to overwrite existing preferences
   * @param {boolean} [options.importDefaults=false] Whether to import default preferences
   * @returns {Promise<Object>} Import result with success count and errors
   */
  async importPreferences(data, options = {}) {
    try {
      this.logger.debug('Importing preferences', { options });
      
      // Validate data
      if (!data || !data.preferences || typeof data.preferences !== 'object') {
        throw new Error('Invalid preferences data: preferences object is required');
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextUpdate('importPreferences', async () => {
        const result = {
          success: 0,
          errors: [],
          skipped: 0
        };
        
        // Import user preferences
        for (const [preferenceId, preference] of Object.entries(data.preferences)) {
          try {
            // Skip if preference exists and overwrite is false
            if (this.preferences.has(preferenceId) && !options.overwrite) {
              result.skipped++;
              continue;
            }
            
            // Set preference
            await this.setPreference(preferenceId, preference.value, {
              category: preference.category || 'imported',
              scope: preference.scope || 'user',
              sync: false
            });
            
            result.success++;
          } catch (error) {
            result.errors.push({
              preferenceId,
              error: error.message
            });
          }
        }
        
        // Import default preferences if requested
        if (options.importDefaults && data.defaults) {
          const defaults = {};
          
          for (const [preferenceId, defaultPreference] of Object.entries(data.defaults)) {
            defaults[preferenceId] = defaultPreference.value;
          }
          
          await this.setDefaultPreferences(defaults, {
            userTier: data.defaults.userTier,
            platform: data.defaults.platform,
            version: data.defaults.version
          });
        }
        
        // Emit preferences imported event
        this.emit('preferencesImported', {
          count: result.success,
          skipped: result.skipped,
          errors: result.errors.length
        });
        
        return result;
      });
    } catch (error) {
      this.logger.error(`Failed to import preferences: ${error.message}`, { error, data });
      
      // Emit error event
      this.emit('error', {
        type: 'preferencesImport',
        message: error.message,
        error
      });
      
      return { success: 0, errors: [{ global: error.message }], skipped: 0 };
    }
  }
}

module.exports = MCPPreferenceManagerProvider;
