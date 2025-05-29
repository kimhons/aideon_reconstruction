/**
 * @fileoverview SemanticCache for the Knowledge Graph Manager.
 * Provides intelligent caching of query results based on semantic similarity.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const crypto = require('crypto');

/**
 * Provides intelligent caching of query results based on semantic similarity.
 */
class SemanticCache {
  /**
   * Creates a new SemanticCache instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} [options.vectorService] - Vector service for embeddings
   * @param {number} [options.defaultTTL=3600000] - Default TTL in milliseconds (1 hour)
   * @param {number} [options.maxCacheSize=1000] - Maximum number of cache entries
   * @param {number} [options.defaultSimilarityThreshold=0.85] - Default similarity threshold
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.vectorService = options.vectorService;
    
    // Load configuration if available
    if (this.configService) {
      const config = this.configService.get('cognitive.knowledge.semanticCache', {
        defaultTTL: 3600000, // 1 hour
        maxCacheSize: 1000,
        defaultSimilarityThreshold: 0.85,
        enableCache: true,
        embeddingDimensions: 768
      });
      
      this.config = config;
    } else {
      this.config = {
        defaultTTL: options.defaultTTL || 3600000, // 1 hour
        maxCacheSize: options.maxCacheSize || 1000,
        defaultSimilarityThreshold: options.defaultSimilarityThreshold || 0.85,
        enableCache: true,
        embeddingDimensions: 768
      };
    }
    
    this.cache = new Map();
    this.keyEmbeddings = new Map();
    this.initialized = false;
  }
  
  /**
   * Initializes the semantic cache.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing SemanticCache');
    }
    
    this.initialized = true;
    
    if (this.logger) {
      this.logger.info('SemanticCache initialized');
    }
  }
  
  /**
   * Stores a query result in the cache.
   * 
   * @param {Object|string} query - Query object or string
   * @param {any} result - Query result
   * @param {Object} [context={}] - Query context
   * @param {number} [ttl] - Time-to-live in milliseconds
   * @returns {Promise<string>} - Cache key
   */
  async store(query, result, context = {}, ttl) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.config.enableCache) {
      return null;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('semanticCache_store');
    }
    
    try {
      // Generate embedding for the query
      const embedding = await this.generateEmbedding(query, context);
      
      // Generate cache key
      const cacheKey = this.generateSemanticKey(query, context);
      
      // Calculate confidence score for the result
      const confidence = this.calculateConfidence(result);
      
      // Store in cache
      this.cache.set(cacheKey, {
        result,
        metadata: {
          timestamp: Date.now(),
          context,
          confidence,
          ttl: ttl || this.config.defaultTTL,
          queryType: typeof query === 'string' ? 'string' : 'object'
        }
      });
      
      // Store embedding for similarity search
      this.keyEmbeddings.set(cacheKey, embedding);
      
      // Enforce cache size limit
      this.enforceCacheLimit();
      
      if (this.logger) {
        this.logger.debug(`Stored in semantic cache: ${cacheKey}`);
      }
      
      return cacheKey;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves a query result from the cache based on semantic similarity.
   * 
   * @param {Object|string} query - Query object or string
   * @param {Object} [context={}] - Query context
   * @param {number} [similarityThreshold] - Similarity threshold
   * @returns {Promise<Object|null>} - Cache entry or null if not found
   */
  async retrieve(query, context = {}, similarityThreshold) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.config.enableCache) {
      return null;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('semanticCache_retrieve');
    }
    
    try {
      // Try exact match first
      const exactKey = this.generateSemanticKey(query, context);
      if (this.cache.has(exactKey)) {
        const entry = this.cache.get(exactKey);
        
        // Check if entry is expired
        if (this.isExpired(entry)) {
          this.cache.delete(exactKey);
          this.keyEmbeddings.delete(exactKey);
          
          if (this.logger) {
            this.logger.debug(`Cache entry expired: ${exactKey}`);
          }
          
          return null;
        }
        
        if (this.logger) {
          this.logger.debug(`Exact cache hit: ${exactKey}`);
        }
        
        return {
          result: entry.result,
          metadata: { ...entry.metadata, source: 'exact' }
        };
      }
      
      // No exact match, try semantic similarity
      const threshold = similarityThreshold || this.config.defaultSimilarityThreshold;
      const queryEmbedding = await this.generateEmbedding(query, context);
      
      // Find similar entries
      const similarEntries = await this.findSimilarEntries(queryEmbedding, threshold);
      
      if (similarEntries.length > 0) {
        const bestMatch = similarEntries[0];
        const entry = this.cache.get(bestMatch.key);
        
        // Check if entry is expired
        if (this.isExpired(entry)) {
          this.cache.delete(bestMatch.key);
          this.keyEmbeddings.delete(bestMatch.key);
          
          if (this.logger) {
            this.logger.debug(`Cache entry expired: ${bestMatch.key}`);
          }
          
          return null;
        }
        
        if (this.logger) {
          this.logger.debug(`Semantic cache hit: ${bestMatch.key} (similarity: ${bestMatch.similarity.toFixed(4)})`);
        }
        
        // Adapt result if needed
        const adaptedResult = this.adaptResult(entry.result, query, context, bestMatch.similarity);
        
        return {
          result: adaptedResult,
          metadata: { 
            ...entry.metadata, 
            source: 'semantic',
            similarity: bestMatch.similarity,
            originalQuery: bestMatch.originalQuery
          }
        };
      }
      
      if (this.logger) {
        this.logger.debug('Semantic cache miss');
      }
      
      return null;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Invalidates cache entries based on criteria.
   * 
   * @param {Object} criteria - Invalidation criteria
   * @param {string} [criteria.key] - Specific cache key to invalidate
   * @param {Object} [criteria.context] - Context to match
   * @param {number} [criteria.olderThan] - Invalidate entries older than this timestamp
   * @returns {Promise<number>} - Number of invalidated entries
   */
  async invalidate(criteria = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    let count = 0;
    const keysToDelete = [];
    
    // Collect keys to delete
    for (const [key, entry] of this.cache.entries()) {
      let shouldDelete = false;
      
      if (criteria.key && key === criteria.key) {
        shouldDelete = true;
      } else if (criteria.context && this.contextMatches(entry.metadata.context, criteria.context)) {
        shouldDelete = true;
      } else if (criteria.olderThan && entry.metadata.timestamp < criteria.olderThan) {
        shouldDelete = true;
      }
      
      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }
    
    // Delete collected keys
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.keyEmbeddings.delete(key);
      count++;
    }
    
    if (this.logger) {
      this.logger.debug(`Invalidated ${count} cache entries`);
    }
    
    return count;
  }
  
  /**
   * Clears the entire cache.
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const count = this.cache.size;
    
    this.cache.clear();
    this.keyEmbeddings.clear();
    
    if (this.logger) {
      this.logger.debug(`Cleared semantic cache (${count} entries)`);
    }
  }
  
  /**
   * Gets cache statistics.
   * 
   * @returns {Promise<Object>} - Cache statistics
   */
  async getStats() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Calculate age statistics
    const now = Date.now();
    let totalAge = 0;
    let minAge = Number.MAX_SAFE_INTEGER;
    let maxAge = 0;
    
    for (const entry of this.cache.values()) {
      const age = now - entry.metadata.timestamp;
      totalAge += age;
      minAge = Math.min(minAge, age);
      maxAge = Math.max(maxAge, age);
    }
    
    const avgAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      enabled: this.config.enableCache,
      ageStats: {
        minAge: this.cache.size > 0 ? minAge : 0,
        maxAge,
        avgAge
      },
      hitRate: 0, // Would be tracked in a real implementation
      missRate: 0  // Would be tracked in a real implementation
    };
  }
  
  /**
   * Generates an embedding for a query.
   * 
   * @private
   * @param {Object|string} query - Query object or string
   * @param {Object} context - Query context
   * @returns {Promise<Array<number>>} - Query embedding
   */
  async generateEmbedding(query, context) {
    // If vectorService is available, use it to generate embeddings
    if (this.vectorService && typeof this.vectorService.generateEmbedding === 'function') {
      const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
      const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context) : '';
      
      return await this.vectorService.generateEmbedding(`${queryStr} ${contextStr}`);
    }
    
    // Fallback: generate a simple hash-based pseudo-embedding
    // This is not semantically meaningful but allows the cache to function
    // until a proper vector service is available
    return this.generatePseudoEmbedding(query, context);
  }
  
  /**
   * Generates a pseudo-embedding based on hash.
   * 
   * @private
   * @param {Object|string} query - Query object or string
   * @param {Object} context - Query context
   * @returns {Array<number>} - Pseudo-embedding
   */
  generatePseudoEmbedding(query, context) {
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
    const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context) : '';
    const combined = `${queryStr}|${contextStr}`;
    
    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    // Convert hash to pseudo-embedding
    const dimensions = this.config.embeddingDimensions || 768;
    const embedding = new Array(dimensions).fill(0);
    
    // Use hash to seed the embedding values
    for (let i = 0; i < hash.length; i += 2) {
      const value = parseInt(hash.substr(i, 2), 16) / 255.0;
      const index = i / 2 % dimensions;
      embedding[index] = value;
    }
    
    return embedding;
  }
  
  /**
   * Generates a semantic key for a query.
   * 
   * @private
   * @param {Object|string} query - Query object or string
   * @param {Object} context - Query context
   * @returns {string} - Semantic key
   */
  generateSemanticKey(query, context) {
    const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
    const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context) : '';
    const combined = `${queryStr}|${contextStr}`;
    
    return crypto.createHash('md5').update(combined).digest('hex');
  }
  
  /**
   * Calculates confidence score for a result.
   * 
   * @private
   * @param {any} result - Query result
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(result) {
    // In a real implementation, this would analyze the result to determine confidence
    // For this example, we'll use a simple heuristic
    
    if (result === null || result === undefined) {
      return 0;
    }
    
    if (Array.isArray(result)) {
      return result.length > 0 ? 0.9 : 0.5;
    }
    
    if (typeof result === 'object') {
      const keys = Object.keys(result);
      return keys.length > 0 ? 0.9 : 0.7;
    }
    
    return 0.8;
  }
  
  /**
   * Finds cache entries similar to a query embedding.
   * 
   * @private
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {number} similarityThreshold - Similarity threshold
   * @returns {Promise<Array<Object>>} - Similar cache entries
   */
  async findSimilarEntries(queryEmbedding, similarityThreshold) {
    const similarities = [];
    
    for (const [key, embedding] of this.keyEmbeddings.entries()) {
      // Skip if entry doesn't exist (might have been invalidated)
      if (!this.cache.has(key)) {
        continue;
      }
      
      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
      
      if (similarity >= similarityThreshold) {
        similarities.push({
          key,
          similarity,
          originalQuery: this.cache.get(key).metadata.queryType === 'string' ? 
            key : JSON.parse(key.split('|')[0])
        });
      }
    }
    
    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities;
  }
  
  /**
   * Calculates cosine similarity between two vectors.
   * 
   * @private
   * @param {Array<number>} vec1 - First vector
   * @param {Array<number>} vec2 - Second vector
   * @returns {number} - Cosine similarity
   */
  calculateCosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    const length = Math.min(vec1.length, vec2.length);
    
    for (let i = 0; i < length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    return dotProduct / (mag1 * mag2);
  }
  
  /**
   * Adapts a cached result for a new query.
   * 
   * @private
   * @param {any} result - Cached result
   * @param {Object|string} query - New query
   * @param {Object} context - New context
   * @param {number} similarity - Similarity score
   * @returns {any} - Adapted result
   */
  adaptResult(result, query, context, similarity) {
    // In a real implementation, this would adapt the result based on the query differences
    // For this example, we'll just return the original result
    
    // For array results, we could adjust confidence scores
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
      return result.map(item => {
        if (item.score !== undefined) {
          // Adjust score based on similarity
          return {
            ...item,
            score: item.score * similarity
          };
        }
        return item;
      });
    }
    
    return result;
  }
  
  /**
   * Checks if a cache entry is expired.
   * 
   * @private
   * @param {Object} entry - Cache entry
   * @returns {boolean} - Whether the entry is expired
   */
  isExpired(entry) {
    const now = Date.now();
    const expirationTime = entry.metadata.timestamp + entry.metadata.ttl;
    
    return now > expirationTime;
  }
  
  /**
   * Enforces the cache size limit.
   * 
   * @private
   */
  enforceCacheLimit() {
    if (this.cache.size <= this.config.maxCacheSize) {
      return;
    }
    
    // Sort entries by age (oldest first)
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        timestamp: entry.metadata.timestamp,
        confidence: entry.metadata.confidence
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until we're under the limit
    const entriesToRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
    
    for (const entry of entriesToRemove) {
      this.cache.delete(entry.key);
      this.keyEmbeddings.delete(entry.key);
    }
    
    if (this.logger && entriesToRemove.length > 0) {
      this.logger.debug(`Removed ${entriesToRemove.length} oldest cache entries to enforce size limit`);
    }
  }
  
  /**
   * Checks if a context matches criteria.
   * 
   * @private
   * @param {Object} context - Context to check
   * @param {Object} criteria - Criteria to match
   * @returns {boolean} - Whether the context matches
   */
  contextMatches(context, criteria) {
    for (const [key, value] of Object.entries(criteria)) {
      if (!context.hasOwnProperty(key) || context[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Shuts down the semantic cache.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down SemanticCache');
    }
    
    this.cache.clear();
    this.keyEmbeddings.clear();
    
    this.initialized = false;
  }
}

module.exports = { SemanticCache };
