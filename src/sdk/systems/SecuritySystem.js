/**
 * @fileoverview Security System for managing authentication, authorization, and encryption.
 * Provides user authentication, role-based access control, and data encryption.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { SecurityError } = require('../utils/errorHandling');
const Logger = require('./LoggingSystem').Logger;

/**
 * Manages application security.
 */
class SecuritySystem {
  /**
   * Creates a new SecuritySystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._users = new Map();
    this._roles = new Map();
    this._permissions = new Map();
    this._sessions = new Map();
    this._initialized = false;
    this._logger = new Logger('aideon:security');
    this._options = {
      enableAuthentication: options.enableAuthentication !== false,
      enableAuthorization: options.enableAuthorization !== false,
      enableEncryption: options.enableEncryption !== false,
      tokenExpiration: options.tokenExpiration || 3600, // 1 hour
      encryptionAlgorithm: options.encryptionAlgorithm || 'aes-256-gcm',
      ...options
    };
    
    // Generate encryption key if not provided
    if (!options.encryptionKey && this._options.enableEncryption) {
      this._encryptionKey = crypto.randomBytes(32);
    } else {
      this._encryptionKey = options.encryptionKey;
    }
  }
  
  /**
   * Initializes the security system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Initializing security system');
      
      // Set up default roles and permissions
      if (this._options.enableAuthorization) {
        this._setupDefaultRoles();
      }
      
      this._initialized = true;
      this._logger.info('Security system initialized');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to initialize security system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to initialize security system', 'SECURITY_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the security system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Shutting down security system');
      
      // Clear sessions
      this._sessions.clear();
      
      this._initialized = false;
      this._logger.info('Security system shut down');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to shut down security system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to shut down security system', 'SECURITY_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Registers a user.
   * @param {Object} user - The user object
   * @param {string} user.username - The username
   * @param {string} user.password - The password
   * @param {Array<string>} [user.roles=[]] - The user roles
   * @returns {Object} The registered user
   */
  registerUser(user) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthentication) {
      throw new SecurityError('Authentication is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!user || !user.username || !user.password) {
      throw new SecurityError('Invalid user object', 'SECURITY_USER_ERROR');
    }
    
    if (this._users.has(user.username)) {
      throw new SecurityError('User already exists', 'SECURITY_USER_EXISTS');
    }
    
    try {
      // Hash password
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = this._hashPassword(user.password, salt);
      
      // Create user
      const newUser = {
        id: uuidv4(),
        username: user.username,
        passwordHash: hash,
        passwordSalt: salt,
        roles: user.roles || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store user
      this._users.set(user.username, newUser);
      
      this._logger.info(`User registered: ${user.username}`);
      
      // Return user without sensitive data
      return this._sanitizeUser(newUser);
    } catch (error) {
      this._logger.error(`Failed to register user: ${user.username}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to register user: ${user.username}`, 'SECURITY_REGISTER_ERROR', error);
    }
  }
  
  /**
   * Authenticates a user.
   * @param {string} username - The username
   * @param {string} password - The password
   * @returns {Object} The authentication result
   */
  authenticate(username, password) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthentication) {
      throw new SecurityError('Authentication is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!username || !password) {
      throw new SecurityError('Invalid credentials', 'SECURITY_AUTH_ERROR');
    }
    
    try {
      // Get user
      const user = this._users.get(username);
      
      if (!user) {
        throw new SecurityError('Invalid credentials', 'SECURITY_AUTH_ERROR');
      }
      
      // Verify password
      const hash = this._hashPassword(password, user.passwordSalt);
      
      if (hash !== user.passwordHash) {
        throw new SecurityError('Invalid credentials', 'SECURITY_AUTH_ERROR');
      }
      
      // Create session
      const session = this._createSession(user);
      
      this._logger.info(`User authenticated: ${username}`);
      
      return {
        user: this._sanitizeUser(user),
        token: session.token,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      this._logger.error(`Failed to authenticate user: ${username}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to authenticate user: ${username}`, 'SECURITY_AUTH_ERROR', error);
    }
  }
  
  /**
   * Validates a token.
   * @param {string} token - The token
   * @returns {Object} The validation result
   */
  validateToken(token) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthentication) {
      throw new SecurityError('Authentication is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!token) {
      throw new SecurityError('Invalid token', 'SECURITY_TOKEN_ERROR');
    }
    
    try {
      // Get session
      const session = this._sessions.get(token);
      
      if (!session) {
        throw new SecurityError('Invalid token', 'SECURITY_TOKEN_ERROR');
      }
      
      // Check expiration
      if (session.expiresAt < Date.now()) {
        this._sessions.delete(token);
        throw new SecurityError('Token expired', 'SECURITY_TOKEN_EXPIRED');
      }
      
      // Get user
      const user = this._users.get(session.username);
      
      if (!user) {
        this._sessions.delete(token);
        throw new SecurityError('User not found', 'SECURITY_USER_ERROR');
      }
      
      return {
        valid: true,
        user: this._sanitizeUser(user)
      };
    } catch (error) {
      this._logger.error('Failed to validate token', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Invalidates a token.
   * @param {string} token - The token
   * @returns {boolean} True if invalidation was successful
   */
  invalidateToken(token) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthentication) {
      throw new SecurityError('Authentication is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!token) {
      throw new SecurityError('Invalid token', 'SECURITY_TOKEN_ERROR');
    }
    
    try {
      // Delete session
      const result = this._sessions.delete(token);
      
      if (result) {
        this._logger.info('Token invalidated');
      }
      
      return result;
    } catch (error) {
      this._logger.error('Failed to invalidate token', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to invalidate token', 'SECURITY_TOKEN_ERROR', error);
    }
  }
  
  /**
   * Checks if a user has a permission.
   * @param {string} username - The username
   * @param {string} permission - The permission
   * @returns {boolean} True if the user has the permission
   */
  hasPermission(username, permission) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!username || !permission) {
      throw new SecurityError('Invalid parameters', 'SECURITY_PERMISSION_ERROR');
    }
    
    try {
      // Get user
      const user = this._users.get(username);
      
      if (!user) {
        return false;
      }
      
      // Check user roles
      for (const roleName of user.roles) {
        const role = this._roles.get(roleName);
        
        if (role && role.permissions.includes(permission)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this._logger.error(`Failed to check permission: ${permission}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to check permission: ${permission}`, 'SECURITY_PERMISSION_ERROR', error);
    }
  }
  
  /**
   * Creates a role.
   * @param {Object} role - The role object
   * @param {string} role.name - The role name
   * @param {Array<string>} [role.permissions=[]] - The role permissions
   * @returns {Object} The created role
   */
  createRole(role) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!role || !role.name) {
      throw new SecurityError('Invalid role object', 'SECURITY_ROLE_ERROR');
    }
    
    if (this._roles.has(role.name)) {
      throw new SecurityError('Role already exists', 'SECURITY_ROLE_EXISTS');
    }
    
    try {
      // Create role
      const newRole = {
        name: role.name,
        permissions: role.permissions || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store role
      this._roles.set(role.name, newRole);
      
      this._logger.info(`Role created: ${role.name}`);
      
      return newRole;
    } catch (error) {
      this._logger.error(`Failed to create role: ${role.name}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to create role: ${role.name}`, 'SECURITY_ROLE_ERROR', error);
    }
  }
  
  /**
   * Gets a role.
   * @param {string} name - The role name
   * @returns {Object} The role
   */
  getRole(name) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!name) {
      throw new SecurityError('Invalid role name', 'SECURITY_ROLE_ERROR');
    }
    
    try {
      // Get role
      const role = this._roles.get(name);
      
      if (!role) {
        throw new SecurityError('Role not found', 'SECURITY_ROLE_ERROR');
      }
      
      return role;
    } catch (error) {
      this._logger.error(`Failed to get role: ${name}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to get role: ${name}`, 'SECURITY_ROLE_ERROR', error);
    }
  }
  
  /**
   * Gets all roles.
   * @returns {Array<Object>} The roles
   */
  getRoles() {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    try {
      // Get all roles
      return Array.from(this._roles.values());
    } catch (error) {
      this._logger.error('Failed to get roles', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to get roles', 'SECURITY_ROLE_ERROR', error);
    }
  }
  
  /**
   * Creates a permission.
   * @param {Object} permission - The permission object
   * @param {string} permission.name - The permission name
   * @param {string} permission.description - The permission description
   * @returns {Object} The created permission
   */
  createPermission(permission) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!permission || !permission.name || !permission.description) {
      throw new SecurityError('Invalid permission object', 'SECURITY_PERMISSION_ERROR');
    }
    
    if (this._permissions.has(permission.name)) {
      throw new SecurityError('Permission already exists', 'SECURITY_PERMISSION_EXISTS');
    }
    
    try {
      // Create permission
      const newPermission = {
        name: permission.name,
        description: permission.description,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store permission
      this._permissions.set(permission.name, newPermission);
      
      this._logger.info(`Permission created: ${permission.name}`);
      
      return newPermission;
    } catch (error) {
      this._logger.error(`Failed to create permission: ${permission.name}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to create permission: ${permission.name}`, 'SECURITY_PERMISSION_ERROR', error);
    }
  }
  
  /**
   * Gets a permission.
   * @param {string} name - The permission name
   * @returns {Object} The permission
   */
  getPermission(name) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    if (!name) {
      throw new SecurityError('Invalid permission name', 'SECURITY_PERMISSION_ERROR');
    }
    
    try {
      // Get permission
      const permission = this._permissions.get(name);
      
      if (!permission) {
        throw new SecurityError('Permission not found', 'SECURITY_PERMISSION_ERROR');
      }
      
      return permission;
    } catch (error) {
      this._logger.error(`Failed to get permission: ${name}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError(`Failed to get permission: ${name}`, 'SECURITY_PERMISSION_ERROR', error);
    }
  }
  
  /**
   * Gets all permissions.
   * @returns {Array<Object>} The permissions
   */
  getPermissions() {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableAuthorization) {
      throw new SecurityError('Authorization is disabled', 'SECURITY_AUTH_DISABLED');
    }
    
    try {
      // Get all permissions
      return Array.from(this._permissions.values());
    } catch (error) {
      this._logger.error('Failed to get permissions', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to get permissions', 'SECURITY_PERMISSION_ERROR', error);
    }
  }
  
  /**
   * Encrypts data.
   * @param {string|Buffer} data - The data to encrypt
   * @returns {Object} The encryption result
   */
  encrypt(data) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableEncryption) {
      throw new SecurityError('Encryption is disabled', 'SECURITY_ENCRYPTION_DISABLED');
    }
    
    if (!data) {
      throw new SecurityError('Invalid data', 'SECURITY_ENCRYPTION_ERROR');
    }
    
    try {
      // Generate initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        this._options.encryptionAlgorithm,
        this._encryptionKey,
        iv
      );
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      this._logger.error('Failed to encrypt data', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to encrypt data', 'SECURITY_ENCRYPTION_ERROR', error);
    }
  }
  
  /**
   * Decrypts data.
   * @param {Object} data - The data to decrypt
   * @param {string} data.encrypted - The encrypted data
   * @param {string} data.iv - The initialization vector
   * @param {string} data.authTag - The authentication tag
   * @returns {string} The decrypted data
   */
  decrypt(data) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    if (!this._options.enableEncryption) {
      throw new SecurityError('Encryption is disabled', 'SECURITY_ENCRYPTION_DISABLED');
    }
    
    if (!data || !data.encrypted || !data.iv || !data.authTag) {
      throw new SecurityError('Invalid data', 'SECURITY_DECRYPTION_ERROR');
    }
    
    try {
      // Parse initialization vector and authentication tag
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this._options.encryptionAlgorithm,
        this._encryptionKey,
        iv
      );
      
      // Set authentication tag
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this._logger.error('Failed to decrypt data', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to decrypt data', 'SECURITY_DECRYPTION_ERROR', error);
    }
  }
  
  /**
   * Generates a secure random string.
   * @param {number} [length=32] - The string length
   * @returns {string} The random string
   */
  generateRandomString(length = 32) {
    if (!this._initialized) {
      throw new SecurityError('Security system not initialized', 'SECURITY_NOT_INITIALIZED');
    }
    
    try {
      return crypto.randomBytes(length).toString('hex').slice(0, length);
    } catch (error) {
      this._logger.error('Failed to generate random string', {
        error: error.message,
        stack: error.stack
      });
      
      throw new SecurityError('Failed to generate random string', 'SECURITY_RANDOM_ERROR', error);
    }
  }
  
  /**
   * Checks if the security system is healthy.
   * @returns {boolean} True if the security system is healthy
   */
  isHealthy() {
    return this._initialized;
  }
  
  /**
   * Sets up default roles and permissions.
   * @private
   */
  _setupDefaultRoles() {
    // Create permissions
    const permissions = [
      {
        name: 'system.read',
        description: 'Read system information'
      },
      {
        name: 'system.write',
        description: 'Write system information'
      },
      {
        name: 'user.read',
        description: 'Read user information'
      },
      {
        name: 'user.write',
        description: 'Write user information'
      },
      {
        name: 'tentacle.read',
        description: 'Read tentacle information'
      },
      {
        name: 'tentacle.write',
        description: 'Write tentacle information'
      },
      {
        name: 'tentacle.execute',
        description: 'Execute tentacle operations'
      },
      {
        name: 'admin.access',
        description: 'Access admin features'
      }
    ];
    
    for (const permission of permissions) {
      if (!this._permissions.has(permission.name)) {
        this.createPermission(permission);
      }
    }
    
    // Create roles
    const roles = [
      {
        name: 'admin',
        permissions: [
          'system.read',
          'system.write',
          'user.read',
          'user.write',
          'tentacle.read',
          'tentacle.write',
          'tentacle.execute',
          'admin.access'
        ]
      },
      {
        name: 'user',
        permissions: [
          'system.read',
          'user.read',
          'tentacle.read',
          'tentacle.execute'
        ]
      },
      {
        name: 'guest',
        permissions: [
          'system.read',
          'tentacle.read'
        ]
      }
    ];
    
    for (const role of roles) {
      if (!this._roles.has(role.name)) {
        this.createRole(role);
      }
    }
  }
  
  /**
   * Creates a session.
   * @param {Object} user - The user
   * @returns {Object} The session
   * @private
   */
  _createSession(user) {
    // Generate token
    const token = this.generateRandomString(64);
    
    // Calculate expiration
    const expiresAt = Date.now() + this._options.tokenExpiration * 1000;
    
    // Create session
    const session = {
      token,
      username: user.username,
      createdAt: Date.now(),
      expiresAt
    };
    
    // Store session
    this._sessions.set(token, session);
    
    return session;
  }
  
  /**
   * Hashes a password.
   * @param {string} password - The password
   * @param {string} salt - The salt
   * @returns {string} The password hash
   * @private
   */
  _hashPassword(password, salt) {
    return crypto.pbkdf2Sync(
      password,
      salt,
      10000,
      64,
      'sha512'
    ).toString('hex');
  }
  
  /**
   * Sanitizes a user object.
   * @param {Object} user - The user
   * @returns {Object} The sanitized user
   * @private
   */
  _sanitizeUser(user) {
    const { passwordHash, passwordSalt, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = SecuritySystem;
