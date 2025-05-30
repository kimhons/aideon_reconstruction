/**
 * @fileoverview Module resolution helper for Screen Recording and Analysis module.
 * 
 * This file provides utility functions to resolve module paths correctly,
 * addressing the module resolution issues identified in the architectural review.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

/**
 * Resolves a module path relative to the Screen Recording and Analysis module.
 * @param {string} relativePath - Relative path from the screen module root
 * @returns {string} Absolute path to the module
 */
function resolveScreenModulePath(relativePath) {
  // Base path for the screen module
  const basePath = path.resolve(__dirname);
  return path.join(basePath, relativePath);
}

/**
 * Resolves a module path for tests relative to the test directory.
 * @param {string} relativePath - Relative path from the test directory
 * @returns {string} Absolute path to the module
 */
function resolveTestPath(relativePath) {
  // Base path for tests
  const basePath = path.resolve(__dirname, '../../../../test');
  return path.join(basePath, relativePath);
}

/**
 * Resolves a source module path from a test file.
 * @param {string} relativePath - Relative path from src root
 * @returns {string} Absolute path to the source module
 */
function resolveSourceFromTest(relativePath) {
  // Base path for source from test perspective
  const basePath = path.resolve(__dirname, '../../../../../src');
  return path.join(basePath, relativePath);
}

/**
 * Safely requires a module with proper error handling.
 * @param {string} modulePath - Path to the module
 * @param {Object} options - Options
 * @param {boolean} options.silent - Whether to suppress errors
 * @param {*} options.defaultValue - Default value if module not found
 * @returns {*} Module exports or default value
 */
function safeRequire(modulePath, options = {}) {
  const silent = options.silent !== false;
  const defaultValue = options.defaultValue !== undefined ? options.defaultValue : null;
  
  try {
    // Check if file exists
    if (!fs.existsSync(modulePath)) {
      if (!silent) {
        console.warn(`Module not found: ${modulePath}`);
      }
      return defaultValue;
    }
    
    // Require module
    return require(modulePath);
  } catch (error) {
    if (!silent) {
      console.error(`Error requiring module ${modulePath}: ${error.message}`);
    }
    return defaultValue;
  }
}

module.exports = {
  resolveScreenModulePath,
  resolveTestPath,
  resolveSourceFromTest,
  safeRequire
};
