/**
 * @fileoverview Mock Logger for testing
 */

class Logger {
  constructor(name) {
    this.name = name;
  }

  info(message, ...args) {
    // Mock implementation - does nothing in tests
  }

  warn(message, ...args) {
    // Mock implementation - does nothing in tests
  }

  error(message, ...args) {
    // Mock implementation - does nothing in tests
  }

  debug(message, ...args) {
    // Mock implementation - does nothing in tests
  }

  trace(message, ...args) {
    // Mock implementation - does nothing in tests
  }
}

module.exports = { Logger };
