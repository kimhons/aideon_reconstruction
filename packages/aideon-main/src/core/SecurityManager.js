/**
 * Security Manager for the Quantum Computing Tentacle
 * 
 * Manages security aspects of the quantum computing tentacle, including
 * authentication, authorization, encryption, and quantum-resistant cryptography.
 * 
 * @module tentacles/quantum/core/SecurityManager
 */

class SecurityManager {
  /**
   * Creates a new instance of the Security Manager
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service instance
   * @param {Object} options.eventBus - Event bus instance
   * @param {Object} options.core - Reference to the Aideon core system
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.configService = options.configService;
    this.eventBus = options.eventBus;
    this.core = options.core;
    this.initialized = false;
    this.securityPolicies = new Map();
    this.encryptionKeys = new Map();
  }

  /**
   * Initializes the Security Manager
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.debug('Initializing Quantum Computing Security Manager');
    
    try {
      // Load security configuration
      await this.loadSecurityConfiguration();
      
      // Initialize security policies
      await this.initializeSecurityPolicies();
      
      // Initialize encryption keys
      await this.initializeEncryptionKeys();
      
      // Subscribe to relevant events
      if (this.eventBus) {
        this.eventBus.subscribe('quantum:security:policy:update', this.handlePolicyUpdate.bind(this));
      }
      
      this.initialized = true;
      this.logger.debug('Quantum Computing Security Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Security Manager', error);
      throw error;
    }
  }

  /**
   * Loads security configuration from the configuration service
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadSecurityConfiguration() {
    if (!this.configService) {
      this.logger.warn('No configuration service available, using default security settings');
      return;
    }
    
    // Load security configuration
    this.securityConfig = this.configService.get('security', {
      encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM',
        keyRotationDays: 30
      },
      authentication: {
        required: true,
        methods: ['token', 'oauth']
      },
      authorization: {
        enabled: true,
        defaultPolicy: 'deny'
      },
      quantumResistant: {
        enabled: true,
        algorithm: 'CRYSTALS-Kyber'
      }
    });
    
    this.logger.debug('Security configuration loaded');
  }

  /**
   * Initializes security policies
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeSecurityPolicies() {
    // Default policies
    const defaultPolicies = {
      'quantum:circuit:execute': {
        description: 'Execute quantum circuits',
        roles: ['user', 'admin'],
        conditions: {
          maxQubits: 50,
          maxGates: 1000,
          maxShots: 10000
        }
      },
      'quantum:algorithm:execute': {
        description: 'Execute quantum algorithms',
        roles: ['user', 'admin'],
        conditions: {
          maxQubits: 30,
          maxIterations: 100
        }
      },
      'quantum:cloud:access': {
        description: 'Access cloud quantum providers',
        roles: ['admin'],
        conditions: {
          maxBudget: 100,
          providers: ['ibm', 'aws', 'google', 'ionq']
        }
      },
      'quantum:cryptography:use': {
        description: 'Use quantum cryptography features',
        roles: ['user', 'admin'],
        conditions: {
          maxKeySize: 4096
        }
      }
    };
    
    // Load custom policies from configuration
    const customPolicies = this.configService ? 
      this.configService.get('security.policies', {}) : {};
    
    // Merge default and custom policies
    for (const [policyId, policy] of Object.entries({...defaultPolicies, ...customPolicies})) {
      this.securityPolicies.set(policyId, policy);
    }
    
    this.logger.debug(`Initialized ${this.securityPolicies.size} security policies`);
  }

  /**
   * Initializes encryption keys
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeEncryptionKeys() {
    // If Aideon core has a key management service, use it
    if (this.core && this.core.keyManager) {
      try {
        // Get quantum tentacle keys from core key manager
        const keys = await this.core.keyManager.getTentacleKeys('quantum-computing');
        
        for (const [keyId, key] of Object.entries(keys)) {
          this.encryptionKeys.set(keyId, key);
        }
        
        this.logger.debug(`Loaded ${this.encryptionKeys.size} encryption keys from core key manager`);
        return;
      } catch (error) {
        this.logger.warn('Failed to load keys from core key manager, generating local keys', error);
      }
    }
    
    // Generate local keys if needed
    if (this.encryptionKeys.size === 0) {
      await this.generateEncryptionKeys();
    }
  }

  /**
   * Generates encryption keys
   * 
   * @private
   * @returns {Promise<void>}
   */
  async generateEncryptionKeys() {
    // In a real implementation, this would use a cryptographically secure method
    // For this example, we'll simulate key generation
    
    const algorithms = ['AES-256-GCM', 'CRYSTALS-Kyber'];
    
    for (const algorithm of algorithms) {
      const keyId = `${algorithm.toLowerCase()}-${Date.now()}`;
      
      // Simulate key generation
      const key = {
        id: keyId,
        algorithm,
        created: Date.now(),
        expires: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
        material: Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256))).toString('base64')
      };
      
      this.encryptionKeys.set(keyId, key);
      
      this.logger.debug(`Generated ${algorithm} encryption key: ${keyId}`);
    }
  }

  /**
   * Handles security policy updates
   * 
   * @private
   * @param {Object} event - Policy update event
   */
  handlePolicyUpdate(event) {
    const { policyId, policy } = event.data;
    
    if (!policyId || !policy) {
      this.logger.warn('Invalid policy update event', event);
      return;
    }
    
    this.securityPolicies.set(policyId, policy);
    this.logger.info(`Updated security policy: ${policyId}`);
    
    // Persist policy if configuration service is available
    if (this.configService) {
      const policies = this.configService.get('security.policies', {});
      policies[policyId] = policy;
      this.configService.set('security.policies', policies);
    }
  }

  /**
   * Checks if a user is authorized to perform an action
   * 
   * @param {string} action - Action to check authorization for
   * @param {Object} context - Authorization context
   * @param {string} context.userId - User ID
   * @param {Array<string>} context.roles - User roles
   * @param {Object} context.attributes - Additional attributes
   * @returns {Promise<boolean>} - Authorization result
   */
  async isAuthorized(action, context) {
    if (!this.initialized) {
      throw new Error('Security Manager not initialized');
    }
    
    // If authorization is disabled, allow all actions
    if (!this.securityConfig.authorization.enabled) {
      return true;
    }
    
    // Get policy for action
    const policy = this.securityPolicies.get(action);
    
    // If no policy exists, use default policy
    if (!policy) {
      return this.securityConfig.authorization.defaultPolicy === 'allow';
    }
    
    // Check if user has required role
    const hasRequiredRole = context.roles.some(role => policy.roles.includes(role));
    
    if (!hasRequiredRole) {
      return false;
    }
    
    // Check conditions
    if (policy.conditions) {
      for (const [condition, value] of Object.entries(policy.conditions)) {
        if (condition in context.attributes) {
          // For array conditions, check if any value matches
          if (Array.isArray(value)) {
            if (!value.includes(context.attributes[condition])) {
              return false;
            }
          } 
          // For numeric conditions, check if attribute is within limit
          else if (typeof value === 'number') {
            if (context.attributes[condition] > value) {
              return false;
            }
          }
          // For other conditions, check exact match
          else if (context.attributes[condition] !== value) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Encrypts data using the specified algorithm
   * 
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} [algorithm='AES-256-GCM'] - Encryption algorithm
   * @returns {Promise<Object>} - Encrypted data object
   */
  async encrypt(data, algorithm = 'AES-256-GCM') {
    if (!this.initialized) {
      throw new Error('Security Manager not initialized');
    }
    
    // If encryption is disabled, return data as-is
    if (!this.securityConfig.encryption.enabled) {
      return {
        data: Buffer.isBuffer(data) ? data.toString('base64') : data,
        encrypted: false
      };
    }
    
    // Find key for algorithm
    const key = Array.from(this.encryptionKeys.values())
      .find(k => k.algorithm === algorithm && k.expires > Date.now());
    
    if (!key) {
      throw new Error(`No valid encryption key found for algorithm: ${algorithm}`);
    }
    
    // In a real implementation, this would use actual encryption
    // For this example, we'll simulate encryption
    
    // Convert data to buffer if it's a string
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    // Simulate encryption
    const encryptedData = Buffer.from(dataBuffer.toString('base64')).toString('base64');
    
    return {
      data: encryptedData,
      keyId: key.id,
      algorithm,
      encrypted: true,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypts data
   * 
   * @param {Object} encryptedData - Encrypted data object
   * @returns {Promise<Buffer>} - Decrypted data
   */
  async decrypt(encryptedData) {
    if (!this.initialized) {
      throw new Error('Security Manager not initialized');
    }
    
    // If data is not encrypted, return as-is
    if (!encryptedData.encrypted) {
      return Buffer.from(encryptedData.data, 'base64');
    }
    
    // Get key used for encryption
    const key = this.encryptionKeys.get(encryptedData.keyId);
    
    if (!key) {
      throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
    }
    
    // In a real implementation, this would use actual decryption
    // For this example, we'll simulate decryption
    
    // Simulate decryption
    const decryptedData = Buffer.from(encryptedData.data, 'base64').toString();
    
    return Buffer.from(decryptedData, 'base64');
  }

  /**
   * Generates a quantum-resistant key pair
   * 
   * @param {string} [algorithm='CRYSTALS-Kyber'] - Quantum-resistant algorithm
   * @returns {Promise<Object>} - Key pair
   */
  async generateQuantumResistantKeyPair(algorithm = 'CRYSTALS-Kyber') {
    if (!this.initialized) {
      throw new Error('Security Manager not initialized');
    }
    
    // Check if quantum-resistant cryptography is enabled
    if (!this.securityConfig.quantumResistant.enabled) {
      throw new Error('Quantum-resistant cryptography is disabled');
    }
    
    // In a real implementation, this would use actual quantum-resistant algorithms
    // For this example, we'll simulate key pair generation
    
    const keyId = `${algorithm.toLowerCase()}-${Date.now()}`;
    
    // Simulate key pair generation
    const keyPair = {
      id: keyId,
      algorithm,
      created: Date.now(),
      publicKey: Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256))).toString('base64'),
      privateKey: Buffer.from(Array(64).fill(0).map(() => Math.floor(Math.random() * 256))).toString('base64')
    };
    
    this.logger.debug(`Generated ${algorithm} key pair: ${keyId}`);
    
    return keyPair;
  }

  /**
   * Validates authentication credentials
   * 
   * @param {Object} credentials - Authentication credentials
   * @returns {Promise<Object>} - Authentication result
   */
  async validateCredentials(credentials) {
    if (!this.initialized) {
      throw new Error('Security Manager not initialized');
    }
    
    // If authentication is disabled, return success
    if (!this.securityConfig.authentication.required) {
      return {
        authenticated: true,
        userId: 'anonymous',
        roles: ['user']
      };
    }
    
    // If Aideon core has an authentication service, use it
    if (this.core && this.core.authManager) {
      try {
        return await this.core.authManager.validateCredentials(credentials);
      } catch (error) {
        this.logger.error('Failed to validate credentials with core auth manager', error);
        throw error;
      }
    }
    
    // For this example, we'll simulate authentication
    // In a real implementation, this would validate against a user database
    
    if (credentials.type === 'token' && credentials.token === 'valid-token') {
      return {
        authenticated: true,
        userId: 'user-123',
        roles: ['user']
      };
    } else if (credentials.type === 'oauth' && credentials.token === 'valid-oauth-token') {
      return {
        authenticated: true,
        userId: 'admin-456',
        roles: ['user', 'admin']
      };
    }
    
    return {
      authenticated: false,
      error: 'Invalid credentials'
    };
  }

  /**
   * Shuts down the Security Manager
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.logger.debug('Shutting down Security Manager');
    
    // Unsubscribe from events
    if (this.eventBus) {
      // No need to unsubscribe individually as EventBus.shutdown() will clear all subscribers
    }
    
    // Clear security policies and encryption keys
    this.securityPolicies.clear();
    this.encryptionKeys.clear();
    
    this.initialized = false;
  }
}

module.exports = { SecurityManager };
