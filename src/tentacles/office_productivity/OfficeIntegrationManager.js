    try {
      return await this.resourceManager.getAsset(assetId, options);
    } catch (error) {
      // Handle offline case - if we have a cached version, use it
      if (this.offlineCapabilityManager && this.offlineCapabilityManager.canExecuteOffline('resourceManager', 'getAsset')) {
        // Try again with cache only
        options.useCache = true;
        options.offlineOnly = true;
        return await this.resourceManager.getAsset(assetId, options);
      }
      throw error;
    }
  }

  /**
   * Gets a localized resource
   * @param {string} resourceId - Resource ID
   * @param {string} [locale] - Locale (defaults to current locale)
   * @returns {Promise<Object>} Localized resource
   */
  async getLocalizedResource(resourceId, locale) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.resourceManager) {
      throw new Error('ResourceManager not initialized');
    }

    try {
      return await this.resourceManager.getLocalizedResource(resourceId, locale || this.getLocale());
    } catch (error) {
      // Handle offline case - if we have a cached version, use it
      if (this.offlineCapabilityManager && this.offlineCapabilityManager.canExecuteOffline('resourceManager', 'getLocalizedResource')) {
        // Try again with cache only
        return await this.resourceManager.getLocalizedResource(resourceId, locale || this.getLocale());
      }
      throw error;
    }
  }

  /**
   * Sets the current locale
   * @param {string} locale - Locale to set
   */
  setLocale(locale) {
    if (this.resourceManager) {
      this.resourceManager.setLocale(locale);
    }
  }

  /**
   * Gets the current locale
   * @returns {string} Current locale
   */
  getLocale() {
    return this.resourceManager ? this.resourceManager.getLocale() : 'en-US';
  }

  /**
   * Cleans up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Clean up all adapters
    for (const adapter of this.applicationRegistry.values()) {
      await adapter.cleanup();
    }

    // Clean up all strategies
    for (const strategy of this.strategyRegistry.values()) {
      if (typeof strategy.cleanup === 'function') {
        await strategy.cleanup();
      }
    }

    // Clean up managers
    if (this.resourceManager) {
      await this.resourceManager.cleanup();
    }
    
    if (this.designSystem) {
      await this.designSystem.cleanup();
    }
    
    if (this.offlineCapabilityManager) {
      await this.offlineCapabilityManager.cleanup();
    }

    this.initialized = false;
  }
}

module.exports = OfficeIntegrationManager;
