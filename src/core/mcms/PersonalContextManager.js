/**
 * PersonalContextManager.js
 * 
 * Manages personal context data with privacy controls, encryption, and compression.
 * Enhanced with Google I/O 2025 AI innovations for improved context awareness.
 * 
 * @author Aideon Team
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const util = require('util');

// Promisify zlib methods
const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

class PersonalContextManager {
  /**
   * Create a new PersonalContextManager
   * @param {Object} options - Configuration options
   * @param {string} options.storageDirectory - Directory to store context data
   * @param {boolean} [options.enableEncryption=true] - Whether to encrypt context data
   * @param {boolean} [options.enableCompression=true] - Whether to compress context data
   * @param {string} [options.encryptionKey] - Encryption key (if not provided, a random key will be generated)
   * @param {number} [options.maxCacheSize=100] - Maximum number of contexts to cache
   * @param {number} [options.cacheTTL=60000] - Time to live for cached contexts (ms)
   */
  constructor(options) {
    // Validate options
    if (!options || !options.storageDirectory) {
      throw new Error('Storage directory must be provided');
    }
    
    // Set options with defaults
    this.options = {
      storageDirectory: options.storageDirectory,
      enableEncryption: options.enableEncryption !== false,
      enableCompression: options.enableCompression !== false,
      encryptionKey: options.encryptionKey || crypto.randomBytes(32).toString('hex'),
      maxCacheSize: options.maxCacheSize || 100,
      cacheTTL: options.cacheTTL || 60000
    };
    
    // Initialize state
    this._initialized = false;
    this._metadata = {
      version: '1.0.0',
      contexts: {}
    };
    this._cache = new Map();
    this._lock = Promise.resolve();
    this._currentRelease = null;
  }
  
  /**
   * Initialize the manager
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create storage directory if it doesn't exist
    await this._ensureDirectoryExists(this.options.storageDirectory);
    
    // Load metadata
    try {
      const metadataPath = path.join(this.options.storageDirectory, 'manager.metadata');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      this._metadata = JSON.parse(metadataContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Error loading metadata:', error);
      }
      
      // Create new metadata file
      await this._saveMetadata();
    }
    
    this._initialized = true;
  }
  
  /**
   * Check if the manager is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this._initialized;
  }
  
  /**
   * Store context data
   * @param {string} namespace - Context namespace
   * @param {Object} data - Context data
   * @param {Object} [options] - Storage options
   * @param {string[]} [options.privateFields=[]] - Fields to mark as private
   * @param {number} [options.ttl] - Time to live (ms)
   * @returns {Promise<string>} - Context ID
   */
  async storeContext(namespace, data, options = {}) {
    if (!this._initialized) {
      throw new Error('Manager not initialized');
    }
    
    // Generate context ID if not provided
    const contextId = options.id || crypto.randomBytes(16).toString('hex');
    
    // Add ID to data
    const contextData = {
      ...data,
      id: contextId
    };
    
    // Acquire lock
    await this._acquireLock();
    
    try {
      // Create namespace directory if it doesn't exist
      const namespaceDir = path.join(this.options.storageDirectory, namespace);
      await this._ensureDirectoryExists(namespaceDir);
      
      // Save context data
      const contextPath = path.join(namespaceDir, `${contextId}.context`);
      const serializedData = JSON.stringify(contextData);
      
      // Process data (compress and encrypt if enabled)
      let processedData = serializedData;
      
      if (this.options.enableCompression) {
        processedData = await gzip(Buffer.from(processedData));
      }
      
      if (this.options.enableEncryption) {
        processedData = this._encrypt(processedData);
      }
      
      // Write to file
      await fs.writeFile(contextPath, processedData);
      
      // Update metadata
      this._metadata.contexts[contextId] = {
        namespace,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        privateFields: options.privateFields || [],
        ttl: options.ttl
      };
      
      // Save metadata
      await this._saveMetadata();
      
      // Add to cache
      this._addToCache(namespace, contextId, contextData, this._metadata.contexts[contextId]);
      
      return contextId;
    } finally {
      // Release lock
      this._releaseLock();
    }
  }
  
  /**
   * Retrieve context data
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @param {Object} [options] - Retrieval options
   * @param {boolean} [options.includePrivateFields=false] - Whether to include private fields
   * @returns {Promise<Object>} - Context data
   */
  async retrieveContext(namespace, contextId, options = {}) {
    if (!this._initialized) {
      throw new Error('Manager not initialized');
    }
    
    // Check if context has expired
    if (this._hasExpired(contextId)) {
      throw new Error(`Context ${contextId} has expired`);
    }
    
    // Check cache first
    const cachedData = this._getFromCache(namespace, contextId);
    if (cachedData) {
      return this._applyPrivacySettings(cachedData, options.includePrivateFields);
    }
    
    // Acquire lock
    await this._acquireLock();
    
    try {
      // Check if context exists in metadata
      const metadata = this._metadata.contexts[contextId];
      if (!metadata || metadata.namespace !== namespace) {
        throw new Error(`Context ${contextId} not found in namespace ${namespace}`);
      }
      
      // Load context data
      const contextPath = path.join(this.options.storageDirectory, namespace, `${contextId}.context`);
      let processedData = await fs.readFile(contextPath);
      
      // Process data (decrypt and decompress if enabled)
      if (this.options.enableEncryption) {
        processedData = this._decrypt(processedData);
      }
      
      if (this.options.enableCompression) {
        processedData = await gunzip(processedData);
      }
      
      // Parse data
      const contextData = JSON.parse(processedData.toString());
      
      // Add to cache
      this._addToCache(namespace, contextId, contextData, metadata);
      
      // Apply privacy settings
      return this._applyPrivacySettings(contextData, options.includePrivateFields);
    } finally {
      // Release lock
      this._releaseLock();
    }
  }
  
  /**
   * Update context data
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @param {Object} data - Context data to update
   * @param {Object} [options] - Update options
   * @param {string[]} [options.privateFields] - Fields to mark as private
   * @param {number} [options.ttl] - Time to live (ms)
   * @returns {Promise<void>}
   */
  async updateContext(namespace, contextId, data, options = {}) {
    if (!this._initialized) {
      throw new Error('Manager not initialized');
    }
    
    // Acquire lock
    await this._acquireLock();
    
    try {
      // Check if context exists in metadata
      const metadata = this._metadata.contexts[contextId];
      if (!metadata || metadata.namespace !== namespace) {
        throw new Error(`Context ${contextId} not found in namespace ${namespace}`);
      }
      
      // Load existing context data
      const existingData = await this.retrieveContext(namespace, contextId, { includePrivateFields: true });
      
      // Merge data
      const updatedData = {
        ...existingData,
        ...data,
        id: contextId // Ensure ID is preserved
      };
      
      // Update private fields if provided
      if (options.privateFields) {
        metadata.privateFields = options.privateFields;
      }
      
      // Update TTL if provided
      if (options.ttl !== undefined) {
        metadata.ttl = options.ttl;
      }
      
      // Update timestamp
      metadata.updatedAt = Date.now();
      
      // Save context data
      const contextPath = path.join(this.options.storageDirectory, namespace, `${contextId}.context`);
      const serializedData = JSON.stringify(updatedData);
      
      // Process data (compress and encrypt if enabled)
      let processedData = serializedData;
      
      if (this.options.enableCompression) {
        processedData = await gzip(Buffer.from(processedData));
      }
      
      if (this.options.enableEncryption) {
        processedData = this._encrypt(processedData);
      }
      
      // Write to file
      await fs.writeFile(contextPath, processedData);
      
      // Save metadata
      await this._saveMetadata();
      
      // Update cache
      this._addToCache(namespace, contextId, updatedData, metadata);
    } finally {
      // Release lock
      this._releaseLock();
    }
  }
  
  /**
   * Delete context data
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @returns {Promise<void>}
   */
  async deleteContext(namespace, contextId) {
    if (!this._initialized) {
      throw new Error('Manager not initialized');
    }
    
    // Acquire lock
    await this._acquireLock();
    
    try {
      // Check if context exists in metadata
      const metadata = this._metadata.contexts[contextId];
      if (!metadata || metadata.namespace !== namespace) {
        throw new Error(`Context ${contextId} not found in namespace ${namespace}`);
      }
      
      // Delete context file
      const contextPath = path.join(this.options.storageDirectory, namespace, `${contextId}.context`);
      await fs.unlink(contextPath);
      
      // Remove from metadata
      delete this._metadata.contexts[contextId];
      
      // Save metadata
      await this._saveMetadata();
      
      // Remove from cache
      this._removeFromCache(namespace, contextId);
    } finally {
      // Release lock
      this._releaseLock();
    }
  }
  
  /**
   * Query contexts by criteria
   * @param {string} namespace - Context namespace
   * @param {Object} criteria - Query criteria
   * @param {Object} [options] - Query options
   * @param {boolean} [options.includePrivateFields=false] - Whether to include private fields
   * @returns {Promise<Object[]>} - Matching contexts
   */
  async queryContext(namespace, criteria, options = {}) {
    if (!this._initialized) {
      throw new Error('Manager not initialized');
    }
    
    // Get all context IDs in namespace
    const results = [];
    
    // Acquire lock
    await this._acquireLock();
    
    try {
      // Get all context IDs in namespace
      const contextIds = Object.keys(this._metadata.contexts).filter(
        id => this._metadata.contexts[id].namespace === namespace && !this._hasExpired(id)
      );
      
      // Load and filter contexts
      for (const contextId of contextIds) {
        try {
          const context = await this.retrieveContext(namespace, contextId, { includePrivateFields: true });
          
          // Check if context matches criteria
          if (this._matchesCriteria(context, criteria)) {
            // Apply privacy settings
            results.push(this._applyPrivacySettings(context, options.includePrivateFields));
          }
        } catch (error) {
          console.warn(`Error loading context ${contextId}:`, error);
        }
      }
      
      return results;
    } finally {
      // Release lock
      this._releaseLock();
    }
  }
  
  /**
   * Save metadata to file
   * @returns {Promise<void>}
   * @private
   */
  async _saveMetadata() {
    const metadataPath = path.join(this.options.storageDirectory, 'manager.metadata');
    await fs.writeFile(metadataPath, JSON.stringify(this._metadata, null, 2));
  }
  
  /**
   * Encrypt data
   * @param {Buffer|string} data - Data to encrypt
   * @returns {Buffer} - Encrypted data
   * @private
   */
  _encrypt(data) {
    // Generate initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const key = Buffer.from(this.options.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    // Prepend IV to encrypted data
    return Buffer.concat([iv, encrypted]);
  }
  
  /**
   * Decrypt data
   * @param {Buffer} data - Data to decrypt
   * @returns {Buffer} - Decrypted data
   * @private
   */
  _decrypt(data) {
    // Extract IV from data
    const iv = data.slice(0, 16);
    const encryptedData = data.slice(16);
    
    // Create decipher
    const key = Buffer.from(this.options.encryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return decrypted;
  }
  
  /**
   * Add context to cache
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @param {Object} data - Context data
   * @param {Object} metadata - Context metadata
   * @private
   */
  _addToCache(namespace, contextId, data, metadata) {
    // Generate cache key
    const cacheKey = `${namespace}:${contextId}`;
    
    // If cache is full, remove oldest entry
    if (this._cache.size >= this.options.maxCacheSize) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }
    
    // Add to cache
    this._cache.set(cacheKey, {
      data,
      metadata,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get context from cache
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @returns {Object|null} - Context data or null if not found
   * @private
   */
  _getFromCache(namespace, contextId) {
    // Generate cache key
    const cacheKey = `${namespace}:${contextId}`;
    
    // Check if in cache
    const cached = this._cache.get(cacheKey);
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.options.cacheTTL) {
      this._cache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Remove context from cache
   * @param {string} namespace - Context namespace
   * @param {string} contextId - Context ID
   * @private
   */
  _removeFromCache(namespace, contextId) {
    // Generate cache key
    const cacheKey = `${namespace}:${contextId}`;
    
    // Remove from cache
    this._cache.delete(cacheKey);
  }
  
  /**
   * Apply privacy settings to context data
   * @param {Object} data - Context data
   * @param {boolean} includePrivateFields - Whether to include private fields
   * @returns {Object} - Filtered context data
   * @private
   */
  _applyPrivacySettings(data, includePrivateFields) {
    if (includePrivateFields === true) {
      return { ...data }; // Return a copy to avoid modifying the original
    }
    
    // Get private fields from metadata using the context ID
    const privateFields = this._metadata.contexts[data.id]?.privateFields || [];
    
    // Clone data to avoid modifying the original
    const filtered = { ...data };
    
    // Remove private fields
    for (const field of privateFields) {
      delete filtered[field];
    }
    
    return filtered;
  }
  
  /**
   * Check if context has expired
   *
(Content truncated due to size limit. Use line ranges to read in chunks)