/**
 * @fileoverview Cache Entry class for the Advanced Caching Strategies system
 * Represents a single cache entry with metadata
 */

/**
 * Class representing a cache entry
 */
class CacheEntry {
  /**
   * Create a new CacheEntry
   * @param {string} key - Cache key
   * @param {*} value - Cached value
   * @param {Object} options - Entry options
   * @param {number} [options.ttl=0] - Time-to-live in milliseconds (0 = no expiration)
   * @param {string} [options.type='object'] - Type of cached data
   * @param {Array<string>} [options.dependencies=[]] - Keys of other cache entries this entry depends on
   * @param {string} [options.source='system'] - Source identifier
   * @param {number} [options.priority=1] - Priority level (1-3, higher = more important)
   * @param {Array<string>} [options.tags=[]] - Tags for categorizing
   */
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    
    const now = Date.now();
    
    this.metadata = {
      created: now,
      lastAccessed: now,
      lastModified: now,
      accessCount: 0,
      size: this._calculateSize(value),
      type: options.type || 'object',
      dependencies: options.dependencies || [],
      source: options.source || 'system',
      priority: options.priority || 1,
      tags: options.tags || [],
      version: 1
    };
    
    // Set expiration if TTL provided
    if (options.ttl) {
      this.metadata.expires = now + options.ttl;
    }
  }

  /**
   * Check if the entry is expired
   * @returns {boolean} Whether the entry is expired
   */
  isExpired() {
    return this.metadata.expires !== undefined && Date.now() > this.metadata.expires;
  }

  /**
   * Update access statistics
   * @returns {void}
   */
  updateAccessStats() {
    this.metadata.lastAccessed = Date.now();
    this.metadata.accessCount++;
  }

  /**
   * Update the cached value
   * @param {*} value - New value
   * @param {Object} options - Update options
   * @param {number} [options.ttl] - New TTL in milliseconds
   * @param {boolean} [options.resetTTL=false] - Whether to reset TTL
   * @param {boolean} [options.updateVersion=true] - Whether to increment version
   * @returns {void}
   */
  updateValue(value, options = {}) {
    this.value = value;
    this.metadata.lastModified = Date.now();
    this.metadata.size = this._calculateSize(value);
    
    if (options.updateVersion !== false) {
      this.metadata.version++;
    }
    
    if (options.ttl || options.resetTTL) {
      const now = Date.now();
      this.metadata.expires = now + (options.ttl || 0);
    }
  }

  /**
   * Add tags to the entry
   * @param {Array<string>} tags - Tags to add
   * @returns {void}
   */
  addTags(tags) {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    
    for (const tag of tags) {
      if (!this.metadata.tags.includes(tag)) {
        this.metadata.tags.push(tag);
      }
    }
  }

  /**
   * Remove tags from the entry
   * @param {Array<string>} tags - Tags to remove
   * @returns {void}
   */
  removeTags(tags) {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    
    this.metadata.tags = this.metadata.tags.filter(tag => !tags.includes(tag));
  }

  /**
   * Check if the entry has a specific tag
   * @param {string} tag - Tag to check
   * @returns {boolean} Whether the entry has the tag
   */
  hasTag(tag) {
    return this.metadata.tags.includes(tag);
  }

  /**
   * Calculate the size of a value in bytes (approximate)
   * @param {*} value - Value to calculate size for
   * @returns {number} Size in bytes
   * @private
   */
  _calculateSize(value) {
    if (value === null || value === undefined) {
      return 0;
    }
    
    const type = typeof value;
    
    switch (type) {
      case 'boolean':
        return 4;
      case 'number':
        return 8;
      case 'string':
        return value.length * 2; // UTF-16
      case 'object':
        if (Array.isArray(value)) {
          return value.reduce((size, item) => size + this._calculateSize(item), 0);
        }
        if (value instanceof Date) {
          return 8;
        }
        if (value instanceof Map || value instanceof Set) {
          let size = 0;
          for (const item of value) {
            size += this._calculateSize(item);
          }
          return size;
        }
        if (Buffer.isBuffer(value)) {
          return value.length;
        }
        if (ArrayBuffer.isView(value)) {
          return value.byteLength;
        }
        
        // Regular object
        let size = 0;
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            size += key.length * 2; // Key size
            size += this._calculateSize(value[key]); // Value size
          }
        }
        return size;
      default:
        return 8; // Default size for unknown types
    }
  }
}

module.exports = CacheEntry;
