/**
 * Jest configuration for Aideon Tentacle Marketplace tests
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test files pattern
  testMatch: [
    '**/analytics/**/*.test.js',
    '**/analytics/**/*.spec.js',
    '**/analytics/**/*.e2e.test.js',
    '**/ui/**/*.test.js',
    '**/ui/**/*.spec.js',
    '**/ui/**/*.e2e.test.js'
  ],
  
  // Module name mapper for resolving paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Setup files
  setupFiles: ['<rootDir>/test/marketplace/setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/marketplace/analytics/**/*.js',
    'src/marketplace/ui/**/*.js',
    '!src/marketplace/analytics/**/index.js',
    '!src/marketplace/ui/**/index.js'
  ],
  
  // Ignore transformations for node_modules
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Verbose output
  verbose: true
};
