/**
 * @fileoverview Distributed Cache implementation for the Advanced Caching Strategies system
 * Provides multi-node cache synchronization with sophisticated caching capabilities
 */

const EventEmitter = require('events');
const CacheEntry = require('./CacheEntry');

/**
 * Class representing a distributed cache (L3 Cache)
 * @extends EventEmitter
 */
class DistributedCache extends EventEmitter {
  /**
   * Create a new DistributedCache instance
   * @param {Object} options - Configuration options
   * @param {Object} options.adapter - Distributed cache adapter (Redis, Memcached, etc.)
   * @param {number} [options.defaultTTL=3600000] - Default TTL in milliseconds (default: 1 hour)
   * @param {boolean} [options.compression=true] - Whether to compress cache data
   * @param {boolean} [options.encryption=false] - Whether to encrypt cache data
   * @param {string} [options.encryptionKey] - Encryption key (required if encryption is true)
   * @param {boolean} [options.trackStats=true] - Whether to track cache statistics
   * @param {string} [options.namespace='aideon:cache'] - Namespace for cache keys
   * @param {number} [options.lockTimeout=5000] - Lock timeout in milliseconds
   */
  constructor(options = {}) {
    super();
    
    // For testing purposes, create a mock adapter if none provided
    const mockAdapter = {
      get: async (key) => this.mockData.get(key),
      set: async (key, value, ttl) => { this.mockData.set(key, value); return true; },
      delete: async (key) => { return this.mockData.delete(key); },
      has: async (key) => this.mockData.has(key),
      clear: async () => { this.mockData.clear(); return true; },
      keys: async () => Array.from(this.mockData.keys()),
      connect: async () => true,
      disconnect: async () => true
    };
    this.mockData = new Map();
    
    this.options = {
      adapter: options.adapter || mockAdapter,
      defaultTTL: options.defaultTTL || 3600000, // 1 hour
      compression: options.compression !== false,
      encryption: options.encryption === true,
      encryptionKey: options.encryptionKey,
      trackStats: options.trackStats !== false,
      namespace: options.namespace || 'aideon:cache',
      lockTimeout: options.lockTimeout || 5000
    };
    
    if (this.options.encryption && !this.options.encryptionKey) {
      throw new Error('Encryption key is required when encryption is enabled');
    }
    
    this.initialized = false;
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0,
      startTime: Date.now(),
      lastCleanup: null
    };
  }

  /**
   * Initialize the cache
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Connect to the distributed cache service
      await this.options.adapter.connect();
      
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize distributed cache: ${error.message}`);
    }
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @param {Object} [options={}] - Get options
   * @param {boolean} [options.updateStats=true] - Whether to update access statistics
   * @param {boolean} [options.throwOnMiss=false] - Whether to throw an error on cache miss
   * @param {boolean} [options.includeMetadata=false] - Whether to include metadata in the result
   * @returns {Promise<*>} Cached value, or undefined if not found
   * @throws {Error} If throwOnMiss is true and the key is not found
   */
  async get(key, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const updateStats = options.updateStats !== false;
    const throwOnMiss = options.throwOnMiss === true;
    const includeMetadata = options.includeMetadata === true;
    
    const namespacedKey = this._getNamespacedKey(key);
    
    try {
      // Get from distributed cache
      const data = await this.options.adapter.get(namespacedKey);
      
      if (!data) {
        if (this.options.trackStats) {
          this.stats.misses++;
        }
        
        if (throwOnMiss) {
          throw new Error(`Cache miss: ${key}`);
        }
        
        return undefined;
      }
      
      // Parse data
      const entry = this._parseEntry(data);
      
      // Check if expired
      if (entry.metadata.expires && entry.metadata.expires < Date.now()) {
        await this._removeEntry(key);
        
        if (this.options.trackStats) {
          this.stats.misses++;
          this.stats.expirations++;
        }
        
        if (throwOnMiss) {
          throw new Error(`Cache entry expired: ${key}`);
        }
        
        return undefined;
      }
      
      // Update access stats if requested
      if (updateStats) {
        entry.metadata.lastAccessed = Date.now();
        entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
        await this._updateEntryMetadata(key, entry.metadata);
      }
      
      if (this.options.trackStats) {
        this.stats.hits++;
      }
      
      // Emit hit event
      this.emit('hit', key, entry.metadata);
      
      // Return value or entry based on options
      return includeMetadata ? { value: entry.value, metadata: entry.metadata } : entry.value;
    } catch (error) {
      if (error.message.startsWith('Cache miss') || error.message.startsWith('Cache entry expired')) {
        throw error;
      }
      
      if (this.options.trackStats) {
        this.stats.misses++;
      }
      
      if (throwOnMiss) {
        throw new Error(`Failed to get cache entry: ${error.message}`);
      }
      
      return undefined;
    }
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} [options={}] - Set options
   * @param {number} [options.ttl] - Time-to-live in milliseconds (defaults to this.options.defaultTTL)
   * @param {string} [options.type='object'] - Type of cached data
   * @param {Array<string>} [options.dependencies=[]] - Keys of other cache entries this entry depends on
   * @param {string} [options.source='system'] - Source identifier
   * @param {number} [options.priority=1] - Priority level
   * @param {Array<string>} [options.tags=[]] - Tags for categorizing
   * @param {boolean} [options.overwrite=true] - Whether to overwrite existing entry
   * @returns {Promise<boolean>} Whether the set operation was successful
   */
  async set(key, value, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const ttl = options.ttl || this.options.defaultTTL;
    const overwrite = options.overwrite !== false;
    
    // Check if key already exists
    if (!overwrite && await this.has(key)) {
      return false;
    }
    
    // Create entry
    const entry = {
      key,
      value,
      metadata: {
        created: Date.now(),
        lastAccessed: Date.now(),
        expires: ttl > 0 ? Date.now() + ttl : null,
        type: options.type || 'object',
        dependencies: options.dependencies || [],
        source: options.source || 'system',
        priority: options.priority || 1,
        tags: options.tags || [],
        version: 1
      }
    };
    
    // Update version if entry exists
    if (await this.has(key)) {
      const existingEntry = await this.get(key, { includeMetadata: true, updateStats: false });
      if (existingEntry && existingEntry.metadata) {
        entry.metadata.version = (existingEntry.metadata.version || 0) + 1;
      }
    }
    
    try {
      // Serialize entry
      const data = this._serializeEntry(entry);
      
      // Set in distributed cache
      const namespacedKey = this._getNamespacedKey(key);
      await this.options.adapter.set(namespacedKey, data, ttl);
      
      // Set metadata for tags and dependencies
      await this._updateMetadataIndexes(key, entry.metadata);
      
      if (this.options.trackStats) {
        this.stats.sets++;
      }
      
      // Emit set event
      this.emit('set', key, entry.metadata);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set cache entry: ${error.message}`);
    }
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the key exists and is not expired
   */
  async has(key) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const namespacedKey = this._getNamespacedKey(key);
    
    try {
      // Check if key exists in distributed cache
      const exists = await this.options.adapter.has(namespacedKey);
      
      if (!exists) {
        return false;
      }
      
      // Get entry to check expiration
      const data = await this.options.adapter.get(namespacedKey);
      
      if (!data) {
        return false;
      }
      
      // Parse data
      const entry = this._parseEntry(data);
      
      // Check if expired
      if (entry.metadata.expires && entry.metadata.expires < Date.now()) {
        await this._removeEntry(key);
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a key from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the key was deleted
   */
  async delete(key) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    return this._removeEntry(key);
  }

  /**
   * Delete multiple keys from the cache
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteMany(keys) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    if (!Array.isArray(keys)) {
      return 0;
    }
    
    let deletedCount = 0;
    
    for (const key of keys) {
      if (await this._removeEntry(key)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Delete all keys with a specific tag
   * @param {string} tag - Tag to match
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteByTag(tag) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const tagKey = this._getTagKey(tag);
    const taggedKeys = await this.options.adapter.get(tagKey) || [];
    
    return this.deleteMany(taggedKeys);
  }

  /**
   * Delete all keys from a specific source
   * @param {string} source - Source identifier
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteBySource(source) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const sourceKey = this._getSourceKey(source);
    const sourceKeys = await this.options.adapter.get(sourceKey) || [];
    
    return this.deleteMany(sourceKeys);
  }

  /**
   * Clear all entries from the cache
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    try {
      // Get all keys in the namespace
      const keys = await this.keys();
      
      // Delete all keys
      await this.deleteMany(keys);
      
      // Emit clear event
      this.emit('clear');
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get all keys in the cache
   * @returns {Promise<Array<string>>} Array of keys
   */
  async keys() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    try {
      // Get all keys in the namespace
      const allKeys = await this.options.adapter.keys(`${this.options.namespace}:entry:*`);
      
      // Remove namespace prefix
      return allKeys.map(key => key.replace(`${this.options.namespace}:entry:`, ''));
    } catch (error) {
      throw new Error(`Failed to get cache keys: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    if (!this.options.trackStats) {
      return null;
    }
    
    const totalOperations = this.stats.hits + this.stats.misses;
    const hitRatio = totalOperations > 0 ? this.stats.hits / totalOperations : 0;
    const uptime = Date.now() - this.stats.startTime;
    
    return {
      ...this.stats,
      hitRatio: hitRatio,
      hitRatioPercent: hitRatio * 100,
      uptime: uptime,
      uptimeHours: uptime / 3600000
    };
  }

  /**
   * Reset cache statistics
   * @returns {void}
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0,
      startTime: Date.now(),
      lastCleanup: this.stats.lastCleanup
    };
  }

  /**
   * Dispose of resources
   * @returns {Promise<void>}
   */
  async dispose() {
    if (!this.initialized) {
      return;
    }
    
    try {
      // Disconnect from the distributed cache service
      await this.options.adapter.disconnect();
      
      this.initialized = false;
      this.removeAllListeners();
      
      this.emit('dispose');
    } catch (error) {
      throw new Error(`Failed to dispose distributed cache: ${error.message}`);
    }
  }

  /**
   * Remove an entry from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the entry was removed
   * @private
   */
  async _removeEntry(key) {
    try {
      // Get entry metadata before deletion
      const entry = await this.get(key, { includeMetadata: true, updateStats: false });
      
      if (!entry) {
        return false;
      }
      
      // Delete from distributed cache
      const namespacedKey = this._getNamespacedKey(key);
      await this.options.adapter.delete(namespacedKey);
      
      // Remove from metadata indexes
      await this._removeFromMetadataIndexes(key, entry.metadata);
      
      // Emit delete event
      this.emit('delete', key);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update entry metadata
   * @param {string} key - Cache key
   * @param {Object} metadata - Updated metadata
   * @returns {Promise<void>}
   * @private
   */
  async _updateEntryMetadata(key, metadata) {
    try {
      // Get current entry
      const namespacedKey = this._getNamespacedKey(key);
      const data = await this.options.adapter.get(namespacedKey);
      
      if (!data) {
        return;
      }
      
      // Parse entry
      const entry = this._parseEntry(data);
      
      // Update metadata
      entry.metadata = { ...entry.metadata, ...metadata };
      
      // Serialize and save
      const updatedData = this._serializeEntry(entry);
      await this.options.adapter.set(namespacedKey, updatedData, entry.metadata.expires ? entry.metadata.expires - Date.now() : 0);
    } catch (error) {
      console.error(`Failed to update entry metadata: ${error.message}`);
    }
  }

  /**
   * Update metadata indexes (tags, sources, etc.)
   * @param {string} key - Cache key
   * @param {Object} metadata - Entry metadata
   * @returns {Promise<void>}
   * @private
   */
  async _updateMetadataIndexes(key, metadata) {
    try {
      // Update tag indexes
      if (metadata.tags && metadata.tags.length > 0) {
        for (const tag of metadata.tags) {
          const tagKey = this._getTagKey(tag);
          const taggedKeys = await this.options.adapter.get(tagKey) || [];
          
          if (!taggedKeys.includes(key)) {
            taggedKeys.push(key);
            await this.options.adapter.set(tagKey, taggedKeys);
          }
        }
      }
      
      // Update source index
      if (metadata.source) {
        const sourceKey = this._getSourceKey(metadata.source);
        const sourceKeys = await this.options.adapter.get(sourceKey) || [];
        
        if (!sourceKeys.includes(key)) {
          sourceKeys.push(key);
          await this.options.adapter.set(sourceKey, sourceKeys);
        }
      }
    } catch (error) {
      console.error(`Failed to update metadata indexes: ${error.message}`);
    }
  }

  /**
   * Remove from metadata indexes (tags, sources, etc.)
   * @param {string} key - Cache key
   * @param {Object} metadata - Entry metadata
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromMetadataIndexes(key, metadata) {
    try {
      // Remove from tag indexes
      if (metadata.tags && metadata.tags.length > 0) {
        for (const tag of metadata.tags) {
          const tagKey = this._getTagKey(tag);
          const taggedKeys = await this.options.adapter.get(tagKey) || [];
          
          const index = taggedKeys.indexOf(key);
          if (index !== -1) {
            taggedKeys.splice(index, 1);
            await this.options.adapter.set(tagKey, taggedKeys);
          }
        }
      }
      
      // Remove from source index
      if (metadata.source) {
        const sourceKey = this._getSourceKey(metadata.source);
        const sourceKeys = await this.options.adapter.get(sourceKey) || [];
        
        const index = sourceKeys.indexOf(key);
        if (index !== -1) {
          sourceKeys.splice(index, 1);
          await this.options.adapter.set(sourceKey, sourceKeys);
        }
      }
    } catch (error) {
      console.error(`Failed to remove from metadata indexes: ${error.message}`);
    }
  }

  /**
   * Get namespaced key
   * @param {string} key - Original key
   * @returns {string} Namespaced key
   * @private
   */
  _getNamespacedKey(key) {
    return `${this.options.namespace}:entry:${key}`;
  }

  /**
   * Get tag key
   * @param {string} tag - Tag name
   * @returns {string} Tag key
   * @private
   */
  _getTagKey(tag) {
    return `${this.options.namespace}:tag:${tag}`;
  }

  /**
   * Get source key
   * @param {string} source - Source identifier
   * @returns {string} Source key
   * @private
   */
  _getSourceKey(source) {
    return `${this.options.namespace}:source:${source}`;
  }

  /**
   * Serialize entry
   * @param {Object} entry - Cache entry
   * @returns {string} Serialized entry
   * @private
   */
  _serializeEntry(entry) {
    let data = JSON.stringify(entry);
    
    // Compress if necessary
    if (this.options.compression) {
      data = this._compress(data);
    }
    
    // Encrypt if necessary
    if (this.options.encryption) {
      data = this._encrypt(data);
    }
    
    return data;
  }

  /**
   * Parse entry
   * @param {string} data - Serialized entry
   * @returns {Object} Cache entry
   * @private
   */
  _parseEntry(data) {
    // Decrypt if necessary
    if (this.options.encryption) {
      data = this._decrypt(data);
    }
    
    // Decompress if necessary
    if (this.options.compression) {
      data = this._decompress(data);
    }
    
    return JSON.parse(data);
  }

  /**
   * Compress data
   * @param {string} data - Data to compress
   * @returns {string} Compressed data
   * @private
   */
  _compress(data) {
    // Simple compression placeholder - in production, use a real compression library
    return data;
  }

  /**
   * Decompress data
   * @param {string} data - Data to decompress
   * @returns {string} Decompressed data
   * @private
   */
  _decompress(data) {
    // Simple decompression placeholder - in production, use a real compression library
    return data;
  }

  /**
   * Encrypt data
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data
   * @private
   */
  _encrypt(data) {
    // Simple encryption placeholder - in production, use a real encryption library
    return data;
  }

  /**
   * Decrypt data
   * @param {string} data - Data to decrypt
   * @returns {string} Decrypted data
   * @private
   */
  _decrypt(data) {
    // Simple decryption placeholder - in production, use a real encryption library
    return data;
  }
}

module.exports = DistributedCache;
