/**
 * @fileoverview Test Module Resolver for Knowledge Context tests.
 * 
 * This utility resolves module paths for tests, ensuring proper imports
 * regardless of the test execution context.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

/**
 * Resolves the path to a module relative to the project root.
 * 
 * @param {string} modulePath - Relative path from src or test directory
 * @returns {string} - Resolved absolute path to the module
 */
function resolveModulePath(modulePath) {
  // Determine if we're looking for a src or test module
  const isSrcModule = modulePath.startsWith('src/');
  const isTestModule = modulePath.startsWith('test/');
  
  // Find the project root directory
  let currentDir = __dirname;
  let projectRoot = null;
  
  // Navigate up until we find the packages/aideon-main directory
  while (currentDir !== '/') {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const packageJson = require(path.join(currentDir, 'package.json'));
      if (packageJson.name === 'aideon-main') {
        projectRoot = currentDir;
        break;
      }
    }
    
    // Check if we're in the packages/aideon-main directory
    if (path.basename(currentDir) === 'aideon-main' && 
        path.basename(path.dirname(currentDir)) === 'packages') {
      projectRoot = currentDir;
      break;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  if (!projectRoot) {
    throw new Error('Could not find project root directory');
  }
  
  // Resolve the module path
  let resolvedPath;
  
  if (isSrcModule) {
    resolvedPath = path.join(projectRoot, modulePath);
  } else if (isTestModule) {
    resolvedPath = path.join(projectRoot, modulePath);
  } else {
    // If no prefix is provided, assume it's a src module
    resolvedPath = path.join(projectRoot, 'src', modulePath);
  }
  
  return resolvedPath;
}

/**
 * Requires a module using its path relative to the project root.
 * 
 * @param {string} modulePath - Relative path from src or test directory
 * @returns {Object} - Required module
 */
function requireModule(modulePath) {
  const resolvedPath = resolveModulePath(modulePath);
  return require(resolvedPath);
}

module.exports = {
  resolveModulePath,
  requireModule
};
