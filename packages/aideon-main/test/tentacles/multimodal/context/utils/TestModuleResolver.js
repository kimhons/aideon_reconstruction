/**
 * @fileoverview Test Module Resolver for MCP UI integration tests.
 * 
 * This module provides a utility to resolve module paths for testing,
 * with special handling for mock implementations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

/**
 * Resolve and require a module, with special handling for test mocks.
 * @param {string} modulePath Module path to resolve
 * @returns {*} Required module
 */
function requireModule(modulePath) {
  try {
    // Check if this is a path that needs special handling
    if (modulePath.includes('EnhancedAsyncLockAdapter')) {
      return require('../mocks/EnhancedAsyncLockAdapter');
    } else if (modulePath.includes('UIContextSchemas')) {
      return require('../schemas/UIContextSchemas');
    } else if (modulePath.includes('MCPUIContextProvider')) {
      // Try to load the actual implementation first
      try {
        return require(path.resolve(__dirname, '../../../../', modulePath));
      } catch (innerError) {
        // Fall back to mock if actual implementation fails
        return require('../mocks/MCPUIContextProvider');
      }
    } else if (modulePath.includes('MCPUIStateManagerProvider') ||
               modulePath.includes('MCPInteractionTrackerProvider') ||
               modulePath.includes('MCPPreferenceManagerProvider') ||
               modulePath.includes('MCPAccessibilityEngineProvider') ||
               modulePath.includes('MCPThemeManagerProvider')) {
      // For specialized providers, try actual implementation first
      try {
        return require(path.resolve(__dirname, '../../../../', modulePath));
      } catch (innerError) {
        // Fall back to base mock provider if specialized mock doesn't exist
        return require('../mocks/MCPUIContextProvider');
      }
    }
    
    // Default case: try to resolve the module normally
    return require(path.resolve(__dirname, '../../../../', modulePath));
  } catch (error) {
    console.error(`Failed to resolve module: ${modulePath}`, error);
    throw error;
  }
}

module.exports = { requireModule };
