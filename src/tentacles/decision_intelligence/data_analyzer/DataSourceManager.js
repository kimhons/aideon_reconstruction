/**
 * @fileoverview Data Source Manager for the Data Analyzer component
 * 
 * This component is responsible for managing and accessing various data sources
 * used in decision analysis, including local files, databases, and APIs.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const fs = require('fs').promises;
const path = require('path');

/**
 * Data Source Manager for the Data Analyzer component
 */
class DataSourceManager {
  /**
   * Creates a new instance of the Data Source Manager
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('DataSourceManager');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      supportedDataSources: config.supportedDataSources || ['csv', 'json', 'database', 'api'],
      cacheTTL: config.cacheTTL || 3600000, // 1 hour in milliseconds
      maxCacheSize: config.maxCacheSize || 100 * 1024 * 1024 // 100 MB
    };
    
    // Data source adapters
    this.adapters = {};
    
    // Data cache
    this.cache = new Map();
    this.cacheSize = 0;
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.manageSources = this.manageSources.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Data Source Manager
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Data Source Manager');
    
    try {
      // Initialize adapters for supported data sources
      await this._initializeAdapters();
      
      this.initialized = true;
      this.logger.info('Data Source Manager initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'dataSourceManager' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Initializes adapters for supported data sources
   * @private
   * @returns {Promise<void>} A promise that resolves when adapters are initialized
   */
  async _initializeAdapters() {
    this.logger.info('Initializing data source adapters');
    
    // Initialize adapters based on supported data sources
    for (const source of this.config.supportedDataSources) {
      try {
        switch (source) {
          case 'csv':
            this.adapters.csv = this._createCsvAdapter();
            break;
          case 'json':
            this.adapters.json = this._createJsonAdapter();
            break;
          case 'database':
            this.adapters.database = this._createDatabaseAdapter();
            break;
          case 'api':
            this.adapters.api = this._createApiAdapter();
            break;
          default:
            this.logger.warn(`Unsupported data source: ${source}`);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize adapter for ${source}`, error);
        // Continue with other adapters even if one fails
      }
    }
    
    this.logger.info('Data source adapters initialized', {
      adapters: Object.keys(this.adapters)
    });
  }
  
  /**
   * Creates an adapter for CSV data sources
   * @private
   * @returns {Object} The CSV adapter
   */
  _createCsvAdapter() {
    return {
      name: 'csv',
      parse: async (content, options = {}) => {
        // Simple CSV parsing implementation
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        return lines.slice(1).map(line => {
          const values = line.split(',').map(value => value.trim());
          const record = {};
          
          headers.forEach((header, index) => {
            record[header] = values[index] || '';
          });
          
          return record;
        });
      },
      fetch: async (source, options = {}) => {
        if (source.filePath) {
          const content = await fs.readFile(source.filePath, 'utf8');
          return this.adapters.csv.parse(content, options);
        } else if (source.content) {
          return this.adapters.csv.parse(source.content, options);
        } else {
          throw new Error('CSV source must provide filePath or content');
        }
      }
    };
  }
  
  /**
   * Creates an adapter for JSON data sources
   * @private
   * @returns {Object} The JSON adapter
   */
  _createJsonAdapter() {
    return {
      name: 'json',
      parse: async (content, options = {}) => {
        return JSON.parse(content);
      },
      fetch: async (source, options = {}) => {
        if (source.filePath) {
          const content = await fs.readFile(source.filePath, 'utf8');
          return this.adapters.json.parse(content, options);
        } else if (source.content) {
          return this.adapters.json.parse(source.content, options);
        } else {
          throw new Error('JSON source must provide filePath or content');
        }
      }
    };
  }
  
  /**
   * Creates an adapter for database data sources
   * @private
   * @returns {Object} The database adapter
   */
  _createDatabaseAdapter() {
    return {
      name: 'database',
      fetch: async (source, options = {}) => {
        if (!source.query) {
          throw new Error('Database source must provide a query');
        }
        
        if (!this.aideon || !this.aideon.database) {
          throw new Error('Database service not available');
        }
        
        // Execute query using Aideon database service
        return this.aideon.database.query(source.query, source.params || {});
      }
    };
  }
  
  /**
   * Creates an adapter for API data sources
   * @private
   * @returns {Object} The API adapter
   */
  _createApiAdapter() {
    return {
      name: 'api',
      fetch: async (source, options = {}) => {
        if (!source.url) {
          throw new Error('API source must provide a URL');
        }
        
        if (!this.aideon || !this.aideon.http) {
          throw new Error('HTTP service not available');
        }
        
        // Make request using Aideon HTTP service
        const response = await this.aideon.http.request({
          method: source.method || 'GET',
          url: source.url,
          headers: source.headers || {},
          data: source.data || null,
          timeout: source.timeout || 30000
        });
        
        return response.data;
      }
    };
  }
  
  /**
   * Shuts down the Data Source Manager
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Data Source Manager');
    
    try {
      // Clear cache
      this.cache.clear();
      this.cacheSize = 0;
      
      this.initialized = false;
      this.logger.info('Data Source Manager shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'dataSourceManager' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Data Source Manager
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      adapters: Object.keys(this.adapters),
      cacheSize: this.cacheSize,
      cacheEntries: this.cache.size
    };
  }
  
  /**
   * Fetches data from a specified source
   * @param {Object} source The data source specification
   * @param {Object} options Fetch options
   * @returns {Promise<Object>} A promise that resolves with the fetched data
   */
  async fetchData(source, options = {}) {
    if (!this.initialized) {
      throw new Error('Data Source Manager not initialized');
    }
    
    if (!source) {
      throw new Error('Source is required');
    }
    
    this.logger.info('Fetching data', {
      sourceType: source.type,
      useCache: options.useCache !== false
    });
    
    // Generate cache key
    const cacheKey = this._generateCacheKey(source);
    
    // Check cache if enabled
    if (options.useCache !== false) {
      const cachedData = this._getFromCache(cacheKey);
      if (cachedData) {
        this.logger.info('Using cached data');
        return cachedData;
      }
    }
    
    try {
      // Get appropriate adapter
      const adapter = this._getAdapter(source.type);
      
      // Fetch data using adapter
      const data = await adapter.fetch(source, options);
      
      // Cache data if enabled
      if (options.useCache !== false) {
        this._addToCache(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch data', error);
      throw error;
    }
  }
  
  /**
   * Manages data sources (add, update, remove)
   * @param {Object} params Management parameters
   * @returns {Promise<Object>} A promise that resolves with the management result
   */
  async manageSources(params) {
    if (!this.initialized) {
      throw new Error('Data Source Manager not initialized');
    }
    
    if (!params) {
      throw new Error('Parameters are required');
    }
    
    this.logger.info('Managing data sources', {
      action: params.action
    });
    
    try {
      switch (params.action) {
        case 'add':
          return await this._addSource(params.source);
        case 'update':
          return await this._updateSource(params.id, params.source);
        case 'remove':
          return await this._removeSource(params.id);
        case 'list':
          return await this._listSources(params.filter);
        default:
          throw new Error(`Unsupported action: ${params.action}`);
      }
    } catch (error) {
      this.logger.error('Failed to manage sources', error);
      throw error;
    }
  }
  
  /**
   * Gets an adapter for a specified data source type
   * @private
   * @param {string} type The data source type
   * @returns {Object} The adapter
   * @throws {Error} If the adapter is not available
   */
  _getAdapter(type) {
    const adapter = this.adapters[type];
    
    if (!adapter) {
      throw new Error(`No adapter available for data source type: ${type}`);
    }
    
    return adapter;
  }
  
  /**
   * Generates a cache key for a data source
   * @private
   * @param {Object} source The data source
   * @returns {string} The cache key
   */
  _generateCacheKey(source) {
    // Simple JSON stringification for cache key
    // In production, would use a more robust hashing algorithm
    return `${source.type}:${JSON.stringify(source)}`;
  }
  
  /**
   * Gets data from the cache
   * @private
   * @param {string} key The cache key
   * @returns {Object|null} The cached data or null if not found or expired
   */
  _getFromCache(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Adds data to the cache
   * @private
   * @param {string} key The cache key
   * @param {Object} data The data to cache
   */
  _addToCache(key, data) {
    // Estimate size of data
    const size = this._estimateSize(data);
    
    // Check if adding this entry would exceed max cache size
    if (size > this.config.maxCacheSize) {
      this.logger.warn('Data too large to cache', {
        size,
        maxCacheSize: this.config.maxCacheSize
      });
      return;
    }
    
    // Make room in cache if necessary
    this._evictCacheEntries(size);
    
    // Add to cache
    this.cache.set(key, {
      data,
      size,
      expiry: Date.now() + this.config.cacheTTL
    });
    
    this.cacheSize += size;
  }
  
  /**
   * Evicts cache entries to make room for new data
   * @private
   * @param {number} requiredSize The size needed
   */
  _evictCacheEntries(requiredSize) {
    // If cache is already under limit, no need to evict
    if (this.cacheSize + requiredSize <= this.config.maxCacheSize) {
      return;
    }
    
    // Sort entries by expiry (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiry - b[1].expiry);
    
    // Evict entries until we have enough space
    for (const [key, entry] of entries) {
      if (this.cacheSize + requiredSize <= this.config.maxCacheSize) {
        break;
      }
      
      this.cache.delete(key);
      this.cacheSize -= entry.size;
    }
  }
  
  /**
   * Estimates the size of data in bytes
   * @private
   * @param {*} data The data to estimate size for
   * @returns {number} The estimated size in bytes
   */
  _estimateSize(data) {
    // Simple size estimation
    return Buffer.from(JSON.stringify(data)).length;
  }
  
  /**
   * Adds a new data source
   * @private
   * @param {Object} source The data source to add
   * @returns {Promise<Object>} A promise that resolves with the add result
   */
  async _addSource(source) {
    // Implementation depends on how sources are stored
    // This is a placeholder implementation
    return {
      success: true,
      message: 'Source added successfully',
      source
    };
  }
  
  /**
   * Updates an existing data source
   * @private
   * @param {string} id The source ID
   * @param {Object} source The updated source
   * @returns {Promise<Object>} A promise that resolves with the update result
   */
  async _updateSource(id, source) {
    // Implementation depends on how sources are stored
    // This is a placeholder implementation
    return {
      success: true,
      message: 'Source updated successfully',
      id,
      source
    };
  }
  
  /**
   * Removes a data source
   * @private
   * @param {string} id The source ID
   * @returns {Promise<Object>} A promise that resolves with the remove result
   */
  async _removeSource(id) {
    // Implementation depends on how sources are stored
    // This is a placeholder implementation
    return {
      success: true,
      message: 'Source removed successfully',
      id
    };
  }
  
  /**
   * Lists data sources
   * @private
   * @param {Object} filter Filter criteria
   * @returns {Promise<Object>} A promise that resolves with the list result
   */
  async _listSources(filter) {
    // Implementation depends on how sources are stored
    // This is a placeholder implementation
    return {
      success: true,
      sources: []
    };
  }
}

module.exports = { DataSourceManager };
