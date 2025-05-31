/**
 * AudioProcessingContext.js
 * 
 * Maintains shared context and state for audio processing operations.
 * Provides thread-safe operations for context data access and modification.
 * 
 * @module tentacles/audio-processing/core/AudioProcessingContext
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Audio Processing Context class
 * Maintains shared state and context for audio processing operations
 */
class AudioProcessingContext extends EventEmitter {
  /**
   * Constructor for the Audio Processing Context
   * @param {Object} options - Configuration options
   * @param {string} options.contextId - Unique identifier for this context
   * @param {string} options.storagePath - Path for persistent storage
   * @param {boolean} options.persistContext - Whether to persist context to disk
   * @param {number} options.persistInterval - Interval for auto-persistence in ms
   */
  constructor(options = {}) {
    super();
    
    this.contextId = options.contextId || `audio-context-${Date.now()}`;
    this.storagePath = options.storagePath || './storage';
    this.persistContext = options.persistContext !== undefined ? options.persistContext : true;
    this.persistInterval = options.persistInterval || 30000; // 30 seconds default
    
    this.contextData = new Map();
    this.locks = new Map();
    this.persistTimer = null;
    
    // Initialize storage directory
    this._initializeStorage();
    
    // Load persisted context if available
    if (this.persistContext) {
      this._loadPersistedContext();
      this._setupAutoPersist();
    }
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Set a value in the context
   * @param {string} key - Context key
   * @param {any} value - Value to store
   * @param {Object} options - Options for this operation
   * @param {boolean} options.persist - Whether to persist this change immediately
   * @param {boolean} options.notify - Whether to emit change event
   * @returns {boolean} - Success status
   */
  set(key, value, options = {}) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    const persist = options.persist !== undefined ? options.persist : false;
    const notify = options.notify !== undefined ? options.notify : true;
    
    try {
      // Acquire lock if not already held
      this._acquireLock(key);
      
      // Store value
      this.contextData.set(key, {
        value,
        timestamp: Date.now(),
        metadata: options.metadata || {}
      });
      
      // Release lock
      this._releaseLock(key);
      
      // Persist if requested
      if (persist && this.persistContext) {
        this._persistContext();
      }
      
      // Emit change event if requested
      if (notify) {
        this.emit('contextChanged', {
          key,
          value,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting context value for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get a value from the context
   * @param {string} key - Context key
   * @param {any} defaultValue - Default value if key not found
   * @returns {any} - Stored value or default
   */
  get(key, defaultValue = null) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    try {
      const entry = this.contextData.get(key);
      
      if (!entry) {
        return defaultValue;
      }
      
      return entry.value;
    } catch (error) {
      console.error(`Error getting context value for key ${key}:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Check if a key exists in the context
   * @param {string} key - Context key
   * @returns {boolean} - Whether key exists
   */
  has(key) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    return this.contextData.has(key);
  }
  
  /**
   * Delete a value from the context
   * @param {string} key - Context key
   * @param {Object} options - Options for this operation
   * @param {boolean} options.persist - Whether to persist this change immediately
   * @param {boolean} options.notify - Whether to emit change event
   * @returns {boolean} - Success status
   */
  delete(key, options = {}) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    const persist = options.persist !== undefined ? options.persist : false;
    const notify = options.notify !== undefined ? options.notify : true;
    
    try {
      // Acquire lock if not already held
      this._acquireLock(key);
      
      // Check if key exists
      if (!this.contextData.has(key)) {
        this._releaseLock(key);
        return false;
      }
      
      // Delete value
      this.contextData.delete(key);
      
      // Release lock
      this._releaseLock(key);
      
      // Persist if requested
      if (persist && this.persistContext) {
        this._persistContext();
      }
      
      // Emit change event if requested
      if (notify) {
        this.emit('contextDeleted', {
          key,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting context value for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get all keys in the context
   * @returns {Array<string>} - Array of keys
   */
  keys() {
    return Array.from(this.contextData.keys());
  }
  
  /**
   * Get all entries in the context
   * @returns {Array<Object>} - Array of entries with key, value, and metadata
   */
  entries() {
    const result = [];
    
    for (const [key, entry] of this.contextData.entries()) {
      result.push({
        key,
        value: entry.value,
        timestamp: entry.timestamp,
        metadata: entry.metadata
      });
    }
    
    return result;
  }
  
  /**
   * Clear all values from the context
   * @param {Object} options - Options for this operation
   * @param {boolean} options.persist - Whether to persist this change immediately
   * @param {boolean} options.notify - Whether to emit change event
   * @returns {boolean} - Success status
   */
  clear(options = {}) {
    const persist = options.persist !== undefined ? options.persist : false;
    const notify = options.notify !== undefined ? options.notify : true;
    
    try {
      // Acquire all locks
      for (const key of this.contextData.keys()) {
        this._acquireLock(key);
      }
      
      // Clear all values
      this.contextData.clear();
      
      // Release all locks
      for (const key of this.locks.keys()) {
        this._releaseLock(key);
      }
      
      // Persist if requested
      if (persist && this.persistContext) {
        this._persistContext();
      }
      
      // Emit change event if requested
      if (notify) {
        this.emit('contextCleared', {
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing context:', error);
      return false;
    }
  }
  
  /**
   * Persist the context to disk
   * @returns {Promise<boolean>} - Success status
   */
  async persist() {
    return this._persistContext();
  }
  
  /**
   * Load the context from disk
   * @returns {Promise<boolean>} - Success status
   */
  async load() {
    return this._loadPersistedContext();
  }
  
  /**
   * Get metadata for a context entry
   * @param {string} key - Context key
   * @returns {Object|null} - Metadata or null if not found
   */
  getMetadata(key) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    try {
      const entry = this.contextData.get(key);
      
      if (!entry) {
        return null;
      }
      
      return entry.metadata || {};
    } catch (error) {
      console.error(`Error getting metadata for key ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Set metadata for a context entry
   * @param {string} key - Context key
   * @param {Object} metadata - Metadata to set
   * @param {Object} options - Options for this operation
   * @param {boolean} options.persist - Whether to persist this change immediately
   * @param {boolean} options.notify - Whether to emit change event
   * @returns {boolean} - Success status
   */
  setMetadata(key, metadata, options = {}) {
    if (!key) {
      throw new Error('Key must be provided');
    }
    
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }
    
    const persist = options.persist !== undefined ? options.persist : false;
    const notify = options.notify !== undefined ? options.notify : true;
    
    try {
      // Acquire lock if not already held
      this._acquireLock(key);
      
      // Check if key exists
      if (!this.contextData.has(key)) {
        this._releaseLock(key);
        return false;
      }
      
      // Update metadata
      const entry = this.contextData.get(key);
      entry.metadata = metadata;
      this.contextData.set(key, entry);
      
      // Release lock
      this._releaseLock(key);
      
      // Persist if requested
      if (persist && this.persistContext) {
        this._persistContext();
      }
      
      // Emit change event if requested
      if (notify) {
        this.emit('metadataChanged', {
          key,
          metadata,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting metadata for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Clear auto-persist timer
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    
    // Persist one last time if needed
    if (this.persistContext) {
      this._persistContext();
    }
    
    // Remove all listeners
    this.removeAllListeners();
  }
  
  /**
   * Initialize storage directory
   * @private
   */
  _initializeStorage() {
    try {
      // Create storage directory if it doesn't exist
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }
    } catch (error) {
      console.error('Error initializing storage directory:', error);
    }
  }
  
  /**
   * Get the path to the context file
   * @private
   * @returns {string} - Path to context file
   */
  _getContextFilePath() {
    return path.join(this.storagePath, `${this.contextId}.json`);
  }
  
  /**
   * Persist context to disk
   * @private
   * @returns {Promise<boolean>} - Success status
   */
  async _persistContext() {
    return new Promise((resolve) => {
      try {
        // Convert context data to serializable format
        const serializedData = {};
        
        for (const [key, entry] of this.contextData.entries()) {
          // Skip non-serializable values
          try {
            JSON.stringify(entry.value);
            serializedData[key] = entry;
          } catch (e) {
            console.warn(`Skipping non-serializable value for key ${key}`);
          }
        }
        
        // Write to file
        fs.writeFileSync(
          this._getContextFilePath(),
          JSON.stringify({
            contextId: this.contextId,
            timestamp: Date.now(),
            data: serializedData
          }, null, 2)
        );
        
        this.emit('contextPersisted', {
          timestamp: Date.now()
        });
        
        resolve(true);
      } catch (error) {
        console.error('Error persisting context:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Load persisted context from disk
   * @private
   * @returns {Promise<boolean>} - Success status
   */
  async _loadPersistedContext() {
    return new Promise((resolve) => {
      try {
        const filePath = this._getContextFilePath();
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          resolve(false);
          return;
        }
        
        // Read and parse file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(fileContent);
        
        // Clear existing data
        this.contextData.clear();
        
        // Load data
        if (parsedData && parsedData.data) {
          for (const [key, entry] of Object.entries(parsedData.data)) {
            this.contextData.set(key, entry);
          }
        }
        
        this.emit('contextLoaded', {
          timestamp: Date.now()
        });
        
        resolve(true);
      } catch (error) {
        console.error('Error loading persisted context:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Set up auto-persist timer
   * @private
   */
  _setupAutoPersist() {
    // Clear existing timer if any
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
    }
    
    // Set up new timer
    this.persistTimer = setInterval(() => {
      this._persistContext();
    }, this.persistInterval);
    
    // Ensure timer doesn't prevent process from exiting
    if (this.persistTimer.unref) {
      this.persistTimer.unref();
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Handle process exit
    process.on('beforeExit', () => {
      this.cleanup();
    });
  }
  
  /**
   * Acquire a lock for a key
   * @private
   * @param {string} key - Key to lock
   */
  _acquireLock(key) {
    // Simple implementation - in a real system, this would be more sophisticated
    if (this.locks.has(key)) {
      throw new Error(`Lock already held for key ${key}`);
    }
    
    this.locks.set(key, Date.now());
  }
  
  /**
   * Release a lock for a key
   * @private
   * @param {string} key - Key to unlock
   */
  _releaseLock(key) {
    this.locks.delete(key);
  }
}

module.exports = AudioProcessingContext;
