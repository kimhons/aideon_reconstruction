/**
 * Mocha configuration for DevMaster Tentacle tests
 */
module.exports = {
  require: ['test/tentacles/devmaster/setup.js'],
  exclude: ['**/marketplace/**', '**/node_modules/**'],
  timeout: 5000,
  ui: 'bdd',
  reporter: 'spec',
  color: true,
  recursive: true
};
