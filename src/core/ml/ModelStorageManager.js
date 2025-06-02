/**
 * @fileoverview ModelStorageManager is responsible for managing the storage,
 * retrieval, and organization of machine learning models within Aideon Core.
 * It provides functionality for model file management, caching, and integrity verification.
 * 
 * @module core/ml/ModelStorageManager
 * @requires core/utils/Logger
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('ModelStorageManager');

/**
 * @class ModelStorageManager
 * @extends EventEmitter
 * @description Manager for model storage, retrieval, and organization
 */
class ModelStorageManager extends EventEmitter {
  /**
   * Creates an instance of ModelStorageManager
   * @param {Object} options - Configuration options
   * @param {string} options.basePath - Base path for model storage
   * @param {number} options.cacheSize - Maximum cache size in bytes
   * @param {boolean} options.enableCompression - Whether to enable model compression
   * @param {string} options.compressionLevel - Compression level (high, medium, low)
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      basePath: path.join(process.cwd(), 'models'),
      cacheSize: 10 * 1024 * 1024 * 1024, // 10 GB
      enableCompression: false,
      compressionLevel: 'medium',
      ...options
    };
    
    this.cache = new Map();
    this.cacheSize = 0;
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.ensureStorageReady = this.ensureStorageReady.bind(this);
    this.listModelDirectories = this.listModelDirectories.bind(this);
    this.listModelFiles = this.listModelFiles.bind(this);
    this.getModelPath = this.getModelPath.bind(this);
    this.storeModel = this.storeModel.bind(this);
    this.retrieveModel = this.retrieveModel.bind(this);
    this.deleteModel = this.deleteModel.bind(this);
    this.verifyModelIntegrity = this.verifyModelIntegrity.bind(this);
    this.cacheModel = this.cacheModel.bind(this);
    this.uncacheModel = this.uncacheModel.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelStorageManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelStorageManager already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelStorageManager');
      
      // Ensure storage directory exists
      await this.ensureStorageReady();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelStorageManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelStorageManager: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Ensures the storage directory is ready
   * @async
   * @returns {Promise<boolean>} Storage ready status
   */
  async ensureStorageReady() {
    try {
      logger.debug(`Ensuring storage directory exists: ${this.options.basePath}`);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.options.basePath)) {
        fs.mkdirSync(this.options.basePath, { recursive: true });
        logger.info(`Created storage directory: ${this.options.basePath}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to ensure storage ready: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Lists all model directories
   * @async
   * @returns {Promise<Array<string>>} Array of model directory paths
   */
  async listModelDirectories() {
    try {
      logger.debug(`Listing model directories in ${this.options.basePath}`);
      
      // Ensure storage directory exists
      await this.ensureStorageReady();
      
      // Get all directories in the base path
      const entries = fs.readdirSync(this.options.basePath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(this.options.basePath, entry.name));
      
      logger.debug(`Found ${directories.length} model directories`);
      return directories;
    } catch (error) {
      logger.error(`Failed to list model directories: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Lists all model files in a directory
   * @async
   * @param {string} modelDir - Model directory path
   * @returns {Promise<Array<string>>} Array of model file names
   */
  async listModelFiles(modelDir) {
    try {
      logger.debug(`Listing model files in ${modelDir}`);
      
      // Check if directory exists
      if (!fs.existsSync(modelDir)) {
        logger.warn(`Model directory does not exist: ${modelDir}`);
        return [];
      }
      
      // Get all files in the directory
      const entries = fs.readdirSync(modelDir, { withFileTypes: true });
      const files = entries
        .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
        .map(entry => entry.name);
      
      logger.debug(`Found ${files.length} model files in ${modelDir}`);
      return files;
    } catch (error) {
      logger.error(`Failed to list model files: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets the path for a model
   * @param {string} modelId - Model ID
   * @param {string} [version] - Model version
   * @returns {string} Model path
   */
  getModelPath(modelId, version) {
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    // Sanitize model ID for use in path
    const sanitizedId = modelId.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Create path with or without version
    if (version) {
      return path.join(this.options.basePath, `${sanitizedId}-${version}`);
    } else {
      return path.join(this.options.basePath, sanitizedId);
    }
  }
  
  /**
   * Stores a model
   * @async
   * @param {Object} modelInfo - Model information
   * @param {string} modelInfo.id - Model ID
   * @param {string} modelInfo.version - Model version
   * @param {string} modelInfo.name - Model name
   * @param {Buffer|string} modelInfo.data - Model data or path to model file
   * @param {Object} [modelInfo.metadata] - Model metadata
   * @returns {Promise<Object>} Stored model information
   */
  async storeModel(modelInfo) {
    if (!this.isInitialized) {
      throw new Error('ModelStorageManager not initialized');
    }
    
    if (!modelInfo || !modelInfo.id || !modelInfo.version) {
      throw new Error('Model ID and version are required');
    }
    
    if (!modelInfo.data) {
      throw new Error('Model data is required');
    }
    
    try {
      logger.info(`Storing model: ${modelInfo.id} (version ${modelInfo.version})`);
      
      // Get model directory path
      const modelDir = this.getModelPath(modelInfo.id, modelInfo.version);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      // Determine model file path
      const modelFilePath = path.join(modelDir, `model.bin`);
      
      // Store model data
      if (Buffer.isBuffer(modelInfo.data)) {
        // Store buffer directly
        fs.writeFileSync(modelFilePath, modelInfo.data);
      } else if (typeof modelInfo.data === 'string') {
        // Copy file
        fs.copyFileSync(modelInfo.data, modelFilePath);
      } else {
        throw new Error('Model data must be a Buffer or file path string');
      }
      
      // Calculate checksum
      const checksum = this.calculateChecksum(modelFilePath);
      
      // Store metadata
      const metadata = {
        id: modelInfo.id,
        name: modelInfo.name || modelInfo.id,
        version: modelInfo.version,
        storedAt: Date.now(),
        size: fs.statSync(modelFilePath).size,
        checksum,
        ...(modelInfo.metadata || {})
      };
      
      fs.writeFileSync(
        path.join(modelDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      this.emit('modelStored', modelInfo.id, metadata);
      logger.info(`Model ${modelInfo.id} (version ${modelInfo.version}) stored successfully`);
      
      return {
        ...metadata,
        path: modelDir,
        filePath: modelFilePath
      };
    } catch (error) {
      logger.error(`Failed to store model ${modelInfo.id}: ${error.message}`, error);
      this.emit('modelStoreError', modelInfo.id, error);
      throw error;
    }
  }
  
  /**
   * Retrieves a model
   * @async
   * @param {string} modelId - Model ID
   * @param {string} [version] - Model version
   * @param {boolean} [useCache=true] - Whether to use cache
   * @returns {Promise<Object>} Retrieved model information
   */
  async retrieveModel(modelId, version, useCache = true) {
    if (!this.isInitialized) {
      throw new Error('ModelStorageManager not initialized');
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    try {
      logger.info(`Retrieving model: ${modelId}${version ? ` (version ${version})` : ''}`);
      
      // Check cache if enabled
      const cacheKey = `${modelId}${version ? `-${version}` : ''}`;
      if (useCache && this.cache.has(cacheKey)) {
        logger.debug(`Model ${cacheKey} found in cache`);
        return this.cache.get(cacheKey);
      }
      
      // Get model directory path
      const modelDir = this.getModelPath(modelId, version);
      
      // Check if directory exists
      if (!fs.existsSync(modelDir)) {
        logger.warn(`Model directory not found: ${modelDir}`);
        return null;
      }
      
      // Check for metadata file
      const metadataPath = path.join(modelDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        logger.warn(`Model metadata not found: ${metadataPath}`);
        return null;
      }
      
      // Read metadata
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Determine model file path
      const modelFilePath = path.join(modelDir, `model.bin`);
      
      // Check if model file exists
      if (!fs.existsSync(modelFilePath)) {
        logger.warn(`Model file not found: ${modelFilePath}`);
        return null;
      }
      
      // Verify integrity if checksum exists
      if (metadata.checksum) {
        const isValid = await this.verifyModelIntegrity(modelFilePath, metadata.checksum);
        if (!isValid) {
          logger.error(`Model integrity check failed for ${modelId}`);
          return null;
        }
      }
      
      // Create result object
      const result = {
        ...metadata,
        path: modelDir,
        filePath: modelFilePath
      };
      
      // Cache result if enabled
      if (useCache) {
        this.cacheModel(cacheKey, result);
      }
      
      this.emit('modelRetrieved', modelId, result);
      logger.info(`Model ${modelId}${version ? ` (version ${version})` : ''} retrieved successfully`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to retrieve model ${modelId}: ${error.message}`, error);
      this.emit('modelRetrieveError', modelId, error);
      throw error;
    }
  }
  
  /**
   * Deletes a model
   * @async
   * @param {string} modelId - Model ID
   * @param {string} [version] - Model version
   * @returns {Promise<boolean>} Deletion success status
   */
  async deleteModel(modelId, version) {
    if (!this.isInitialized) {
      throw new Error('ModelStorageManager not initialized');
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    try {
      logger.info(`Deleting model: ${modelId}${version ? ` (version ${version})` : ''}`);
      
      // Get model directory path
      const modelDir = this.getModelPath(modelId, version);
      
      // Check if directory exists
      if (!fs.existsSync(modelDir)) {
        logger.warn(`Model directory not found: ${modelDir}`);
        return false;
      }
      
      // Remove from cache
      const cacheKey = `${modelId}${version ? `-${version}` : ''}`;
      this.uncacheModel(cacheKey);
      
      // Delete directory recursively
      fs.rmSync(modelDir, { recursive: true, force: true });
      
      this.emit('modelDeleted', modelId, version);
      logger.info(`Model ${modelId}${version ? ` (version ${version})` : ''} deleted successfully`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete model ${modelId}: ${error.message}`, error);
      this.emit('modelDeleteError', modelId, error);
      throw error;
    }
  }
  
  /**
   * Verifies model integrity
   * @async
   * @param {string} filePath - Path to model file
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<boolean>} Verification result
   */
  async verifyModelIntegrity(filePath, expectedChecksum) {
    try {
      logger.debug(`Verifying integrity of ${filePath}`);
      
      // Calculate checksum
      const actualChecksum = this.calculateChecksum(filePath);
      
      // Compare checksums
      const isValid = actualChecksum === expectedChecksum;
      
      if (!isValid) {
        logger.warn(`Integrity check failed for ${filePath}. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
      } else {
        logger.debug(`Integrity check passed for ${filePath}`);
      }
      
      return isValid;
    } catch (error) {
      logger.error(`Failed to verify model integrity: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Calculates checksum for a file
   * @param {string} filePath - Path to file
   * @returns {string} Checksum
   */
  calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }
  
  /**
   * Caches a model
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   */
  cacheModel(key, value) {
    // Skip if already in cache
    if (this.cache.has(key)) {
      return;
    }
    
    // Get size of value (approximate)
    const valueSize = JSON.stringify(value).length;
    
    // Check if cache is full
    if (this.cacheSize + valueSize > this.options.cacheSize) {
      // Evict oldest entries until there's enough space
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
      
      let spaceNeeded = valueSize - (this.options.cacheSize - this.cacheSize);
      let index = 0;
      
      while (spaceNeeded > 0 && index < entries.length) {
        const [entryKey, entryValue] = entries[index];
        const entrySize = JSON.stringify(entryValue).length;
        
        this.cache.delete(entryKey);
        this.cacheSize -= entrySize;
        spaceNeeded -= entrySize;
        
        logger.debug(`Evicted ${entryKey} from cache (size: ${entrySize})`);
        index++;
      }
    }
    
    // Add to cache with timestamp
    this.cache.set(key, {
      ...value,
      cachedAt: Date.now()
    });
    
    this.cacheSize += valueSize;
    logger.debug(`Cached ${key} (size: ${valueSize})`);
  }
  
  /**
   * Removes a model from cache
   * @param {string} key - Cache key
   */
  uncacheModel(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      const valueSize = JSON.stringify(value).length;
      
      this.cache.delete(key);
      this.cacheSize -= valueSize;
      
      logger.debug(`Removed ${key} from cache (size: ${valueSize})`);
    }
  }
  
  /**
   * Clears the cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheSize = 0;
    logger.debug('Cache cleared');
  }
  
  /**
   * Shuts down the ModelStorageManager
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelStorageManager not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelStorageManager');
      
      // Clear cache
      this.clearCache();
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelStorageManager shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelStorageManager shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelStorageManager;
