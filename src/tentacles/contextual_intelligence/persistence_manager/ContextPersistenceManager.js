/**
 * @fileoverview Context Persistence Manager for the Contextual Intelligence Tentacle.
 * Handles saving and loading context to/from persistent storage.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone } = require('../../utils/object_utils');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Default file storage provider implementation.
 */
class FileStorageProvider {
  /**
   * Creates a new FileStorageProvider instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.baseDir] - Base directory for storage
   */
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'data', 'contexts');
  }

  /**
   * Initializes the storage provider.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    try {
      // Ensure base directory exists
      await fs.mkdir(this.baseDir, { recursive: true });
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`);
    }
  }

  /**
   * Saves data to storage.
   * @param {string} key - The storage key
   * @param {Object} data - The data to save
   * @returns {Promise<boolean>} - Promise resolving to true if save was successful
   */
  async save(key, data) {
    try {
      const filePath = this._getFilePath(key);
      const dirPath = path.dirname(filePath);
      
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write data to file
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      return true;
    } catch (error) {
      throw new Error(`Failed to save data: ${error.message}`);
    }
  }

  /**
   * Loads data from storage.
   * @param {string} key - The storage key
   * @returns {Promise<Object|null>} - Promise resolving to loaded data or null
   */
  async load(key) {
    try {
      const filePath = this._getFilePath(key);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return null;
      }
      
      // Read and parse data
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Deletes data from storage.
   * @param {string} key - The storage key
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async delete(key) {
    try {
      const filePath = this._getFilePath(key);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return true; // File doesn't exist, consider it deleted
      }
      
      // Delete file
      await fs.unlink(filePath);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete data: ${error.message}`);
    }
  }

  /**
   * Lists all stored keys.
   * @returns {Promise<Array<string>>} - Promise resolving to array of keys
   */
  async list() {
    try {
      const keys = [];
      
      // Recursively scan directory
      await this._scanDirectory(this.baseDir, '', keys);
      
      return keys;
    } catch (error) {
      throw new Error(`Failed to list keys: ${error.message}`);
    }
  }

  /**
   * Recursively scans a directory for context files.
   * @param {string} dir - The directory to scan
   * @param {string} prefix - Key prefix
   * @param {Array<string>} keys - Array to populate with keys
   * @private
   */
  async _scanDirectory(dir, prefix, keys) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectory
          const newPrefix = prefix ? `${prefix}.${entry.name}` : entry.name;
          await this._scanDirectory(entryPath, newPrefix, keys);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Add key for JSON file
          const fileName = entry.name.slice(0, -5); // Remove .json extension
          const key = prefix ? `${prefix}.${fileName}` : fileName;
          keys.push(key);
        }
      }
    } catch (error) {
      // Ignore errors for non-existent directories
    }
  }

  /**
   * Gets the file path for a key.
   * @param {string} key - The storage key
   * @returns {string} - The file path
   * @private
   */
  _getFilePath(key) {
    // Convert key to path
    const keyPath = key.replace(/\./g, path.sep);
    return path.join(this.baseDir, `${keyPath}.json`);
  }
}

/**
 * Handles saving and loading context to/from persistent storage.
 */
class ContextPersistenceManager {
  /**
   * Creates a new ContextPersistenceManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} [options.storageProvider] - Storage provider
   * @param {boolean} [options.encryptionEnabled] - Whether encryption is enabled
   * @param {boolean} [options.compressionEnabled] - Whether compression is enabled
   * @param {string} [options.encryptionKey] - Encryption key
   * @param {EventEmitter} [options.eventEmitter] - Event emitter for persistence events
   */
  constructor(options = {}) {
    this.storageProvider = options.storageProvider || new FileStorageProvider();
    this.encryptionEnabled = options.encryptionEnabled !== undefined ? options.encryptionEnabled : true;
    this.compressionEnabled = options.compressionEnabled !== undefined ? options.compressionEnabled : true;
    this.encryptionKey = options.encryptionKey || 'aideon-context-encryption-key';
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.initialized = false;
    this.saveQueue = new Map();
    this.processingQueue = false;
    this.expirationChecker = null;
    this.expirationCheckInterval = options.expirationCheckInterval || 3600000; // 1 hour
  }

  /**
   * Initializes the Context Persistence Manager.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Initialize storage provider
      await this.storageProvider.initialize();

      // Start expiration checker
      this._startExpirationChecker();

      this.initialized = true;
      this.eventEmitter.emit('persistence:initialized');
      return true;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'initialize',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Starts the expiration checker.
   * @private
   */
  _startExpirationChecker() {
    if (this.expirationChecker) {
      clearInterval(this.expirationChecker);
    }

    this.expirationChecker = setInterval(() => {
      this._checkExpiredContexts();
    }, this.expirationCheckInterval);

    // Ensure the timer doesn't prevent Node from exiting
    if (this.expirationChecker.unref) {
      this.expirationChecker.unref();
    }
  }

  /**
   * Checks for and removes expired contexts.
   * @private
   */
  async _checkExpiredContexts() {
    try {
      // Get all contexts
      const keys = await this.storageProvider.list();
      const now = Date.now();
      let expiredCount = 0;

      for (const key of keys) {
        try {
          // Load context metadata
          const metadata = await this._loadContextMetadata(key);

          if (metadata && metadata.expiration && metadata.expiration < now) {
            // Context has expired
            await this.deleteContext(key);
            expiredCount++;
          }
        } catch (error) {
          this.eventEmitter.emit('persistence:warning', {
            operation: 'checkExpiration',
            key,
            error: error.message
          });
        }
      }

      if (expiredCount > 0) {
        this.eventEmitter.emit('persistence:expired', {
          count: expiredCount
        });
      }
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'checkExpiredContexts',
        error: error.message
      });
    }
  }

  /**
   * Loads context metadata.
   * @param {string} path - The context path
   * @returns {Promise<Object|null>} - Promise resolving to metadata or null
   * @private
   */
  async _loadContextMetadata(path) {
    try {
      // Try to load just the metadata
      const context = await this.loadContext(path, { metadataOnly: true });
      
      if (context && context._persistence) {
        return {
          expiration: context._persistence.expiration
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Saves a context to persistent storage.
   * @param {string} path - The context path
   * @param {Object} context - The context to save
   * @param {Object} [options] - Save options
   * @param {boolean} [options.immediate=false] - Whether to save immediately or queue
   * @returns {Promise<boolean>} - Promise resolving to true if save was successful
   */
  async saveContext(path, context, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }

      // Clone context to avoid modifications
      const contextToSave = deepClone(context);

      // Add metadata if not present
      if (!contextToSave._persistence) {
        contextToSave._persistence = {
          savedAt: Date.now()
        };
      } else {
        contextToSave._persistence.savedAt = Date.now();
      }

      // Calculate expiration if specified
      if (contextToSave._persistence.expiration && typeof contextToSave._persistence.expiration === 'string') {
        contextToSave._persistence.expiration = this._calculateExpirationTimestamp(
          contextToSave._persistence.expiration
        );
      }

      // Process immediately or add to queue
      if (options.immediate) {
        return await this._processSave(path, contextToSave);
      } else {
        this.saveQueue.set(path, contextToSave);
        this._processQueue();
        return true;
      }
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'saveContext',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Processes the save queue.
   * @private
   */
  async _processQueue() {
    if (this.processingQueue || this.saveQueue.size === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      const entries = Array.from(this.saveQueue.entries());
      this.saveQueue.clear();

      for (const [path, context] of entries) {
        try {
          await this._processSave(path, context);
        } catch (error) {
          this.eventEmitter.emit('persistence:warning', {
            operation: 'processQueue',
            path,
            error: error.message
          });
        }
      }
    } finally {
      this.processingQueue = false;

      // Check if more items were added to the queue
      if (this.saveQueue.size > 0) {
        setImmediate(() => this._processQueue());
      }
    }
  }

  /**
   * Processes a single save operation.
   * @param {string} path - The context path
   * @param {Object} context - The context to save
   * @returns {Promise<boolean>} - Promise resolving to true if save was successful
   * @private
   */
  async _processSave(path, context) {
    try {
      // Prepare data for storage
      let data = context;

      // Compress if enabled
      if (this.compressionEnabled) {
        data = await this._compressData(data);
      }

      // Encrypt if enabled
      if (this.encryptionEnabled) {
        data = await this._encryptData(data);
      }

      // Save to storage
      await this.storageProvider.save(path, data);

      this.eventEmitter.emit('persistence:saved', {
        path,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'processSave',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Loads a context from persistent storage.
   * @param {string} path - The context path
   * @param {Object} [options] - Load options
   * @param {boolean} [options.metadataOnly=false] - Whether to load only metadata
   * @returns {Promise<Object|null>} - Promise resolving to loaded context or null
   */
  async loadContext(path, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Load from storage
      const data = await this.storageProvider.load(path);

      if (!data) {
        return null;
      }

      // Decrypt if needed
      let context = data;
      if (this.encryptionEnabled && data._encrypted) {
        context = await this._decryptData(data);
      }

      // Decompress if needed
      if (this.compressionEnabled && context._compressed) {
        context = await this._decompressData(context);
      }

      // Return only metadata if requested
      if (options.metadataOnly) {
        return {
          _type: context._type,
          _persistence: context._persistence
        };
      }

      this.eventEmitter.emit('persistence:loaded', {
        path,
        timestamp: Date.now()
      });

      return context;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'loadContext',
        path,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Loads all contexts from persistent storage.
   * @returns {Promise<Object>} - Promise resolving to object with paths as keys and contexts as values
   */
  async loadAllContexts() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const keys = await this.storageProvider.list();
      const contexts = {};

      for (const key of keys) {
        try {
          const context = await this.loadContext(key);
          if (context) {
            contexts[key] = context;
          }
        } catch (error) {
          this.eventEmitter.emit('persistence:warning', {
            operation: 'loadAllContexts',
            key,
            error: error.message
          });
        }
      }

      return contexts;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'loadAllContexts',
        error: error.message
      });
      return {};
    }
  }

  /**
   * Deletes a context from persistent storage.
   * @param {string} path - The context path
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteContext(path) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }

      // Remove from save queue if present
      this.saveQueue.delete(path);

      // Delete from storage
      await this.storageProvider.delete(path);

      this.eventEmitter.emit('persistence:deleted', {
        path,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'deleteContext',
        path,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Lists all persisted contexts.
   * @returns {Promise<Array<string>>} - Promise resolving to array of context paths
   */
  async listContexts() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await this.storageProvider.list();
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'listContexts',
        error: error.message
      });
      return [];
    }
  }

  /**
   * Compresses data.
   * @param {Object} data - The data to compress
   * @returns {Promise<Object>} - Promise resolving to compressed data
   * @private
   */
  async _compressData(data) {
    // This is a simplified implementation
    // In a real implementation, use a compression library
    return {
      ...data,
      _compressed: true
    };
  }

  /**
   * Decompresses data.
   * @param {Object} data - The data to decompress
   * @returns {Promise<Object>} - Promise resolving to decompressed data
   * @private
   */
  async _decompressData(data) {
    // This is a simplified implementation
    // In a real implementation, use a compression library
    const result = { ...data };
    delete result._compressed;
    return result;
  }

  /**
   * Encrypts data.
   * @param {Object} data - The data to encrypt
   * @returns {Promise<Object>} - Promise resolving to encrypted data
   * @private
   */
  async _encryptData(data) {
    try {
      // Convert data to string
      const dataString = JSON.stringify(data);
      
      // Create cipher
      const iv = crypto.randomBytes(16);
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(dataString, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return {
        _encrypted: true,
        _iv: iv.toString('hex'),
        data: encrypted
      };
    } catch (error) {
      // Fall back to unencrypted if encryption fails
      return {
        ...data,
        _encryptionFailed: true
      };
    }
  }

  /**
   * Decrypts data.
   * @param {Object} data - The data to decrypt
   * @returns {Promise<Object>} - Promise resolving to decrypted data
   * @private
   */
  async _decryptData(data) {
    try {
      // Check if data is encrypted
      if (!data._encrypted || !data._iv || !data.data) {
        throw new Error('Data is not properly encrypted');
      }
      
      // Create decipher
      const iv = Buffer.from(data._iv, 'hex');
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt data
      let decrypted = decipher.update(data.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse decrypted data
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  /**
   * Calculates an expiration timestamp from a duration string.
   * @param {string} duration - Duration string (e.g., '1d', '2h', '30m')
   * @returns {number} - Expiration timestamp
   * @private
   */
  _calculateExpirationTimestamp(duration) {
    if (!duration || typeof duration !== 'string') {
      return null;
    }

    const now = Date.now();
    const match = duration.match(/^(\d+)([dhms])$/);

    if (!match) {
      return null;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd': // days
        return now + value * 24 * 60 * 60 * 1000;
      case 'h': // hours
        return now + value * 60 * 60 * 1000;
      case 'm': // minutes
        return now + value * 60 * 1000;
      case 's': // seconds
        return now + value * 1000;
      default:
        return null;
    }
  }

  /**
   * Gets statistics about persisted contexts.
   * @returns {Promise<Object>} - Promise resolving to statistics object
   */
  async getStatistics() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const keys = await this.storageProvider.list();
      const stats = {
        totalContexts: keys.length,
        byType: {},
        expiring: 0,
        encrypted: 0,
        compressed: 0
      };

      for (const key of keys) {
        try {
          // Load context metadata
          const context = await this.loadContext(key, { metadataOnly: true });
          
          if (context) {
            // Count by type
            const type = context._type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // Count expiring contexts
            if (context._persistence && context._persistence.expiration) {
              stats.expiring++;
            }
            
            // Count encrypted and compressed contexts
            if (context._encrypted) {
              stats.encrypted++;
            }
            
            if (context._compressed) {
              stats.compressed++;
            }
          }
        } catch (error) {
          // Ignore errors for individual contexts
        }
      }

      return stats;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'getStatistics',
        error: error.message
      });
      return {
        totalContexts: 0,
        byType: {},
        error: error.message
      };
    }
  }

  /**
   * Configures the persistence manager.
   * @param {Object} config - Configuration options
   * @param {boolean} [config.encryptionEnabled] - Whether encryption is enabled
   * @param {boolean} [config.compressionEnabled] - Whether compression is enabled
   * @param {string} [config.encryptionKey] - Encryption key
   * @param {number} [config.expirationCheckInterval] - Interval for checking expirations
   * @returns {Promise<boolean>} - Promise resolving to true if configuration was successful
   */
  async configure(config) {
    try {
      if (config.encryptionEnabled !== undefined) {
        this.encryptionEnabled = config.encryptionEnabled;
      }
      
      if (config.compressionEnabled !== undefined) {
        this.compressionEnabled = config.compressionEnabled;
      }
      
      if (config.encryptionKey) {
        this.encryptionKey = config.encryptionKey;
      }
      
      if (config.expirationCheckInterval) {
        this.expirationCheckInterval = config.expirationCheckInterval;
        this._startExpirationChecker();
      }
      
      this.eventEmitter.emit('persistence:configured', {
        encryptionEnabled: this.encryptionEnabled,
        compressionEnabled: this.compressionEnabled,
        expirationCheckInterval: this.expirationCheckInterval
      });
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'configure',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Shuts down the Context Persistence Manager.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    try {
      if (!this.initialized) {
        return true;
      }

      // Process any remaining items in the save queue
      if (this.saveQueue.size > 0) {
        await this._processQueue();
      }

      // Stop expiration checker
      if (this.expirationChecker) {
        clearInterval(this.expirationChecker);
        this.expirationChecker = null;
      }

      this.initialized = false;
      this.eventEmitter.emit('persistence:shutdown');
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('persistence:error', {
        operation: 'shutdown',
        error: error.message
      });
      return false;
    }
  }
}

module.exports = ContextPersistenceManager;
