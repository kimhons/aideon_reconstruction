/**
 * @fileoverview Module resolver for MCP UI integration tests.
 * 
 * This module provides a utility to resolve module paths for testing,
 * with special handling for mock implementations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');

/**
 * Resolve and require a module, with special handling for test mocks.
 * @param {string} modulePath Module path to resolve
 * @returns {*} Required module
 */
function resolveModule(modulePath) {
  console.log(`[MODULE_RESOLVER] Resolving: ${modulePath}`);
  
  // Handle special cases for mocks
  if (modulePath.includes('input/utils/EnhancedAsyncLockAdapter')) {
    console.log('[MODULE_RESOLVER] Using mock EnhancedAsyncLockAdapter');
    return require(path.join(__dirname, '..', 'mocks', 'EnhancedAsyncLockAdapter.js'));
  }
  
  // Default case: try to resolve the module normally
  try {
    return require(path.resolve(__dirname, '../../../../../', modulePath));
  } catch (error) {
    console.error(`[MODULE_RESOLVER] Failed to resolve module: ${modulePath}`, error);
    throw error;
  }
}

module.exports = { resolveModule };
