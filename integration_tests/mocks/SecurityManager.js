/**
 * @fileoverview Mock SecurityManager for integration tests
 */

class SecurityManager {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
  }

  validateAccess(resource, operation, context = {}) {
    // Mock implementation - always return true for tests
    return true;
  }

  encryptData(data, options = {}) {
    // Mock implementation - return the data unchanged
    return data;
  }

  decryptData(encryptedData, options = {}) {
    // Mock implementation - return the data unchanged
    return encryptedData;
  }

  validateDataIntegrity(data, signature) {
    // Mock implementation - always return true for tests
    return true;
  }
}

module.exports = SecurityManager;
