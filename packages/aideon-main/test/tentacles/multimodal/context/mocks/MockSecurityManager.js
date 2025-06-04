/**
 * @fileoverview Mock SecurityManager for testing.
 */
class MockSecurityManager {
  constructor() {
    this.encryptionKeys = new Map();
    this.permissions = new Map();
    this.roles = new Map();
  }
  
  async getEncryptionKey(keyName) {
    return this.encryptionKeys.get(keyName);
  }
  
  async storeEncryptionKey(keyName, key) {
    this.encryptionKeys.set(keyName, key);
    return true;
  }
  
  async checkPermission(source, permission) {
    const sourcePermissions = this.permissions.get(source) || [];
    return sourcePermissions.includes(permission) || sourcePermissions.includes('admin');
  }
  
  async checkRole(source, role) {
    const sourceRoles = this.roles.get(source) || [];
    return sourceRoles.includes(role);
  }
  
  setPermission(source, permission) {
    const sourcePermissions = this.permissions.get(source) || [];
    sourcePermissions.push(permission);
    this.permissions.set(source, sourcePermissions);
  }
  
  setRole(source, role) {
    const sourceRoles = this.roles.get(source) || [];
    sourceRoles.push(role);
    this.roles.set(source, sourceRoles);
  }
}

module.exports = MockSecurityManager;
