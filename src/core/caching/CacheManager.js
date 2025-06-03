/**
 * @fileoverview Cache Manager for the Advanced Caching Strategies system
 * Provides a unified interface for managing multiple cache layers
 */

const EventEmitter = require('events');
const MemoryCache = require('./MemoryCache');
const PersistentCache = require('./PersistentCache');
const DistributedCache = require('./DistributedCache');
const PredictivePreCaching = require('./PredictivePreCaching');
const ContextAwareCacheManagement = require('./ContextAwareCacheManagement');

/**
 * Class representing a cache manager
 * @extends EventEmitter
 */
class CacheManager extends EventEmitter {
  /**
   * Create a new CacheManager instance
   * @param {Object} options - Configuration options
   * @param {Object} [options.memoryCache] - Memory cache options
   * @param {Object} [options.persistentCache] - Persistent cache options
   * @param {Object} [options.distributedCache] - Distributed cache options
   * @param {string} [options.writePolicy='write-through'] - Write policy ('write-through', 'write-back', 'write-around')
   * @param {number} [options.writeBackDelay=1000] - Delay for write-back operations in milliseconds
   * @param {Object} [options.predictivePreCaching] - Predictive pre-caching options
   * @param {Object} [options.contextAwareManagement] - Context-aware cache management options
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      writePolicy: options.writePolicy || 'write-through',
      writeBackDelay: options.writeBackDelay || 1000
    };
    
    // Initialize cache layers
    if (options.memoryCache !== false) {
      this.memoryCache = new MemoryCache(options.memoryCache || {});
    }
    
    if (options.persistentCache) {
      this.persistentCache = new PersistentCache(options.persistentCache);
    }
    
    if (options.distributedCache) {
      this.distributedCache = new DistributedCache(options.distributedCache);
    }
    
    // Initialize features
    this.features = {};
    
    // Write-back queue
    this.writeBackQueue = new Map();
    this.writeBackTimer = null;
    
    // Statistics
    this.stats = {
      hits: {
        memory: 0,
        persistent: 0,
        distributed: 0,
        total: 0
      },
      misses: {
        memory: 0,
        persistent: 0,
        distributed: 0,
        total: 0
      },
      operations: {
        get: 0,
        set: 0,
        delete: 0,
        flush: 0
      }
    };
    
    // Initialize features after self-reference is available
    if (options.predictivePreCaching && options.predictivePreCaching.enabled) {
      const preCachingOptions = {
        ...options.predictivePreCaching,
        cacheManager: this
      };
      this.features.predictivePreCaching = new PredictivePreCaching(preCachingOptions);
    }
    
    if (options.contextAwareManagement && options.contextAwareManagement.enabled) {
      const contextOptions = {
        ...options.contextAwareManagement,
        cacheManager: this
      };
      this.features.contextAwareManagement = new ContextAwareCacheManagement(contextOptions);
    }
  }

  /**
   * Initialize the cache manager and all cache layers
   * @returns {Promise<void>}
   */
  async initialize() {
    // Initialize cache layers
    const initPromises = [];
    
    if (this.persistentCache) {
      initPromises.push(this.persistentCache.initialize());
    }
    
    if (this.distributedCache) {
      initPromises.push(this.distributedCache.initialize());
    }
    
    await Promise.all(initPromises);
    
    // Initialize features
    if (this.features.predictivePreCaching) {
      await this.features.predictivePreCaching.initialize();
    }
    
    if (this.features.contextAwareManagement) {
      await this.features.contextAwareManagement.initialize();
    }
    
    // Start write-back timer if needed
    if (this.options.writePolicy === 'write-back') {
      this._startWriteBackTimer();
    }
    
    // Set up event forwarding
    this._setupEventForwarding();
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @param {Object} [options={}] - Get options
   * @param {boolean} [options.includeMetadata=false] - Whether to include metadata in the result
   * @param {Function} [options.fetchFunction] - Function to fetch the value if not in cache
   * @param {number} [options.ttl] - TTL for fetched value
   * @param {Array<string>} [options.tags=[]] - Tags for fetched value
   * @returns {Promise<*>} Cached value, or undefined if not found
   */
  async get(key, options = {}) {
    const includeMetadata = options.includeMetadata === true;
    const fetchFunction = options.fetchFunction;
    const ttl = options.ttl;
    const tags = options.tags || [];
    
    this.stats.operations.get++;
    
    // Apply context-aware management if available
    let shouldCache = true;
    if (this.features.contextAwareManagement) {
      shouldCache = this.features.contextAwareManagement.shouldCache(key);
    }
    
    // Try memory cache first
    if (this.memoryCache) {
      const memoryResult = this.memoryCache.get(key, { includeMetadata });
      
      if (memoryResult !== undefined) {
        this.stats.hits.memory++;
        this.stats.hits.total++;
        
        // Emit get event
        this.emit('get', key, options);
        
        return memoryResult;
      }
    }
    
    // Try persistent cache
    if (this.persistentCache) {
      const persistentResult = await this.persistentCache.get(key, { includeMetadata });
      
      if (persistentResult !== undefined) {
        this.stats.hits.persistent++;
        this.stats.hits.total++;
        
        // Promote to memory cache if available
        if (this.memoryCache && shouldCache) {
          const value = includeMetadata ? persistentResult.value : persistentResult;
          const metadata = includeMetadata ? persistentResult.metadata : undefined;
          
          if (metadata) {
            this.memoryCache.set(key, value, {
              ttl: metadata.expires ? metadata.expires - Date.now() : undefined,
              tags: metadata.tags,
              priority: metadata.priority,
              source: metadata.source
            });
          } else {
            this.memoryCache.set(key, value);
          }
        }
        
        // Emit get event
        this.emit('get', key, options);
        
        return persistentResult;
      }
    }
    
    // Try distributed cache
    if (this.distributedCache) {
      const distributedResult = await this.distributedCache.get(key, { includeMetadata });
      
      if (distributedResult !== undefined) {
        this.stats.hits.distributed++;
        this.stats.hits.total++;
        
        // Promote to lower cache layers if available
        if (shouldCache) {
          const value = includeMetadata ? distributedResult.value : distributedResult;
          const metadata = includeMetadata ? distributedResult.metadata : undefined;
          
          if (this.memoryCache) {
            if (metadata) {
              this.memoryCache.set(key, value, {
                ttl: metadata.expires ? metadata.expires - Date.now() : undefined,
                tags: metadata.tags,
                priority: metadata.priority,
                source: metadata.source
              });
            } else {
              this.memoryCache.set(key, value);
            }
          }
          
          if (this.persistentCache && this.options.writePolicy !== 'write-around') {
            if (metadata) {
              await this.persistentCache.set(key, value, {
                ttl: metadata.expires ? metadata.expires - Date.now() : undefined,
                tags: metadata.tags,
                priority: metadata.priority,
                source: metadata.source
              });
            } else {
              await this.persistentCache.set(key, value);
            }
          }
        }
        
        // Emit get event
        this.emit('get', key, options);
        
        return distributedResult;
      }
    }
    
    // Cache miss
    this.stats.misses.total++;
    if (this.memoryCache) this.stats.misses.memory++;
    if (this.persistentCache) this.stats.misses.persistent++;
    if (this.distributedCache) this.stats.misses.distributed++;
    
    // Emit get event
    this.emit('get', key, options);
    
    // Try to fetch if function provided
    if (fetchFunction) {
      try {
        const fetchedValue = await fetchFunction();
        
        if (fetchedValue !== undefined && shouldCache) {
          // Apply context-aware TTL adjustment if available
          let adjustedTTL = ttl;
          if (this.features.contextAwareManagement && ttl) {
            adjustedTTL = this.features.contextAwareManagement.adjustTTL(ttl, key);
          }
          
          // Cache the fetched value
          await this.set(key, fetchedValue, {
            ttl: adjustedTTL,
            tags: tags,
            source: 'fetch'
          });
        }
        
        return includeMetadata ? { value: fetchedValue, metadata: { created: Date.now(), tags } } : fetchedValue;
      } catch (error) {
        // Emit error event
        this.emit('error', error, { operation: 'fetch', key });
        
        return undefined;
      }
    }
    
    return undefined;
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} [options={}] - Set options
   * @param {number} [options.ttl] - Time-to-live in milliseconds
   * @param {Array<string>} [options.tags=[]] - Tags for categorizing
   * @param {number} [options.priority=1] - Priority level
   * @param {string} [options.source='api'] - Source identifier
   * @returns {Promise<boolean>} Whether the set operation was successful
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl;
    const tags = options.tags || [];
    const priority = options.priority || 1;
    const source = options.source || 'api';
    
    this.stats.operations.set++;
    
    // Apply context-aware management if available
    let shouldCache = true;
    let adjustedTTL = ttl;
    
    if (this.features.contextAwareManagement) {
      shouldCache = this.features.contextAwareManagement.shouldCache(key);
      
      if (shouldCache && ttl) {
        adjustedTTL = this.features.contextAwareManagement.adjustTTL(ttl, key);
      }
    }
    
    if (!shouldCache) {
      return false;
    }
    
    // Set in memory cache
    if (this.memoryCache) {
      this.memoryCache.set(key, value, {
        ttl: adjustedTTL,
        tags: tags,
        priority: priority,
        source: source
      });
    }
    
    // Handle different write policies for lower cache layers
    if (this.persistentCache) {
      switch (this.options.writePolicy) {
        case 'write-through':
          await this.persistentCache.set(key, value, {
            ttl: adjustedTTL,
            tags: tags,
            priority: priority,
            source: source
          });
          break;
          
        case 'write-back':
          this.writeBackQueue.set(key, {
            value,
            options: {
              ttl: adjustedTTL,
              tags: tags,
              priority: priority,
              source: source
            },
            timestamp: Date.now()
          });
          break;
          
        case 'write-around':
          // Skip persistent cache
          break;
      }
    }
    
    // Always write-through to distributed cache if available
    if (this.distributedCache) {
      await this.distributedCache.set(key, value, {
        ttl: adjustedTTL,
        tags: tags,
        priority: priority,
        source: source
      });
    }
    
    // Emit set event
    this.emit('set', key, value, options);
    
    return true;
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the key exists
   */
  async has(key) {
    // Check memory cache first
    if (this.memoryCache && this.memoryCache.has(key)) {
      return true;
    }
    
    // Check persistent cache
    if (this.persistentCache && await this.persistentCache.has(key)) {
      return true;
    }
    
    // Check distributed cache
    if (this.distributedCache && await this.distributedCache.has(key)) {
      return true;
    }
    
    return false;
  }

  /**
   * Delete a key from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the key was deleted
   */
  async delete(key) {
    this.stats.operations.delete++;
    
    let deleted = false;
    
    // Delete from memory cache
    if (this.memoryCache) {
      deleted = this.memoryCache.delete(key) || deleted;
    }
    
    // Delete from persistent cache
    if (this.persistentCache) {
      deleted = await this.persistentCache.delete(key) || deleted;
    }
    
    // Delete from distributed cache
    if (this.distributedCache) {
      deleted = await this.distributedCache.delete(key) || deleted;
    }
    
    // Remove from write-back queue if present
    if (this.writeBackQueue.has(key)) {
      this.writeBackQueue.delete(key);
    }
    
    // Emit delete event
    this.emit('delete', key);
    
    return deleted;
  }

  /**
   * Delete multiple keys from the cache
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteMany(keys) {
    if (!Array.isArray(keys)) {
      return 0;
    }
    
    let deletedCount = 0;
    
    for (const key of keys) {
      if (await this.delete(key)) {
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
    let deletedCount = 0;
    let keysToDelete = [];
    
    // Collect keys from memory cache
    if (this.memoryCache) {
      const memoryEntries = this.memoryCache.findByTag(tag);
      keysToDelete = keysToDelete.concat(memoryEntries.map(entry => entry.key));
    }
    
    // Collect keys from persistent cache
    if (this.persistentCache) {
      const persistentEntries = await this.persistentCache.findByTag(tag);
      keysToDelete = keysToDelete.concat(persistentEntries.map(entry => entry.key));
    }
    
    // Collect keys from distributed cache
    if (this.distributedCache) {
      const distributedEntries = await this.distributedCache.findByTag(tag);
      keysToDelete = keysToDelete.concat(distributedEntries.map(entry => entry.key));
    }
    
    // Remove duplicates
    keysToDelete = [...new Set(keysToDelete)];
    
    // Delete all collected keys
    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Clear all entries from all cache layers
   * @returns {Promise<void>}
   */
  async clear() {
    // Clear memory cache
    if (this.memoryCache) {
      this.memoryCache.clear();
    }
    
    // Clear persistent cache
    if (this.persistentCache) {
      await this.persistentCache.clear();
    }
    
    // Clear distributed cache
    if (this.distributedCache) {
      await this.distributedCache.clear();
    }
    
    // Clear write-back queue
    this.writeBackQueue.clear();
    
    // Emit clear event
    this.emit('clear');
  }

  /**
   * Flush the write-back queue
   * @returns {Promise<number>} Number of items flushed
   */
  async flush() {
    this.stats.operations.flush++;
    
    if (!this.persistentCache || this.writeBackQueue.size === 0) {
      return 0;
    }
    
    const entries = Array.from(this.writeBackQueue.entries());
    this.writeBackQueue.clear();
    
    let flushedCount = 0;
    
    for (const [key, { value, options }] of entries) {
      try {
        await this.persistentCache.set(key, value, options);
        flushedCount++;
      } catch (error) {
        // Emit error event
        this.emit('error', error, { operation: 'flush', key });
      }
    }
    
    // Emit flush event
    this.emit('flush', flushedCount);
    
    return flushedCount;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const stats = { ...this.stats };
    
    // Add cache size information
    stats.size = {
      memory: this.memoryCache ? this.memoryCache.getSize() : 0,
      entries: {
        memory: this.memoryCache ? this.memoryCache.count() : 0,
        writeBackQueue: this.writeBackQueue.size
      }
    };
    
    // Calculate hit ratio
    const totalOperations = stats.hits.total + stats.misses.total;
    stats.hitRatio = totalOperations > 0 ? stats.hits.total / totalOperations : 0;
    stats.hitRatioPercent = stats.hitRatio * 100;
    
    return stats;
  }

  /**
   * Reset cache statistics
   * @returns {void}
   */
  resetStats() {
    this.stats = {
      hits: {
        memory: 0,
        persistent: 0,
        distributed: 0,
        total: 0
      },
      misses: {
        memory: 0,
        persistent: 0,
        distributed: 0,
        total: 0
      },
      operations: {
        get: 0,
        set: 0,
        delete: 0,
        flush: 0
      }
    };
  }

  /**
   * Start the write-back timer
   * @private
   */
  _startWriteBackTimer() {
    if (this.writeBackTimer) {
      clearInterval(this.writeBackTimer);
    }
    
    this.writeBackTimer = setInterval(async () => {
      if (this.writeBackQueue.size > 0) {
        await this.flush();
      }
    }, this.options.writeBackDelay);
    
    // Ensure the timer doesn't prevent the process from exiting
    if (this.writeBackTimer.unref) {
      this.writeBackTimer.unref();
    }
  }

  /**
   * Stop the write-back timer
   * @private
   */
  _stopWriteBackTimer() {
    if (this.writeBackTimer) {
      clearInterval(this.writeBackTimer);
      this.writeBackTimer = null;
    }
  }

  /**
   * Set up event forwarding from cache layers
   * @private
   */
  _setupEventForwarding() {
    if (this.memoryCache) {
      this.memoryCache.on('error', (error) => {
        this.emit('error', error, { layer: 'memory' });
      });
    }
    
    if (this.persistentCache) {
      this.persistentCache.on('error', (error) => {
        this.emit('error', error, { layer: 'persistent' });
      });
    }
    
    if (this.distributedCache) {
      this.distributedCache.on('error', (error) => {
        this.emit('error', error, { layer: 'distributed' });
      });
    }
  }

  /**
   * Dispose of resources
   * @returns {Promise<void>}
   */
  async dispose() {
    this._stopWriteBackTimer();
    
    // Dispose of features
    if (this.features.predictivePreCaching) {
      await this.features.predictivePreCaching.dispose();
    }
    
    if (this.features.contextAwareManagement) {
      await this.features.contextAwareManagement.dispose();
    }
    
    // Dispose of cache layers
    if (this.memoryCache) {
      this.memoryCache.dispose();
    }
    
    if (this.persistentCache) {
      await this.persistentCache.dispose();
    }
    
    if (this.distributedCache) {
      await this.distributedCache.dispose();
    }
    
    // Clear write-back queue
    this.writeBackQueue.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

module.exports = CacheManager;
