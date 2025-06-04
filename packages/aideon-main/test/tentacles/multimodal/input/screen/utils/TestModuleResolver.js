/**
 * @fileoverview Test module resolver for Screen Recording and Analysis tests.
 * 
 * This file provides utility functions to resolve module paths correctly in tests,
 * addressing the module resolution issues identified in the architectural review.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

/**
 * Base paths for different contexts
 */
const BASE_PATHS = {
  // Path to the test directory
  TEST: path.resolve(__dirname, '../../../../../test'),
  
  // Path to the source directory
  SRC: path.resolve(__dirname, '../../../../../src'),
  
  // Path to the screen recording module in source
  SCREEN_MODULE: path.resolve(__dirname, '../../../../../src/tentacles/multimodal/input/screen'),
  
  // Path to the screen recording tests
  SCREEN_TESTS: path.resolve(__dirname, '../../../../../test/tentacles/multimodal/input/screen')
};

/**
 * Resolves a module path relative to the source directory.
 * @param {string} relativePath - Relative path from the source directory
 * @returns {string} Absolute path to the module
 */
function resolveSourcePath(relativePath) {
  return path.join(BASE_PATHS.SRC, relativePath);
}

/**
 * Resolves a module path relative to the screen recording module.
 * @param {string} relativePath - Relative path from the screen recording module
 * @returns {string} Absolute path to the module
 */
function resolveScreenModulePath(relativePath) {
  return path.join(BASE_PATHS.SCREEN_MODULE, relativePath);
}

/**
 * Resolves a module path relative to the test directory.
 * @param {string} relativePath - Relative path from the test directory
 * @returns {string} Absolute path to the module
 */
function resolveTestPath(relativePath) {
  return path.join(BASE_PATHS.TEST, relativePath);
}

/**
 * Resolves a module path relative to the screen recording tests.
 * @param {string} relativePath - Relative path from the screen recording tests
 * @returns {string} Absolute path to the module
 */
function resolveScreenTestPath(relativePath) {
  return path.join(BASE_PATHS.SCREEN_TESTS, relativePath);
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
    
    // Clear require cache for the module to ensure fresh load
    delete require.cache[require.resolve(modulePath)];
    
    // Require module
    return require(modulePath);
  } catch (error) {
    if (!silent) {
      console.error(`Error requiring module ${modulePath}: ${error.message}`);
    }
    return defaultValue;
  }
}

/**
 * Creates a mock for a module.
 * @param {string} modulePath - Path to the module to mock
 * @param {Object} mockImplementation - Mock implementation
 * @returns {Object} Mock module
 */
function mockModule(modulePath, mockImplementation) {
  // Ensure module path is absolute
  const absolutePath = path.isAbsolute(modulePath) ? modulePath : path.resolve(modulePath);
  
  // Create mock
  const mock = typeof mockImplementation === 'function' 
    ? mockImplementation() 
    : mockImplementation;
  
  // Add to require cache
  require.cache[require.resolve(absolutePath)] = {
    id: absolutePath,
    filename: absolutePath,
    loaded: true,
    exports: mock
  };
  
  return mock;
}

/**
 * Restores a mocked module.
 * @param {string} modulePath - Path to the mocked module
 */
function restoreModule(modulePath) {
  // Ensure module path is absolute
  const absolutePath = path.isAbsolute(modulePath) ? modulePath : path.resolve(modulePath);
  
  // Remove from require cache
  delete require.cache[require.resolve(absolutePath)];
}

module.exports = {
  BASE_PATHS,
  resolveSourcePath,
  resolveScreenModulePath,
  resolveTestPath,
  resolveScreenTestPath,
  safeRequire,
  mockModule,
  restoreModule
};
