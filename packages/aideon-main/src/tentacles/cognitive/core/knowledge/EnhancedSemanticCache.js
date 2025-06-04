/**
 * @fileoverview EnhancedSemanticCache for the Knowledge Graph Manager.
 * Provides advanced semantic caching capabilities with vector similarity,
 * context awareness, and offline support.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Cache entry expiration strategies.
 * @enum {string}
 */
const ExpirationStrategy = {
  /**
   * Time-based expiration.
   */
  TIME: 'time',
  
  /**
   * Least recently used.
   */
  LRU: 'lru',
  
  /**
   * Least frequently used.
   */
  LFU: 'lfu',
  
  /**
   * Size-based expiration.
   */
  SIZE: 'size',
  
  /**
   * Priority-based expiration.
   */
  PRIORITY: 'priority'
};

/**
 * Cache consistency levels.
 * @enum {string}
 */
const ConsistencyLevel = {
  /**
   * Strong consistency (always up-to-date).
   */
  STRONG: 'strong',
  
  /**
   * Eventual consistency (may be stale).
   */
  EVENTUAL: 'eventual',
  
  /**
   * Session consistency (consistent within a session).
   */
  SESSION: 'session',
  
  /**
   * Weak consistency (may be significantly stale).
   */
  WEAK: 'weak'
};

/**
 * Provides enhanced semantic caching capabilities for the knowledge graph.
 */
class EnhancedSemanticCache extends EventEmitter {
  /**
   * Creates a new EnhancedSemanticCache instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} [options.vectorService] - Vector service for embeddings
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.vectorService = options.vectorService;
    
    this.initialized = false;
    this.cache = new Map();
    this.contextIndex = new Map();
    this.vectorIndex = null;
    this.stats = {
      hits: 0,
      misses: 0,
      stores: 0,
      invalidations: 0,
      size: 0
    };
  }
  
  /**
   * Initializes the enhanced semantic cache.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing EnhancedSemanticCache');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.semanticCache', {
          maxSize: 1000,
          defaultTtl: 3600000, // 1 hour
          expirationStrategy: ExpirationStrategy.LRU,
          defaultConsistencyLevel: ConsistencyLevel.EVENTUAL,
          enableVectorSimilarity: true,
          enableContextAwareness: true,
          enableOfflineSupport: true,
          similarityThreshold: 0.8,
          persistToDisk: true,
          persistPath: './cache',
          compressionLevel: 'medium'
        });
        
        this.config = config;
      } else {
        this.config = {
          maxSize: 1000,
          defaultTtl: 3600000, // 1 hour
          expirationStrategy: ExpirationStrategy.LRU,
          defaultConsistencyLevel: ConsistencyLevel.EVENTUAL,
          enableVectorSimilarity: true,
          enableContextAwareness: true,
          enableOfflineSupport: true,
          similarityThreshold: 0.8,
          persistToDisk: true,
          persistPath: './cache',
          compressionLevel: 'medium'
        };
      }
      
      // Initialize vector index if vector similarity is enabled
      if (this.config.enableVectorSimilarity && this.vectorService) {
        this.vectorIndex = new Map();
      }
      
      // Load persisted cache if offline support is enabled
      if (this.config.enableOfflineSupport && this.config.persistToDisk) {
        await this.loadPersistedCache();
      }
      
      // Set up expiration timer
      this.setupExpirationTimer();
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('EnhancedSemanticCache initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('EnhancedSemanticCache initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`EnhancedSemanticCache initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Sets up the expiration timer.
   * 
   * @private
   */
  setupExpirationTimer() {
    // Run expiration check every minute
    this.expirationInterval = setInterval(() => {
      this.expireEntries().catch(error => {
        if (this.logger) {
          this.logger.error('Failed to expire cache entries', { error: error.message });
        }
      });
    }, 60000);
  }
  
  /**
   * Loads persisted cache from disk.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadPersistedCache() {
    try {
      // In a real implementation, this would load from disk
      // For now, we'll just log the attempt
      if (this.logger) {
        this.logger.debug('Attempted to load persisted cache (not implemented)');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to load persisted cache', { error: error.message });
      }
    }
  }
  
  /**
   * Persists cache to disk.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async persistCache() {
    if (!this.config.enableOfflineSupport || !this.config.persistToDisk) {
      return;
    }
    
    try {
      // In a real implementation, this would persist to disk
      // For now, we'll just log the attempt
      if (this.logger) {
        this.logger.debug('Attempted to persist cache (not implemented)');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to persist cache', { error: error.message });
      }
    }
  }
  
  /**
   * Stores a value in the cache.
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to store
   * @param {Object} [options={}] - Storage options
   * @returns {Promise<void>}
   */
  async store(key, value, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_store');
    }
    
    try {
      // Generate entry ID
      const entryId = uuidv4();
      
      // Prepare entry
      const entry = {
        id: entryId,
        key,
        result: value,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        ttl: options.ttl || this.config.defaultTtl,
        context: options.context || {},
        consistencyLevel: options.consistencyLevel || this.config.defaultConsistencyLevel,
        priority: options.priority || 0,
        size: this.estimateSize(value)
      };
      
      // Add vector embedding if available
      if (this.config.enableVectorSimilarity && this.vectorService && options.text) {
        try {
          entry.embedding = await this.vectorService.getEmbedding(options.text);
        } catch (e) {
          if (this.logger) {
            this.logger.warn('Failed to get embedding for cache entry', { key, error: e.message });
          }
        }
      }
      
      // Store entry
      this.cache.set(key, entry);
      
      // Update context index
      if (this.config.enableContextAwareness && entry.context) {
        this.updateContextIndex(entry);
      }
      
      // Update vector index
      if (this.vectorIndex && entry.embedding) {
        this.vectorIndex.set(entryId, {
          key,
          embedding: entry.embedding
        });
      }
      
      // Update stats
      this.stats.stores++;
      this.stats.size += entry.size;
      
      // Check if we need to evict entries
      if (this.cache.size > this.config.maxSize) {
        await this.evictEntries();
      }
      
      // Persist cache if needed
      if (this.config.enableOfflineSupport && this.config.persistToDisk) {
        await this.persistCache();
      }
      
      if (this.logger) {
        this.logger.debug(`Stored cache entry: ${key}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to store cache entry: ${key}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves a value from the cache.
   * 
   * @param {string} key - Cache key
   * @param {Object} [options={}] - Retrieval options
   * @returns {Promise<Object|null>} - Cache entry or null if not found
   */
  async retrieve(key, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_retrieve');
    }
    
    try {
      // Check direct cache hit
      if (this.cache.has(key)) {
        const entry = this.cache.get(key);
        
        // Check if entry is expired
        if (this.isExpired(entry)) {
          // Remove expired entry
          this.cache.delete(key);
          this.stats.misses++;
          return null;
        }
        
        // Update entry metadata
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        
        // Update stats
        this.stats.hits++;
        
        if (this.logger) {
          this.logger.debug(`Cache hit: ${key}`);
        }
        
        return entry;
      }
      
      // If direct hit fails, try context-based retrieval
      if (this.config.enableContextAwareness && options.context) {
        const contextEntry = await this.retrieveByContext(options.context);
        if (contextEntry) {
          return contextEntry;
        }
      }
      
      // If context-based retrieval fails, try vector similarity
      if (this.config.enableVectorSimilarity && this.vectorService && options.text) {
        const similarEntry = await this.retrieveBySimilarity(options.text);
        if (similarEntry) {
          return similarEntry;
        }
      }
      
      // Cache miss
      this.stats.misses++;
      
      if (this.logger) {
        this.logger.debug(`Cache miss: ${key}`);
      }
      
      return null;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve cache entry: ${key}`, { error: error.message, stack: error.stack });
      }
      
      // Return null on error
      return null;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves a cache entry by context.
   * 
   * @private
   * @param {Object} context - Context to match
   * @returns {Promise<Object|null>} - Cache entry or null if not found
   */
  async retrieveByContext(context) {
    if (!this.config.enableContextAwareness) {
      return null;
    }
    
    try {
      // Find entries that match all context properties
      const matchingEntries = [];
      
      for (const [contextKey, contextValue] of Object.entries(context)) {
        if (this.contextIndex.has(contextKey)) {
          const entriesForKey = this.contextIndex.get(contextKey);
          
          if (entriesForKey.has(JSON.stringify(contextValue))) {
            const entryIds = entriesForKey.get(JSON.stringify(contextValue));
            
            for (const entryId of entryIds) {
              // Find the entry with this ID
              for (const entry of this.cache.values()) {
                if (entry.id === entryId) {
                  matchingEntries.push(entry);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Find entry that matches the most context properties
      if (matchingEntries.length > 0) {
        // Sort by number of matching context properties (descending)
        matchingEntries.sort((a, b) => {
          const aMatches = Object.keys(a.context).filter(key => 
            context[key] !== undefined && 
            JSON.stringify(a.context[key]) === JSON.stringify(context[key])
          ).length;
          
          const bMatches = Object.keys(b.context).filter(key => 
            context[key] !== undefined && 
            JSON.stringify(b.context[key]) === JSON.stringify(context[key])
          ).length;
          
          return bMatches - aMatches;
        });
        
        const bestMatch = matchingEntries[0];
        
        // Check if entry is expired
        if (this.isExpired(bestMatch)) {
          return null;
        }
        
        // Update entry metadata
        bestMatch.lastAccessed = Date.now();
        bestMatch.accessCount++;
        
        // Update stats
        this.stats.hits++;
        
        if (this.logger) {
          this.logger.debug(`Context-based cache hit: ${bestMatch.key}`);
        }
        
        return bestMatch;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to retrieve by context', { error: error.message });
      }
    }
    
    return null;
  }
  
  /**
   * Retrieves a cache entry by semantic similarity.
   * 
   * @private
   * @param {string} text - Text to find similar entries for
   * @returns {Promise<Object|null>} - Cache entry or null if not found
   */
  async retrieveBySimilarity(text) {
    if (!this.config.enableVectorSimilarity || !this.vectorService || !this.vectorIndex) {
      return null;
    }
    
    try {
      // Get embedding for the text
      const embedding = await this.vectorService.getEmbedding(text);
      
      // Find similar entries
      const similarities = [];
      
      for (const [entryId, indexEntry] of this.vectorIndex.entries()) {
        const similarity = this.cosineSimilarity(embedding, indexEntry.embedding);
        
        if (similarity >= this.config.similarityThreshold) {
          similarities.push({
            key: indexEntry.key,
            similarity
          });
        }
      }
      
      // Sort by similarity (descending)
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // Get the most similar entry
      if (similarities.length > 0) {
        const mostSimilar = similarities[0];
        const entry = this.cache.get(mostSimilar.key);
        
        if (entry) {
          // Check if entry is expired
          if (this.isExpired(entry)) {
            return null;
          }
          
          // Update entry metadata
          entry.lastAccessed = Date.now();
          entry.accessCount++;
          
          // Update stats
          this.stats.hits++;
          
          if (this.logger) {
            this.logger.debug(`Similarity-based cache hit: ${entry.key} (similarity: ${mostSimilar.similarity.toFixed(4)})`);
          }
          
          return entry;
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to retrieve by similarity', { error: error.message });
      }
    }
    
    return null;
  }
  
  /**
   * Invalidates cache entries.
   * 
   * @param {Object} options - Invalidation options
   * @returns {Promise<number>} - Number of invalidated entries
   */
  async invalidate(options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_invalidate');
    }
    
    try {
      let invalidatedCount = 0;
      
      // Invalidate by key
      if (options.key) {
        if (this.cache.has(options.key)) {
          const entry = this.cache.get(options.key);
          this.removeEntry(entry);
          invalidatedCount++;
        }
      }
      
      // Invalidate by context
      if (options.context) {
        for (const entry of this.cache.values()) {
          let matches = true;
          
          for (const [key, value] of Object.entries(options.context)) {
            if (!entry.context || entry.context[key] !== value) {
              matches = false;
              break;
            }
          }
          
          if (matches) {
            this.removeEntry(entry);
            invalidatedCount++;
          }
        }
      }
      
      // Invalidate all
      if (options.all) {
        invalidatedCount = this.cache.size;
        this.clear();
      }
      
      // Update stats
      this.stats.invalidations += invalidatedCount;
      
      // Persist cache if needed
      if (invalidatedCount > 0 && this.config.enableOfflineSupport && this.config.persistToDisk) {
        await this.persistCache();
      }
      
      if (this.logger) {
        this.logger.debug(`Invalidated ${invalidatedCount} cache entries`);
      }
      
      return invalidatedCount;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to invalidate cache entries', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Removes a cache entry and updates indexes.
   * 
   * @private
   * @param {Object} entry - Cache entry to remove
   */
  removeEntry(entry) {
    // Remove from cache
    this.cache.delete(entry.key);
    
    // Update context index
    if (this.config.enableContextAwareness && entry.context) {
      this.removeFromContextIndex(entry);
    }
    
    // Update vector index
    if (this.vectorIndex && entry.id) {
      this.vectorIndex.delete(entry.id);
    }
    
    // Update stats
    this.stats.size -= entry.size;
  }
  
  /**
   * Updates the context index with a cache entry.
   * 
   * @private
   * @param {Object} entry - Cache entry
   */
  updateContextIndex(entry) {
    if (!entry.context) {
      return;
    }
    
    for (const [key, value] of Object.entries(entry.context)) {
      if (!this.contextIndex.has(key)) {
        this.contextIndex.set(key, new Map());
      }
      
      const valueMap = this.contextIndex.get(key);
      const valueString = JSON.stringify(value);
      
      if (!valueMap.has(valueString)) {
        valueMap.set(valueString, new Set());
      }
      
      valueMap.get(valueString).add(entry.id);
    }
  }
  
  /**
   * Removes a cache entry from the context index.
   * 
   * @private
   * @param {Object} entry - Cache entry
   */
  removeFromContextIndex(entry) {
    if (!entry.context) {
      return;
    }
    
    for (const [key, value] of Object.entries(entry.context)) {
      if (this.contextIndex.has(key)) {
        const valueMap = this.contextIndex.get(key);
        const valueString = JSON.stringify(value);
        
        if (valueMap.has(valueString)) {
          const entryIds = valueMap.get(valueString);
          entryIds.delete(entry.id);
          
          if (entryIds.size === 0) {
            valueMap.delete(valueString);
          }
        }
        
        if (valueMap.size === 0) {
          this.contextIndex.delete(key);
        }
      }
    }
  }
  
  /**
   * Checks if a cache entry is expired.
   * 
   * @private
   * @param {Object} entry - Cache entry
   * @returns {boolean} - Whether the entry is expired
   */
  isExpired(entry) {
    if (!entry) {
      return true;
    }
    
    // Check TTL
    if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Expires old cache entries.
   * 
   * @private
   * @returns {Promise<number>} - Number of expired entries
   */
  async expireEntries() {
    let expiredCount = 0;
    
    for (const entry of this.cache.values()) {
      if (this.isExpired(entry)) {
        this.removeEntry(entry);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0 && this.logger) {
      this.logger.debug(`Expired ${expiredCount} cache entries`);
    }
    
    return expiredCount;
  }
  
  /**
   * Evicts cache entries based on the configured strategy.
   * 
   * @private
   * @returns {Promise<number>} - Number of evicted entries
   */
  async evictEntries() {
    const strategy = this.config.expirationStrategy;
    const targetSize = Math.floor(this.config.maxSize * 0.8); // Reduce to 80% of max size
    let evictedCount = 0;
    
    // Convert cache to array for sorting
    const entries = Array.from(this.cache.values());
    
    // Sort based on strategy
    switch (strategy) {
      case ExpirationStrategy.LRU:
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        break;
      
      case ExpirationStrategy.LFU:
        // Sort by access count (least first)
        entries.sort((a, b) => a.accessCount - b.accessCount);
        break;
      
      case ExpirationStrategy.SIZE:
        // Sort by size (largest first)
        entries.sort((a, b) => b.size - a.size);
        break;
      
      case ExpirationStrategy.PRIORITY:
        // Sort by priority (lowest first)
        entries.sort((a, b) => a.priority - b.priority);
        break;
      
      case ExpirationStrategy.TIME:
      default:
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a.timestamp - b.timestamp);
        break;
    }
    
    // Evict entries until we reach target size
    while (this.cache.size > targetSize && evictedCount < entries.length) {
      const entry = entries[evictedCount];
      this.removeEntry(entry);
      evictedCount++;
    }
    
    if (evictedCount > 0 && this.logger) {
      this.logger.debug(`Evicted ${evictedCount} cache entries using ${strategy} strategy`);
    }
    
    return evictedCount;
  }
  
  /**
   * Clears the cache.
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_clear');
    }
    
    try {
      // Clear cache and indexes
      this.cache.clear();
      this.contextIndex.clear();
      
      if (this.vectorIndex) {
        this.vectorIndex.clear();
      }
      
      // Reset stats
      this.stats.size = 0;
      
      // Persist empty cache if needed
      if (this.config.enableOfflineSupport && this.config.persistToDisk) {
        await this.persistCache();
      }
      
      if (this.logger) {
        this.logger.debug('Cleared cache');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to clear cache', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Gets cache statistics.
   * 
   * @returns {Promise<Object>} - Cache statistics
   */
  async getStats() {
    this.ensureInitialized();
    
    // Calculate hit rate
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    return {
      ...this.stats,
      entryCount: this.cache.size,
      hitRate
    };
  }
  
  /**
   * Estimates the size of a value in bytes.
   * 
   * @private
   * @param {*} value - Value to estimate size for
   * @returns {number} - Estimated size in bytes
   */
  estimateSize(value) {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // Approximate size in bytes
    } catch (e) {
      return 1000; // Default size if can't stringify
    }
  }
  
  /**
   * Calculates cosine similarity between two vectors.
   * 
   * @private
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} - Cosine similarity
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Ensures the cache is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the cache is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('EnhancedSemanticCache is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Shuts down the enhanced semantic cache.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down EnhancedSemanticCache');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('enhancedSemanticCache_shutdown');
    }
    
    try {
      // Clear expiration timer
      if (this.expirationInterval) {
        clearInterval(this.expirationInterval);
        this.expirationInterval = null;
      }
      
      // Persist cache if needed
      if (this.config.enableOfflineSupport && this.config.persistToDisk) {
        await this.persistCache();
      }
      
      this.initialized = false;
      
      this.emit('shutdown');
    } catch (error) {
      if (this.logger) {
        this.logger.error('EnhancedSemanticCache shutdown failed', { error: error.message, stack: error.stack });
      }
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = { EnhancedSemanticCache, ExpirationStrategy, ConsistencyLevel };
