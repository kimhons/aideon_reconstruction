/**
 * @fileoverview Persistent Cache implementation for the Advanced Caching Strategies system
 * Provides file-based persistent storage with sophisticated caching capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const CacheEntry = require('./CacheEntry');

/**
 * Class representing a persistent cache (L2 Cache)
 * @extends EventEmitter
 */
class PersistentCache extends EventEmitter {
  /**
   * Create a new PersistentCache instance
   * @param {Object} options - Configuration options
   * @param {string} options.directory - Directory to store cache files
   * @param {number} [options.defaultTTL=3600000] - Default TTL in milliseconds (default: 1 hour)
   * @param {boolean} [options.compression=true] - Whether to compress cache data
   * @param {boolean} [options.encryption=false] - Whether to encrypt cache data
   * @param {string} [options.encryptionKey] - Encryption key (required if encryption is true)
   * @param {boolean} [options.autoCleanup=true] - Whether to automatically clean up expired entries
   * @param {number} [options.cleanupInterval=300000] - Cleanup interval in milliseconds (default: 5 minutes)
   * @param {boolean} [options.trackStats=true] - Whether to track cache statistics
   */
  constructor(options = {}) {
    super();
    
    if (!options.directory) {
      throw new Error('Directory is required for persistent cache');
    }
    
    this.options = {
      directory: options.directory,
      defaultTTL: options.defaultTTL || 3600000, // 1 hour
      compression: options.compression !== false,
      encryption: options.encryption === true,
      encryptionKey: options.encryptionKey,
      autoCleanup: options.autoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      trackStats: options.trackStats !== false
    };
    
    if (this.options.encryption && !this.options.encryptionKey) {
      throw new Error('Encryption key is required when encryption is enabled');
    }
    
    this.initialized = false;
    this.cleanupTimer = null;
    this.indexPath = path.join(this.options.directory, 'cache_index.json');
    this.index = new Map();
    
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
      // Create cache directory if it doesn't exist
      await fs.mkdir(this.options.directory, { recursive: true });
      
      // Load cache index if it exists
      try {
        const indexData = await fs.readFile(this.indexPath, 'utf8');
        const indexEntries = JSON.parse(indexData);
        
        for (const [key, metadata] of Object.entries(indexEntries)) {
          this.index.set(key, metadata);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to load cache index: ${error.message}`);
        }
        // If index doesn't exist or is corrupted, create a new one
        await this._saveIndex();
      }
      
      // Start cleanup timer if enabled
      if (this.options.autoCleanup) {
        this._startCleanupTimer();
      }
      
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize persistent cache: ${error.message}`);
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
    
    const metadata = this.index.get(key);
    
    if (!metadata) {
      if (this.options.trackStats) {
        this.stats.misses++;
      }
      
      if (throwOnMiss) {
        throw new Error(`Cache miss: ${key}`);
      }
      
      return undefined;
    }
    
    // Check if expired
    if (metadata.expires && metadata.expires < Date.now()) {
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
    
    try {
      // Read cache file
      const filePath = this._getFilePath(key);
      let data = await fs.readFile(filePath, 'utf8');
      
      // Decrypt if necessary
      if (this.options.encryption) {
        data = this._decrypt(data);
      }
      
      // Decompress if necessary
      if (this.options.compression) {
        data = this._decompress(data);
      }
      
      // Parse data
      const entry = JSON.parse(data);
      
      // Update access stats if requested
      if (updateStats) {
        metadata.lastAccessed = Date.now();
        metadata.accessCount = (metadata.accessCount || 0) + 1;
        await this._saveIndex();
      }
      
      if (this.options.trackStats) {
        this.stats.hits++;
      }
      
      // Emit hit event
      this.emit('hit', key, metadata);
      
      // Return value or entry based on options
      return includeMetadata ? { value: entry.value, metadata } : entry.value;
    } catch (error) {
      // If file doesn't exist, remove from index
      if (error.code === 'ENOENT') {
        this.index.delete(key);
        await this._saveIndex();
      }
      
      if (this.options.trackStats) {
        this.stats.misses++;
      }
      
      if (throwOnMiss) {
        throw new Error(`Failed to read cache entry: ${error.message}`);
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
    if (this.index.has(key) && !overwrite) {
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
    if (this.index.has(key)) {
      const existingMetadata = this.index.get(key);
      entry.metadata.version = (existingMetadata.version || 0) + 1;
    }
    
    try {
      // Prepare data for storage
      let data = JSON.stringify(entry);
      
      // Compress if necessary
      if (this.options.compression) {
        data = this._compress(data);
      }
      
      // Encrypt if necessary
      if (this.options.encryption) {
        data = this._encrypt(data);
      }
      
      // Write to file
      const filePath = this._getFilePath(key);
      await fs.writeFile(filePath, data, 'utf8');
      
      // Update index
      this.index.set(key, entry.metadata);
      await this._saveIndex();
      
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
    
    const metadata = this.index.get(key);
    
    if (!metadata) {
      return false;
    }
    
    // Check if expired
    if (metadata.expires && metadata.expires < Date.now()) {
      await this._removeEntry(key);
      return false;
    }
    
    // Check if file exists
    try {
      const filePath = this._getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.index.delete(key);
        await this._saveIndex();
      }
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
    
    const keysToDelete = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (metadata.tags && metadata.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }
    
    return this.deleteMany(keysToDelete);
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
    
    const keysToDelete = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (metadata.source === source) {
        keysToDelete.push(key);
      }
    }
    
    return this.deleteMany(keysToDelete);
  }

  /**
   * Delete all keys matching a filter function
   * @param {Function} filterFn - Filter function that takes a metadata object and returns boolean
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteByFilter(filterFn) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    if (typeof filterFn !== 'function') {
      return 0;
    }
    
    const keysToDelete = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (filterFn(metadata)) {
        keysToDelete.push(key);
      }
    }
    
    return this.deleteMany(keysToDelete);
  }

  /**
   * Clear all entries from the cache
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const keys = Array.from(this.index.keys());
    await this.deleteMany(keys);
    
    // Emit clear event
    this.emit('clear');
  }

  /**
   * Get the number of entries in the cache
   * @returns {number} Number of entries
   */
  count() {
    return this.index.size;
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
      entries: this.index.size,
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
   * Get all keys in the cache
   * @returns {Array<string>} Array of keys
   */
  keys() {
    return Array.from(this.index.keys());
  }

  /**
   * Get all entries in the cache
   * @param {boolean} [includeExpired=false] - Whether to include expired entries
   * @returns {Promise<Array<Object>>} Array of entries with key, value, and metadata
   */
  async entries(includeExpired = false) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const result = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (includeExpired || !metadata.expires || metadata.expires >= Date.now()) {
        try {
          const value = await this.get(key);
          if (value !== undefined) {
            result.push({
              key: key,
              value: value,
              metadata: { ...metadata }
            });
          }
        } catch (error) {
          // Skip entries that can't be read
        }
      }
    }
    
    return result;
  }

  /**
   * Find entries by tag
   * @param {string} tag - Tag to match
   * @returns {Promise<Array<Object>>} Array of matching entries
   */
  async findByTag(tag) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const result = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (metadata.tags && metadata.tags.includes(tag) && 
          (!metadata.expires || metadata.expires >= Date.now())) {
        try {
          const value = await this.get(key);
          if (value !== undefined) {
            result.push({
              key: key,
              value: value,
              metadata: { ...metadata }
            });
          }
        } catch (error) {
          // Skip entries that can't be read
        }
      }
    }
    
    return result;
  }

  /**
   * Find entries by source
   * @param {string} source - Source identifier
   * @returns {Promise<Array<Object>>} Array of matching entries
   */
  async findBySource(source) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const result = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (metadata.source === source && 
          (!metadata.expires || metadata.expires >= Date.now())) {
        try {
          const value = await this.get(key);
          if (value !== undefined) {
            result.push({
              key: key,
              value: value,
              metadata: { ...metadata }
            });
          }
        } catch (error) {
          // Skip entries that can't be read
        }
      }
    }
    
    return result;
  }

  /**
   * Find entries by custom filter
   * @param {Function} filterFn - Filter function that takes a metadata object and returns boolean
   * @returns {Promise<Array<Object>>} Array of matching entries
   */
  async findByFilter(filterFn) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    if (typeof filterFn !== 'function') {
      return [];
    }
    
    const result = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (filterFn(metadata) && (!metadata.expires || metadata.expires >= Date.now())) {
        try {
          const value = await this.get(key);
          if (value !== undefined) {
            result.push({
              key: key,
              value: value,
              metadata: { ...metadata }
            });
          }
        } catch (error) {
          // Skip entries that can't be read
        }
      }
    }
    
    return result;
  }

  /**
   * Clean up expired entries
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanup() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, metadata] of this.index.entries()) {
      if (metadata.expires && metadata.expires < now) {
        keysToDelete.push(key);
      }
    }
    
    const removedCount = await this.deleteMany(keysToDelete);
    
    if (this.options.trackStats) {
      this.stats.lastCleanup = now;
      this.stats.expirations += removedCount;
    }
    
    // Emit cleanup event
    this.emit('cleanup', removedCount);
    
    return removedCount;
  }

  /**
   * Flush all pending writes to disk
   * @returns {Promise<void>}
   */
  async flush() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }
    
    await this._saveIndex();
    this.emit('flush');
  }

  /**
   * Dispose of resources
   * @returns {Promise<void>}
   */
  async dispose() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    await this._saveIndex();
    this.removeAllListeners();
    this.initialized = false;
    
    this.emit('dispose');
  }

  /**
   * Start the automatic cleanup timer
   * @private
   */
  _startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error(`Cache cleanup error: ${error.message}`);
      }
    }, this.options.cleanupInterval);
    
    // Ensure the timer doesn't prevent the process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove an entry from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the entry was removed
   * @private
   */
  async _removeEntry(key) {
    if (!this.index.has(key)) {
      return false;
    }
    
    try {
      // Delete cache file
      const filePath = this._getFilePath(key);
      await fs.unlink(filePath).catch(() => {});
      
      // Remove from index
      this.index.delete(key);
      await this._saveIndex();
      
      // Emit delete event
      this.emit('delete', key);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save the cache index to disk
   * @returns {Promise<void>}
   * @private
   */
  async _saveIndex() {
    try {
      const indexData = {};
      
      for (const [key, metadata] of this.index.entries()) {
        indexData[key] = metadata;
      }
      
      await fs.writeFile(this.indexPath, JSON.stringify(indexData), 'utf8');
    } catch (error) {
      console.error(`Failed to save cache index: ${error.message}`);
    }
  }

  /**
   * Get the file path for a cache key
   * @param {string} key - Cache key
   * @returns {string} File path
   * @private
   */
  _getFilePath(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.options.directory, `${hash}.cache`);
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
    if (!this.options.encryption) {
      return data;
    }
    
    const cipher = crypto.createCipher('aes-256-cbc', this.options.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt data
   * @param {string} data - Data to decrypt
   * @returns {string} Decrypted data
   * @private
   */
  _decrypt(data) {
    if (!this.options.encryption) {
      return data;
    }
    
    const decipher = crypto.createDecipher('aes-256-cbc', this.options.encryptionKey);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = PersistentCache;
