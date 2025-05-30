/**
 * @fileoverview Test Module Resolver for MCP integration tests.
 * 
 * This utility resolves module paths for MCP integration tests, ensuring
 * that the correct modules are loaded regardless of the test execution context.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

/**
 * Resolves module paths for MCP integration tests.
 */
class TestModuleResolver {
  /**
   * Creates a new Test Module Resolver.
   */
  constructor() {
    this.rootDir = this.findProjectRoot();
    this.srcDir = path.join(this.rootDir, 'src');
    this.testDir = path.join(this.rootDir, 'test');
  }

  /**
   * Finds the project root directory.
   * 
   * @returns {string} The absolute path to the project root directory
   */
  findProjectRoot() {
    let currentDir = __dirname;
    
    // Traverse up until we find the package.json file
    while (currentDir !== '/') {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        // Found the package.json, this is the project root
        return currentDir;
      }
      
      // Move up one directory
      currentDir = path.dirname(currentDir);
    }
    
    // If we couldn't find the project root, use a reasonable default
    return path.resolve(path.join(__dirname, '..', '..', '..', '..', '..'));
  }

  /**
   * Resolves a module path relative to the project root.
   * 
   * @param {string} modulePath - The module path to resolve
   * @returns {string} The absolute path to the module
   */
  resolvePath(modulePath) {
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      // Relative path, resolve from the current directory
      return path.resolve(path.join(__dirname, modulePath));
    } else if (modulePath.startsWith('/')) {
      // Absolute path, use as is
      return modulePath;
    } else {
      // Module path, resolve from the project root
      return path.join(this.rootDir, modulePath);
    }
  }

  /**
   * Resolves a source module path.
   * 
   * @param {string} modulePath - The module path relative to the src directory
   * @returns {string} The absolute path to the module
   */
  resolveSourcePath(modulePath) {
    return path.join(this.srcDir, modulePath);
  }

  /**
   * Resolves a test module path.
   * 
   * @param {string} modulePath - The module path relative to the test directory
   * @returns {string} The absolute path to the module
   */
  resolveTestPath(modulePath) {
    return path.join(this.testDir, modulePath);
  }

  /**
   * Requires a module using the resolved path.
   * 
   * @param {string} modulePath - The module path to require
   * @returns {Object} The required module
   */
  require(modulePath) {
    const resolvedPath = this.resolvePath(modulePath);
    return require(resolvedPath);
  }

  /**
   * Requires a source module using the resolved path.
   * 
   * @param {string} modulePath - The module path relative to the src directory
   * @returns {Object} The required module
   */
  requireSource(modulePath) {
    const resolvedPath = this.resolveSourcePath(modulePath);
    return require(resolvedPath);
  }

  /**
   * Requires a test module using the resolved path.
   * 
   * @param {string} modulePath - The module path relative to the test directory
   * @returns {Object} The required module
   */
  requireTest(modulePath) {
    const resolvedPath = this.resolveTestPath(modulePath);
    return require(resolvedPath);
  }
}

module.exports = new TestModuleResolver();
