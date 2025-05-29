/**
 * @fileoverview Mock Logger for integration tests
 */

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.module = options.module || 'default';
  }

  info(message, metadata = {}) {
    // Mock implementation
    return true;
  }

  error(message, metadata = {}) {
    // Mock implementation
    return true;
  }

  warn(message, metadata = {}) {
    // Mock implementation
    return true;
  }

  debug(message, metadata = {}) {
    // Mock implementation
    return true;
  }

  trace(message, metadata = {}) {
    // Mock implementation
    return true;
  }
}

module.exports = Logger;
